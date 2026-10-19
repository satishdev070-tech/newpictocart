/**
 * Ambient fallback for `@/lib/sarvam/client` until the foundation workstream merges.
 * Signatures mirror the real client (`chatTurn` → string, `translateText` → string).
 */
declare module "@/lib/sarvam/client" {
  export type SarvamChatMessage = { role: "system" | "user" | "assistant"; content: string };

  export function chatTurn(args: {
    messages: SarvamChatMessage[];
    languageCode: string;
    temperature?: number;
  }): Promise<string>;

  export function translateText(args: {
    text: string;
    source: string;
    target: string;
  }): Promise<string>;

  export function isSarvamConfigured(): boolean;
}
