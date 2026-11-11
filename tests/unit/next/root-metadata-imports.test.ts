import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The vinext Worker build links the proxy, root layout/error/not-found and root metadata routes
 * (sitemap, robots) into the RSC entry that EVERY request loads on a cold isolate. A static import
 * of heavy data or SDKs there is parsed and evaluated before any page renders and eats the
 * Worker CPU budget (Error 1102 "Worker exceeded resource limits", Nov 2026). Heavy modules must
 * be imported lazily (`await import(...)`) inside the handler instead.
 */
const ALWAYS_LOADED = [
  "src/proxy.ts",
  "src/app/layout.tsx",
  "src/app/not-found.tsx",
  "src/app/error.tsx",
  "src/app/global-error.tsx",
  "src/app/sitemap.ts",
  "src/app/robots.ts",
];

const HEAVY = [
  /^@\/features\/theme\/marketplace\/(catalog|themes|presets)/,
  /^@\/features\/marketing-site\/server\//,
  /^@\/features\/observability\/(observe-proxy|server)/,
  /^@\/lib\/observability\/server\//,
  /^@\/lib\/cache\//,
  /^@\/lib\/supabase\/admin/,
  /^@upstash\/redis/,
];

/** Value (non-type) static import specifiers. */
function staticImports(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/^\s*import\s+(?!type\b)(?:[^'";]*?\s+from\s+)?["']([^"']+)["']/gm)) out.push(m[1] ?? "");
  for (const m of src.matchAll(/^\s*export\s+(?!type\b)[^'";]*?\s+from\s+["']([^"']+)["']/gm)) out.push(m[1] ?? "");
  return out;
}

describe("always-loaded Worker modules stay light", () => {
  it("parses static vs dynamic imports", () => {
    const src = 'import a from "@upstash/redis";\nimport type { X } from "@/lib/cache/x";\nconst y = await import("@/lib/cache/y");';
    expect(staticImports(src)).toEqual(["@upstash/redis"]);
  });

  it.each(ALWAYS_LOADED)("%s has no static import of heavy modules", (file) => {
    const bad = staticImports(readFileSync(file, "utf8")).filter((spec) => HEAVY.some((re) => re.test(spec)));
    expect(bad).toEqual([]);
  });
});
