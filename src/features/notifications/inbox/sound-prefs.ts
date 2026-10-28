/**
 * Browser-only notification sound preferences (localStorage). Mute types stay in the DB
 * (`notification_preferences`); tone + enabled are per-device so they never need a round-trip.
 */

export const SOUND_PREF_STORAGE_KEY = "pc_notification_sound";

/** Short tones under `/sounds/{id}.wav`. */
export const NOTIFICATION_TONES = [
  { id: "chime", label: "Chime", file: "/sounds/chime.wav" },
  { id: "ping", label: "Ping", file: "/sounds/ping.wav" },
  { id: "soft", label: "Soft", file: "/sounds/soft.wav" },
  { id: "bright", label: "Bright", file: "/sounds/bright.wav" },
  { id: "alert", label: "Alert", file: "/sounds/alert.wav" },
] as const;

export type NotificationToneId = (typeof NOTIFICATION_TONES)[number]["id"];

export const DEFAULT_NOTIFICATION_TONE: NotificationToneId = "chime";

/** Types that play a sound when unread increases (still skipped if the user muted them in DB). */
export const DEFAULT_BEEP_TYPES = ["order.new", "payment.received", "stock.low", "stock.out"] as const;

export type NotificationSoundPrefs = {
  enabled: boolean;
  toneId: NotificationToneId;
};

export const DEFAULT_SOUND_PREFS: NotificationSoundPrefs = {
  enabled: true,
  toneId: DEFAULT_NOTIFICATION_TONE,
};

const TONE_IDS = new Set<string>(NOTIFICATION_TONES.map((t) => t.id));

export function isNotificationToneId(value: unknown): value is NotificationToneId {
  return typeof value === "string" && TONE_IDS.has(value);
}

/** Pure parse of stored JSON / unknown input. Invalid or missing fields fall back to defaults. */
export function parseSoundPrefs(raw: unknown): NotificationSoundPrefs {
  if (raw == null) return { ...DEFAULT_SOUND_PREFS };
  let value: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return { ...DEFAULT_SOUND_PREFS };
    try {
      value = JSON.parse(trimmed) as unknown;
    } catch {
      return { ...DEFAULT_SOUND_PREFS };
    }
  }
  if (!value || typeof value !== "object") return { ...DEFAULT_SOUND_PREFS };
  const obj = value as Record<string, unknown>;
  const enabled = typeof obj.enabled === "boolean" ? obj.enabled : DEFAULT_SOUND_PREFS.enabled;
  const toneId = isNotificationToneId(obj.toneId) ? obj.toneId : DEFAULT_NOTIFICATION_TONE;
  return { enabled, toneId };
}

export function serializeSoundPrefs(prefs: NotificationSoundPrefs): string {
  return JSON.stringify({
    enabled: Boolean(prefs.enabled),
    toneId: isNotificationToneId(prefs.toneId) ? prefs.toneId : DEFAULT_NOTIFICATION_TONE,
  });
}

export function toneFileFor(toneId: NotificationToneId): string {
  return NOTIFICATION_TONES.find((t) => t.id === toneId)?.file ?? NOTIFICATION_TONES[0].file;
}

export function isBeepType(type: string, beepTypes: readonly string[] = DEFAULT_BEEP_TYPES): boolean {
  return beepTypes.includes(type);
}

/**
 * Whether a live bell refresh should play a sound: unread went up, tab is visible, sound is on,
 * and at least one newly seen unread item is a default beep type (muted types never arrive).
 */
export function shouldPlayNotificationSound(input: {
  prefs: NotificationSoundPrefs;
  prevUnread: number;
  nextUnread: number;
  prevItemIds: ReadonlySet<string>;
  nextItems: ReadonlyArray<{ id: string; type: string; readAt: string | null }>;
  tabVisible: boolean;
  beepTypes?: readonly string[];
}): boolean {
  if (!input.prefs.enabled || !input.tabVisible) return false;
  if (input.nextUnread <= input.prevUnread) return false;
  const beep = input.beepTypes ?? DEFAULT_BEEP_TYPES;
  return input.nextItems.some((item) => !item.readAt && !input.prevItemIds.has(item.id) && isBeepType(item.type, beep));
}
