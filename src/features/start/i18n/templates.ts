/**
 * Static onboarding dictionaries (no runtime translation). English is the source of truth; other
 * locales are plain-string "template" trees generated once by scripts/i18n/translate-onboarding.mts
 * and reviewed by hand. Function-valued entries (e.g. `codeSentTo(email)`) are stored as templates
 * with `{named}` placeholders and rebuilt into functions here. Any key a locale lacks (or whose
 * placeholders don't match English) falls back to English.
 */

/** A dictionary with every function replaced by its template string. */
export type Templates<T> = T extends (...args: never[]) => string
  ? string
  : T extends readonly unknown[]
    ? { [K in keyof T]: Templates<T[K]> }
    : T extends object
      ? { [K in keyof T]: Templates<T[K]> }
      : T;

/** What a generated locale file holds: any subset of the template tree. */
export type DeepPartial<T> = T extends string
  ? T
  : T extends readonly (infer E)[]
    ? readonly (DeepPartial<E> | undefined)[]
    : T extends object
      ? { readonly [K in keyof T]?: DeepPartial<T[K]> }
      : T;

export type Translation<T> = DeepPartial<Templates<T>>;

/** Placeholder names for each function-valued entry, by dotted path (e.g. `account.codeSentTo`). */
export type ParamNames = Readonly<Record<string, readonly string[]>>;

const PLACEHOLDER_RE = /\{([a-zA-Z][a-zA-Z0-9]*)\}/g;

/** Sorted `{placeholder}` names in a template (with repeats removed). */
export function placeholdersOf(template: string): string[] {
  return [...new Set([...template.matchAll(PLACEHOLDER_RE)].map((m) => m[1]!))].sort();
}

export function fillTemplate(template: string, names: readonly string[], args: readonly unknown[]): string {
  return template.replace(PLACEHOLDER_RE, (whole, name: string) => {
    const i = names.indexOf(name);
    return i === -1 ? whole : String(args[i] ?? "");
  });
}

function join(path: string, key: string | number): string {
  return path ? `${path}.${key}` : String(key);
}

/** English dictionary → template tree (functions called with `{name}` placeholders). */
export function toTemplates<T>(source: T, params: ParamNames, path = ""): Templates<T> {
  if (typeof source === "function") {
    const names = params[path];
    if (!names) throw new Error(`No placeholder names for function entry "${path}"`);
    return (source as (...a: string[]) => string)(...names.map((n) => `{${n}}`)) as Templates<T>;
  }
  if (Array.isArray(source)) return source.map((v, i) => toTemplates(v, params, join(path, i))) as Templates<T>;
  if (source && typeof source === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(source)) out[k] = toTemplates(v, params, join(path, k));
    return out as Templates<T>;
  }
  return source as Templates<T>;
}

function samePlaceholders(a: string, b: string): boolean {
  return placeholdersOf(a).join("|") === placeholdersOf(b).join("|");
}

/**
 * English dictionary + a (partial) translation → a full dictionary of the English shape.
 * Strings missing/blank or with placeholders that differ from English fall back to English.
 */
export function localize<T>(en: T, translation: unknown, params: ParamNames, path = ""): T {
  if (typeof en === "function") {
    const names = params[path] ?? [];
    const english = toTemplates(en, params, path) as unknown as string;
    if (typeof translation !== "string" || !translation.trim() || !samePlaceholders(english, translation)) return en;
    return ((...args: unknown[]) => fillTemplate(translation, names, args)) as T;
  }
  if (typeof en === "string") {
    if (typeof translation !== "string" || !translation.trim() || !samePlaceholders(en, translation)) return en;
    return translation as T;
  }
  if (Array.isArray(en)) {
    const tr = Array.isArray(translation) ? translation : [];
    return en.map((v, i) => localize(v, tr[i], params, join(path, i))) as T;
  }
  if (en && typeof en === "object") {
    const tr = translation && typeof translation === "object" ? (translation as Record<string, unknown>) : {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(en)) out[k] = localize(v, tr[k], params, join(path, k));
    return out as T;
  }
  return en;
}

/** Every leaf of a template tree as [dotted path, string]. */
export function leaves(tree: unknown, path = ""): [string, string][] {
  if (typeof tree === "string") return [[path, tree]];
  if (Array.isArray(tree)) return tree.flatMap((v, i) => leaves(v, join(path, i)));
  if (tree && typeof tree === "object") return Object.entries(tree).flatMap(([k, v]) => leaves(v, join(path, k)));
  return [];
}

/** Value at a dotted path (array indexes are numeric segments). */
export function at(tree: unknown, path: string): unknown {
  let cur: unknown = tree;
  for (const seg of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}
