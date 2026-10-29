#!/usr/bin/env tsx
/**
 * Theme customizer QA smoke — lists Phase F checklist IDs (no browser / e2e).
 *
 *   pnpm exec tsx scripts/dev/theme-customizer-qa/smoke.mts
 *   pnpm exec tsx scripts/dev/theme-customizer-qa/smoke.mts --phase A1
 */

import { QA_PHASES, THEME_CUSTOMIZER_QA, checklistByPhase, type QaPhase } from "./checklist";

const args = process.argv.slice(2);
const phaseIdx = args.indexOf("--phase");
const phaseArg = phaseIdx >= 0 ? args[phaseIdx + 1] : undefined;
const json = args.includes("--json");

function isPhase(v: string | undefined): v is QaPhase {
  return !!v && (QA_PHASES as readonly string[]).includes(v);
}

const items = isPhase(phaseArg) ? checklistByPhase(phaseArg) : [...THEME_CUSTOMIZER_QA];

if (json) {
  console.log(JSON.stringify(items.map(({ id, phase, title, coverage }) => ({ id, phase, title, coverage })), null, 2));
  process.exit(0);
}

console.log(`Theme customizer QA checklist (${items.length} items)`);
let current: string | null = null;
for (const item of items) {
  if (item.phase !== current) {
    current = item.phase;
    console.log(`\n## Phase ${current}`);
  }
  const auto = item.coverage === "manual" ? "manual" : item.coverage;
  console.log(`  ${item.id}  [${auto}]  ${item.title}`);
}

console.log(`\nPhases: ${QA_PHASES.join(", ")}`);
console.log("Docs: docs/THEME_CUSTOMIZER_QA.md");
