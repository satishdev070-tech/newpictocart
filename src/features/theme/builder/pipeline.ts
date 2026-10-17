import type { IndustrySlug } from "@/features/stores/industries";
import type { PromptImage } from "@/features/neural-pulse/prompts";
import { FetchGuardError, type SafeFetchResult } from "./fetch-guard";
import { stylesheetLinks, summarizeReference, type ReferenceSummary } from "./extract";
import { buildThemePrompt } from "./prompt";
import { aiThemeDraftSchema, repairDraft, validateBuiltTheme, type AiThemeDraft, type BuiltTheme } from "./schema";
import { fillThemeImages, type StockFetcher } from "./images";

/**
 * "Create theme from URL + screenshot" (no framework imports, so a script can run it too):
 * fetch + summarise the reference → AI theme draft → repair → strict validation (one regeneration
 * with the validation issues if it still fails) → Unsplash photos for every image slot.
 */

export type ThemeBuildInput = { name: string; industry: IndustrySlug; url: string | null; screenshots: PromptImage[] };

export type Generated = { data: AiThemeDraft; provider: string; model: string; attempts: number };
export type ThemeBuildDeps = {
  fetchText: (url: string, opts?: { accept?: "html" | "css"; maxBytes?: number; timeoutMs?: number }) => Promise<SafeFetchResult>;
  generate: (prompt: ReturnType<typeof buildThemePrompt> & { images?: PromptImage[] }, schema: typeof aiThemeDraftSchema) => Promise<Generated>;
  fetchStock: StockFetcher;
};

export class ThemeBuildError extends Error {
  constructor(
    readonly reason: "reference" | "invalid",
    message: string,
    readonly issues: string[] = [],
  ) {
    super(message);
    this.name = "ThemeBuildError";
  }
}

/** Fetches the page and up to three of its own stylesheets; returns the design summary. */
export async function summarizeUrl(url: string, fetchText: ThemeBuildDeps["fetchText"]): Promise<ReferenceSummary> {
  let page: SafeFetchResult;
  try {
    page = await fetchText(url, { accept: "html" });
  } catch (err) {
    throw new ThemeBuildError("reference", err instanceof FetchGuardError ? err.message : "The website couldn't be fetched.");
  }
  const css = await Promise.all(
    stylesheetLinks(page.body, page.url, 3).map((href) =>
      fetchText(href, { accept: "css", maxBytes: 800_000, timeoutMs: 5_000 })
        .then((r) => r.body)
        .catch(() => ""),
    ),
  );
  return summarizeReference(page.body, css.join("\n"), page.url);
}

export type ThemeBuildResult = { theme: Omit<BuiltTheme, "key">; summary: ReferenceSummary | null };

export async function buildThemeFromReference(input: ThemeBuildInput, deps: ThemeBuildDeps): Promise<ThemeBuildResult> {
  if (!input.url && !input.screenshots.length) throw new ThemeBuildError("reference", "Add a website address or at least one screenshot.");
  const summary = input.url ? await summarizeUrl(input.url, deps.fetchText) : null;

  let issues: string[] = [];
  let attempts = 0;
  for (let round = 0; round < 2; round++) {
    const prompt = buildThemePrompt({ name: input.name, industry: input.industry, summary, screenshots: input.screenshots.length, retryIssues: issues });
    const gen = await deps.generate({ ...prompt, images: input.screenshots }, aiThemeDraftSchema);
    attempts += gen.attempts;
    const { preset, meta, repairs } = repairDraft(gen.data, { industry: input.industry, name: input.name });
    const candidate = {
      key: "draft-preview",
      name: meta.name,
      tagline: meta.tagline,
      description: meta.description,
      industry: input.industry,
      style: meta.style,
      bestFor: meta.bestFor,
      features: meta.features,
      preset,
      images: [],
      reference: { url: input.url, host: summary?.host ?? null, screenshots: input.screenshots.length },
      generation: { provider: gen.provider, model: gen.model.slice(0, 100), attempts: Math.min(attempts, 6), repairs: repairs.slice(0, 60).map((r) => r.slice(0, 200)), notes: meta.notes },
    };
    const checked = validateBuiltTheme(candidate);
    if (!checked.ok) {
      issues = checked.issues;
      continue;
    }
    const images = await fillThemeImages(checked.theme.preset, input.industry, deps.fetchStock);
    const { key: _key, ...theme } = { ...checked.theme, images };
    return { theme, summary };
  }
  throw new ThemeBuildError("invalid", "The AI didn't return a usable theme. Please try again.", issues);
}
