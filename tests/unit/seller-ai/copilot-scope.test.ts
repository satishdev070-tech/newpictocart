import { describe, expect, it } from "vitest";
import { copilotScopeRule, copilotTopicSchema } from "@/features/seller-ai/copilot/scope";
import { storeCopilotReplySchema } from "@/features/seller-ai/copilot/schemas";
import { storeCopilotPrompt } from "@/features/seller-ai/copilot/prompts";
import { informativeCopilotPrompt } from "@/features/informative/ai/copilot-prompts";
import { informativeCopilotReplySchema } from "@/features/informative/ai/copilot-views";
import { copilotCallGreeting, spokenText } from "@/features/seller-ai/copilot/call-greeting";
import { COPILOT_LANGUAGES } from "@/features/seller-ai/copilot/languages";

describe("Tara stays on the business", () => {
  it("tells both panels to decline off-topic questions and plan nothing", () => {
    const store = storeCopilotPrompt({ storeName: "Nuts", language: "en", snapshot: "x", messages: [{ role: "user", content: "hi" }] }).system;
    const info = informativeCopilotPrompt({ businessName: "Smile", language: "hi", snapshot: "x", messages: [{ role: "user", content: "hi" }] }).system;
    for (const p of [store, info]) {
      expect(p).toContain('"topic":"business"|"off_topic"');
      expect(p).toMatch(/Do not answer the off-topic question/);
      expect(p).toMatch(/links \[\] and proposals \[\]/);
    }
    expect(copilotScopeRule("store")).toContain("this online store");
    expect(copilotScopeRule("informative")).toContain("this business and its website");
  });

  it("reads the topic leniently (missing or unknown = on topic)", () => {
    expect(copilotTopicSchema.parse(undefined)).toBe("business");
    expect(copilotTopicSchema.parse("weather")).toBe("business");
    expect(copilotTopicSchema.parse("off_topic")).toBe("off_topic");
    expect(storeCopilotReplySchema.parse({ answer: "Hi" }).topic).toBe("business");
    expect(storeCopilotReplySchema.parse({ topic: "off_topic", answer: "Sorry" }).topic).toBe("off_topic");
    expect(informativeCopilotReplySchema.parse({ topic: "off_topic", reply: "Sorry" }).topic).toBe("off_topic");
  });
});

describe("voice call lines", () => {
  it("greets in every reply language", () => {
    for (const l of COPILOT_LANGUAGES) expect(copilotCallGreeting(l).length).toBeGreaterThan(10);
    expect(copilotCallGreeting("hi")).toContain("तारा");
  });
  it("speaks plain text, not markdown", () => {
    expect(spokenText("**Done.**\n- Stock is `50`\nSee [Products](/x)")).toBe("Done.\nStock is 50\nSee Products");
  });
});
