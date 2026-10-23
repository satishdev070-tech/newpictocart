import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public-config read module", () => {
  it("does not import sharp (auth/marketing must stay sharp-free)", () => {
    const src = readFileSync(new URL("../../../src/features/platform/server/public-config.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/from ["']sharp["']/);
    expect(src).not.toMatch(/import\s+sharp\b/);
  });

  it("keeps sharp in the write-only branding-images module", () => {
    const src = readFileSync(new URL("../../../src/features/platform/server/branding-images.ts", import.meta.url), "utf8");
    expect(src).toMatch(/from ["']sharp["']/);
  });
});
