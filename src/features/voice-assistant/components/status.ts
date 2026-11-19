/**
 * Voice assistant status machine (pure, unit tested). idle → listening → transcribing → thinking →
 * speaking → idle, with error reachable from any state and cancel/done always returning to idle.
 */
import type { AssistantLocale } from "../languages";

export type AssistantStatus = "idle" | "listening" | "transcribing" | "thinking" | "speaking" | "error";
export type AssistantEvent = "listen" | "transcribe" | "send" | "speak" | "done" | "fail";

export function nextStatus(s: AssistantStatus, e: AssistantEvent): AssistantStatus {
  switch (e) {
    case "listen":
      return "listening";
    case "transcribe":
      return s === "listening" ? "transcribing" : s;
    case "send":
      return "thinking";
    case "speak":
      return s === "thinking" ? "speaking" : s;
    case "fail":
      return "error";
    case "done":
      return "idle";
  }
}

const LABELS: Record<AssistantStatus, string> = {
  idle: "Ready",
  listening: "Listening… tap Stop when you finish",
  transcribing: "Got it…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  error: "Something went wrong",
};
export const statusLabel = (s: AssistantStatus): string => LABELS[s];

export const ASSISTANT_SUGGESTIONS: Record<AssistantLocale, string[]> = {
  "en-IN": ["Make my brand colour dark green", "What can you help me with?", "How do I add a product?"],
  "hi-IN": ["मेरे स्टोर का रंग मरून कर दो", "आप क्या-क्या कर सकते हैं?"],
  hinglish: ["Mere store ka colour maroon kar do", "Aap kya kya kar sakte ho?"],
};
