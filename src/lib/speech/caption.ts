/**
 * Live caption accumulator for browser speech recognition (pure, unit tested). A turn can span
 * several recognition sessions: engines end a session after a pause, and the caller restarts it
 * until the merchant presses Stop. Shared by the onboarding call and `dictate()`.
 */

/**
 * What the seller has said in the current turn. A turn can span several recognition sessions
 * (a session ends after each pause, and we restart it until the end-of-turn timer fires).
 */
export type CaptionState = {
  /** Text from earlier sessions in this turn. */
  committed: string;
  /** Final results of the running session. */
  final: string;
  /** Interim (still changing) text of the running session. */
  interim: string;
};

export type RecognitionPiece = { text: string; isFinal: boolean };

export type CaptionEvent =
  /** The full results list of the running session (SpeechRecognitionEvent.results). */
  | { type: "results"; pieces: readonly RecognitionPiece[] }
  /** The session ended. Its text is kept for the turn. */
  | { type: "session-end" }
  | { type: "reset" };

export const emptyCaption: CaptionState = { committed: "", final: "", interim: "" };

function join(...parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(" ");
}

export function captionReducer(s: CaptionState, e: CaptionEvent): CaptionState {
  switch (e.type) {
    case "results": {
      const final = join(...e.pieces.filter((p) => p.isFinal).map((p) => p.text));
      const interim = join(...e.pieces.filter((p) => !p.isFinal).map((p) => p.text));
      if (final === s.final && interim === s.interim) return s;
      return { ...s, final, interim };
    }
    case "session-end": {
      // Engines that end without a final result leave the last interim text: keep it.
      const committed = join(s.committed, s.final, s.interim);
      if (committed === s.committed && !s.final && !s.interim) return s;
      return { committed, final: "", interim: "" };
    }
    case "reset":
      return s === emptyCaption ? s : emptyCaption;
  }
}

/** Everything heard so far in this turn (shown live, sent as the turn text). */
export function captionText(s: CaptionState): string {
  return join(s.committed, s.final, s.interim);
}

/** True once the turn holds any text. */
export function captionHasText(s: CaptionState): boolean {
  return captionText(s).length > 0;
}

/** Results list (DOM shape) → plain pieces. */
export function piecesFromResults(results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>): RecognitionPiece[] {
  const out: RecognitionPiece[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (!r || r.length === 0) continue;
    out.push({ text: r[0]?.transcript ?? "", isFinal: r.isFinal });
  }
  return out;
}
