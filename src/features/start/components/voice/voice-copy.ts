/** Strings for the Tara call console (English + Hindi; other locales fall back to English). */
export type VoiceUiCopy = {
  liveCall: string;
  agentName: string;
  agentRole: string;
  statusIdle: string;
  statusOnCall: string;
  stateReady: string;
  stateListening: string;
  stateThinking: string;
  stateSpeaking: string;
  tapToStart: string;
  tapToStop: string;
  endCall: string;
  callEnded: string;
  tipsTitle: string;
  tips: string[];
  typeInstead: string;
  typePlaceholder: string;
  send: string;
  micBlocked: string;
  micUnsupported: string;
  transcriptTitle: string;
  messages: (n: number) => string;
  clear: string;
  emptyTranscript: string;
  you: string;
  didntCatch: string;
  greeting: string;
  confirmTitle: string;
  confirmHint: string;
  storeName: string;
  categories: string;
  productTypes: string;
  city: string;
  cityPlaceholder: string;
  remove: (label: string) => string;
  looksGood: string;
  keepTalking: string;
  preferQuiz: string;
  manual: string;
  back: string;
  noVoice: string;
  useQuiz: string;
};

const en: VoiceUiCopy = {
  liveCall: "Live call — Talk to Tara",
  agentName: "Tara",
  agentRole: "Pictocart setup assistant",
  statusIdle: "Ready",
  statusOnCall: "On call",
  stateReady: "Ready",
  stateListening: "Listening (speak now)",
  stateThinking: "Thinking",
  stateSpeaking: "Tara is speaking",
  tapToStart: "Tap to speak",
  tapToStop: "Tap to stop and send",
  endCall: "End call",
  callEnded: "Call ended",
  tipsTitle: "Tips",
  tips: [
    "Allow microphone access when your browser asks.",
    "Speak naturally in English or Hindi — one answer at a time.",
    "No mic? You can also type your answers.",
  ],
  typeInstead: "Type instead",
  typePlaceholder: "Type your answer…",
  send: "Send",
  micBlocked: "Microphone is blocked, so let's type instead. You can allow the mic in your browser's site settings any time.",
  micUnsupported: "This browser can't record audio. Type your answers instead.",
  transcriptTitle: "Conversation transcript",
  messages: (n) => `${n} ${n === 1 ? "message" : "messages"}`,
  clear: "Clear",
  emptyTranscript: "Your conversation with Tara appears here.",
  you: "You",
  didntCatch: "Didn't catch that — try again a little closer to the mic, or type.",
  greeting: "Hi, I'm Tara! Let's set up your store together. What's your store called?",
  confirmTitle: "Here's what I got",
  confirmHint: "Fix anything that's off, then continue.",
  storeName: "Store name",
  categories: "What you sell",
  productTypes: "Product types",
  city: "City",
  cityPlaceholder: "Optional",
  remove: (label) => `Remove ${label}`,
  looksGood: "Looks good — continue",
  keepTalking: "Keep talking",
  preferQuiz: "Prefer tapping? Use the quiz",
  manual: "Set up manually",
  back: "Back",
  noVoice: "Voice isn't available on this platform yet.",
  useQuiz: "Answer a quick quiz instead",
};

const hi: VoiceUiCopy = {
  ...en,
  liveCall: "लाइव कॉल — तारा से बात करें",
  agentRole: "Pictocart सेटअप सहायक",
  statusIdle: "तैयार",
  statusOnCall: "कॉल पर",
  stateReady: "तैयार",
  stateListening: "सुन रही हूँ (अब बोलिए)",
  stateThinking: "सोच रही हूँ",
  stateSpeaking: "तारा बोल रही है",
  tapToStart: "बोलने के लिए टैप करें",
  tapToStop: "रोकने और भेजने के लिए टैप करें",
  endCall: "कॉल समाप्त करें",
  callEnded: "कॉल समाप्त",
  tipsTitle: "सुझाव",
  tips: [
    "ब्राउज़र पूछे तो माइक्रोफ़ोन की अनुमति दें।",
    "हिंदी या अंग्रेज़ी में आराम से बोलें — एक बार में एक जवाब।",
    "माइक नहीं है? आप जवाब टाइप भी कर सकते हैं।",
  ],
  typeInstead: "टाइप करें",
  typePlaceholder: "अपना जवाब लिखें…",
  send: "भेजें",
  micBlocked: "माइक्रोफ़ोन बंद है, इसलिए टाइप करके जवाब दें। आप ब्राउज़र सेटिंग में कभी भी माइक चालू कर सकते हैं।",
  micUnsupported: "यह ब्राउज़र ऑडियो रिकॉर्ड नहीं कर सकता। कृपया टाइप करें।",
  transcriptTitle: "बातचीत",
  messages: (n) => `${n} संदेश`,
  clear: "साफ़ करें",
  emptyTranscript: "तारा के साथ आपकी बातचीत यहाँ दिखेगी।",
  you: "आप",
  didntCatch: "सुनाई नहीं दिया — माइक के पास फिर से बोलें, या टाइप करें।",
  greeting: "नमस्ते, मैं तारा हूँ! चलिए आपका स्टोर बनाते हैं। आपके स्टोर का नाम क्या है?",
  confirmTitle: "मैंने यह समझा",
  confirmHint: "कुछ गलत हो तो ठीक करें, फिर आगे बढ़ें।",
  storeName: "स्टोर का नाम",
  categories: "आप क्या बेचते हैं",
  productTypes: "प्रोडक्ट के प्रकार",
  city: "शहर",
  cityPlaceholder: "वैकल्पिक",
  remove: (label) => `${label} हटाएँ`,
  looksGood: "सही है — आगे बढ़ें",
  keepTalking: "बात जारी रखें",
  preferQuiz: "टैप करना पसंद है? क्विज़ चुनें",
  manual: "खुद सेट करें",
  back: "वापस",
  noVoice: "इस प्लेटफ़ॉर्म पर अभी आवाज़ उपलब्ध नहीं है।",
  useQuiz: "छोटे क्विज़ से जवाब दें",
};

export function voiceUiCopy(locale: string): VoiceUiCopy {
  return locale.startsWith("hi") ? hi : en;
}
