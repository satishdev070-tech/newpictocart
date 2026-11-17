import { z } from "zod";

/**
 * Phased finish of the informative onboarding (pure; client + server, unit tested).
 *
 * Production runs on Workers Free (10 ms CPU per request), so the finish step is split into small
 * idempotent server actions the browser calls in order: create (or resume) the site → logo +
 * language → photos in batches → AI writing (optional) → finish. Progress is kept in the
 * informative draft, so "Try again" resumes from the phase that failed and never re-creates the
 * site. Each call is retried with backoff, including thrown network errors / non-JSON responses
 * from a Worker that was killed part-way.
 */

export const FINISH_PHASES = ["create", "details", "images", "ai", "finish"] as const;
export type FinishPhase = (typeof FINISH_PHASES)[number];

/** Phases remembered in the draft. "finish" is not: it is cheap and returns what the ready panel needs. */
const STORED_PHASES = ["create", "details", "images", "ai"] as const;

/** Photos imported per images call (each call stays well inside the Worker CPU limit). */
export const PHOTO_BATCH_SIZE = 2;
/** Safety stop for the images loop (a site needs at most 7 photos, i.e. 4 calls). */
export const MAX_PHOTO_CALLS = 12;

export const finishProgressSchema = z.object({
  /** Address of the site created by the "create" phase; later phases use it to find the membership. */
  slug: z.string().trim().toLowerCase().max(63).nullable().default(null),
  done: z.array(z.enum(STORED_PHASES)).max(STORED_PHASES.length).default([]),
  /** Curated photo ids whose download failed; skipped by later images calls. */
  failedPhotos: z.array(z.string().max(80)).max(20).default([]),
  /** AI writing was skipped (Sarvam unavailable / timed out); the starter content stays. */
  aiSkipped: z.boolean().default(false),
});
export type FinishProgress = z.infer<typeof finishProgressSchema>;

export const EMPTY_FINISH_PROGRESS: FinishProgress = { slug: null, done: [], failedPhotos: [], aiSkipped: false };

/** The phase to run next (first not done, in order); "finish" once everything else is done. */
export function nextPhase(p: FinishProgress): FinishPhase {
  return FINISH_PHASES.find((ph) => ph === "finish" || !(p.done as readonly string[]).includes(ph)) ?? "finish";
}

/** Phase guard: everything after "create" needs the created site (its address) and every earlier phase. */
export function canRunPhase(phase: FinishPhase, p: FinishProgress): boolean {
  if (phase === "create") return true;
  if (!p.slug || !p.done.includes("create")) return false;
  const before = FINISH_PHASES.slice(0, FINISH_PHASES.indexOf(phase));
  return before.every((ph) => (p.done as readonly string[]).includes(ph));
}

/** Records a finished phase (kept in phase order, no duplicates; "finish" is never stored). */
export function markPhaseDone(p: FinishProgress, phase: FinishPhase, patch: Partial<FinishProgress> = {}): FinishProgress {
  const next = { ...p, ...patch };
  if (phase === "finish") return next;
  const done = new Set<string>([...next.done, phase]);
  return { ...next, done: STORED_PHASES.filter((ph) => done.has(ph)) };
}

/** Status of each phase for the progress list. */
export type PhaseStatus = "pending" | "active" | "done" | "failed" | "skipped";
export function phaseStatuses(p: FinishProgress, active: FinishPhase | null, failed: FinishPhase | null, ready: boolean): Record<FinishPhase, PhaseStatus> {
  const out = {} as Record<FinishPhase, PhaseStatus>;
  for (const ph of FINISH_PHASES) {
    const done = ready || (p.done as readonly string[]).includes(ph);
    out[ph] = ph === failed ? "failed" : done ? (ph === "ai" && p.aiSkipped ? "skipped" : "done") : ph === active ? "active" : "pending";
  }
  return out;
}

/**
 * A membership the person may continue onboarding on: their own INFORMATIVE site with this
 * address. `ownerOnly` for the create/resume phase (the completion RPC only resumes for the owner).
 */
export function findOnboardingMembership<M extends { tenantSlug: string; websiteType: string; role: string }>(memberships: readonly M[], slug: string, opts: { ownerOnly?: boolean } = {}): M | null {
  const s = slug.trim().toLowerCase();
  return memberships.find((m) => m.tenantSlug === s && m.websiteType === "INFORMATIVE" && (!opts.ownerOnly || m.role === "owner")) ?? null;
}

// ---- Retry -------------------------------------------------------------------------------------

/** Waits before retries 1, 2 and 3. */
export const RETRY_DELAYS_MS = [500, 1500, 3000] as const;

type PhaseError = { code: string; message: string; fieldErrors?: Record<string, string[]> };
export type PhaseResult<T> = { ok: true; data: T } | { ok: false; error: PhaseError };

/** Error codes worth another try: the server (or the Worker) failed, not the input or the rules. */
const RETRYABLE = new Set(["INTERNAL", "TENANT_UNAVAILABLE", "NETWORK"]);
export const isRetryableError = (e: PhaseError): boolean => RETRYABLE.has(e.code);

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Calls a server action, retrying up to `delays.length` times with those waits when it throws
 * (network error, non-JSON response from a killed Worker), returns something that isn't an
 * ActionResult, or returns a retryable error. Never throws.
 */
export async function withPhaseRetry<T>(
  call: (attempt: number) => Promise<PhaseResult<T>>,
  opts: { delays?: readonly number[]; sleep?: (ms: number) => Promise<void>; onRetry?: (attempt: number) => void } = {},
): Promise<PhaseResult<T> & { attempts: number }> {
  const delays = opts.delays ?? RETRY_DELAYS_MS;
  const sleep = opts.sleep ?? defaultSleep;
  for (let attempt = 1; ; attempt++) {
    let result: PhaseResult<T>;
    try {
      const r: unknown = await call(attempt);
      result = isPhaseResult<T>(r) ? r : { ok: false, error: { code: "NETWORK", message: "Unexpected response" } };
    } catch {
      result = { ok: false, error: { code: "NETWORK", message: "Network error" } };
    }
    if (result.ok || !isRetryableError(result.error) || attempt > delays.length) return { ...result, attempts: attempt };
    opts.onRetry?.(attempt);
    await sleep(delays[attempt - 1]!);
  }
}

function isPhaseResult<T>(r: unknown): r is PhaseResult<T> {
  if (!r || typeof r !== "object" || !("ok" in r)) return false;
  const v = r as { ok: unknown; error?: unknown };
  if (v.ok === true) return true;
  return v.ok === false && !!v.error && typeof v.error === "object" && typeof (v.error as { code?: unknown }).code === "string";
}
