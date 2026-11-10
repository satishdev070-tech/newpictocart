import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const script = join(process.cwd(), "scripts/ci/validate-worker-secrets.mts");

function run(payload: Record<string, string>, extraArgs: string[] = []) {
  const dir = mkdtempSync(join(tmpdir(), "worker-secrets-"));
  const file = join(dir, "secrets.json");
  writeFileSync(file, JSON.stringify(payload));
  return spawnSync("pnpm", ["exec", "tsx", script, file, ...extraArgs], {
    encoding: "utf8",
    cwd: process.cwd(),
    env: { ...process.env, FORCE_COLOR: "0" },
  });
}

const base = {
  APP_SECRET: "a".repeat(40),
  CRON_SECRET: "c".repeat(32),
  SUPABASE_SECRET_KEY: "sb_secret_xxxxxxxxxxxxxxxxxxxxxxxx",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_xxxxxxxxxxxxxxxxxxxx",
  NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN: "pictocart.in",
  NEXT_PUBLIC_PLATFORM_URL: "https://www.pictocart.in",
  EMAIL_FROM: "Pictocart <no-reply@pictocart.in>",
  RESEND_API_KEY: "re_test_xxxxxxxxxxxxxxxxxxxx",
};

describe("validate-worker-secrets", () => {
  it("accepts a complete wipe-safe secrets file", () => {
    const r = run(base);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("serverEnvSchema: ok");
    expect(r.stdout).toContain("wipe-safe secrets: ok");
  });

  it("rejects a 9-key subset that omits EMAIL_FROM and Resend", () => {
    const { EMAIL_FROM: _e, RESEND_API_KEY: _r, ...nine } = base;
    const r = run(nine);
    expect(r.status).toBe(1);
    expect(r.stderr + r.stdout).toMatch(/EMAIL_FROM/);
    expect(r.stderr + r.stdout).toMatch(/RESEND_API_KEY/);
  });

  it("allows omitting RESEND_API_KEY only with --allow-db-resend", () => {
    const { RESEND_API_KEY: _r, ...noResend } = base;
    const denied = run(noResend);
    expect(denied.status).toBe(1);
    const allowed = run(noResend, ["--allow-db-resend"]);
    expect(allowed.status).toBe(0);
    expect(allowed.stdout).toMatch(/allow-db-resend/);
  });
});
