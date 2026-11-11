import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { layerFirstAppearance, layerOrderViolation } from "@/lib/css/layer-order";

function cssFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...cssFiles(p));
    else if (p.endsWith(".css")) out.push(p);
  }
  return out;
}

describe("css layer order guard", () => {
  it("flags a stylesheet that opens with @layer components (the production storefront bug)", () => {
    const css = "/* c */ @layer components { .sf-container { padding-inline: 1rem } }";
    expect(layerFirstAppearance(css)).toEqual(["components"]);
    expect(layerOrderViolation(css)).toMatch(/start the file with/);
  });

  it("accepts a stylesheet that pins the full order first", () => {
    const css = "@layer properties, theme, base, components, utilities;\n@layer components{.a{b:c}}";
    expect(layerOrderViolation(css)).toBeNull();
    // lightningcss output: unused trailing layers dropped from the statement.
    expect(layerOrderViolation("@layer properties,theme,base;@layer components{.a{b:c}}")).toBeNull();
    // Out of order is still caught.
    expect(layerOrderViolation("@layer properties,base,theme;@layer components{}")).toMatch(/start the file/);
  });

  it("accepts Tailwind's own emitted order and files without layers", () => {
    const tw = "@layer properties{@supports (x:y){*{--a:0}}}@layer theme{:root{--c:red}}@layer base{*{margin:0}}@layer components;@layer utilities{.p-4{padding:1rem}}";
    expect(layerOrderViolation(tw)).toBeNull();
    expect(layerOrderViolation("@page { size: A4 } .x { color: red }")).toBeNull();
  });

  it("ignores @layer text inside comments and nested blocks", () => {
    expect(layerFirstAppearance("/* @layer components {} */ .a{}")).toEqual([]);
    expect(layerFirstAppearance("@media print { @layer components { .a{} } }")).toEqual([]);
  });

  it("every source stylesheet in src/ is safe in any load order", () => {
    const bad = cssFiles("src")
      .filter((f) => !f.endsWith("globals.css")) // Tailwind entry: @import "tailwindcss" declares the order.
      .map((f) => [f, layerOrderViolation(readFileSync(f, "utf8"))] as const)
      .filter(([, v]) => v);
    expect(bad).toEqual([]);
  });
});
