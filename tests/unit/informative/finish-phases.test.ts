import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_FINISH_PROGRESS,
  FINISH_PHASES,
  RETRY_DELAYS_MS,
  canRunPhase,
  findOnboardingMembership,
  markPhaseDone,
  nextPhase,
  phaseStatuses,
  withPhaseRetry,
  type FinishProgress,
  type PhaseResult,
} from "@/features/informative/onboarding/phases";
import { completionInfo } from "@/features/informative/onboarding/completion";
import { EMPTY_DRAFT, parseDraft } from "@/features/informative/onboarding/draft";
import { TENANT_ROLE_PERMISSIONS } from "@/lib/permissions/matrix";

describe("withPhaseRetry (500 ms, 1.5 s, 3 s backoff)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("retries thrown network errors and non-JSON responses with the backoff, then succeeds", async () => {
    const outcomes: (() => unknown)[] = [
      () => {
        throw new TypeError("Failed to fetch");
      },
      () => "<html>Error 1102</html>", // a killed Worker's page, not an ActionResult
      () => ({ ok: false, error: { code: "INTERNAL", message: "Something went wrong." } }),
      () => ({ ok: true, data: 7 }),
    ];
    const times: number[] = [];
    const start = Date.now();
    const call = vi.fn(async (attempt: number) => {
      times.push(Date.now() - start);
      return outcomes[attempt - 1]!() as PhaseResult<number>;
    });
    const onRetry = vi.fn();
    const p = withPhaseRetry(call, { onRetry });
    await vi.runAllTimersAsync();
    const r = await p;
    expect(r).toEqual({ ok: true, data: 7, attempts: 4 });
    expect(times).toEqual([0, 500, 2000, 5000]);
    expect(onRetry).toHaveBeenCalledTimes(3);
    expect(RETRY_DELAYS_MS).toEqual([500, 1500, 3000]);
  });

  it("gives up after 3 retries with the last error and never throws", async () => {
    const call = vi.fn(async (): Promise<PhaseResult<number>> => {
      throw new Error("down");
    });
    const p = withPhaseRetry(call);
    await vi.runAllTimersAsync();
    const r = await p;
    expect(call).toHaveBeenCalledTimes(4);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NETWORK");
  });

  it("does not retry input or permission errors", async () => {
    for (const code of ["VALIDATION", "FORBIDDEN", "NOT_FOUND", "RATE_LIMITED"]) {
      const call = vi.fn(async (): Promise<PhaseResult<number>> => ({ ok: false, error: { code, message: code } }));
      const r = await withPhaseRetry(call);
      expect(call, code).toHaveBeenCalledTimes(1);
      expect(r.attempts).toBe(1);
    }
  });
});

describe("phase guards", () => {
  const created = markPhaseDone(EMPTY_FINISH_PROGRESS, "create", { slug: "calm-clinic" });

  it("runs the phases in order and resumes from the first one not done", () => {
    let p: FinishProgress = EMPTY_FINISH_PROGRESS;
    const order: string[] = [];
    for (let i = 0; i < 10; i++) {
      const ph = nextPhase(p);
      order.push(ph);
      if (ph === "finish") break;
      p = markPhaseDone(p, ph, ph === "create" ? { slug: "calm-clinic" } : {});
    }
    expect(order).toEqual([...FINISH_PHASES]);
    expect(nextPhase(created)).toBe("details");
    expect(nextPhase(markPhaseDone(created, "details"))).toBe("images");
  });

  it("nothing after create runs without the created site, or before the earlier phases", () => {
    expect(canRunPhase("create", EMPTY_FINISH_PROGRESS)).toBe(true);
    for (const ph of ["details", "images", "ai", "finish"] as const) expect(canRunPhase(ph, EMPTY_FINISH_PROGRESS), ph).toBe(false);
    expect(canRunPhase("details", { ...created, slug: null })).toBe(false);
    expect(canRunPhase("details", created)).toBe(true);
    expect(canRunPhase("images", created)).toBe(false);
    expect(canRunPhase("finish", markPhaseDone(markPhaseDone(markPhaseDone(created, "details"), "images"), "ai"))).toBe(true);
  });

  it("marking is idempotent, ordered, and never stores finish", () => {
    const p = markPhaseDone(markPhaseDone(markPhaseDone(created, "details"), "details"), "finish");
    expect(p.done).toEqual(["create", "details"]);
  });

  it("statuses: done / active / failed / skipped AI", () => {
    const p = { ...markPhaseDone(markPhaseDone(markPhaseDone(created, "details"), "images"), "ai"), aiSkipped: true };
    expect(phaseStatuses(p, "finish", null, false)).toEqual({ create: "done", details: "done", images: "done", ai: "skipped", finish: "active" });
    expect(phaseStatuses(created, null, "details", false).details).toBe("failed");
  });

  it("progress lives in the draft; old or broken drafts get an empty one", () => {
    expect(parseDraft({ v: 1, basic: {} }).finish).toEqual(EMPTY_FINISH_PROGRESS);
    expect(parseDraft({ ...EMPTY_DRAFT, finish: { done: ["nope"] } }).finish).toEqual(EMPTY_FINISH_PROGRESS);
    expect(parseDraft({ ...EMPTY_DRAFT, finish: created }).finish).toEqual(created);
  });

  it("only the person's own INFORMATIVE membership with that address (owner for create/resume)", () => {
    const ms = [
      { tenantSlug: "calm-clinic", websiteType: "ONLINE_STORE", role: "owner" },
      { tenantSlug: "calm-clinic", websiteType: "INFORMATIVE", role: "manager" },
      { tenantSlug: "other", websiteType: "INFORMATIVE", role: "owner" },
    ];
    expect(findOnboardingMembership(ms, "Calm-Clinic")).toBe(ms[1]);
    expect(findOnboardingMembership(ms, "calm-clinic", { ownerOnly: true })).toBeNull();
    expect(findOnboardingMembership(ms, "nobody")).toBeNull();
  });
});

describe("completion choices", () => {
  it("offers Publish only with theme.publish and while the site is a draft", () => {
    const owner = completionInfo(TENANT_ROLE_PERMISSIONS.owner, false, "nexus-core");
    expect(owner).toMatchObject({ canPublish: true, dashboardUrl: "/informative/dashboard?welcome=1", afterPublishUrl: "/informative/dashboard", previewUrl: "/informative/site-preview" });
    expect(completionInfo(TENANT_ROLE_PERMISSIONS.owner, true, "nexus-core").canPublish).toBe(false);
    expect(completionInfo(new Set(["content.write"]), false, "nexus-core").canPublish).toBe(false);
  });
});

// ---- Server: permissions of the completion actions --------------------------------------------

vi.mock("server-only", () => ({}));

describe("completion actions permission", () => {
  beforeEach(() => vi.resetModules());

  it("publishing (repo.setSiteStatus, used by setSiteStatusAction) needs theme.publish", async () => {
    const from = vi.fn();
    vi.doMock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ from }) }));
    const repo = await import("@/features/informative/server/repo");
    await expect(repo.setSiteStatus({ tenantId: "t1", permissions: new Set(["content.write"]) } as never, "PUBLISHED")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(from).not.toHaveBeenCalled();
  });

  function mockServer(memberships: unknown[]) {
    const from = vi.fn();
    const rpc = vi.fn();
    vi.doMock("@/features/informative/server/onboarding-gate", () => ({ informativeOnboardingAllowed: async () => true }));
    vi.doMock("@/lib/auth/session", () => ({ requireUserWithRetry: async () => ({ id: "u1", email: "a@b.c", displayName: null }) }));
    vi.doMock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => undefined), clientIpKey: async () => "ip" }));
    vi.doMock("@/lib/tenant/membership", async (orig) => ({ ...(await orig<object>()), listMemberships: async () => memberships }));
    vi.doMock("@/lib/tenant/active", () => ({ setActiveTenant: vi.fn() }));
    vi.doMock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ from, rpc }) }));
    vi.doMock("@/features/informative/ai/server", () => ({ buildSiteWithAi: vi.fn(), siteIsNew: vi.fn() }));
    vi.doMock("@/features/informative/images/seed", () => ({ importInformativeImagesBatch: vi.fn() }));
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
    return { from, rpc };
  }
  const membership = (role: string, websiteType = "INFORMATIVE") => ({ tenantId: "t1", tenantName: "Calm", tenantSlug: "calm-clinic", tenantStatus: "active", role, customRole: role === "custom" ? { id: "r", name: "Writer", permissions: ["content.write"] } : null, websiteType });

  it("phases only touch the person's own site: another address is NOT_FOUND", async () => {
    const { from } = mockServer([membership("owner")]);
    const a = await import("@/features/informative/onboarding/actions");
    const r = await a.finishInformativeOnboardingAction({ slug: "someone-else" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
    expect(from).not.toHaveBeenCalled();
  });

  it("logo/language needs settings.write and AI writing needs content + settings write", async () => {
    const { from } = mockServer([membership("custom")]);
    const a = await import("@/features/informative/onboarding/actions");
    const details = await a.saveInformativeSiteDetailsAction({ slug: "calm-clinic", locale: "hi-IN" });
    const ai = await a.buildInformativeOnboardingAiAction({ slug: "calm-clinic" });
    for (const r of [details, ai]) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("FORBIDDEN");
    }
    expect(from).not.toHaveBeenCalled();
  });

  it("an online store with the same address is never used", async () => {
    mockServer([membership("owner", "ONLINE_STORE")]);
    const a = await import("@/features/informative/onboarding/actions");
    const r = await a.finishInformativeOnboardingAction({ slug: "calm-clinic" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });
});
