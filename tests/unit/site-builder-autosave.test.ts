import { describe, expect, it } from "vitest";
import {
  AUTOSAVE_IDLE_MS,
  AUTOSAVE_MAX_WAIT_MS,
  autosaveMaxWaitDelayMs,
  draftStatusLabel,
  isStaleDraftConflict,
  shouldScheduleAutosave,
} from "@/features/theme/site-builder/autosave";
import { historyReducer, initHistory, isDirty } from "@/features/theme/site-builder/history";
import { leaveDecision, shouldAcceptDraftSave, shouldGateLeave } from "@/features/theme/site-builder/leave-gate";
import { DEFAULT_THEME_CONFIG } from "@/features/theme/default-theme";

describe("site builder autosave helpers", () => {
  it("uses a 2–3s idle window", () => {
    expect(AUTOSAVE_IDLE_MS).toBeGreaterThanOrEqual(2000);
    expect(AUTOSAVE_IDLE_MS).toBeLessThanOrEqual(3000);
  });

  it("uses a ~10s max-wait so continuous dirty sessions still flush", () => {
    expect(AUTOSAVE_MAX_WAIT_MS).toBeGreaterThanOrEqual(8_000);
    expect(AUTOSAVE_MAX_WAIT_MS).toBeLessThanOrEqual(15_000);
    expect(AUTOSAVE_MAX_WAIT_MS).toBeGreaterThan(AUTOSAVE_IDLE_MS);
  });

  it("schedules autosave only when dirty, not conflicting, and not already saving", () => {
    expect(shouldScheduleAutosave({ dirty: true, conflict: false, saving: false })).toBe(true);
    expect(shouldScheduleAutosave({ dirty: false, conflict: false, saving: false })).toBe(false);
    expect(shouldScheduleAutosave({ dirty: true, conflict: true, saving: false })).toBe(false);
    expect(shouldScheduleAutosave({ dirty: true, conflict: false, saving: true })).toBe(false);
  });

  it("skips scheduling while holdAutosave (slider/colour pointer hold)", () => {
    expect(shouldScheduleAutosave({ dirty: true, conflict: false, saving: false, holdAutosave: true })).toBe(false);
    expect(shouldScheduleAutosave({ dirty: true, conflict: false, saving: false, holdAutosave: false })).toBe(true);
    expect(shouldScheduleAutosave({ dirty: true, conflict: false, saving: false })).toBe(true);
  });

  it("computes max-wait delay from the dirty streak start", () => {
    expect(autosaveMaxWaitDelayMs(null, 1_000)).toBeNull();
    expect(autosaveMaxWaitDelayMs(0, 1_000, 10_000)).toBe(9_000);
    expect(autosaveMaxWaitDelayMs(0, 10_000, 10_000)).toBe(0);
    expect(autosaveMaxWaitDelayMs(0, 12_000, 10_000)).toBe(0);
  });

  it("detects stale-draft conflicts by code", () => {
    expect(isStaleDraftConflict("CONFLICT")).toBe(true);
    expect(isStaleDraftConflict("VALIDATION")).toBe(false);
    expect(isStaleDraftConflict(undefined)).toBe(false);
  });

  it("labels draft / save / publish / conflict status", () => {
    expect(draftStatusLabel({ dirty: false, saving: false, publishing: false, conflict: false })).toBe("All changes saved");
    expect(draftStatusLabel({ dirty: true, saving: false, publishing: false, conflict: false })).toBe("Unsaved changes");
    expect(draftStatusLabel({ dirty: true, saving: true, publishing: false, conflict: false })).toBe("Saving draft…");
    expect(draftStatusLabel({ dirty: false, saving: false, publishing: true, conflict: false })).toBe("Publishing…");
    expect(draftStatusLabel({ dirty: true, saving: false, publishing: false, conflict: true })).toMatch(/conflict/i);
  });
});

describe("leave-gate helpers", () => {
  it("gates leave when dirty or saving", () => {
    expect(shouldGateLeave({ dirty: false, saving: false })).toBe(false);
    expect(shouldGateLeave({ dirty: true, saving: false })).toBe(true);
    expect(shouldGateLeave({ dirty: false, saving: true })).toBe(true);
    expect(shouldGateLeave({ dirty: true, saving: true })).toBe(true);
  });

  it("prompts unless bypass is set", () => {
    expect(leaveDecision({ dirty: true, saving: false })).toBe("prompt");
    expect(leaveDecision({ dirty: false, saving: true })).toBe("prompt");
    expect(leaveDecision({ dirty: false, saving: false })).toBe("proceed");
    expect(leaveDecision({ dirty: true, saving: true, bypass: true })).toBe("proceed");
  });

  it("rejects draft markSaved after discard bumps the save generation", () => {
    let generation = 0;
    const saveGen = generation;
    expect(shouldAcceptDraftSave(generation, saveGen)).toBe(true);
    // Discard local unsynced edits.
    generation += 1;
    expect(shouldAcceptDraftSave(generation, saveGen)).toBe(false);
    expect(shouldAcceptDraftSave(generation, generation)).toBe(true);
  });
});

describe("local-first dirty vs saved draft", () => {
  it("apply updates present synchronously without touching the saved baseline (non-blocking paint)", () => {
    const c0 = DEFAULT_THEME_CONFIG;
    const c1 = {
      ...c0,
      tokens: {
        ...c0.tokens,
        colors: { ...c0.tokens.colors, accent: "#ff0000" },
      },
    };
    let s = initHistory(c0);
    // Colour/slider-style edit: history apply is sync; save baseline stays put until persistDraft.
    s = historyReducer(s, { type: "apply", config: c1, coalesce: "tokens.colors.accent", now: 0 });
    expect(s.present).toBe(c1);
    expect(s.saved).toBe(c0);
    expect(isDirty(s)).toBe(true);
    // Autosave may be scheduled independently; it must not be required for paint.
    expect(shouldScheduleAutosave({ dirty: true, conflict: false, saving: false })).toBe(true);
  });

  it("stays dirty after apply until markSaved with the sent document", () => {
    const c0 = DEFAULT_THEME_CONFIG;
    const c1 = {
      ...c0,
      embeds: { ...c0.embeds, backToTop: { enabled: !c0.embeds.backToTop.enabled } },
    };
    const c2 = {
      ...c1,
      embeds: {
        ...c1.embeds,
        whatsapp: { ...c1.embeds.whatsapp, enabled: !c1.embeds.whatsapp.enabled },
      },
    };
    let s = initHistory(c0);
    expect(isDirty(s)).toBe(false);

    s = historyReducer(s, { type: "apply", config: c1, now: 0 });
    expect(isDirty(s)).toBe(true);

    // Mid-flight edit while a save of c1 is outstanding: present moves ahead.
    s = historyReducer(s, { type: "apply", config: c2, now: 10 });
    expect(isDirty(s)).toBe(true);

    // Autosave of c1 completes: baseline advances, but local c2 remains dirty for the next pass.
    s = historyReducer(s, { type: "saved", config: c1 });
    expect(s.saved).toBe(c1);
    expect(s.present).toBe(c2);
    expect(isDirty(s)).toBe(true);

    s = historyReducer(s, { type: "saved", config: c2 });
    expect(isDirty(s)).toBe(false);
  });

  it("discard restores present to last saved and clears undo/redo", () => {
    const c0 = DEFAULT_THEME_CONFIG;
    const c1 = {
      ...c0,
      tokens: {
        ...c0.tokens,
        colors: { ...c0.tokens.colors, accent: "#00ff00" },
      },
    };
    let s = initHistory(c0);
    s = historyReducer(s, { type: "apply", config: c1, now: 0 });
    expect(isDirty(s)).toBe(true);
    expect(s.past).toHaveLength(1);

    s = historyReducer(s, { type: "discard" });
    expect(s.present).toBe(c0);
    expect(s.saved).toBe(c0);
    expect(s.past).toHaveLength(0);
    expect(s.future).toHaveLength(0);
    expect(isDirty(s)).toBe(false);
  });

  it("discard after a partial autosave restores to that saved baseline, not the original load", () => {
    const c0 = DEFAULT_THEME_CONFIG;
    const c1 = {
      ...c0,
      embeds: { ...c0.embeds, backToTop: { enabled: !c0.embeds.backToTop.enabled } },
    };
    const c2 = {
      ...c1,
      embeds: {
        ...c1.embeds,
        whatsapp: { ...c1.embeds.whatsapp, enabled: !c1.embeds.whatsapp.enabled },
      },
    };
    let s = initHistory(c0);
    s = historyReducer(s, { type: "apply", config: c1, now: 0 });
    s = historyReducer(s, { type: "saved", config: c1 });
    s = historyReducer(s, { type: "apply", config: c2, now: 10 });
    expect(isDirty(s)).toBe(true);

    s = historyReducer(s, { type: "discard" });
    expect(s.present).toBe(c1);
    expect(s.saved).toBe(c1);
    expect(isDirty(s)).toBe(false);
  });
});
