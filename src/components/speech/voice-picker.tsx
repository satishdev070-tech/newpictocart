"use client";

import { Check, Loader2, Play, Settings2, Square } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { voiceGenderScore } from "@/lib/speech/voice-gender";
import {
  SERVER_VOICE_PREFS,
  VOICE_SPEEDS,
  chooseVoice,
  deviceVoices,
  rankVoices,
  saveVoiceChoice,
  saveVoiceSpeed,
  speakPieces,
  speechSynth,
  subscribeVoicePrefs,
  voicePrefsSnapshot,
  voiceQualityScore,
  type VoiceSpeed,
} from "@/lib/speech/voices";

/**
 * "Tara's voice": lists the voices this device has for the reply language, with a ▶ preview,
 * plus a speed choice. Saved per browser (localStorage) and used whenever Tara speaks with the
 * device voice (always on some surfaces; on others when the premium voice is unavailable).
 */

const COPY = {
  en: {
    button: "Tara's voice",
    title: "Tara's voice",
    note: "Voices come from this device and browser. Edge and Chrome on a computer have the most natural ones.",
    auto: "Automatic (best on this device)",
    natural: "Natural",
    female: "Female",
    male: "Male",
    speed: "Speed",
    speeds: { slow: "Slow", normal: "Normal", fast: "Fast" } as Record<VoiceSpeed, string>,
    play: "Play sample",
    stop: "Stop",
    none: "This device has no voice for this language. Tara will show text only.",
    loading: "Loading voices…",
    close: "Done",
    sample: "Namaste! I'm Tara. Your Blue Kurti stock is now 50, and your store is ready for customers.",
  },
  hi: {
    button: "तारा की आवाज़",
    title: "तारा की आवाज़",
    note: "आवाज़ें इस फ़ोन/कंप्यूटर और ब्राउज़र से आती हैं। कंप्यूटर पर Edge और Chrome में सबसे अच्छी आवाज़ें मिलती हैं।",
    auto: "अपने आप (इस डिवाइस की सबसे अच्छी)",
    natural: "नेचुरल",
    female: "महिला",
    male: "पुरुष",
    speed: "रफ़्तार",
    speeds: { slow: "धीमी", normal: "सामान्य", fast: "तेज़" } as Record<VoiceSpeed, string>,
    play: "सुनें",
    stop: "रोकें",
    none: "इस डिवाइस में इस भाषा की कोई आवाज़ नहीं है। तारा सिर्फ़ लिखकर जवाब देगी।",
    loading: "आवाज़ें लोड हो रही हैं…",
    close: "ठीक है",
    sample: "नमस्ते! मैं तारा हूँ। ब्लू कुर्ती का स्टॉक अब 50 है, और आपका स्टोर ग्राहकों के लिए तैयार है।",
  },
};

const STYLES = {
  app: {
    trigger: "grid size-8 place-items-center rounded-lg hover:bg-surface-secondary",
    panel: "border-border bg-surface text-foreground",
    muted: "text-muted",
    row: "hover:bg-surface-secondary",
    selected: "bg-accent-soft ring-1 ring-inset ring-accent/30",
    chip: "border-border",
    chipOn: "border-accent bg-accent-soft text-accent",
    badge: "bg-success/10 text-success",
    primary: "bg-accent text-white hover:opacity-90",
  },
  onboarding: {
    trigger: "grid size-9 place-items-center rounded-full border border-mk-line-strong text-mk-text hover:bg-white/[0.06]",
    panel: "border-mk-line-strong bg-mk-elev-2 text-mk-text",
    muted: "text-mk-muted",
    row: "hover:bg-white/[0.06]",
    selected: "bg-white/[0.08] ring-1 ring-inset ring-orange-400/40",
    chip: "border-mk-line-strong",
    chipOn: "border-orange-400 bg-orange-500/15 text-orange-200",
    badge: "bg-emerald-500/15 text-emerald-300",
    primary: "bg-orange-500 text-white hover:bg-orange-400",
  },
} as const;

const noSubscribe = () => () => undefined;

type Listed = { name: string; lang: string; natural: boolean; gender: number };

function regionLabel(lang: string): string {
  const region = lang.replace(/_/g, "-").split("-")[1]?.toUpperCase();
  return region ?? "";
}

export function VoicePicker({ lang, tone = "app", className }: { lang: string; tone?: keyof typeof STYLES; className?: string }) {
  const t = lang.toLowerCase().startsWith("hi") ? COPY.hi : COPY.en;
  const s = STYLES[tone];
  const id = useId();
  const [open, setOpen] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[] | null>(null);
  const prefs = useSyncExternalStore(subscribeVoicePrefs, voicePrefsSnapshot, () => SERVER_VOICE_PREFS);
  // The server render has no speechSynthesis: decided on the client (no hydration mismatch).
  const supported = useSyncExternalStore(noSubscribe, () => !!speechSynth(), () => false);
  const [playing, setPlaying] = useState<string | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const stopPreview = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setPlaying(null);
  }, []);
  const close = useCallback(() => {
    stopPreview();
    setOpen(false);
  }, [stopPreview]);

  useEffect(() => {
    if (!open) return;
    let live = true;
    void deviceVoices().then((v) => live && setVoices(v));
    const synth = speechSynth();
    const onChange = () => synth && setVoices(synth.getVoices());
    synth?.addEventListener("voiceschanged", onChange);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      live = false;
      synth?.removeEventListener("voiceschanged", onChange);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, close]);

  // Unmount: stop a sample that is still playing.
  useEffect(() => () => cancelRef.current?.(), []);

  const base = lang.toLowerCase().replace(/_/g, "-").split("-")[0]!;
  const saved = prefs.voices[base] ?? null;
  const ranked = voices ? rankVoices(voices, lang) : [];
  const list: Listed[] = ranked.map(({ voice }) => ({
    name: voice.name,
    lang: voice.lang,
    natural: voiceQualityScore(voice.name) >= 25,
    gender: voiceGenderScore(voice.name),
  }));
  const autoVoice = voices ? chooseVoice(voices, lang) : null;
  const current = saved && list.some((v) => v.name === saved) ? saved : null;

  function preview(name: string | null, key: string, rate = VOICE_SPEEDS[prefs.speed]) {
    const synth = speechSynth();
    if (!synth || !voices) return;
    if (playing === key) return stopPreview();
    stopPreview();
    const voice = name ? (voices.find((v) => v.name === name) ?? null) : autoVoice;
    if (!voice) return;
    setPlaying(key);
    void speakPieces(synth, t.sample, voice, voice.lang, {
      rate,
      register: (cancel) => {
        cancelRef.current = cancel;
      },
    }).then(() => setPlaying((p) => (p === key ? null : p)));
  }

  if (!supported) return null;

  const option = (key: string, name: string | null, label: string, meta: ReactNode) => {
    const selected = name === current;
    return (
      <li key={key} className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5", selected ? s.selected : s.row)}>
        <button
          type="button"
          role="radio"
          aria-checked={selected}
          onClick={() => {
            saveVoiceChoice(lang, name);
            preview(name, key);
          }}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span aria-hidden className={cn("grid size-4 shrink-0 place-items-center rounded-full border", selected ? "border-current" : s.chip)}>
            {selected ? <Check className="size-3" /> : null}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-caption font-medium">{label}</span>
            <span className={cn("flex flex-wrap items-center gap-1 text-[11px]", s.muted)}>{meta}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => preview(name, key)}
          className={cn("grid size-7 shrink-0 place-items-center rounded-full", s.row)}
          aria-label={playing === key ? t.stop : `${t.play}: ${label}`}
          title={playing === key ? t.stop : t.play}
        >
          {playing === key ? <Square className="size-3" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
        </button>
      </li>
    );
  };

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        aria-label={t.button}
        title={t.button}
        className={s.trigger}
      >
        <Settings2 aria-hidden className="size-4" />
      </button>
      {open ? (
        <div
          id={`${id}-panel`}
          role="dialog"
          aria-label={t.title}
          className={cn("absolute right-0 top-full z-[60] mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border p-3 text-left shadow-2xl", s.panel)}
        >
          <p className="text-small font-semibold">{t.title}</p>
          <p className={cn("mt-0.5 text-[11px] leading-snug", s.muted)}>{t.note}</p>

          {voices === null ? (
            <p className={cn("mt-3 flex items-center gap-2 text-caption", s.muted)}>
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              {t.loading}
            </p>
          ) : list.length === 0 ? (
            <p className={cn("mt-3 text-caption", s.muted)}>{t.none}</p>
          ) : (
            <ul role="radiogroup" aria-label={t.title} className="mt-2 max-h-64 space-y-0.5 overflow-y-auto pr-1">
              {option("auto", null, t.auto, autoVoice ? <span className="truncate">{autoVoice.name}</span> : null)}
              {list.map((v) =>
                option(
                  `v:${v.name}`,
                  v.name,
                  v.name.replace(/^Microsoft\s+/i, "").replace(/\s*-\s*.*$/, "").replace(/\s*\((natural)\)/i, ""),
                  <>
                    {v.natural ? <span className={cn("rounded px-1 py-px font-medium", s.badge)}>{t.natural}</span> : null}
                    {v.gender > 0 ? <span>{t.female}</span> : v.gender < 0 ? <span>{t.male}</span> : null}
                    {regionLabel(v.lang) ? <span>· {regionLabel(v.lang)}</span> : null}
                  </>,
                ),
              )}
            </ul>
          )}

          <div className="mt-3">
            <p className={cn("text-[11px] font-medium uppercase tracking-wide", s.muted)}>{t.speed}</p>
            <div role="radiogroup" aria-label={t.speed} className="mt-1 grid grid-cols-3 gap-1">
              {(Object.keys(VOICE_SPEEDS) as VoiceSpeed[]).map((sp) => (
                <button
                  key={sp}
                  type="button"
                  role="radio"
                  aria-checked={prefs.speed === sp}
                  onClick={() => {
                    saveVoiceSpeed(sp);
                    preview(current, `speed:${sp}`, VOICE_SPEEDS[sp]);
                  }}
                  className={cn("rounded-lg border px-2 py-1 text-caption", prefs.speed === sp ? s.chipOn : s.chip)}
                >
                  {t.speeds[sp]}
                </button>
              ))}
            </div>
          </div>

          <button type="button" onClick={close} className={cn("mt-3 w-full rounded-lg px-3 py-1.5 text-caption font-semibold", s.primary)}>
            {t.close}
          </button>
        </div>
      ) : null}
    </div>
  );
}
