/**
 * Tara's spoken opener for the panel voice call, in every reply language (pure). Short, so it is
 * quick to synthesise and the seller can start talking straight away.
 */
import type { CopilotLanguage } from "./languages";

const GREETING: Record<CopilotLanguage, string> = {
  en: "Hi, I'm Tara. Tell me what you need for your business, and I'll check it or do it for you.",
  hi: "नमस्ते, मैं तारा हूँ। बताइए, आज आपके बिज़नेस के लिए क्या करना है?",
  bn: "নমস্কার, আমি তারা। বলুন, আজ আপনার ব্যবসার জন্য কী করব?",
  ta: "வணக்கம், நான் தாரா. இன்று உங்கள் வணிகத்துக்கு என்ன செய்யலாம், சொல்லுங்கள்.",
  te: "నమస్తే, నేను తార. ఈరోజు మీ వ్యాపారం కోసం ఏమి చేయాలో చెప్పండి.",
  mr: "नमस्कार, मी तारा. सांगा, आज तुमच्या व्यवसायासाठी काय करायचं?",
  gu: "નમસ્તે, હું તારા છું. કહો, આજે તમારા બિઝનેસ માટે શું કરવું છે?",
  kn: "ನಮಸ್ಕಾರ, ನಾನು ತಾರಾ. ಇಂದು ನಿಮ್ಮ ವ್ಯಾಪಾರಕ್ಕಾಗಿ ಏನು ಮಾಡಬೇಕು ಹೇಳಿ.",
  ml: "നമസ്കാരം, ഞാൻ താര. ഇന്ന് നിങ്ങളുടെ ബിസിനസിനായി എന്ത് ചെയ്യണം എന്ന് പറയൂ.",
  pa: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਮੈਂ ਤਾਰਾ ਹਾਂ। ਦੱਸੋ, ਅੱਜ ਤੁਹਾਡੇ ਕਾਰੋਬਾਰ ਲਈ ਕੀ ਕਰੀਏ?",
};

export const copilotCallGreeting = (lang: CopilotLanguage): string => GREETING[lang];

/** Markdown and links read badly aloud: plain sentences for the voice. */
export function spokenText(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*|`/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .trim();
}
