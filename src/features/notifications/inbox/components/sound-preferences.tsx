"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NOTIFICATION_TYPES } from "../catalog";
import { DEFAULT_BEEP_TYPES, DEFAULT_SOUND_PREFS, NOTIFICATION_TONES, type NotificationSoundPrefs, type NotificationToneId } from "../sound-prefs";
import { playNotificationTone, readSoundPrefs, unlockNotificationAudio, writeSoundPrefs } from "../notification-sound";

const BEEP_LABELS = DEFAULT_BEEP_TYPES.map((t) => NOTIFICATION_TYPES[t].label);

export function SoundPreferences() {
  const [prefs, setPrefs] = useState<NotificationSoundPrefs>(DEFAULT_SOUND_PREFS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    unlockNotificationAudio();
    setPrefs(readSoundPrefs());
    setHydrated(true);
  }, []);

  const save = (next: NotificationSoundPrefs) => {
    setPrefs(next);
    writeSoundPrefs(next);
  };

  const setEnabled = (enabled: boolean) => save({ ...prefs, enabled });
  const setTone = (toneId: NotificationToneId) => {
    const next = { ...prefs, toneId };
    save(next);
    void playNotificationTone(toneId);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-small font-medium">Play a sound for important alerts</p>
          <p className="mt-0.5 text-caption text-muted">
            Sounds for {BEEP_LABELS.slice(0, -1).join(", ")} and {BEEP_LABELS.at(-1)}. Saved in this browser only; type mutes above still apply.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={prefs.enabled}
          disabled={!hydrated}
          onClick={() => setEnabled(!prefs.enabled)}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-small font-medium shadow-xs hover:bg-surface-secondary disabled:opacity-60"
        >
          {prefs.enabled ? <Volume2 aria-hidden className="size-4 text-accent" /> : <VolumeX aria-hidden className="size-4 text-muted" />}
          {prefs.enabled ? "Sound on" : "Sound off"}
        </button>
      </div>

      <fieldset disabled={!prefs.enabled || !hydrated} className="disabled:opacity-50">
        <legend className="mb-2 text-overline text-subtle">Tone</legend>
        <div className="flex flex-wrap gap-2">
          {NOTIFICATION_TONES.map((tone) => {
            const active = prefs.toneId === tone.id;
            return (
              <button
                key={tone.id}
                type="button"
                aria-pressed={active}
                onClick={() => setTone(tone.id)}
                className={
                  active
                    ? "inline-flex h-8 items-center rounded-lg border border-accent/40 bg-accent-soft px-3 text-small font-medium text-accent"
                    : "inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-small font-medium text-muted hover:text-foreground"
                }
              >
                {tone.label}
              </button>
            );
          })}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!prefs.enabled || !hydrated}
            onClick={() => void playNotificationTone(prefs.toneId)}
          >
            Preview
          </Button>
        </div>
      </fieldset>
    </div>
  );
}
