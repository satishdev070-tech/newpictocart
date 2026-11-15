import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import worker, { runJobs, type Env } from "../../../workers/cron/src/index";
import { SCHEDULES } from "../../../workers/cron/src/schedule";

/** Contract + behaviour of the pictocart-cron Worker (ADR-043). */
const CRON_DIR = "src/app/api/cron";
const NOT_SCHEDULED = new Set(["preview-token-self-test"]);
const routes = readdirSync(CRON_DIR).filter((d) => existsSync(join(CRON_DIR, d, "route.ts")));
const config = readFileSync("workers/cron/cloudflare.config.ts", "utf8");
const workflow = readFileSync(".github/workflows/cron.yml", "utf8");

describe("cron Worker schedule contract", () => {
  it("runs every scheduled job route exactly once", () => {
    const all = Object.values(SCHEDULES).flat();
    for (const r of routes.filter((r) => !NOT_SCHEDULED.has(r))) expect(all.filter((p) => p === r), r).toHaveLength(1);
    for (const p of all) expect(routes, p).toContain(p);
  });

  it("declares exactly the SCHEDULES keys as Cron Triggers (Free plan: at most 5)", () => {
    const declared = [...config.matchAll(/triggers\.scheduled\(\{ schedule: "([^"]+)" \}\)/g)].map((m) => m[1]);
    expect(declared.sort()).toEqual(Object.keys(SCHEDULES).sort());
    expect(declared.length).toBeLessThanOrEqual(5);
  });

  it("matches the manual-run mapping in cron.yml", () => {
    const mapped = Object.fromEntries([...workflow.matchAll(/^\s*"([^"]+)"\)\s+paths="([^"]+)"/gm)].map((m) => [m[1]!, m[2]!.split(/\s+/)]));
    expect(mapped).toEqual(Object.fromEntries(Object.entries(SCHEDULES).map(([k, v]) => [k, [...v]])));
  });

  it("is production-only, private, and calls the platform Worker by service binding", () => {
    expect(config).toContain('name: "pictocart-cron"');
    expect(config).toContain('APP: bindings.worker({ worker: "pictocart" })');
    expect(config).toContain('APP_ORIGIN: bindings.text("https://www.pictocart.in")');
    expect(config).toContain("CRON_SECRET: bindings.secret()");
    expect(config).toContain("workersDev: false");
    expect(config).not.toMatch(/pictocartdev|staging/);
  });
});

function env(responder: (url: string, auth: string | null) => Response | Promise<Response>): Env & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    CRON_SECRET: "s".repeat(48),
    APP_ORIGIN: "https://www.pictocart.in",
    APP: {
      fetch: async (req: Request) => {
        calls.push(req.url);
        return responder(req.url, req.headers.get("authorization"));
      },
    },
  };
}

describe("cron Worker behaviour", () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  it("calls each job of the trigger with the bearer secret", async () => {
    const e = env((_u, auth) => new Response(auth === `Bearer ${"s".repeat(48)}` ? '{"ok":1}' : "no", { status: auth ? 200 : 401 }));
    const r = await runJobs("*/5 * * * *", e);
    expect(e.calls).toEqual(["https://www.pictocart.in/api/cron/expire-orders", "https://www.pictocart.in/api/cron/notifications"]);
    expect(r.every((x) => x.ok)).toBe(true);
  });

  it("sends the platform Host header (the app routes by Host; without it every job 404s)", async () => {
    const hosts: (string | null)[] = [];
    const e = env(() => new Response("{}", { status: 200 }));
    const inner = e.APP.fetch;
    e.APP.fetch = async (req: Request) => {
      hosts.push(req.headers.get("host"));
      return inner(req);
    };
    await runJobs("23 2 * * *", e);
    expect(hosts).toEqual(["www.pictocart.in", "www.pictocart.in"]);
  });

  it("runs every job even if one fails, then fails the invocation", async () => {
    const e = env((u) => new Response("x", { status: u.endsWith("expire-orders") ? 500 : 200 }));
    await expect(worker.scheduled({ cron: "*/5 * * * *" }, e)).rejects.toThrow(/expire-orders=500/);
    expect(e.calls).toHaveLength(2);
  });

  it("treats a network error as a failed job", async () => {
    const e = env(() => Promise.reject(new Error("boom")));
    const r = await runJobs("23 2 * * *", e);
    expect(r.map((x) => [x.job, x.ok, x.status])).toEqual([["gbp-reviews", false, 0], ["observability", false, 0]]);
  });

  it("refuses an unmapped trigger or a missing secret", async () => {
    await expect(runJobs("0 0 * * *", env(() => new Response("")))).rejects.toThrow(/no jobs mapped/);
    await expect(runJobs("*/5 * * * *", { ...env(() => new Response("")), CRON_SECRET: "" })).rejects.toThrow(/CRON_SECRET/);
  });

  it("answers any HTTP request with 404 (no public surface)", async () => {
    expect((await worker.fetch()).status).toBe(404);
  });
});
