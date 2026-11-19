/**
 * Social desk automation rules (pure, unit tested). The server side
 * (server/automation.ts) reads the store's settings and calls these to decide whether and how an
 * automatic post is created when the store launches or a product is published.
 */
import { formatMoney } from "@/lib/money";
import { ALL_CHANNELS, isAutoPlatform, normalizeHashtags, type Channel, type SocialPlatform } from "./compose";

export const AUTOMATION_MODES = ["review", "auto"] as const;
export type AutomationMode = (typeof AUTOMATION_MODES)[number];

export type AutomationSettings = {
  launchEnabled: boolean;
  productEnabled: boolean;
  mode: AutomationMode;
  platforms: Channel[];
  useAi: boolean;
  delayMinutes: number;
  productEnabledAt: string | null;
  saved: boolean;
};

/** Defaults when the store never saved settings: a launch draft (no publishing, no credits). */
export const DEFAULT_AUTOMATION: AutomationSettings = { launchEnabled: true, productEnabled: false, mode: "review", platforms: [], useAi: false, delayMinutes: 15, productEnabledAt: null, saved: false };

export type AutomationRow = { launch_enabled: boolean; product_enabled: boolean; mode: string; platforms: string[]; use_ai: boolean; delay_minutes: number; product_enabled_at: string | null };

export function parseAutomation(row: AutomationRow | null | undefined): AutomationSettings {
  if (!row) return DEFAULT_AUTOMATION;
  return {
    launchEnabled: row.launch_enabled,
    productEnabled: row.product_enabled,
    mode: row.mode === "auto" ? "auto" : "review",
    platforms: row.platforms.filter((p): p is Channel => (ALL_CHANNELS as readonly string[]).includes(p)),
    useAi: row.use_ai,
    delayMinutes: Math.min(1440, Math.max(5, row.delay_minutes || 15)),
    productEnabledAt: row.product_enabled_at,
    saved: true,
  };
}

/**
 * product_enabled_at to store on save: kept while product posts stay on, set to now when they are
 * switched on, cleared when off. Products published before it never get automatic posts.
 */
export function nextProductEnabledAt(before: AutomationSettings, productEnabled: boolean, now: Date): string | null {
  if (!productEnabled) return null;
  return before.productEnabled && before.productEnabledAt ? before.productEnabledAt : now.toISOString();
}

export type AutoTrigger = { kind: "launch" } | { kind: "product"; publishedAt: string | null };

export type AutoPostPlan =
  | { create: false; reason: "disabled" | "too_old" | "no_channels" }
  | { create: true; status: "draft" | "scheduled"; scheduledAt: string | null; platforms: Channel[]; aiState: "pending" | null; note: string | null };

/**
 * What to create for a trigger. Auto mode schedules only when at least one selected auto-publish
 * network is connected; otherwise it falls back to a draft (with a note) so nothing is lost.
 */
export function planAutoPost(s: AutomationSettings, trigger: AutoTrigger, connected: readonly SocialPlatform[], now: Date): AutoPostPlan {
  if (trigger.kind === "launch" ? !s.launchEnabled : !s.productEnabled) return { create: false, reason: "disabled" };
  if (trigger.kind === "product") {
    const since = s.productEnabledAt ? Date.parse(s.productEnabledAt) : NaN;
    const at = trigger.publishedAt ? Date.parse(trigger.publishedAt) : NaN;
    // Only products first published after product posts were switched on (and within a day).
    if (Number.isNaN(since) || Number.isNaN(at) || at < since - 60_000 || at < now.getTime() - 86_400_000) return { create: false, reason: "too_old" };
  }
  const platforms = s.platforms.filter((p) => !isAutoPlatform(p) || connected.includes(p));
  const auto = platforms.filter(isAutoPlatform);
  const aiState = s.useAi ? ("pending" as const) : null;
  if (s.mode === "auto" && auto.length) {
    return { create: true, status: "scheduled", scheduledAt: new Date(now.getTime() + s.delayMinutes * 60_000).toISOString(), platforms, aiState, note: null };
  }
  const note = s.mode === "auto" ? "Saved as a draft: none of the chosen auto-publish networks is connected." : null;
  return { create: true, status: "draft", scheduledAt: null, platforms, aiState, note };
}

export type LaunchFacts = { storeName: string; tagline: string | null; link: string | null; keywords: string[] };
export type ProductFacts = { title: string; priceMinor: number | null; summary: string | null; link: string | null; storeName: string; keywords: string[] };

const tagFrom = (s: string) => `#${s.replace(/[^\p{L}\p{M}\p{N}]+/gu, "")}`;

/** Template text used without AI (and kept if AI fails): honest facts only. */
export function launchTemplate(f: LaunchFacts): { title: string; caption: string; hashtags: string[] } {
  const caption = [`🎉 ${f.storeName} is now open online!`, f.tagline?.trim() ?? "", "Come take a look and tell us what you love.", f.link ?? ""].filter(Boolean).join("\n\n");
  return { title: `${f.storeName} launch`.slice(0, 120), caption: caption.slice(0, 2200), hashtags: normalizeHashtags([tagFrom(f.storeName), "#NewLaunch", "#ShopOnline", "#ShopLocal", ...f.keywords]) };
}

export function productTemplate(f: ProductFacts): { title: string; caption: string; hashtags: string[] } {
  const price = f.priceMinor == null ? "" : `Price: ${formatMoney(f.priceMinor)}`;
  const caption = [`✨ New at ${f.storeName}: ${f.title.trim()}`, f.summary?.trim() ?? "", price, f.link ? `Shop now: ${f.link}` : ""].filter(Boolean).join("\n\n");
  return { title: f.title.slice(0, 120), caption: caption.slice(0, 2200), hashtags: normalizeHashtags([tagFrom(f.storeName), "#NewArrival", "#ShopOnline", ...f.keywords]) };
}
