/**
 * Pure transcript helpers for the Tara call UI (client-safe, no server imports).
 * The seller bubble always shows what STT actually recognised — never a placeholder.
 */

export type TranscriptRole = "tara" | "seller" | "system";

export type TranscriptEntry = {
  id: string;
  role: TranscriptRole;
  text: string;
  /** Epoch ms when the line was added; null for lines restored from a saved draft. */
  at: number | null;
};

/** The parts of a Tara turn result the transcript needs (subset of `VoiceTurnData`). */
export type TurnForTranscript = {
  transcript: string;
  userText?: string;
  heard?: boolean;
  reply: string;
};

export const DIDNT_CATCH_THAT = "Didn't catch that";

let seq = 0;
function nextId(role: TranscriptRole): string {
  seq += 1;
  return `${role}-${Date.now().toString(36)}-${seq}`;
}

export function makeEntry(role: TranscriptRole, text: string, at: number | null = Date.now()): TranscriptEntry {
  return { id: nextId(role), role, text, at };
}

/**
 * Lines to append after one turn: the seller's recognised words + Tara's reply, or a single
 * "Didn't catch that" system line when the audio had no speech.
 */
export function turnToEntries(turn: TurnForTranscript, now: number = Date.now(), didntCatch = DIDNT_CATCH_THAT): TranscriptEntry[] {
  const said = (turn.userText ?? turn.transcript ?? "").trim();
  if (turn.heard === false || !said) {
    return [makeEntry("system", didntCatch, now)];
  }
  const out: TranscriptEntry[] = [makeEntry("seller", said, now)];
  const reply = turn.reply.trim();
  if (reply) out.push(makeEntry("tara", reply, now));
  return out;
}

/** Saved draft turns → transcript lines (no timestamps). */
export function entriesFromTurns(turns: readonly { role: "seller" | "tara"; text: string }[]): TranscriptEntry[] {
  return turns.filter((t) => t.text.trim()).map((t) => makeEntry(t.role, t.text, null));
}

/** Transcript → history the server sees (system lines dropped, last 12, ≤800 chars each). */
export function entriesToHistory(entries: readonly TranscriptEntry[]): { role: "seller" | "tara"; text: string }[] {
  return entries
    .filter((e): e is TranscriptEntry & { role: "seller" | "tara" } => e.role !== "system")
    .slice(-12)
    .map((e) => ({ role: e.role, text: e.text.slice(0, 800) }));
}

/** Number of real conversation messages (system lines excluded). */
export function messageCount(entries: readonly TranscriptEntry[]): number {
  return entries.filter((e) => e.role !== "system").length;
}

/** Call timer label, e.g. 75_000 → "01:15". */
export function formatCallClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
