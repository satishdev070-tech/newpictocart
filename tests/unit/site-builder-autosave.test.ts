import { describe, expect, it } from "vitest";
import {
  AUTOSAVE_IDLE_MS,
  draftStatusLabel,
  isStaleDraftConflict,
  shouldScheduleAutosave,
} from "@/features/theme/site-builder/autosave";
import { historyReducer, initHistory, isDirty } from "@/features/theme/site-builder/history";
import { DEFAULT_THEME_CONFIG } from "@/features/theme/default-theme";

describe("site builder autosave helpers", () => {
  it("uses a 2–3s idle window", () => {
    expect(AUTOSAVE_IDLE_MS).toBeGreaterThanOrEqual(2000);
    expect(AUTOSAVE_IDLE_MS).toBeLessThanOrEqual(3000);
  });

  it("schedules autosave only when dirty, not conflicting, and not already saving", () => {
    expect(shouldScheduleAutosave({ dirty: true, conflict: false, saving: false })).toBe(true);
    expect(shouldScheduleAutosave({ dirty: false, conflict: false, saving: false })).toBe(false);
    expect(shouldScheduleAutosave({ dirty: true, conflict: true, saving: false })).toBe(false);
    expect(shouldScheduleAutosave({ dirty: true, conflict: false, saving: true })).toBe(false);
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
});
