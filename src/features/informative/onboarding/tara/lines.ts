import type { InfoFactKey, InfoVoiceFacts } from "./facts";
import { missingInfoFacts } from "./facts";

/**
 * Tara's fixed lines for the Informative journey (pure; client + server). The greeting opens the
 * call; the scripted questions are used only when every AI brain is unavailable.
 */
const GREETING: Record<string, string> = {
  "en-IN": "Namaste! I'm Tara. Let's set up your website together. What's your business called, and what do you do?",
  "hi-IN": "नमस्ते! मैं तारा हूँ। चलिए मिलकर आपकी वेबसाइट बनाते हैं। आपके बिज़नेस का नाम क्या है, और आप क्या काम करते हैं?",
  "bn-IN": "নমস্কার! আমি তারা। চলুন একসাথে আপনার ওয়েবসাইট তৈরি করি। আপনার ব্যবসার নাম কী, আর আপনি কী কাজ করেন?",
  "ta-IN": "வணக்கம்! நான் தாரா. சேர்ந்து உங்கள் வலைதளத்தை உருவாக்கலாம். உங்கள் தொழிலின் பெயர் என்ன, நீங்கள் என்ன செய்கிறீர்கள்?",
  "te-IN": "నమస్కారం! నేను తారా. కలిసి మీ వెబ్‌సైట్ తయారు చేద్దాం. మీ వ్యాపారం పేరు ఏమిటి, మీరు ఏం చేస్తారు?",
  "mr-IN": "नमस्कार! मी तारा. चला मिळून तुमची वेबसाइट तयार करूया. तुमच्या व्यवसायाचं नाव काय, आणि तुम्ही काय काम करता?",
  "gu-IN": "નમસ્તે! હું તારા છું. ચાલો સાથે મળીને તમારી વેબસાઇટ બનાવીએ. તમારા બિઝનેસનું નામ શું છે, અને તમે શું કામ કરો છો?",
  "kn-IN": "ನಮಸ್ಕಾರ! ನಾನು ತಾರಾ. ಒಟ್ಟಿಗೆ ನಿಮ್ಮ ವೆಬ್‌ಸೈಟ್ ಮಾಡೋಣ. ನಿಮ್ಮ ವ್ಯವಹಾರದ ಹೆಸರೇನು, ನೀವು ಏನು ಕೆಲಸ ಮಾಡುತ್ತೀರಿ?",
  "ml-IN": "നമസ്കാരം! ഞാൻ താരയാണ്. നമുക്ക് ഒരുമിച്ച് നിങ്ങളുടെ വെബ്സൈറ്റ് ഉണ്ടാക്കാം. നിങ്ങളുടെ ബിസിനസ്സിന്റെ പേരെന്താണ്, നിങ്ങൾ എന്താണ് ചെയ്യുന്നത്?",
  "pa-IN": "ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਤਾਰਾ ਹਾਂ। ਆਓ ਮਿਲ ਕੇ ਤੁਹਾਡੀ ਵੈੱਬਸਾਈਟ ਬਣਾਈਏ। ਤੁਹਾਡੇ ਕਾਰੋਬਾਰ ਦਾ ਨਾਂ ਕੀ ਹੈ, ਅਤੇ ਤੁਸੀਂ ਕੀ ਕੰਮ ਕਰਦੇ ਹੋ?",
};

export function infoTaraGreeting(locale: string): string {
  return GREETING[locale] ?? GREETING["en-IN"]!;
}

type Step = InfoFactKey | "ready";
const ASK: Record<"en-IN" | "hi-IN", Record<Step, string>> = {
  "en-IN": {
    businessName: "What's your business called?",
    serviceType: "What do you do? For example a clinic, salon, gym, coaching classes or consultancy.",
    city: "Which city are you in?",
    phone: "What's your mobile or WhatsApp number for customers?",
    email: "What's your email? You can also type it in the form below, or skip it.",
    services: "Which 3 to 5 services do you offer? Add a starting price if you like.",
    ready: "Thank you! Please check the form below and press Continue.",
  },
  "hi-IN": {
    businessName: "आपके बिज़नेस का नाम क्या है?",
    serviceType: "आप क्या काम करते हैं? जैसे क्लिनिक, सैलून, जिम, कोचिंग या कंसल्टेंसी।",
    city: "आप किस शहर में हैं?",
    phone: "ग्राहकों के लिए आपका मोबाइल या WhatsApp नंबर क्या है?",
    email: "आपका ईमेल क्या है? चाहें तो नीचे फ़ॉर्म में टाइप करें, या छोड़ दें।",
    services: "आप कौन-सी 3 से 5 सेवाएँ देते हैं? चाहें तो शुरुआती दाम भी बताइए।",
    ready: "धन्यवाद! नीचे फ़ॉर्म देखकर Continue दबाइए।",
  },
};

/** Next scripted question: first missing fact, skipping optional ones already asked once. */
export function nextInfoStep(f: InfoVoiceFacts, asked: { email: boolean; services: boolean }): Step {
  const next = missingInfoFacts(f).find((k) => !(k === "email" && asked.email) && !(k === "services" && asked.services));
  return next ?? "ready";
}

export function infoOfflineQuestion(locale: string, step: Step): string {
  return (locale === "hi-IN" ? ASK["hi-IN"] : ASK["en-IN"])[step];
}

/** Was this question already asked in the conversation (by its scripted text or a keyword)? */
export function wasAsked(history: readonly { role: "seller" | "tara"; text: string }[], key: "email" | "services"): boolean {
  const re = key === "email" ? /e-?mail|ईमेल/i : /services|सेवाएँ|सर्विस/i;
  return history.some((h) => h.role === "tara" && re.test(h.text));
}
