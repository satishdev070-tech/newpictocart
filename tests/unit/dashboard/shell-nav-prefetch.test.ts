import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * App Router viewport prefetch on every shell nav Link storms RSC flights and can
 * cascade into route-error / React #185 under load. Shell nav must opt out with
 * prefetch={false}; idle allowlist + hover warm remain intentional.
 */
describe("shell nav Link viewport prefetch", () => {
  it("disables default Link prefetch on app-shell nav Links (≥3)", () => {
    const src = readFileSync(
      new URL("../../../src/components/app-shell/app-shell-client.tsx", import.meta.url),
      "utf8",
    );
    const matches = src.match(/prefetch=\{false\}/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });

  it("disables default Link prefetch on SidebarLink", () => {
    const src = readFileSync(
      new URL("../../../src/components/app-shell/sidebar-link.tsx", import.meta.url),
      "utf8",
    );
    expect(src).toMatch(/prefetch=\{false\}/);
  });
});
