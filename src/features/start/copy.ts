import type { StartIntentId } from "./intents";

export type StartCopy = {
  back: string;
  voiceOn: string;
  voiceOff: string;
  switchManual: string;
  switchAi: string;
  livePreview: string;
  welcome: {
    headline: string;
    headlineAccent: string;
    headlineEnd: string;
    sub: string;
    cta: string;
    features: string[];
    orderToast: string;
  };
  lang: { title: string; titleAccent: string; sub: string; continue: (name: string) => string; more: string };
  intent: { tara: string; question: string; continue: string };
  path: { title: string; titleAccent: string; sub: string; aiTitle: string; aiBadge: string; aiDesc: string; aiBullets: string[]; manualTitle: string; manualBadge: string; manualDesc: string; manualBullets: string[]; ctaAi: string; ctaManual: string };
  voice: {
    understood: string;
    understoodHint: string;
    tapMic: string;
    prompt: string;
    tapTalk: string;
    preferQuiz: string;
    noVoice: string;
    continueManual: string;
    typePlaceholder: string;
    send: string;
    micDenied: string;
    micUnsupported: string;
    thinking: string;
  };
  business: {
    title: string;
    titleAccent: string;
    storeName: string;
    tagline: string;
    writeAi: string;
    category: string;
    city: string;
    whatsapp: string;
    next: string;
  };
  products: {
    title: string;
    titleAccent: string;
    newProduct: string;
    photo: string;
    photoAi: string;
    titleLabel: string;
    titlePh: string;
    priceLabel: string;
    add: string;
    remove: string;
    count: (n: number) => string;
    next: string;
  };
  mood: { title: string; titleAccent: string; sub: string; accent: string; next: string };
  payment: {
    title: string;
    titleAccent: string;
    upiLabel: string;
    cod: string;
    codSub: string;
    shipping: string;
    shipFree: string;
    shipFlat: string;
    shipCourier: string;
    next: string;
  };
  building: { title: string; steps: string[] };
  account: {
    title: string;
    titleAccent: string;
    sub: string;
    signUp: string;
    signIn: string;
    orEmail: string;
    create: string;
    checkEmail: string;
    name: string;
    email: string;
    password: string;
    passwordHint: string;
    signInSubmit: string;
    sendCode: string;
    codeLabel: string;
    codeHint: string;
    codeSubmit: string;
    codeSent: string;
    agree: string;
    terms: string;
    and: string;
    privacy: string;
  };
  done: {
    badge: string;
    title: string;
    titleAccent: string;
    sub: string;
    copy: string;
    copied: string;
    whatsapp: string;
    dashboard: string;
    tryLook: string;
  };
  intents: Record<StartIntentId, { title: string; sub: string }>;
};

const EN: StartCopy = {
  back: "Back",
  voiceOn: "Voice on",
  voiceOff: "Voice off",
  switchManual: "Switch to manual",
  switchAi: "Switch to AI help",
  livePreview: "Live preview",
  welcome: {
    headline: "Your store, ",
    headlineAccent: "dreamt up",
    headlineEnd: " from a single photo.",
    sub: "Let our AI build it with you, or set it up yourself. Either way, you're selling in minutes.",
    cta: "Let's begin →",
    features: ["Free forever", "50+ themes", "About 5 minutes"],
    orderToast: "New order · ₹2,190 from Pune",
  },
  lang: {
    title: "Which language feels like ",
    titleAccent: "home",
    sub: "Every screen, Tara's voice and your listings will switch to it.",
    continue: (name) => `Continue in ${name} →`,
    more: "More Indian languages",
  },
  intent: {
    tara: "Namaste! I'm Tara. Before we build anything, tell me a little about you.",
    question: "What brings you to Pictocart today?",
    continue: "Continue →",
  },
  path: {
    title: "How would you like to ",
    titleAccent: "build your store",
    sub: "You can switch methods at any step.",
    aiTitle: "AI assistance",
    aiBadge: "Recommended",
    aiDesc: "Tara helps write your store, pick a theme, and set up products while you talk or type.",
    aiBullets: ["Answers and recommendations from Tara", "SEO, theme and product help", "Fastest path — about 5 minutes"],
    manualTitle: "Manual setup",
    manualBadge: "Full control",
    manualDesc: "Enter your details, design, products and payments yourself.",
    manualBullets: ["Step-by-step store setup", "AI help when you want it", "About 8 minutes"],
    ctaAi: "Meet Tara →",
    ctaManual: "Set up manually →",
  },
  voice: {
    understood: "TARA HAS UNDERSTOOD",
    understoodHint: "Details appear here as you talk.",
    tapMic: "Tap the mic to start",
    prompt: "Tell me about your business. What do you make or sell?",
    tapTalk: "Tap to talk",
    preferQuiz: "Prefer tapping? Use quiz",
    noVoice: "Voice isn't available on this platform yet.",
    continueManual: "Continue with manual setup",
    typePlaceholder: "Type your answer…",
    send: "Send",
    micDenied: "Allow the microphone to talk with Tara, or type your answer.",
    micUnsupported: "This browser can't record audio. Type your answer instead.",
    thinking: "Tara is listening…",
  },
  business: {
    title: "Tell us about your ",
    titleAccent: "business",
    storeName: "Store name",
    tagline: "Tagline",
    writeAi: "✦ Write with AI",
    category: "Category",
    city: "City",
    whatsapp: "WhatsApp number",
    next: "Next: Products →",
  },
  products: {
    title: "Add your ",
    titleAccent: "products",
    newProduct: "New product",
    photo: "Choose a photo",
    photoAi: "Name from photo with AI",
    titleLabel: "Title",
    titlePh: "e.g. Bandhani silk stole",
    priceLabel: "Price (₹)",
    add: "+ Add product",
    remove: "Remove",
    count: (n) => `${n} product${n === 1 ? "" : "s"}`,
    next: "Next: Design →",
  },
  mood: {
    title: "Pick a ",
    titleAccent: "colour mood",
    sub: "Choose a palette for your storefront.",
    accent: "Accent colour",
    next: "Next: Payment →",
  },
  payment: {
    title: "How will customers ",
    titleAccent: "pay",
    upiLabel: "UPI ID — money goes straight to you, 0% fee",
    cod: "Cash on delivery",
    codSub: "A trusted option across India",
    shipping: "Shipping",
    shipFree: "Free shipping above ₹499",
    shipFlat: "₹60 on every order",
    shipCourier: "As per courier rates",
    next: "Continue →",
  },
  building: {
    title: "Your store is being built…",
    steps: [
      "Saving your information",
      "Creating your store page",
      "Connecting payments",
      "Going live",
      "Finishing touches",
    ],
  },
  account: {
    title: "Save your store before ",
    titleAccent: "going live",
    sub: "Create an account so we can publish your store.",
    signUp: "Sign up",
    signIn: "Sign in",
    orEmail: "Or with email",
    create: "Create account and go live →",
    checkEmail: "Check your email to confirm, then return here — your draft is saved.",
    name: "Full name",
    email: "Email",
    password: "Password",
    passwordHint: "Use 10+ characters with a letter and a number.",
    signInSubmit: "Sign in",
    sendCode: "Email me a code",
    codeLabel: "Email code",
    codeHint: "Enter the 6-digit code we emailed you.",
    codeSubmit: "Confirm and continue",
    codeSent: "We sent a code to your email.",
    agree: "By continuing you agree to the",
    terms: "Terms",
    and: "and",
    privacy: "Privacy Policy",
  },
  done: {
    badge: "Your store is live",
    title: "Your store is ",
    titleAccent: "open",
    sub: "Set up manually. Share your link and start taking orders.",
    copy: "Copy",
    copied: "Copied!",
    whatsapp: "Share on WhatsApp",
    dashboard: "Go to dashboard →",
    tryLook: "Try another look",
  },
  intents: {
    "first-business": { title: "Starting my first business", sub: "I have products, no store yet" },
    "offline-to-online": { title: "I sell offline, want to go online", sub: "Shop, stall or from home" },
    "social-seller": { title: "I sell on WhatsApp or Instagram", sub: "Want a proper store and payments" },
    "platform-switch": { title: "Moving from another platform", sub: "Bring my products and customers" },
  },
};

const HI: StartCopy = {
  back: "वापस",
  voiceOn: "आवाज़ चालू",
  voiceOff: "आवाज़ बंद",
  switchManual: "मैन्युअल पर जाएँ",
  switchAi: "AI सहायता पर जाएँ",
  livePreview: "लाइव प्रीव्यू",
  welcome: {
    headline: "आपकी दुकान, ",
    headlineAccent: "एक फोटो",
    headlineEnd: " से सपनों जैसी।",
    sub: "AI आपके साथ बनाए, या खुद सेट करें — कुछ ही मिनटों में बिक्री शुरू।",
    cta: "शुरू करें →",
    features: ["हमेशा मुफ्त", "50+ थीम", "लगभग 5 मिनट"],
    orderToast: "नया ऑर्डर · पुणे से ₹2,190",
  },
  lang: {
    title: "कौन सी भाषा ",
    titleAccent: "घर",
    sub: "हर स्क्रीन, तारा की आवाज़ और आपकी लिस्टिंग इसी में होंगी।",
    continue: (name) => `${name} में जारी रखें →`,
    more: "और भारतीय भाषाएँ",
  },
  intent: {
    tara: "नमस्ते! मैं तारा हूँ। कुछ भी बनाने से पहले, मुझे अपने बारे में थोड़ा बताइए।",
    question: "आज आप Pictocart पर क्यों आए हैं?",
    continue: "आगे बढ़ें →",
  },
  path: {
    title: "आप अपनी दुकान ",
    titleAccent: "कैसे बनाना",
    sub: "किसी भी चरण पर आप तरीका बदल सकते हैं।",
    aiTitle: "AI सहायता",
    aiBadge: "सुझाया गया",
    aiDesc: "तारा आपकी दुकान लिखने, थीम चुनने और प्रोडक्ट सेट करने में मदद करेगी।",
    aiBullets: ["तारा से सुझाव और जवाब", "SEO, थीम और प्रोडक्ट में मदद", "सबसे तेज़ — लगभग 5 मिनट"],
    manualTitle: "मैन्युअल सेटअप",
    manualBadge: "पूरा नियंत्रण",
    manualDesc: "अपनी जानकारी, डिज़ाइन, प्रोडक्ट और भुगतान खुद भरें।",
    manualBullets: ["चरण दर चरण सेटअप", "जरूरत पर AI मदद", "लगभग 8 मिनट"],
    ctaAi: "तारा से मिलें →",
    ctaManual: "मैन्युअल सेटअप →",
  },
  voice: {
    understood: "तारा ने समझा",
    understoodHint: "बात करते ही जानकारी यहाँ दिखेगी।",
    tapMic: "माइक टैप करके शुरू करें",
    prompt: "अपने बिज़नेस के बारे में बताइए। आप क्या बनाते या बेचते हैं?",
    tapTalk: "बोलने के लिए टैप करें",
    preferQuiz: "टैप करना पसंद है? क्विज़ इस्तेमाल करें",
    noVoice: "इस प्लेटफॉर्म पर अभी आवाज़ उपलब्ध नहीं है।",
    continueManual: "मैन्युअल सेटअप जारी रखें",
    typePlaceholder: "अपना जवाब लिखें…",
    send: "भेजें",
    micDenied: "तारा से बात करने के लिए माइक्रोफ़ोन की अनुमति दें, या जवाब लिखें।",
    micUnsupported: "यह ब्राउज़र आवाज़ रिकॉर्ड नहीं कर सकता। जवाब लिखें।",
    thinking: "तारा सुन रही है…",
  },
  business: {
    title: "अपने ",
    titleAccent: "बिज़नेस",
    storeName: "दुकान का नाम",
    tagline: "टैगलाइन",
    writeAi: "✦ AI से लिखें",
    category: "कैटेगरी",
    city: "शहर",
    whatsapp: "WhatsApp नंबर",
    next: "आगे: उत्पाद →",
  },
  products: {
    title: "अपने ",
    titleAccent: "प्रोडक्ट",
    newProduct: "नया प्रोडक्ट",
    photo: "फोटो चुनें",
    photoAi: "फोटो से AI नाम लिखें",
    titleLabel: "टाइटल",
    titlePh: "जैसे बाँधी सिल्क स्टोल",
    priceLabel: "दाम (₹)",
    add: "+ प्रोडक्ट जोड़ें",
    remove: "हटाएँ",
    count: (n) => `${n} प्रोडक्ट`,
    next: "आगे: डिज़ाइन →",
  },
  mood: {
    title: "एक ",
    titleAccent: "रंग",
    sub: "अपनी दुकान के लिए मूड चुनें।",
    accent: "मुख्य रंग",
    next: "आगे: पेमेंट →",
  },
  payment: {
    title: "ग्राहक ",
    titleAccent: "पेमेंट",
    upiLabel: "UPI ID — पैसा सीधे आपके खाते में, 0% फीस",
    cod: "कैश ऑन डिलीवरी",
    codSub: "भारत में भरोसेमंद विकल्प",
    shipping: "शिपिंग",
    shipFree: "₹499 से ऊपर मुफ्त शिपिंग",
    shipFlat: "हर ऑर्डर पर ₹60",
    shipCourier: "कुरियर के हिसाब से",
    next: "आगे बढ़ें →",
  },
  building: {
    title: "आपकी दुकान बन रही है…",
    steps: [
      "आपकी जानकारी सेव हो रही है",
      "दुकान का पेज बन रहा है",
      "पेमेंट कनेक्ट हो रहा है",
      "लाइव हो रहा है",
      "आखिरी सुधार",
    ],
  },
  account: {
    title: "लाइव होने से पहले ",
    titleAccent: "अकाउंट बनाएँ",
    sub: "दुकान सेव करने के लिए अकाउंट जरूरी है।",
    signUp: "साइन अप",
    signIn: "साइन इन",
    orEmail: "या ईमेल से",
    create: "अकाउंट बनाएं और लाइव करें →",
    checkEmail: "ईमेल कन्फर्म करें, फिर यहाँ वापस आएँ — ड्राफ्ट सुरक्षित है।",
    name: "पूरा नाम",
    email: "ईमेल",
    password: "पासवर्ड",
    passwordHint: "10+ अक्षर, एक अक्षर और एक नंबर।",
    signInSubmit: "साइन इन",
    sendCode: "कोड ईमेल करें",
    codeLabel: "ईमेल कोड",
    codeHint: "ईमेल में आया 6 अंकों का कोड लिखें।",
    codeSubmit: "कन्फर्म करें और आगे बढ़ें",
    codeSent: "हमने आपके ईमेल पर कोड भेज दिया है।",
    agree: "आगे बढ़कर आप सहमत होते हैं",
    terms: "नियम",
    and: "और",
    privacy: "गोपनीयता नीति",
  },
  done: {
    badge: "आपकी दुकान लाइव है",
    title: "आपकी दुकान ",
    titleAccent: "खुल गई है",
    sub: "मैन्युअल रूप से सेट की गई। लिंक शेयर करें और ऑर्डर लें।",
    copy: "कॉपी",
    copied: "कॉपी हो गया!",
    whatsapp: "WhatsApp पर शेयर करें",
    dashboard: "डैशबोर्ड पर जाएं →",
    tryLook: "दूसरा लुक आज़माएं",
  },
  intents: {
    "first-business": { title: "अपना पहला बिजनेस शुरू कर रहे हैं", sub: "सामान है, दुकान नहीं" },
    "offline-to-online": { title: "ऑफलाइन बेचते हैं, अब ऑनलाइन आएंगे", sub: "दुकान, स्टॉल या घर से" },
    "social-seller": { title: "WhatsApp या Instagram पर बेचते हैं", sub: "अच्छी दुकान और पेमेंट चाहिए" },
    "platform-switch": { title: "दूसरे प्लेटफॉर्म्स से आ रहे हैं", sub: "प्रोडक्ट और ग्राहक साथ लाएँ" },
  },
};

export function startCopy(locale: string): StartCopy {
  return locale === "hi-IN" ? HI : EN;
}

export function uiLocaleFromSarvam(locale: string): "en" | "hi" {
  return locale === "hi-IN" ? "hi" : "en";
}
