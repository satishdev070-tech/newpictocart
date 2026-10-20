import { describe, expect, it } from "vitest";
import { parseSectionJson } from "@/features/theme/site-builder/ai-section";

describe("parseSectionJson", () => {
  it("reads a JSON object with a string type and object settings", () => {
    expect(parseSectionJson('{"type":"FAQ","settings":{"heading":"Use {curly} braces","items":[{"question":"How long?","answer":"3–5 days"}]}}')).toEqual({
      type: "FAQ",
      settings: { heading: "Use {curly} braces", items: [{ question: "How long?", answer: "3–5 days" }] },
    });
  });

  it("extracts the first JSON object when the reply is wrapped in prose", () => {
    const text = ['A note {not really json} then the section:', '```json', '{"type":"Hero","settings":{"heading":"Welcome home"}}', "```", "Hope that helps!"].join("\n");
    expect(parseSectionJson(text)).toEqual({ type: "Hero", settings: { heading: "Welcome home" } });
    expect(parseSectionJson('Use this one: {"type":"Testimonials","settings":{"heading":"Loved by customers"}} Thanks!')).toEqual({
      type: "Testimonials",
      settings: { heading: "Loved by customers" },
    });
  });

  it("returns null for garbage", () => {
    expect(parseSectionJson("not json at all")).toBeNull();
    expect(parseSectionJson("{type: FAQ}")).toBeNull();
    expect(parseSectionJson("")).toBeNull();
    expect(parseSectionJson('{"settings":{}}')).toBeNull();
    expect(parseSectionJson('{"type":1,"settings":{}}')).toBeNull();
  });

  it("uses {} when settings are missing or not an object", () => {
    expect(parseSectionJson('{"type":"FAQ"}')).toEqual({ type: "FAQ", settings: {} });
    expect(parseSectionJson('{"type":"FAQ","settings":"nope"}')).toEqual({ type: "FAQ", settings: {} });
    expect(parseSectionJson('{"type":" FAQ "}')).toEqual({ type: "FAQ", settings: {} });
  });
});
