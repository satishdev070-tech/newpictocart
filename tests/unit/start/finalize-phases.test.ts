import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FINALIZE_PHASES,
  FINALIZE_RETRY_DELAYS_MS,
  initialFinalizeProgress,
  nextFinalizePhase,
  parseFinalizeProgress,
  runFinalizePhases,
  withFinalizeRetry,
  type FinalizeApi,
  type FinalizeProgress,
} from "@/features/start/finalize-phases";
import { phaseProgressPct, phaseStepIndex } from "@/features/start/building-progress";
import { startCopy } from "@/features/start/copy";

const ok = <T,>(data: T) => ({ ok: true as const, data });
const err = (code: string, message = "Nope") => ({ ok: false as const, error: { code, message } });
const noSleep = async () => {};

function fakeApi(over: Partial<FinalizeApi> = {}) {
  const calls: string[] = [];
  const api: FinalizeApi = {
    createStore: async () => (calls.push("store"), ok({ slug: "kia", name: "Kia", seeded: false })),
    seedCatalog: async (_d, _s, step) => (calls.push(step), ok({ step })),
    seedContent: async () => (calls.push("content"), ok({ done: true })),
    seedImages: async () => (calls.push("images"), ok({ remaining: 0, failed: [] })),
    publishTheme: async () => (calls.push("publishTheme"), ok({ done: true })),
    finish: async () => (calls.push("finish"), ok({ slug: "kia", name: "Kia" })),
    ...over,
  };
  return { api, calls };
}

describe("finalize phase order", () => {
  it("walks every phase and skips the catalogue for an already-seeded store", () => {
    expect(FINALIZE_PHASES[0]).toBe("store");
    expect(nextFinalizePhase("store")).toBe("theme");
    expect(nextFinalizePhase("store", true)).toBe("content");
    expect(nextFinalizePhase("images")).toBe("publishTheme");
    expect(nextFinalizePhase("finish")).toBeNull();
  });

  it("parses a saved resume point and drops corrupt ones", () => {
    expect(parseFinalizeProgress(null)).toEqual(initialFinalizeProgress());
    expect(parseFinalizeProgress({ phase: "bogus" }).phase).toBe("store");
    // Any phase after "store" needs the store's slug.
    expect(parseFinalizeProgress({ phase: "products" }).phase).toBe("store");
    const p = parseFinalizeProgress({ phase: "images", slug: "kia", name: "Kia", imagesSkip: ["a", 3], imagesTotal: 8, imagesRemaining: 4 });
    expect(p).toMatchObject({ phase: "images", slug: "kia", imagesSkip: ["a"], imagesTotal: 8, imagesRemaining: 4 });
  });
});

describe("withFinalizeRetry", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("retries thrown errors (killed Worker) with 500 ms, 1.5 s and 3 s backoff", async () => {
    const run = vi
      .fn<() => Promise<{ ok: true } | { ok: false; error: { code: string } }>>()
      .mockRejectedValueOnce(new Error("An unexpected response was received from the server."))
      .mockResolvedValueOnce({ ok: false, error: { code: "INTERNAL" } })
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ ok: true });
    const p = withFinalizeRetry(run);
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(FINALIZE_RETRY_DELAYS_MS[0] - 1);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(FINALIZE_RETRY_DELAYS_MS[1]);
    expect(run).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(FINALIZE_RETRY_DELAYS_MS[2]);
    await expect(p).resolves.toMatchObject({ ok: true, attempts: 4 });
  });

  it("gives up after 3 retries", async () => {
    const run = vi.fn(async () => {
      throw new Error("boom");
    });
    const p = withFinalizeRetry(run);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toMatchObject({ ok: false, attempts: 4 });
    expect(run).toHaveBeenCalledTimes(4);
  });

  it("does not retry auth, permission or rate-limit failures", async () => {
    for (const code of ["UNAUTHENTICATED", "FORBIDDEN", "RATE_LIMITED"]) {
      const run = vi.fn(async () => ({ ok: false as const, error: { code } }));
      await expect(withFinalizeRetry(run)).resolves.toMatchObject({ ok: false, attempts: 1 });
      expect(run).toHaveBeenCalledTimes(1);
    }
  });
});

describe("runFinalizePhases", () => {
  it("runs the phases in order and returns the store", async () => {
    const { api, calls } = fakeApi();
    const saved: FinalizeProgress[] = [];
    const res = await runFinalizePhases("{}", initialFinalizeProgress(), api, { save: (p) => saved.push(p), sleep: noSleep });
    expect(res).toEqual({ ok: true, slug: "kia", name: "Kia" });
    expect(calls).toEqual(["store", "theme", "plan", "categories", "products", "navigation", "content", "images", "publishTheme", "finish"]);
    expect(saved.at(-1)?.phase).toBe("finish");
  });

  it("stops at a phase that keeps failing and resumes there on Try again", async () => {
    let productsUp = false;
    const { api, calls } = fakeApi({
      seedCatalog: async (_d, _s, step) => {
        calls.push(step);
        if (step === "products" && !productsUp) throw new Error("Worker exceeded resource limits");
        return ok({ step });
      },
    });
    let progress = initialFinalizeProgress();
    const save = (p: FinalizeProgress) => (progress = p);
    const first = await runFinalizePhases("{}", progress, api, { save, sleep: noSleep });
    expect(first).toMatchObject({ ok: false, phase: "products" });
    expect(calls.filter((c) => c === "products")).toHaveLength(4);
    expect(progress.phase).toBe("products");

    calls.length = 0;
    productsUp = true;
    const second = await runFinalizePhases("{}", progress, api, { save, sleep: noSleep });
    expect(second.ok).toBe(true);
    // Never restarts from scratch: no second create / theme / plan.
    expect(calls[0]).toBe("products");
    expect(calls).not.toContain("store");
    expect(calls).not.toContain("plan");
  });

  it("loops image batches until none remain and skips photos that failed", async () => {
    const skips: string[][] = [];
    const remaining = [8, 4, 0];
    const { api } = fakeApi({
      seedImages: async (_d, _s, skip) => {
        skips.push([...skip]);
        const r = remaining.shift() ?? 0;
        return ok({ remaining: r, failed: r === 4 ? ["bad-photo"] : [] });
      },
    });
    const saved: FinalizeProgress[] = [];
    const res = await runFinalizePhases("{}", { ...initialFinalizeProgress(), phase: "images", slug: "kia" }, api, { save: (p) => saved.push(p), sleep: noSleep });
    expect(res.ok).toBe(true);
    expect(skips).toEqual([[], [], ["bad-photo"]]);
    expect(saved.some((p) => p.imagesRemaining === 4)).toBe(true);
  });

  it("skips catalogue phases for a store seeded earlier", async () => {
    const { api, calls } = fakeApi({ createStore: async () => (calls.push("store"), ok({ slug: "kia", name: "Kia", seeded: true })) });
    await runFinalizePhases("{}", initialFinalizeProgress(), api, { save: () => {}, sleep: noSleep });
    expect(calls).toEqual(["store", "content", "images", "publishTheme", "finish"]);
  });

  it("starts over once when a saved store belongs to another account", async () => {
    let forbidden = true;
    const { api, calls } = fakeApi({
      seedContent: async () => {
        calls.push("content");
        if (forbidden) {
          forbidden = false;
          return err("FORBIDDEN");
        }
        return ok({ done: true });
      },
    });
    const res = await runFinalizePhases("{}", { ...initialFinalizeProgress(), phase: "content", slug: "someone-else", seeded: true }, api, { save: () => {}, sleep: noSleep });
    expect(res.ok).toBe(true);
    expect(calls.slice(0, 2)).toEqual(["content", "store"]);
  });

  it("surfaces the server's message when retries run out", async () => {
    const { api } = fakeApi({ createStore: async () => ({ ok: false, error: { code: "VALIDATION", message: "x", fieldErrors: { _form: ["Add a business name before finishing."] } } }) });
    const res = await runFinalizePhases("{}", initialFinalizeProgress(), api, { save: () => {}, sleep: noSleep });
    expect(res).toEqual({ ok: false, phase: "store", message: "Add a business name before finishing.", code: "VALIDATION" });
  });
});

describe("building progress from real phases", () => {
  const steps = startCopy("en-IN").building.steps.length;

  it("maps phases onto the building step list", () => {
    expect(phaseStepIndex("store", steps)).toBe(0);
    expect(phaseStepIndex("categories", steps)).toBe(1);
    expect(phaseStepIndex("products", steps)).toBe(2);
    expect(phaseStepIndex("content", steps)).toBe(3);
    expect(phaseStepIndex("images", steps)).toBe(4);
    // "Your store is ready!" lights only when done.
    expect(phaseStepIndex("finish", steps)).toBe(steps - 2);
    expect(phaseStepIndex("finish", steps, true)).toBe(steps - 1);
  });

  it("moves the bar forward through phases and image batches, 100 only when done", () => {
    const base = { imagesTotal: 0, imagesRemaining: null };
    const pcts = FINALIZE_PHASES.map((phase) => phaseProgressPct({ ...base, phase }));
    expect([...pcts].sort((a, b) => a - b)).toEqual(pcts);
    expect(Math.max(...pcts)).toBeLessThan(100);
    const before = phaseProgressPct({ phase: "images", imagesTotal: 12, imagesRemaining: 12 });
    const mid = phaseProgressPct({ phase: "images", imagesTotal: 12, imagesRemaining: 4 });
    expect(mid).toBeGreaterThan(before);
    expect(mid).toBeLessThan(phaseProgressPct({ ...base, phase: "publishTheme" }));
    expect(phaseProgressPct({ ...base, phase: "finish" }, true)).toBe(100);
  });

  it("has the new failure + done copy in every start locale", () => {
    for (const locale of ["en-IN", "hi-IN", "bn-IN", "ta-IN", "te-IN", "mr-IN", "gu-IN", "kn-IN", "ml-IN", "pa-IN"]) {
      const c = startCopy(locale);
      expect(c.building.tryAgain.trim(), locale).not.toBe("");
      expect(c.done.publish.trim(), locale).not.toBe("");
      expect(c.done.myDashboard.trim(), locale).not.toBe("");
      if (locale !== "en-IN") expect(c.done.publish, locale).not.toBe(startCopy("en-IN").done.publish);
    }
  });
});
