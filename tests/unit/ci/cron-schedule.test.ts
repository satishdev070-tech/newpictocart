import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contract: every scheduled /api/cron/* route is called by .github/workflows/cron.yml, every
 * schedule in `on.schedule` is mapped to paths, and every mapped path is a real route.
 * (cron.yml is the manual-run tool; the pictocart-cron Worker runs the schedules, ADR-043.)
 */
const CRON_DIR = "src/app/api/cron";
/** Ops probes, not jobs: called by deploy verification, never on a schedule. */
const NOT_SCHEDULED = new Set(["preview-token-self-test"]);

const workflow = readFileSync(".github/workflows/cron.yml", "utf8");
const routes = readdirSync(CRON_DIR).filter((d) => existsSync(join(CRON_DIR, d, "route.ts")));
const schedules = [...workflow.matchAll(/^\s*- cron: "([^"]+)"/gm)].map((m) => m[1]!);
const mapped = new Map([...workflow.matchAll(/^\s*"([^"]+)"\)\s+paths="([^"]+)"/gm)].map((m) => [m[1]!, m[2]!.split(/\s+/)]));
const manualOptions = (workflow.match(/options:\s*\[([^\]]+)\]/)?.[1] ?? "").split(",").map((s) => s.trim());

describe("cron.yml schedules every cron route", () => {
  it("finds the cron routes and schedules", () => {
    expect(routes.length).toBeGreaterThan(1);
    expect(schedules.length).toBeGreaterThan(0);
  });

  it("maps every schedule to paths", () => {
    for (const s of schedules) expect(mapped.has(s), `schedule "${s}" has no paths`).toBe(true);
  });

  it("schedules every job route exactly once", () => {
    const all = [...mapped.values()].flat();
    for (const r of routes.filter((r) => !NOT_SCHEDULED.has(r))) {
      expect(all.filter((p) => p === r), `/api/cron/${r}`).toHaveLength(1);
    }
  });

  it("only calls routes that exist, and offers each one for a manual run", () => {
    for (const p of [...mapped.values()].flat()) {
      expect(routes, p).toContain(p);
      expect(manualOptions, p).toContain(p);
    }
  });

  it("stays off unless explicitly enabled and never targets staging", () => {
    expect(workflow).toMatch(/if: github\.event_name == 'workflow_dispatch' \|\| vars\.PRODUCTION_CRON_ENABLED == 'true'/);
    expect(workflow).toContain("BASE_URL: https://www.pictocart.in");
    expect(workflow).not.toMatch(/pictocartdev\.in/);
  });
});

describe("deploy-worker.yml tags each Worker with its role", () => {
  const deploy = readFileSync(".github/workflows/deploy-worker.yml", "utf8");
  it("writes DEPLOY_WORKER_ROLE for the platform Worker and overrides it for the storefront", () => {
    expect(deploy).toContain('"DEPLOY_WORKER_ROLE": "platform"');
    expect(deploy).toContain('d["DEPLOY_WORKER_ROLE"] = "storefront"');
  });
  it("never lets staging deploy a production Worker name", () => {
    expect(deploy).toMatch(/staging\) case "\$SF_WORKER_NAME" in pictocart\|pictocart-storefront\)/);
  });
});

describe("deploy-worker.yml active-deployment check", () => {
  const deploy = readFileSync(".github/workflows/deploy-worker.yml", "utf8");
  it("matches a SHA prefix, because Cloudflare truncates a first deployment's message to 50 chars", () => {
    expect(deploy).toContain('os.environ["DEPLOY_SHA"][:12] in m');
    const sha = "9ca503e9a24437138232769fb5f2b52dcc464790";
    const truncated = `gha:staging:${sha.slice(0, 35)}...`;
    expect(truncated.length).toBe(50);
    expect(truncated).toContain(sha.slice(0, 12));
  });
});

describe("deploy-worker.yml rollback", () => {
  const deploy = readFileSync(".github/workflows/deploy-worker.yml", "utf8");
  it("forces the rollback deployment (DEPLOY_COMMIT_SHA changes every deploy; Cloudflare error 10220 otherwise)", () => {
    const rollback = deploy.slice(deploy.indexOf("rollback() {"), deploy.indexOf("rolled back to $2"));
    expect(rollback).toContain('"$api?force=true"');
  });
});

describe("cron.yml uptime check", () => {
  const wf = readFileSync(".github/workflows/cron.yml", "utf8");
  it("checks platform readiness and the Worker role of the platform and a store host", () => {
    expect(wf).toContain("Uptime and routing check");
    expect(wf).toContain("https://www.pictocart.in/api/health/ready");
    expect(wf).toMatch(/role='\$r' \(want platform\)/);
    expect(wf).toContain("vars.PRODUCTION_UPTIME_STORE_HOST");
  });
});

describe("cloudflare.config.ts", () => {
  const cfg = readFileSync("cloudflare.config.ts", "utf8");
  it("declares Workers Logs with query strings redacted, so deploys cannot switch them off", () => {
    expect(cfg).toMatch(/observability:\s*{\s*enabled: true,\s*redactQueryString: true/);
  });
});
