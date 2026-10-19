import { describe, expect, it } from "vitest";
import { emptyStartDraft, parseStartDraft, START_DRAFT_STORAGE_KEY } from "@/features/start/draft/schema";
import { startPreviewHost } from "@/features/start/components/live-preview";

describe("start draft schema", () => {
  it("round-trips empty draft", () => {
    const d = emptyStartDraft({ plan: "starter", theme: null });
    expect(d.v).toBe(1);
    expect(d.screen).toBe("welcome");
    expect(d.plan).toBe("starter");
    const again = parseStartDraft(d);
    expect(again).toEqual(d);
  });

  it("returns null for invalid payload", () => {
    expect(parseStartDraft({ v: 2 })).toBeNull();
    expect(parseStartDraft({ v: 1, screen: "nope" })).toBeNull();
  });

  it("exports storage key constant", () => {
    expect(START_DRAFT_STORAGE_KEY).toBe("pictocart.start.draft.v1");
  });

  it("keeps drafts saved before the conversation history field", () => {
    const d = emptyStartDraft();
    const stored = { ...d, voice: { facts: d.voice.facts, done: false } };
    const again = parseStartDraft(stored);
    expect(again?.voice.turns).toEqual([]);
  });

  it("uses the store slug in the preview address", () => {
    expect(startPreviewHost("Radhika Jewellers", "localhost")).toBe("radhika-jewellers.localhost");
  });
});
