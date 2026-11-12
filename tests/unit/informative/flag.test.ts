import { afterEach, describe, expect, it } from "vitest";
import { canCreateInformative, informativeFlagMode, informativeFlagOn, parseInformativeFlag } from "@/features/informative/flag";
import { parseEnv, serverEnvSchema } from "@/lib/env/schema";

const prev = process.env.FEATURE_INFORMATIVE_WEBSITE;
afterEach(() => {
  if (prev === undefined) delete process.env.FEATURE_INFORMATIVE_WEBSITE;
  else process.env.FEATURE_INFORMATIVE_WEBSITE = prev;
});

describe("FEATURE_INFORMATIVE_WEBSITE", () => {
  it("is off unless explicitly internal or all", () => {
    for (const v of [undefined, null, "", "off", "false", "true", "on", "yes", "1"]) expect(parseInformativeFlag(v)).toBe("off");
    expect(parseInformativeFlag("internal")).toBe("internal");
    expect(parseInformativeFlag(" ALL ")).toBe("all");
  });

  it("reads the server env at call time", () => {
    delete process.env.FEATURE_INFORMATIVE_WEBSITE;
    expect(informativeFlagMode()).toBe("off");
    process.env.FEATURE_INFORMATIVE_WEBSITE = "internal";
    expect(informativeFlagMode()).toBe("internal");
  });

  it("creation: off nobody, internal platform staff only, all everyone", () => {
    expect(canCreateInformative("off", { platformStaff: true })).toBe(false);
    expect(canCreateInformative("internal", { platformStaff: false })).toBe(false);
    expect(canCreateInformative("internal", { platformStaff: true })).toBe(true);
    expect(canCreateInformative("all", { platformStaff: false })).toBe(true);
    expect(informativeFlagOn("off")).toBe(false);
    expect(informativeFlagOn("internal")).toBe(true);
  });

  it("is optional in the server env schema and rejects unknown values", () => {
    const base = {
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_xxxxxxxxxxxxxxxx",
      NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN: "pictocart.in",
      SUPABASE_SECRET_KEY: "sb_secret_xxxxxxxxxxxxxxxxxxxx",
      APP_SECRET: "x".repeat(32),
    };
    expect(parseEnv(serverEnvSchema, base).FEATURE_INFORMATIVE_WEBSITE).toBeUndefined();
    expect(parseEnv(serverEnvSchema, { ...base, FEATURE_INFORMATIVE_WEBSITE: "all" }).FEATURE_INFORMATIVE_WEBSITE).toBe("all");
    expect(() => parseEnv(serverEnvSchema, { ...base, FEATURE_INFORMATIVE_WEBSITE: "yes" })).toThrow();
  });
});
