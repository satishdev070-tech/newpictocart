/**
 * Phased /start finalize (pure; no server or React imports, so it is unit-tested directly).
 *
 * Workers Free kills a request after 10 ms of CPU (Error 1102). Creating + seeding a store in ONE
 * server action died part-way on production, so the client runs small idempotent phases in order,
 * retrying each one, and remembers the phase it reached so "Try again" resumes there.
 */

export const FINALIZE_PHASES = [
  "store",
  "theme",
  "plan",
  "categories",
  "products",
  "navigation",
  "content",
  "images",
  "publishTheme",
  "finish",
] as const;

export type FinalizePhase = (typeof FINALIZE_PHASES)[number];

/** Catalogue sub-steps handled by `startSeedCatalogAction`. */
export const CATALOG_STEPS = [
  "theme",
  "plan",
  "categories",
  "products",
  "navigation",
] as const;
export type CatalogStep = (typeof CATALOG_STEPS)[number];

export function isFinalizePhase(v: unknown): v is FinalizePhase {
  return (
    typeof v === "string" && (FINALIZE_PHASES as readonly string[]).includes(v)
  );
}

export function isCatalogStep(p: FinalizePhase): p is CatalogStep {
  return (CATALOG_STEPS as readonly string[]).includes(p);
}

/**
 * Phase after `phase`. A store that was already seeded skips the catalogue (theme…navigation):
 * those would overwrite what the seller has edited since.
 */
export function nextFinalizePhase(
  phase: FinalizePhase,
  seeded = false,
): FinalizePhase | null {
  if (phase === "store" && seeded) return "content";
  const i = FINALIZE_PHASES.indexOf(phase);
  return FINALIZE_PHASES[i + 1] ?? null;
}

/** Saved resume point for one browser tab (kept in localStorage next to the draft). */
export type FinalizeProgress = {
  phase: FinalizePhase;
  slug: string | null;
  name: string | null;
  seeded: boolean;
  /** Photo ids whose download failed: not retried, so the image loop always ends. */
  imagesSkip: string[];
  /** Largest "photos remaining" seen, for the progress bar. */
  imagesTotal: number;
  imagesRemaining: number | null;
};

export function initialFinalizeProgress(): FinalizeProgress {
  return {
    phase: "store",
    slug: null,
    name: null,
    seeded: false,
    imagesSkip: [],
    imagesTotal: 0,
    imagesRemaining: null,
  };
}

/** Tolerant parse of a stored progress record (old / corrupt → fresh start). */
export function parseFinalizeProgress(raw: unknown): FinalizeProgress {
  const fresh = initialFinalizeProgress();
  if (!raw || typeof raw !== "object") return fresh;
  const r = raw as Record<string, unknown>;
  if (!isFinalizePhase(r.phase)) return fresh;
  const slug = typeof r.slug === "string" && r.slug ? r.slug : null;
  // Every phase after "store" needs the store it created.
  if (r.phase !== "store" && !slug) return fresh;
  return {
    phase: r.phase,
    slug,
    name: typeof r.name === "string" ? r.name : null,
    seeded: r.seeded === true,
    imagesSkip: Array.isArray(r.imagesSkip)
      ? r.imagesSkip
          .filter((x): x is string => typeof x === "string")
          .slice(0, 60)
      : [],
    imagesTotal:
      typeof r.imagesTotal === "number" && r.imagesTotal >= 0
        ? r.imagesTotal
        : 0,
    imagesRemaining:
      typeof r.imagesRemaining === "number" && r.imagesRemaining >= 0
        ? r.imagesRemaining
        : null,
  };
}

/** Backoff before retry 1, 2 and 3. */
export const FINALIZE_RETRY_DELAYS_MS = [500, 1500, 3000] as const;

/** A result that a retry will not fix (signed out, not allowed, rate limited). */
const FINAL_CODES = new Set(["UNAUTHENTICATED", "FORBIDDEN", "RATE_LIMITED"]);

type ResultLike = { ok: true } | { ok: false; error: { code: string } };

export type RetryOutcome<T> =
  | { ok: true; value: T; attempts: number }
  | { ok: false; value: T | null; error: unknown; attempts: number };

/**
 * Runs `run` and retries on a thrown error (network drop, killed Worker returning HTML instead of
 * the action payload) or an `{ ok: false }` result, waiting `delays[i]` before retry i+1.
 * Auth / permission / rate-limit failures are returned at once.
 */
export async function withFinalizeRetry<T extends ResultLike>(
  run: () => Promise<T>,
  opts: {
    delays?: readonly number[];
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<RetryOutcome<T>> {
  const delays = opts.delays ?? FINALIZE_RETRY_DELAYS_MS;
  const sleep =
    opts.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let last: T | null = null;
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    if (attempt > 0) await sleep(delays[attempt - 1]!);
    try {
      const res = await run();
      if (res.ok) return { ok: true, value: res, attempts: attempt + 1 };
      last = res;
      lastError = res.error;
      if (FINAL_CODES.has(res.error.code))
        return {
          ok: false,
          value: res,
          error: res.error,
          attempts: attempt + 1,
        };
    } catch (err) {
      last = null;
      lastError = err;
    }
  }
  return {
    ok: false,
    value: last,
    error: lastError,
    attempts: delays.length + 1,
  };
}

type Res<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        fieldErrors?: Record<string, string[]>;
      };
    };

/** Server actions the runner calls (injected so the runner stays pure and testable). */
export type FinalizeApi = {
  createStore: (
    draftJson: string,
  ) => Promise<Res<{ slug: string; name: string; seeded: boolean }>>;
  seedCatalog: (
    draftJson: string,
    slug: string,
    step: CatalogStep,
  ) => Promise<Res<unknown>>;
  seedContent: (draftJson: string, slug: string) => Promise<Res<unknown>>;
  seedImages: (
    draftJson: string,
    slug: string,
    skip: string[],
  ) => Promise<Res<{ remaining: number; failed: string[] }>>;
  publishTheme: (draftJson: string, slug: string) => Promise<Res<unknown>>;
  finish: (
    draftJson: string,
    slug: string,
  ) => Promise<Res<{ slug: string; name: string }>>;
};

export type FinalizeRunResult =
  | { ok: true; slug: string; name: string }
  | {
      ok: false;
      phase: FinalizePhase;
      message: string | null;
      code: string | null;
    };

/** Image batches per run: ~25 photos / 4 per batch, plus slack. Ends the loop whatever happens. */
export const MAX_IMAGE_BATCHES = 15;
/** Photos per image call on the server (SEED_IMAGE_BATCH); only used to size the progress bar. */
const IMAGE_BATCH_SIZE = 4;

function failure(
  phase: FinalizePhase,
  outcome: RetryOutcome<Res<unknown>>,
): FinalizeRunResult {
  const v = outcome.value;
  if (v && !v.ok)
    return {
      ok: false,
      phase,
      message: v.error.fieldErrors?._form?.[0] ?? v.error.message,
      code: v.error.code,
    };
  return { ok: false, phase, message: null, code: null };
}

/**
 * Runs the finalize phases from `start.phase` on, each with retries. `save` is called after every
 * completed phase (and image batch) so a later "Try again" resumes from the phase that failed.
 */
export async function runFinalizePhases(
  draftJson: string,
  start: FinalizeProgress,
  api: FinalizeApi,
  opts: {
    save: (p: FinalizeProgress) => void;
    sleep?: (ms: number) => Promise<void>;
    delays?: readonly number[];
  },
): Promise<FinalizeRunResult> {
  const retry = <T extends Res<unknown>>(run: () => Promise<T>) =>
    withFinalizeRetry(run, { sleep: opts.sleep, delays: opts.delays });
  let p: FinalizeProgress = { ...start };
  const advance = (patch: Partial<FinalizeProgress>, seeded = p.seeded) => {
    const next = nextFinalizePhase(p.phase, seeded);
    p = { ...p, ...patch, phase: next ?? p.phase };
    opts.save(p);
  };
  // A saved resume point for a store this account does not own (another account signed in on this
  // browser) is dropped once and the run starts over from "store".
  let reset = false;
  const fail = (
    phase: FinalizePhase,
    out: RetryOutcome<Res<unknown>>,
  ): FinalizeRunResult | null => {
    const f = failure(phase, out);
    if (!f.ok && f.code === "FORBIDDEN" && phase !== "store" && !reset) {
      reset = true;
      p = initialFinalizeProgress();
      opts.save(p);
      return null;
    }
    return f;
  };

  phases: for (let guard = 0; guard < 2 * FINALIZE_PHASES.length + 2; guard++) {
    const phase = p.phase;
    if (phase === "store") {
      const out = await retry(() => api.createStore(draftJson));
      if (!out.ok || !out.value.ok) {
        const f = fail(phase, out);
        if (f) return f;
        continue;
      }
      const d = out.value.data;
      advance({ slug: d.slug, name: d.name, seeded: d.seeded }, d.seeded);
      continue;
    }
    const slug = p.slug;
    if (!slug) {
      p = initialFinalizeProgress();
      opts.save(p);
      continue;
    }
    if (isCatalogStep(phase)) {
      const out = await retry(() => api.seedCatalog(draftJson, slug, phase));
      if (!out.ok) {
        const f = fail(phase, out);
        if (f) return f;
        continue;
      }
      advance({});
      continue;
    }
    if (phase === "content") {
      const out = await retry(() => api.seedContent(draftJson, slug));
      if (!out.ok) {
        const f = fail(phase, out);
        if (f) return f;
        continue;
      }
      advance({});
      continue;
    }
    if (phase === "images") {
      for (let batch = 0; batch < MAX_IMAGE_BATCHES; batch++) {
        const out = await retry(() =>
          api.seedImages(draftJson, slug, p.imagesSkip),
        );
        if (!out.ok || !out.value.ok) {
          const f = fail(phase, out);
          if (f) return f;
          continue phases;
        }
        const { remaining, failed } = out.value.data;
        const imagesSkip = [...new Set([...p.imagesSkip, ...failed])].slice(
          0,
          60,
        );
        p = {
          ...p,
          imagesSkip,
          imagesRemaining: remaining,
          imagesTotal: Math.max(p.imagesTotal, remaining + IMAGE_BATCH_SIZE),
        };
        opts.save(p);
        if (remaining === 0) break;
      }
      advance({});
      continue;
    }
    if (phase === "publishTheme") {
      const out = await retry(() => api.publishTheme(draftJson, slug));
      if (!out.ok) {
        const f = fail(phase, out);
        if (f) return f;
        continue;
      }
      advance({});
      continue;
    }
    const out = await retry(() => api.finish(draftJson, slug));
    if (!out.ok || !out.value.ok) {
      const f = fail(phase, out);
      if (f) return f;
      continue;
    }
    return { ok: true, slug: out.value.data.slug, name: out.value.data.name };
  }
  return { ok: false, phase: p.phase, message: null, code: null };
}
