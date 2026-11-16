import { describe, expect, it } from "vitest";
import {
  DIDNT_CATCH_THAT,
  entriesFromTurns,
  entriesToHistory,
  formatCallClock,
  makeEntry,
  messageCount,
  turnToEntries,
} from "@/features/onboarding/voice/transcript";

describe("Tara transcript mapping", () => {
  it("shows the seller's recognised words, not a placeholder", () => {
    const lines = turnToEntries(
      { transcript: "I sell fashion jewellery in Noida", userText: "I sell fashion jewellery in Noida", heard: true, reply: "Lovely! What types?" },
      1000,
    );
    expect(lines.map((l) => [l.role, l.text])).toEqual([
      ["seller", "I sell fashion jewellery in Noida"],
      ["tara", "Lovely! What types?"],
    ]);
    expect(lines.every((l) => !l.text.includes("Voice message"))).toBe(true);
    expect(lines[0]!.at).toBe(1000);
  });

  it("falls back to `transcript` for older responses without userText", () => {
    const lines = turnToEntries({ transcript: "Glow Box", reply: "Nice name!" });
    expect(lines[0]).toMatchObject({ role: "seller", text: "Glow Box" });
  });

  it("adds a single system line when STT heard nothing", () => {
    expect(turnToEntries({ transcript: "", userText: "", heard: false, reply: "" }).map((l) => [l.role, l.text])).toEqual([
      ["system", DIDNT_CATCH_THAT],
    ]);
    expect(turnToEntries({ transcript: "   ", reply: "x" }, 0, "Sorry?")[0]).toMatchObject({ role: "system", text: "Sorry?" });
  });

  it("round-trips saved turns and drops system lines from history", () => {
    const entries = [
      ...entriesFromTurns([
        { role: "tara", text: "Hi" },
        { role: "seller", text: "Glow Box" },
      ]),
      makeEntry("system", DIDNT_CATCH_THAT),
    ];
    expect(entries[0]!.at).toBeNull();
    expect(messageCount(entries)).toBe(2);
    expect(entriesToHistory(entries)).toEqual([
      { role: "tara", text: "Hi" },
      { role: "seller", text: "Glow Box" },
    ]);
    const long = Array.from({ length: 20 }, (_, i) => makeEntry("seller", `m${i}`));
    expect(entriesToHistory(long)).toHaveLength(12);
  });

  it("formats the call timer as mm:ss", () => {
    expect(formatCallClock(0)).toBe("00:00");
    expect(formatCallClock(75_400)).toBe("01:15");
    expect(formatCallClock(-5)).toBe("00:00");
  });
});
