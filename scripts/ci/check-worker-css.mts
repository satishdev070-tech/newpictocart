/**
 * Post-build guard for the vinext Worker CSS (run after `pnpm build:vinext` in CI).
 *
 * 1. Every emitted stylesheet that uses Tailwind's cascade layers pins the full layer order
 *    (see src/lib/css/layer-order.ts) so load order on the page cannot flip preflight over components.
 * 2. Key storefront and platform rules exist in the emitted CSS, so a missed import or a
 *    Tailwind source-scanning gap cannot ship silently.
 *
 * Usage: tsx scripts/ci/check-worker-css.mts [assetsDir]
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { layerOrderViolation } from "../../src/lib/css/layer-order";

const root = process.argv[2] ?? ".cloudflare/output/v0/workers/default/assets";

/** Selectors (as minified CSS rule starts) that the storefront and platform UI depend on. */
const REQUIRED_RULES = [
  ".sf-root{",
  ".sf-container{",
  ".sf-section{",
  ".sf-heading{",
  ".sf-btn{",
  ".sf-skel{",
  // Tailwind utilities used by storefront section renderers (source scanning must reach them).
  ".mx-auto{",
  ".grid{",
  ".max-w-",
  // Platform marketing @utility.
  ".mk-container{",
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".css")) out.push(p);
  }
  return out;
}

let files: string[];
try {
  files = walk(root);
} catch {
  console.error(`check-worker-css: ${root} not found. Run \`pnpm build:vinext\` first.`);
  process.exit(1);
}
if (files.length === 0) {
  console.error(`check-worker-css: no CSS files under ${root}.`);
  process.exit(1);
}

const problems: string[] = [];
let all = "";
for (const f of files) {
  const css = readFileSync(f, "utf8");
  all += css + "\n";
  const v = layerOrderViolation(css);
  if (v) problems.push(`${relative(process.cwd(), f)}: ${v}`);
}
for (const rule of REQUIRED_RULES) {
  if (!all.includes(rule)) problems.push(`missing CSS rule \`${rule}\` in the Worker build output`);
}

if (problems.length) {
  console.error("check-worker-css failed:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log(`check-worker-css: ${files.length} stylesheets OK (layer order pinned, ${REQUIRED_RULES.length} key rules present).`);
