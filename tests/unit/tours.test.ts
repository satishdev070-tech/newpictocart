import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES } from "@/lib/i18n/config";
import { TOUR_IDS, tourForPath } from "@/features/dashboard-ui/tours/routes";
import { TOURS, stepTargets } from "@/features/dashboard-ui/tours/steps";
import { placePopover } from "@/features/dashboard-ui/tours/position";
import { en } from "@/features/dashboard-ui/tours/text/en";
import { hi } from "@/features/dashboard-ui/tours/text/hi";

const TEXT = { en, hi };

/** Every `data-tour="x"` / `tour="x"` written in the source tree. */
function sourceTourIds(): Set<string> {
  const ids = new Set<string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".tsx")) for (const m of readFileSync(p, "utf8").matchAll(/\b(?:data-tour|tour)="([a-z0-9-]+)"/g)) ids.add(m[1]!);
    }
  };
  walk(join(process.cwd(), "src"));
  return ids;
}

describe("tour routes", () => {
  it("matches pages, sub-pages by UUID only, and ignores the rest", () => {
    expect(tourForPath("/dashboard")).toBe("home");
    expect(tourForPath("/dashboard/")).toBe("home");
    expect(tourForPath("/dashboard/products")).toBe("products");
    expect(tourForPath("/dashboard/products/new")).toBe("productNew");
    expect(tourForPath("/dashboard/products/import")).toBeNull();
    expect(tourForPath("/dashboard/orders/9548acc6-3a62-43fe-b42f-1b0e7e83fd4f")).toBe("orderDetail");
    expect(tourForPath("/dashboard/orders/9548acc6-3a62-43fe-b42f-1b0e7e83fd4f/invoice")).toBeNull();
    expect(tourForPath("/dashboard/settings/shipping")).toBe("shipping");
    expect(tourForPath("/dashboard/analytics")).toBeNull();
    expect(tourForPath("/admin")).toBeNull();
  });
});

describe("tour steps", () => {
  const ids = sourceTourIds();

  it.each(TOUR_IDS)("%s: steps exist, ids unique, targets present in the source", (tour) => {
    const steps = TOURS[tour];
    expect(steps.length).toBeGreaterThan(0);
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
    expect(steps.some((s) => stepTargets(s).length)).toBe(true);
    for (const s of steps) for (const target of stepTargets(s)) expect(ids.has(target), `${tour}.${s.id} → data-tour="${target}"`).toBe(true);
  });

  it.each(LOCALES)("%s text covers exactly every step", (l) => {
    const text = TEXT[l];
    expect(Object.keys(text).sort()).toEqual([...TOUR_IDS].sort());
    for (const tour of TOUR_IDS) {
      expect(Object.keys(text[tour]).sort(), tour).toEqual(TOURS[tour].map((s) => s.id).sort());
      for (const [step, { title, body }] of Object.entries(text[tour])) {
        expect(title.trim(), `${tour}.${step}`).not.toBe("");
        expect(body.trim(), `${tour}.${step}`).not.toBe("");
      }
    }
  });
});

describe("popover placement", () => {
  const vp = { width: 1280, height: 800 };
  const pop = { width: 340, height: 180 };

  it("docks as a bottom sheet on phones", () => {
    expect(placePopover({ top: 100, left: 10, width: 300, height: 50 }, pop, { width: 375, height: 812 }).side).toBe("sheet");
  });
  it("centres when there is no target", () => {
    expect(placePopover(null, pop, vp)).toMatchObject({ side: "center", left: (1280 - 340) / 2 });
  });
  it("prefers below, then above, and stays on screen", () => {
    expect(placePopover({ top: 100, left: 1200, width: 60, height: 40 }, pop, vp)).toMatchObject({ side: "bottom", left: 1280 - 340 - 12 });
    expect(placePopover({ top: 700, left: 100, width: 200, height: 60 }, pop, vp).side).toBe("top");
  });
});
