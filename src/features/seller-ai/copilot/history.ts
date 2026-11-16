import type { CopilotChatMessage } from "./types";

export const COPILOT_HISTORY_MAX = 16;

/**
 * Conversation sent to the server (pure): error turns dropped, capped to the last turns, starts
 * with the seller's message and ends with the new question.
 */
export function historyFor(messages: { role: "user" | "assistant"; content: string; error?: boolean }[], question: string): CopilotChatMessage[] {
  const turns = [...messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content: content.slice(0, 2000) })), { role: "user" as const, content: question }].slice(-COPILOT_HISTORY_MAX);
  const first = turns.findIndex((m) => m.role === "user");
  return turns.slice(first);
}
