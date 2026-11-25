/**
 * Device (browser) voices for Tara: ranking, the seller's saved choice, speed, and speaking long
 * replies in sentence-sized pieces. Used whenever Sarvam audio is unavailable (no credits, outage)
 * and by the surfaces that always speak with the device voice.
 *
 * Ranking (pure; unit tested): language is never traded away; then the region (exact locale, then
 * India, then elsewhere); then a female voice (Tara is a woman); then quality: "Natural" / "Neural"
 * / "Online" / "Enhanced" / "Premium" voices and Chrome's Google voices sound far better than the
 * old offline engines, so they win among voices of the same region and gender.
 */
import { voiceGenderScore } from "@/lib/speech/voice-gender";

export type VoiceLike = Pick<SpeechSynthesisVoice, "lang" | "name" | "localService" | "default">;

const normTag = (tag: string) => tag.trim().replace(/_/g, "-").toLowerCase();
const baseLang = (tag: string) => normTag(tag).split("-")[0]!;

/** Higher = sounds more natural. Name-based: the Web Speech API exposes no quality field. */
export function voiceQualityScore(name: string): number {
  const n = name.toLowerCase();
  if (/\b(natural|neural|premium|enhanced|siri)\b/.test(n)) return 40;
  if (/\bonline\b/.test(n)) return 30;
  if (/^google\b/.test(n)) return 25;
  if (/\b(compact|espeak|robot)\b/.test(n)) return -20;
  return 0;
}

/** Apple's novelty voices ("Bubbles", "Bad News", …): never offered or picked for Tara. */
const NOVELTY = new Set([
  "albert", "bad news", "bahh", "bells", "boing", "bubbles", "cellos", "deranged", "good news", "hysterical",
  "jester", "junior", "organ", "pipe organ", "ralph", "superstar", "trinoids", "whisper", "wobble", "zarvox", "kathy",
]);
export const isNoveltyVoice = (name: string) => NOVELTY.has(name.toLowerCase().replace(/\s*\(.*\)\s*$/, "").trim());

export type RankedVoice<V> = { voice: V; score: number };

/** Voices that speak `lang`'s language, best first. */
export function rankVoices<V extends VoiceLike>(voices: readonly V[], lang: string): RankedVoice<V>[] {
  const want = normTag(lang);
  const base = baseLang(want);
  const out: RankedVoice<V>[] = [];
  for (const v of voices) {
    const tag = normTag(v.lang);
    if (baseLang(tag) !== base || isNoveltyVoice(v.name)) continue;
    let score = tag === want ? 300 : tag.endsWith("-in") ? 200 : 100;
    score += Math.sign(voiceGenderScore(v.name)) * 150; // a (likely) female voice outranks region, never language
    score += voiceQualityScore(v.name);
    if (v.default) score += 5;
    if (v.localService) score += 1; // tie-break only: on-device starts faster
    out.push({ voice: v, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

/**
 * Best voice for `lang`, or the seller's saved voice when this device has it. Null when nothing
 * speaks the language (callers stay silent rather than read Hindi with an English voice).
 */
export function chooseVoice<V extends VoiceLike>(voices: readonly V[], lang: string, preferredName?: string | null): V | null {
  const ranked = rankVoices(voices, lang);
  if (preferredName) {
    const saved = ranked.find((r) => r.voice.name === preferredName);
    if (saved) return saved.voice;
  }
  return ranked[0]?.voice ?? null;
}

// ---- seller preference (per browser) ----------------------------------------------------------

export const VOICE_SPEEDS = { slow: 0.85, normal: 0.95, fast: 1.1 } as const;
export type VoiceSpeed = keyof typeof VOICE_SPEEDS;
export type VoicePrefs = { voices: Record<string, string>; speed: VoiceSpeed };

const PREFS_KEY = "pc-tara-voice-v1";
export const VOICE_PREFS_EVENT = "pc-tara-voice-change";
const DEFAULT_PREFS: VoicePrefs = { voices: {}, speed: "normal" };

export function parseVoicePrefs(raw: string | null): VoicePrefs {
  if (!raw) return { ...DEFAULT_PREFS, voices: {} };
  try {
    const v = JSON.parse(raw) as Partial<VoicePrefs>;
    const voices: Record<string, string> = {};
    if (v.voices && typeof v.voices === "object") {
      for (const [k, name] of Object.entries(v.voices)) {
        if (/^[a-z]{2,3}$/.test(k) && typeof name === "string" && name.length <= 200) voices[k] = name;
      }
    }
    const speed = typeof v.speed === "string" && v.speed in VOICE_SPEEDS ? (v.speed as VoiceSpeed) : "normal";
    return { voices, speed };
  } catch {
    return { ...DEFAULT_PREFS, voices: {} };
  }
}

export function readVoicePrefs(): VoicePrefs {
  try {
    return parseVoicePrefs(typeof window === "undefined" ? null : window.localStorage.getItem(PREFS_KEY));
  } catch {
    return { ...DEFAULT_PREFS, voices: {} };
  }
}

function writeVoicePrefs(p: VoicePrefs): void {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* private mode: choice lasts for this page only */
  }
  try {
    window.dispatchEvent(new Event(VOICE_PREFS_EVENT));
  } catch {
    /* ignore */
  }
}

// useSyncExternalStore helpers: a stable snapshot per stored value.
let snapRaw: string | null | undefined;
let snap: VoicePrefs = { ...DEFAULT_PREFS, voices: {} };
export const SERVER_VOICE_PREFS: VoicePrefs = { ...DEFAULT_PREFS, voices: {} };

export function voicePrefsSnapshot(): VoicePrefs {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(PREFS_KEY);
  } catch {
    raw = null;
  }
  if (raw !== snapRaw) {
    snapRaw = raw;
    snap = parseVoicePrefs(raw);
  }
  return snap;
}

export function subscribeVoicePrefs(cb: () => void): () => void {
  window.addEventListener(VOICE_PREFS_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(VOICE_PREFS_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Save (or clear with null = automatic) the voice for `lang`'s language. */
export function saveVoiceChoice(lang: string, name: string | null): void {
  const p = readVoicePrefs();
  const key = baseLang(lang);
  if (name) p.voices[key] = name;
  else delete p.voices[key];
  writeVoicePrefs(p);
}

export function saveVoiceSpeed(speed: VoiceSpeed): void {
  writeVoicePrefs({ ...readVoicePrefs(), speed });
}

export const savedVoiceName = (lang: string): string | null => readVoicePrefs().voices[baseLang(lang)] ?? null;
export const savedVoiceRate = (): number => VOICE_SPEEDS[readVoicePrefs().speed];

// ---- speaking ---------------------------------------------------------------------------------

/**
 * Split a reply into sentence-sized pieces. Chrome's online voices stop after ~15 s of one
 * utterance, and short pieces also let Stop cut in quickly. Splits on . ! ? । and new lines,
 * then on commas / spaces for anything still longer than `max`.
 */
export function speechChunks(text: string, max = 220): string[] {
  const clean = text.replace(/\s+\n/g, "\n").trim();
  if (!clean) return [];
  const sentences = clean.split(/(?<=[.!?।॥])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const s of sentences) {
    if (s.length <= max) {
      out.push(s);
      continue;
    }
    let rest = s;
    while (rest.length > max) {
      const window = rest.slice(0, max);
      const cut = Math.max(window.lastIndexOf(", "), window.lastIndexOf("، "));
      const at = cut > max / 3 ? cut + 1 : window.lastIndexOf(" ") > max / 3 ? window.lastIndexOf(" ") : max;
      out.push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
    if (rest) out.push(rest);
  }
  return out;
}

export function speechSynth(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return null;
  return window.speechSynthesis;
}

/** Device voices, waiting briefly for Chrome's async `voiceschanged` on first use. */
export function deviceVoices(timeoutMs = 1_500): Promise<SpeechSynthesisVoice[]> {
  const synth = speechSynth();
  if (!synth) return Promise.resolve([]);
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener("voiceschanged", done);
      window.clearTimeout(timer);
      resolve(synth.getVoices());
    };
    const timer = window.setTimeout(done, timeoutMs);
    synth.addEventListener("voiceschanged", done);
  });
}

/** The voice Tara will use on this device for `lang` (saved choice or best), or null. */
export async function taraDeviceVoice(lang: string): Promise<SpeechSynthesisVoice | null> {
  return chooseVoice(await deviceVoices(), lang, savedVoiceName(lang));
}

/** Safety timeout for a piece whose `onend` never fires (some engines drop it). */
const pieceTimeoutMs = (text: string, rate: number) => Math.min(30_000, (3_000 + text.length * 110) / Math.max(0.5, rate));

/**
 * Speak `text` with `voice` piece by piece. Resolves true when everything was spoken, false when
 * cancelled. `register` receives a cancel function before speech starts.
 */
export function speakPieces(
  synth: SpeechSynthesis,
  text: string,
  voice: SpeechSynthesisVoice | null,
  lang: string,
  opts: { rate?: number; register?: (cancel: () => void) => void } = {},
): Promise<boolean> {
  const pieces = speechChunks(text);
  const rate = opts.rate ?? savedVoiceRate();
  if (!pieces.length) return Promise.resolve(true);
  return new Promise((resolve) => {
    let cancelled = false;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(ok);
    };
    opts.register?.(() => {
      cancelled = true;
      synth.cancel();
      finish(false);
    });
    synth.cancel(); // drop anything queued (e.g. a silent priming utterance)
    const next = (i: number) => {
      if (cancelled || settled) return;
      if (i >= pieces.length) return finish(true);
      const piece = pieces[i]!;
      const u = new SpeechSynthesisUtterance(piece);
      u.lang = voice?.lang ?? lang;
      if (voice) u.voice = voice;
      u.rate = rate;
      let moved = false;
      const go = () => {
        if (moved) return;
        moved = true;
        if (timer) clearTimeout(timer);
        next(i + 1);
      };
      u.onend = go;
      u.onerror = (e) => {
        // "interrupted"/"canceled" = Stop or a new reply: end here.
        const err = (e as SpeechSynthesisErrorEvent).error;
        if (err === "interrupted" || err === "canceled") finish(false);
        else go();
      };
      timer = setTimeout(go, pieceTimeoutMs(piece, rate));
      synth.speak(u);
    };
    next(0);
  });
}
