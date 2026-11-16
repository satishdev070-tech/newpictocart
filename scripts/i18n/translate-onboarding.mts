/**
 * Generate the static onboarding dictionaries with Sarvam Translate (never called at runtime).
 *
 *   set -a; source .env.local; set +a
 *   pnpm exec tsx scripts/i18n/translate-onboarding.mts [--only=start|informative] [--locales=ta-IN,bn-IN] [--force] [--dry-run] [--paths=build.title,…]
 *
 * Reads the English dictionaries (START_EN in src/features/start/copy.ts, INFO_EN in
 * src/features/start/i18n/info-copy.ts), turns function entries into `{placeholder}` templates,
 * translates every string and writes one TS file per locale plus an index:
 *   src/features/start/i18n/start/<locale>.ts        (all START_UI_LOCALES except en-IN and hi-IN,
 *                                                     which are hand-written in copy.ts)
 *   src/features/start/i18n/informative/<locale>.ts  (all START_UI_LOCALES except en-IN)
 *   src/features/start/i18n/voice/<locale>.ts        (Tara call console; except en-IN and hi-IN)
 *
 * Split headlines (title + orange accent) are translated as one sentence, then split before the
 * last word, so word order stays natural. --paths=a.b,c.d re-translates just those keys.
 *
 * Re-running keeps strings already in a locale file (so hand edits survive) and only fills missing
 * keys; pass --force to re-translate everything. Brand/product terms (Pictocart, Tara, UPI, OTP,
 * Google, WhatsApp, …), ₹ amounts, arrows and `{placeholders}` are kept as-is. A string whose
 * placeholders or brand terms don't survive is retried, then left out (the app shows English).
 * Review the diff before committing.
 */
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { GLOSSARY } from "./glossary";

// Keep the Sarvam client's per-call warnings (rate limits are retried here) out of the output.
process.env.LOG_LEVEL = "error";

// src/lib/sarvam/client.ts imports "server-only", which throws outside a React Server bundle.
register(
  "data:text/javascript," +
    encodeURIComponent(
      `export async function resolve(s, c, next) { if (s === "server-only") return { url: "data:text/javascript,", format: "module", shortCircuit: true }; return next(s, c); }`,
    ),
);

const ROOT = path.resolve(import.meta.dirname, "../..");
const src = (p: string) => pathToFileURL(path.join(ROOT, "src", p)).href;

const { translateText, chatTurn } = (await import(src("lib/sarvam/client.ts"))) as typeof import("../../src/lib/sarvam/client");
const { START_EN, START_COPY_PARAMS } = (await import(src("features/start/copy.ts"))) as typeof import("../../src/features/start/copy");
const { INFO_EN, INFO_COPY_PARAMS } = (await import(src("features/start/i18n/info-copy.ts"))) as typeof import("../../src/features/start/i18n/info-copy");
const { VOICE_EN, VOICE_COPY_PARAMS } = (await import(src("features/start/components/voice/voice-copy.ts"))) as typeof import("../../src/features/start/components/voice/voice-copy");
const { START_UI_LOCALES } = (await import(src("features/start/supported-locales.ts"))) as typeof import("../../src/features/start/supported-locales");
const { toTemplates, leaves, at, placeholdersOf } = (await import(src("features/start/i18n/templates.ts"))) as typeof import("../../src/features/start/i18n/templates");

// ---------------------------------------------------------------------------------------------
// CLI

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k!, v ?? "true"] as const;
  }),
);
const FORCE = args.get("force") === "true";
const DRY = args.get("dry-run") === "true";
const ONLY = args.get("only");
const LOCALES = args.get("locales")?.split(",").filter(Boolean);
const PATHS = args.get("paths")?.split(",").filter(Boolean);
/** `chat` (default): ~50 strings per Sarvam chat call — fast. `translate`: one Translate call per string (slow, rate-limited). */
const ENGINE = args.get("engine") ?? "chat";

if (!process.env.SARVAM_API_KEY && !DRY) {
  console.error("SARVAM_API_KEY is not set. Run: set -a; source .env.local; set +a");
  process.exit(1);
}

type Dict = {
  name: "start" | "informative" | "voice";
  dir: string;
  constPrefix: string;
  typeName: string;
  typeImport: string;
  english: unknown;
  /** Locales with hand-written copy are skipped. */
  skip: readonly string[];
  /** [title, accent] paths rendered as one headline. */
  pairs?: readonly (readonly [string, string])[];
};

const DICTS: Dict[] = [
  {
    name: "start",
    dir: path.join(ROOT, "src/features/start/i18n/start"),
    constPrefix: "START",
    typeName: "StartCopyTranslation",
    typeImport: "../../copy",
    english: toTemplates(START_EN, START_COPY_PARAMS),
    skip: ["en-IN", "hi-IN"],
    pairs: [
      ["build.title", "build.titleAccent"],
      ["theme.title", "theme.titleAccent"],
      ["account.title", "account.titleAccent"],
      ["account.signInTitle", "account.signInTitleAccent"],
      ["account.codeTitle", "account.codeTitleAccent"],
      ["done.title", "done.titleAccent"],
    ],
  },
  {
    name: "informative",
    dir: path.join(ROOT, "src/features/start/i18n/informative"),
    constPrefix: "INFO",
    typeName: "InfoCopyTranslation",
    typeImport: "../info-copy",
    english: toTemplates(INFO_EN, INFO_COPY_PARAMS),
    skip: ["en-IN"],
  },
  {
    name: "voice",
    dir: path.join(ROOT, "src/features/start/i18n/voice"),
    constPrefix: "VOICE",
    typeName: "VoiceUiCopyTranslation",
    typeImport: "../../components/voice/voice-copy",
    english: toTemplates(VOICE_EN, VOICE_COPY_PARAMS),
    skip: ["en-IN", "hi-IN"],
  },
];

// ---------------------------------------------------------------------------------------------
// One string

/** Terms that must stay in Latin script. `Tara` may come back transliterated (it is a name). */
const BRAND_TERMS = ["Pictocart", "Tara", "UPI", "OTP", "Google", "WhatsApp", "Instagram", "AI", "PNG", "JPG", "WebP", "MB"];
const STRICT_BRANDS = BRAND_TERMS.filter((t) => t !== "Tara");
const BRAND_RE = new RegExp(`(?<![\\p{L}{])(${BRAND_TERMS.join("|")})(?![\\p{L}}])`, "gu");
const PREFIX_RE = /^[\s←✦+✓]*/u;
const SUFFIX_RE = /[\s→…,:]*$/u;

function brandsIn(s: string): string[] {
  return [...new Set([...s.matchAll(BRAND_RE)].map((m) => m[1]!))];
}

/** Whether `s` has any words to translate once placeholders and brand terms are removed. */
function hasWords(s: string): boolean {
  return /\p{L}{2,}/u.test(s.replace(/\{[^}]*\}/g, "").replace(BRAND_RE, ""));
}

function problems(source: string, out: string): string[] {
  const issues: string[] = [];
  if (placeholdersOf(source).join("|") !== placeholdersOf(out).join("|")) issues.push(`placeholders ${placeholdersOf(out).join(",") || "none"}`);
  if (/[{}]/.test(out.replace(/\{[a-zA-Z][a-zA-Z0-9]*\}/g, ""))) issues.push("stray braces");
  for (const b of brandsIn(source)) if (STRICT_BRANDS.includes(b) && !out.includes(b)) issues.push(`lost ${b}`);
  if (source.includes("₹") && !out.includes("₹")) issues.push("lost ₹");
  if (out.trim() === source.trim()) issues.push("untranslated");
  return issues;
}

async function translateCore(core: string, locale: string): Promise<string> {
  const wrapped = core.replace(BRAND_RE, "{$1}");
  const { translatedText } = await translateText({ text: wrapped, sourceLanguageCode: "en-IN", targetLanguageCode: locale });
  let out = translatedText.trim();
  for (const b of BRAND_TERMS) out = out.replaceAll(`{${b}}`, b);
  // The model adds a full stop / danda to fragments; keep the source's ending.
  if (!/[.!?।]$/u.test(core)) out = out.replace(/\s*[.।]+$/u, "");
  return out.replace(/\s*-\s+/g, " — ").replace(/\s{2,}/g, " ");
}

const cache = new Map<string, Promise<string | null>>();

/** Translate one dictionary string (null when it can't be translated safely). */
function translateString(source: string, locale: string): Promise<string | null> {
  const key = `${locale}\u0000${source}`;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      const prefix = source.match(PREFIX_RE)?.[0] ?? "";
      const rest = source.slice(prefix.length);
      const suffix = rest.match(SUFFIX_RE)?.[0] ?? "";
      const core = rest.slice(0, rest.length - suffix.length);
      if (!hasWords(core)) return source;
      const fixed = GLOSSARY[core]?.[locale];
      if (fixed) return `${prefix}${fixed}${suffix}`;
      let last: string[] = [];
      // translateText returns the English on errors (429s included), seen here as "untranslated".
      for (let attempt = 0; attempt < 6; attempt++) {
        if (attempt) await new Promise((r) => setTimeout(r, 1500 * 2 ** (attempt - 1)));
        const out = await translateCore(core, locale);
        last = problems(core, out);
        if (!last.length) return `${prefix}${out}${suffix}`;
      }
      console.warn(`  ! ${locale} kept English for ${JSON.stringify(source)} (${last.join("; ")})`);
      return null;
    })();
    cache.set(key, p);
  }
  return p;
}

const LANGUAGE_NAMES: Record<string, string> = {
  "hi-IN": "Hindi", "bn-IN": "Bengali", "ta-IN": "Tamil", "te-IN": "Telugu", "mr-IN": "Marathi",
  "gu-IN": "Gujarati", "kn-IN": "Kannada", "ml-IN": "Malayalam", "pa-IN": "Punjabi (Gurmukhi)", "od-IN": "Odia",
};

/**
 * Batch engine: one chat call translates up to 50 UI strings (JSON in, JSON out). Every result is
 * still checked with `problems()`; failures fall back to the single-string Translate path.
 */
async function translateBatch(items: [string, string][], locale: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const input: Record<string, string> = {};
  items.forEach(([, en], i) => {
    input[String(i)] = en.replace(BRAND_RE, "{$1}");
  });
  const system = [
    `You translate short UI strings of an Indian e-commerce onboarding app from English to ${LANGUAGE_NAMES[locale] ?? locale}.`,
    "Use natural, simple, friendly everyday language a small shop owner uses (not formal/literary). Keep it concise like UI text.",
    "Keep every {placeholder} exactly as written (same braces and name). Words wrapped in braces like {Pictocart} are brand names: keep them exactly, braces included.",
    "Keep ₹ amounts, numbers, arrows (→ ←), emoji and punctuation style. Do not add a trailing full stop if the source has none.",
    'Reply with one JSON object only, same keys as the input, values translated. No markdown.',
  ].join("\n");
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const turn = await chatTurn({ messages: [{ role: "system", content: system }, { role: "user", content: JSON.stringify(input) }], temperature: 0.2, maxTokens: 8192 });
      const text = turn.content;
      const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as Record<string, unknown>;
      items.forEach(([p, en], i) => {
        const raw = json[String(i)];
        if (typeof raw !== "string") return;
        let t = raw.trim();
        for (const b of BRAND_TERMS) t = t.replaceAll(`{${b}}`, b);
        const prefix = en.match(PREFIX_RE)?.[0] ?? "";
        const core = en.slice(prefix.length);
        if (!/[.!?]$/u.test(core.trim())) t = t.replace(/\s*[.।]+$/u, "");
        if (!problems(en.trim(), t).length || (!hasWords(en))) out.set(p, t);
      });
      return out;
    } catch (err) {
      console.warn(`  ! ${locale} batch attempt ${attempt + 1} failed: ${String(err).slice(0, 120)}`);
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Files

async function existing(dict: Dict, locale: string): Promise<unknown> {
  const file = path.join(dict.dir, `${locale}.ts`);
  if (!existsSync(file)) return {};
  const mod = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
  return mod[constName(dict, locale)] ?? {};
}

function constName(dict: Dict, locale: string): string {
  return `${dict.constPrefix}_${locale.replace("-", "_").toUpperCase()}`;
}

/** Rebuild the English-shaped tree from translated leaves (missing leaves → omitted / undefined in arrays). */
function build(english: unknown, values: Map<string, string>, p = ""): unknown {
  if (typeof english === "string") return values.get(p);
  if (Array.isArray(english)) return english.map((v, i) => build(v, values, p ? `${p}.${i}` : String(i)));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(english as Record<string, unknown>)) {
    const child = build(v, values, p ? `${p}.${k}` : k);
    if (child !== undefined && !(typeof child === "object" && child && !Array.isArray(child) && !Object.keys(child).length)) out[k] = child;
  }
  return out;
}

function serialize(value: unknown, indent = ""): string {
  const next = `${indent}  `;
  if (value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[\n${value.map((v) => `${next}${serialize(v, next)},`).join("\n")}\n${indent}]`;
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return "{}";
  return `{\n${entries
    .map(([k, v]) => `${next}${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${serialize(v, next)},`)
    .join("\n")}\n${indent}}`;
}

async function writeIndex(dict: Dict) {
  const locales = START_UI_LOCALES.filter((l) => !dict.skip.includes(l) && existsSync(path.join(dict.dir, `${l}.ts`)));
  const lines = [
    "// Generated by scripts/i18n/translate-onboarding.mts. Do not edit by hand.",
    `import type { ${dict.typeName} } from "${dict.typeImport}";`,
    ...locales.map((l) => `import { ${constName(dict, l)} } from "./${l}";`),
    "",
    `export const ${dict.constPrefix}_TRANSLATIONS: Readonly<Record<string, ${dict.typeName}>> = {`,
    ...locales.map((l) => `  "${l}": ${constName(dict, l)},`),
    "};",
    "",
  ];
  await writeFile(path.join(dict.dir, "index.ts"), lines.join("\n"));
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) await fn(items[i++]!);
  }));
}

for (const dict of DICTS) {
  if (ONLY && ONLY !== dict.name) continue;
  const englishLeaves = leaves(dict.english);
  for (const locale of START_UI_LOCALES) {
    if (dict.skip.includes(locale) || (LOCALES && !LOCALES.includes(locale))) continue;
    const prev = FORCE ? {} : await existing(dict, locale);
    const values = new Map<string, string>();
    const todo: [string, string][] = [];
    const paired = new Set((dict.pairs ?? []).flat());
    for (const [p, en] of englishLeaves) {
      if (paired.has(p)) continue;
      if (PATHS?.includes(p)) {
        todo.push([p, en]);
        continue;
      }
      const kept = at(prev, p);
      const core = en.replace(PREFIX_RE, "").replace(SUFFIX_RE, "");
      if (GLOSSARY[core]?.[locale]) todo.push([p, en]);
      else if (typeof kept === "string" && kept.trim() && placeholdersOf(kept).join("|") === placeholdersOf(en).join("|")) values.set(p, kept);
      else todo.push([p, en]);
    }
    console.log(`${dict.name} ${locale}: ${values.size} kept, ${todo.length} to translate (+ ${dict.pairs?.length ?? 0} headlines)${DRY ? " (dry run)" : ""}`);
    if (DRY) continue;
    const pairTodo: (readonly [string, string])[] = [];
    for (const [tp, ap] of dict.pairs ?? []) {
      const t = at(prev, tp);
      const a = at(prev, ap);
      if (!PATHS?.some((x) => x === tp || x === ap) && typeof t === "string" && t.trim() && typeof a === "string" && a.trim()) {
        values.set(tp, t);
        values.set(ap, a);
      } else pairTodo.push([tp, ap]);
    }
    let rest = todo;
    if (ENGINE === "chat") {
      const chunks: [string, string][][] = [];
      for (let i = 0; i < todo.length; i += 50) chunks.push(todo.slice(i, i + 50));
      const done = new Set<string>();
      await pool(chunks, 3, async (chunk) => {
        const got = await translateBatch(chunk, locale);
        for (const [p, t] of got) {
          values.set(p, t);
          done.add(p);
        }
      });
      rest = todo.filter(([p]) => !done.has(p));
      console.log(`  ${locale}: batch translated ${done.size}/${todo.length}; ${rest.length} via Translate`);
    }
    await pool(rest, 2, async ([p, en]) => {
      const out = await translateString(en, locale);
      if (out != null) values.set(p, out);
    });
    await pool([...pairTodo], 2, async ([tp, ap]) => {
      const title = String(at(dict.english, tp));
      const accent = String(at(dict.english, ap));
      const out = await translateString(`${title.trim()} ${accent.trim()}`, locale);
      const m = out?.match(/^(.*\S)\s+(\S+)$/su);
      if (!m) return;
      values.set(tp, title.endsWith(" ") ? `${m[1]} ` : m[1]!);
      values.set(ap, m[2]!);
    });
    const body = [
      "// Generated by scripts/i18n/translate-onboarding.mts (Sarvam Translate) from the English dictionary,",
      "// then reviewed. Hand edits are kept on re-runs; missing keys fall back to English.",
      `import type { ${dict.typeName} } from "${dict.typeImport}";`,
      "",
      `export const ${constName(dict, locale)}: ${dict.typeName} = ${serialize(build(dict.english, values))};`,
      "",
    ].join("\n");
    await writeFile(path.join(dict.dir, `${locale}.ts`), body);
    console.log(`  wrote ${path.relative(ROOT, path.join(dict.dir, `${locale}.ts`))} (${values.size}/${englishLeaves.length})`);
  }
  if (!DRY) await writeIndex(dict);
}
