/**
 * Drawer UI text for "Ask Tara" (pure). English and Hindi; other panel languages use
 * English UI while replies follow the chosen reply language.
 */
import type { CopilotIntent } from "./quick-actions";

export type CopilotCopy = {
  open: string;
  title: string;
  subtitleStore: string;
  subtitleInformative: string;
  close: string;
  clear: string;
  placeholder: string;
  send: string;
  thinking: string;
  welcomeStore: string;
  welcomeInformative: string;
  costAsk: string;
  costUnknown: string;
  balance: string;
  retry: string;
  errorGeneric: string;
  apply: string;
  applyCost: string;
  applyFree: string;
  applying: string;
  applied: string;
  discard: string;
  discarded: string;
  current: string;
  proposed: string;
  empty: string;
  copy: string;
  copied: string;
  micStart: string;
  micStop: string;
  micUnsupported: string;
  micDenied: string;
  transcribing: string;
  speakOn: string;
  speakOff: string;
  language: string;
  cancelQuick: string;
  rebuild: string;
  rebuilding: string;
  rebuildConfirm: string;
  quick: Partial<Record<CopilotIntent, string>>;
};

const en: CopilotCopy = {
  open: "Ask Tara",
  title: "Tara · Pictocart AI",
  subtitleStore: "Your store copilot. Nothing changes until you press Apply.",
  subtitleInformative: "Your website copilot. Nothing changes until you press Apply.",
  close: "Close",
  clear: "Clear chat",
  placeholder: "Ask anything about your business…",
  send: "Send",
  thinking: "Thinking",
  welcomeStore: "Hi, I'm Tara! I know your products, orders and stock. Ask a question or pick a task below.",
  welcomeInformative: "Hi, I'm Tara! I know your services, pages and enquiries. Ask a question or pick a task below.",
  costAsk: "Each question uses {credits} AI credits",
  costUnknown: "Each question uses AI credits",
  balance: "{balance} left",
  retry: "Retry",
  errorGeneric: "Something went wrong. Try again.",
  apply: "Apply",
  applyCost: "Apply · {credits} credits",
  applyFree: "Apply · free",
  applying: "Applying…",
  applied: "Applied",
  discard: "Discard",
  discarded: "Discarded",
  current: "Now",
  proposed: "Proposed",
  empty: "(empty)",
  copy: "Copy",
  copied: "Copied",
  micStart: "Speak your question",
  micStop: "Stop recording",
  micUnsupported: "Voice input isn't supported in this browser.",
  micDenied: "Allow microphone access to speak your question.",
  transcribing: "Listening…",
  speakOn: "Read replies aloud: on",
  speakOff: "Read replies aloud: off",
  language: "Reply language",
  cancelQuick: "Cancel task",
  rebuild: "Rebuild my whole website with AI",
  rebuilding: "Rewriting your website…",
  rebuildConfirm: "Rewrite your tagline, About text, service descriptions, FAQs and search engine text with AI? Your prices, photos and contact details stay as they are.",
  quick: {},
};

const hi: CopilotCopy = {
  ...en,
  open: "तारा से पूछें",
  title: "तारा · Pictocart AI",
  subtitleStore: "आपका स्टोर सहायक। Apply दबाने तक कुछ नहीं बदलेगा।",
  subtitleInformative: "आपकी वेबसाइट सहायक। Apply दबाने तक कुछ नहीं बदलेगा।",
  close: "बंद करें",
  clear: "चैट साफ़ करें",
  placeholder: "अपने बिज़नेस के बारे में कुछ भी पूछें…",
  send: "भेजें",
  thinking: "सोच रहा है",
  welcomeStore: "नमस्ते, मैं तारा हूँ! मुझे आपके प्रोडक्ट, ऑर्डर और स्टॉक की जानकारी है। सवाल पूछें या नीचे से कोई काम चुनें।",
  welcomeInformative: "नमस्ते, मैं तारा हूँ! मुझे आपकी सेवाओं, पेजों और पूछताछ की जानकारी है। सवाल पूछें या नीचे से कोई काम चुनें।",
  costAsk: "हर सवाल में {credits} AI क्रेडिट लगते हैं",
  costUnknown: "हर सवाल में AI क्रेडिट लगते हैं",
  balance: "{balance} बाकी",
  retry: "फिर से कोशिश करें",
  errorGeneric: "कुछ गड़बड़ हुई। फिर से कोशिश करें।",
  applyCost: "Apply · {credits} क्रेडिट",
  applyFree: "Apply · मुफ़्त",
  applying: "लागू हो रहा है…",
  applied: "लागू हो गया",
  discard: "हटाएँ",
  discarded: "हटाया गया",
  current: "अभी",
  proposed: "सुझाव",
  empty: "(खाली)",
  copy: "कॉपी",
  copied: "कॉपी हो गया",
  micStart: "बोलकर पूछें",
  micStop: "रिकॉर्डिंग रोकें",
  micUnsupported: "इस ब्राउज़र में आवाज़ से पूछना उपलब्ध नहीं है।",
  micDenied: "बोलकर पूछने के लिए माइक्रोफ़ोन की अनुमति दें।",
  transcribing: "सुन रहा है…",
  speakOn: "जवाब बोलकर सुनाएँ: चालू",
  speakOff: "जवाब बोलकर सुनाएँ: बंद",
  language: "जवाब की भाषा",
  cancelQuick: "रद्द करें",
  quick: {
    product_description: "प्रोडक्ट विवरण बेहतर करें",
    product_seo: "प्रोडक्ट का SEO टाइटल",
    faqs: "FAQ लिखें",
    promo: "ऑफ़र मैसेज लिखें",
    review_reply: "रिव्यू का जवाब",
    next_steps: "बिक्री बढ़ाने के लिए आगे क्या करूँ?",
    improve_about: "About टेक्स्ट बेहतर करें",
    service_description: "सेवा का विवरण लिखें",
    seo: "Google टाइटल बेहतर करें",
    enquiry_reply: "पूछताछ का जवाब",
    whats_missing: "मेरी साइट पर क्या कमी है?",
  },
};

export function copilotCopy(lang: string | null | undefined): CopilotCopy {
  return lang === "hi" ? hi : en;
}

export const fill = (template: string, vars: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
