/** Pre-auth intents from the Pictocart Prototype v2 “hello” step. */
export const START_INTENTS = [
  {
    id: "first-business",
    title: "Starting my first business",
    titleHi: "अपना पहला बिजनेस शुरू कर रहे हैं",
    sub: "I have products, no store yet",
    subHi: "सामान है, दुकान नहीं",
  },
  {
    id: "offline-to-online",
    title: "I sell offline, want to go online",
    titleHi: "ऑफलाइन बेचते हैं, अब ऑनलाइन आएंगे",
    sub: "Shop, stall or from home",
    subHi: "दुकान, स्टॉल या घर से",
  },
  {
    id: "social-seller",
    title: "I sell on WhatsApp or Instagram",
    titleHi: "WhatsApp या Instagram पर बेचते हैं",
    sub: "Want a proper store and payments",
    subHi: "अच्छी दुकान और पेमेंट चाहिए",
  },
  {
    id: "platform-switch",
    title: "Moving from another platform",
    titleHi: "दूसरे प्लेटफॉर्म्स से आ रहे हैं",
    sub: "Bring my products and customers",
    subHi: "प्रोडक्ट और ग्राहक साथ लाएँ",
  },
] as const;

export type StartIntentId = (typeof START_INTENTS)[number]["id"];

export function isStartIntentId(v: unknown): v is StartIntentId {
  return typeof v === "string" && START_INTENTS.some((i) => i.id === v);
}
