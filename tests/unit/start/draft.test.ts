import { describe, expect, it } from "vitest";
import { emptyStartDraft, parseStartDraft, START_DRAFT_STORAGE_KEY } from "@/features/start/draft/schema";

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
});
