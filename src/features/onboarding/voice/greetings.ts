/**
 * Tara's spoken opener per onboarding locale (pure, client- and server-safe).
 * Hand-written, warm and respectful; "Pictocart" stays in Latin script so Bulbul says the brand.
 * Locales outside the 10 we ship fall back to English.
 */

export type TaraGreetingKind = "welcome" | "resume";

type Lines = Record<TaraGreetingKind, string>;

const GREETINGS: Record<string, Lines> = {
  "en-IN": {
    welcome: "Namaste! Welcome to Pictocart. I'm Tara, and I'll set up your online store with you. What's your store called?",
    resume: "Welcome back! Let's pick up where we left off. Go ahead whenever you're ready.",
  },
  "hi-IN": {
    welcome: "नमस्ते! Pictocart में आपका स्वागत है। मैं तारा हूँ, और मैं आपके साथ मिलकर आपका ऑनलाइन स्टोर बनाऊँगी। आपके स्टोर का नाम क्या है?",
    resume: "फिर से स्वागत है! चलिए, जहाँ रुके थे वहीं से आगे बढ़ते हैं। जब तैयार हों, बोलिए।",
  },
  "bn-IN": {
    welcome: "নমস্কার! Pictocart-এ আপনাকে স্বাগত। আমি তারা, আপনার সঙ্গে মিলে আপনার অনলাইন স্টোর তৈরি করব। আপনার স্টোরের নাম কী?",
    resume: "আবার স্বাগত! যেখানে থেমেছিলাম, সেখান থেকেই শুরু করি। তৈরি হলে বলুন।",
  },
  "ta-IN": {
    welcome: "வணக்கம்! Pictocart-க்கு உங்களை அன்புடன் வரவேற்கிறோம். நான் தாரா, உங்களுடன் சேர்ந்து உங்கள் ஆன்லைன் கடையை அமைக்கப் போகிறேன். உங்கள் கடையின் பெயர் என்ன?",
    resume: "மீண்டும் வருக! நிறுத்திய இடத்திலிருந்து தொடரலாம். தயாரானதும் சொல்லுங்கள்.",
  },
  "te-IN": {
    welcome: "నమస్కారం! Pictocart కి స్వాగతం. నేను తార, మీతో కలిసి మీ ఆన్‌లైన్ స్టోర్‌ను సిద్ధం చేస్తాను. మీ స్టోర్ పేరు ఏమిటి?",
    resume: "మళ్ళీ స్వాగతం! ఆపిన చోటు నుండే కొనసాగిద్దాం. సిద్ధమైనప్పుడు చెప్పండి.",
  },
  "mr-IN": {
    welcome: "नमस्कार! Pictocart मध्ये आपले स्वागत आहे. मी तारा, तुमच्यासोबत तुमचे ऑनलाइन स्टोअर तयार करणार आहे. तुमच्या स्टोअरचे नाव काय आहे?",
    resume: "पुन्हा स्वागत आहे! जिथे थांबलो होतो तिथून पुढे जाऊया. तयार असाल तेव्हा बोला.",
  },
  "gu-IN": {
    welcome: "નમસ્તે! Pictocart માં આપનું સ્વાગત છે. હું તારા છું, અને તમારી સાથે મળીને તમારો ઓનલાઇન સ્ટોર તૈયાર કરીશ. તમારા સ્ટોરનું નામ શું છે?",
    resume: "ફરી સ્વાગત છે! જ્યાં અટક્યા હતા ત્યાંથી આગળ વધીએ. તૈયાર હો ત્યારે બોલો.",
  },
  "kn-IN": {
    welcome: "ನಮಸ್ಕಾರ! Pictocart ಗೆ ಸ್ವಾಗತ. ನಾನು ತಾರಾ, ನಿಮ್ಮೊಂದಿಗೆ ಸೇರಿ ನಿಮ್ಮ ಆನ್‌ಲೈನ್ ಸ್ಟೋರ್ ಸಿದ್ಧಪಡಿಸುತ್ತೇನೆ. ನಿಮ್ಮ ಸ್ಟೋರ್‌ನ ಹೆಸರೇನು?",
    resume: "ಮತ್ತೆ ಸ್ವಾಗತ! ನಿಲ್ಲಿಸಿದ ಕಡೆಯಿಂದಲೇ ಮುಂದುವರಿಸೋಣ. ಸಿದ್ಧವಾದಾಗ ಹೇಳಿ.",
  },
  "ml-IN": {
    welcome: "നമസ്കാരം! Pictocart-ലേക്ക് സ്വാഗതം. ഞാൻ താര, നിങ്ങളോടൊപ്പം നിങ്ങളുടെ ഓൺലൈൻ സ്റ്റോർ ഒരുക്കാം. നിങ്ങളുടെ സ്റ്റോറിന്റെ പേര് എന്താണ്?",
    resume: "വീണ്ടും സ്വാഗതം! നിർത്തിയിടത്തുനിന്ന് തുടരാം. തയ്യാറാകുമ്പോൾ പറയൂ.",
  },
  "pa-IN": {
    welcome: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ ਜੀ! Pictocart ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ। ਮੈਂ ਤਾਰਾ ਹਾਂ, ਤੇ ਤੁਹਾਡੇ ਨਾਲ ਮਿਲ ਕੇ ਤੁਹਾਡਾ ਆਨਲਾਈਨ ਸਟੋਰ ਬਣਾਵਾਂਗੀ। ਤੁਹਾਡੇ ਸਟੋਰ ਦਾ ਨਾਮ ਕੀ ਹੈ?",
    resume: "ਮੁੜ ਜੀ ਆਇਆਂ ਨੂੰ! ਜਿੱਥੇ ਰੁਕੇ ਸੀ, ਉੱਥੋਂ ਅੱਗੇ ਵਧੀਏ। ਤਿਆਰ ਹੋਵੋ ਤਾਂ ਬੋਲੋ।",
  },
};

/** Locales with a hand-written greeting (the 10 onboarding languages). */
export const TARA_GREETING_LOCALES = Object.keys(GREETINGS);

/** Tara's opener for `locale` (English fallback). `resume` = the transcript already has answers. */
export function taraGreetingText(locale: string, kind: TaraGreetingKind = "welcome"): string {
  return (GREETINGS[locale] ?? GREETINGS["en-IN"]!)[kind];
}
