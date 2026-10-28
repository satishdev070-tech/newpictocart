import { describe, expect, it } from "vitest";
import {
  DEFAULT_BEEP_TYPES,
  DEFAULT_NOTIFICATION_TONE,
  DEFAULT_SOUND_PREFS,
  NOTIFICATION_TONES,
  isBeepType,
  isNotificationToneId,
  parseSoundPrefs,
  serializeSoundPrefs,
  shouldPlayNotificationSound,
  toneFileFor,
} from "@/features/notifications/inbox/sound-prefs";

describe("notification sound prefs", () => {
  it("exposes 3–5 tone ids with wav paths", () => {
    expect(NOTIFICATION_TONES.length).toBeGreaterThanOrEqual(3);
    expect(NOTIFICATION_TONES.length).toBeLessThanOrEqual(5);
    for (const tone of NOTIFICATION_TONES) {
      expect(isNotificationToneId(tone.id)).toBe(true);
      expect(tone.file).toMatch(/^\/sounds\/[a-z]+\.wav$/);
      expect(toneFileFor(tone.id)).toBe(tone.file);
    }
    expect(isNotificationToneId("nope")).toBe(false);
  });

  it("parses enabled + toneId with defaults for junk input", () => {
    expect(parseSoundPrefs(null)).toEqual(DEFAULT_SOUND_PREFS);
    expect(parseSoundPrefs("")).toEqual(DEFAULT_SOUND_PREFS);
    expect(parseSoundPrefs("{")).toEqual(DEFAULT_SOUND_PREFS);
    expect(parseSoundPrefs({ enabled: false, toneId: "ping" })).toEqual({ enabled: false, toneId: "ping" });
    expect(parseSoundPrefs('{"enabled":false,"toneId":"alert"}')).toEqual({ enabled: false, toneId: "alert" });
    expect(parseSoundPrefs({ enabled: "yes", toneId: "made-up" })).toEqual({
      enabled: DEFAULT_SOUND_PREFS.enabled,
      toneId: DEFAULT_NOTIFICATION_TONE,
    });
  });

  it("round-trips serialize → parse", () => {
    const prefs = { enabled: false, toneId: "bright" as const };
    expect(parseSoundPrefs(serializeSoundPrefs(prefs))).toEqual(prefs);
  });

  it("default beep types cover orders, payments, and stock", () => {
    expect(DEFAULT_BEEP_TYPES).toEqual(["order.new", "payment.received", "stock.low", "stock.out"]);
    expect(isBeepType("order.new")).toBe(true);
    expect(isBeepType("review.new")).toBe(false);
  });

  it("plays only when unread rises for a beep type while visible and enabled", () => {
    const base = {
      prefs: { enabled: true, toneId: DEFAULT_NOTIFICATION_TONE },
      prevUnread: 1,
      nextUnread: 2,
      prevItemIds: new Set(["a"]),
      nextItems: [
        { id: "b", type: "order.new", readAt: null },
        { id: "a", type: "review.new", readAt: null },
      ],
      tabVisible: true,
    };
    expect(shouldPlayNotificationSound(base)).toBe(true);
    expect(shouldPlayNotificationSound({ ...base, prefs: { ...base.prefs, enabled: false } })).toBe(false);
    expect(shouldPlayNotificationSound({ ...base, tabVisible: false })).toBe(false);
    expect(shouldPlayNotificationSound({ ...base, nextUnread: 1 })).toBe(false);
    expect(
      shouldPlayNotificationSound({
        ...base,
        nextItems: [{ id: "b", type: "review.new", readAt: null }],
      }),
    ).toBe(false);
    expect(
      shouldPlayNotificationSound({
        ...base,
        nextItems: [{ id: "a", type: "order.new", readAt: null }],
      }),
    ).toBe(false);
  });
});
