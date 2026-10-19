import { describe, expect, it } from "vitest";
import { buildSeedBrief } from "@/features/start/brief";
import { emptyStartDraft } from "@/features/start/draft/schema";

describe("buildSeedBrief", () => {
  it("includes product title and mood", () => {
    const d = emptyStartDraft();
    d.business.name = "Meera Handloom";
    d.business.category = "fashion";
    d.mood = "kamal";
    d.accent = "#EC4899";
    d.products = [{ id: "1", title: "Bandhani stole", pricePaise: 145_000 }];
    const brief = buildSeedBrief(d);
    expect(brief).toContain("Meera Handloom");
    expect(brief).toContain("Bandhani stole");
    expect(brief).toContain("kamal");
    expect(brief).toContain("#EC4899");
  });
});
