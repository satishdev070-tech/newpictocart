/** Pre-auth intents from the Pictocart Prototype v2 “hello” step. */
export const START_INTENTS = [
  { id: "first-business", title: "Starting my first business", sub: "I have products, no store yet" },
  { id: "offline-to-online", title: "I sell offline, want to go online", sub: "Shop, stall or from home" },
  { id: "social-seller", title: "I sell on WhatsApp or Instagram", sub: "Want a proper store and payments" },
  { id: "platform-switch", title: "Moving from another platform", sub: "Bring my products and customers" },
] as const;

export type StartIntentId = (typeof START_INTENTS)[number]["id"];

export function isStartIntentId(v: unknown): v is StartIntentId {
  return typeof v === "string" && START_INTENTS.some((i) => i.id === v);
}
