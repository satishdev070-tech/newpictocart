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
  lang: {
    headline: string;
    title: string;
    titleAccent: string;
    sub: string;
    continue: (name: string) => string;
    more: string;
  };
  intent: { tara: string; question: string; continue: string };
  path: {
    headline: string;
    title: string;
    titleAccent: string;
    sub: string;
    voiceTitle: string;
    voiceBadge: string;
    voiceDesc: string;
    quizTitle: string;
    quizBadge: string;
    quizDesc: string;
    ctaVoice: string;
    ctaQuiz: string;
    /** @deprecated Prefer voice* / quiz* fields for five-screen onboarding. */
    aiTitle: string;
    aiBadge: string;
    aiDesc: string;
    aiBullets: string[];
    manualTitle: string;
    manualBadge: string;
    manualDesc: string;
    manualBullets: string[];
    ctaAi: string;
    ctaManual: string;
  };
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
  quiz: {
    step: (n: number, total: number) => string;
    nameTitle: string;
    nameHint: string;
    categoryTitle: string;
    subcategoryTitle: string;
    more: string;
    less: string;
    siteTitle: string;
    storeTitle: string;
    storeDesc: string;
    siteInfoTitle: string;
    siteInfoDesc: string;
    cityTitle: string;
    cityHint: string;
    taglineTitle: string;
    taglineHint: string;
    skip: string;
    next: string;
    finish: string;
  };
  business: {
    title: string;
    titleAccent: string;
    storeName: string;
    tagline: string;
    writeAi: string;
    category: string;
    subcategory: string;
    productsServices: string;
    productsServicesHint: string;
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
    /** Eyebrow above the main headline (e.g. Create Account). */
    eyebrow: string;
    title: string;
    titleAccent: string;
    sub: string;
    valueLine: string;
    signUp: string;
    signIn: string;
    signInTitle: string;
    signInTitleAccent: string;
    signInSub: string;
    haveAccount: string;
    needAccount: string;
    or: string;
    orEmail: string;
    continueGoogle: string;
    signInGoogle: string;
    create: string;
    continueEmail: string;
    checkEmail: string;
    name: string;
    email: string;
    password: string;
    passwordHint: string;
    signInSubmit: string;
    sendCode: string;
    usePassword: string;
    useEmailCode: string;
    summaryStore: string;
    summaryCategory: string;
    summaryTheme: string;
    summaryLanguage: string;
    codeTitle: string;
    codeTitleAccent: string;
    codeLabel: string;
    codeHint: string;
    codeSubmit: string;
    codeSent: string;
    codeSentTo: (email: string) => string;
    didntGetIt: string;
    resend: string;
    resendIn: (seconds: number) => string;
    resending: string;
    resent: string;
    changeEmail: string;
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
    /** Personalized when store name is known. */
    subNamed: (name: string) => string;
    copy: string;
    copied: string;
    whatsapp: string;
    dashboard: string;
    tryLook: string;
    journeyTitle: string;
    journeySub: string;
    journeySteps: [
      { label: string; blurb: string },
      { label: string; blurb: string },
      { label: string; blurb: string },
      { label: string; blurb: string },
      { label: string; blurb: string },
    ];
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
    headline: "Start Your Journey",
    title: "Which language feels like ",
    titleAccent: "home",
    sub: "Which language feels like home?",
    continue: (name) => `Continue in ${name} →`,
    more: "More Indian languages",
  },
  intent: {
    tara: "Namaste! I'm Tara. Before we build anything, tell me a little about you.",
    question: "What brings you to Pictocart today?",
    continue: "Continue →",
  },
  path: {
    headline: "How would you like to build your store?",
    title: "How would you like to ",
    titleAccent: "build your store",
    sub: "Talk with Tara, or answer a short quiz — you can switch later.",
    voiceTitle: "AI Voice Assistant",
    voiceBadge: "Talk",
    voiceDesc: "Talk naturally with Tara. She listens, asks follow-ups, and fills in your store.",
    quizTitle: "Quick Setup Quiz",
    quizBadge: "Tap",
    quizDesc: "Answer a few simple questions. Fast, clear, and no microphone needed.",
    ctaVoice: "Talk with Tara →",
    ctaQuiz: "Start the quiz →",
    aiTitle: "AI Voice Assistant",
    aiBadge: "Talk",
    aiDesc: "Talk naturally with Tara. She listens, asks follow-ups, and fills in your store.",
    aiBullets: ["Natural conversation", "Tara fills store details", "About 5 minutes"],
    manualTitle: "Quick Setup Quiz",
    manualBadge: "Tap",
    manualDesc: "Answer a few simple questions. Fast, clear, and no microphone needed.",
    manualBullets: ["Short questions", "No microphone", "About 3 minutes"],
    ctaAi: "Talk with Tara →",
    ctaManual: "Start the quiz →",
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
  quiz: {
    step: (n, total) => `Question ${n} of ${total}`,
    nameTitle: "What is your store called?",
    nameHint: "e.g. Kia Garments",
    categoryTitle: "What do you sell?",
    subcategoryTitle: "Which type fits best?",
    more: "More categories",
    less: "Fewer categories",
    siteTitle: "What should we build?",
    storeTitle: "Online store",
    storeDesc: "A shop with a cart, checkout and orders.",
    siteInfoTitle: "Business website",
    siteInfoDesc: "A site where people learn about you and get in touch.",
    cityTitle: "Which city are you in?",
    cityHint: "e.g. Jaipur",
    taglineTitle: "A short line for your store?",
    taglineHint: "e.g. Handloom from the family workshop",
    skip: "Skip",
    next: "Next",
    finish: "Continue →",
  },
  business: {
    title: "Tell us about your ",
    titleAccent: "business",
    storeName: "Store name",
    tagline: "Tagline",
    writeAi: "✦ Write with AI",
    category: "Category",
    subcategory: "Subcategory",
    productsServices: "What do you sell or offer?",
    productsServicesHint: "e.g. Bandhani stoles, block-print kurtas, custom sizes",
    city: "City",
    whatsapp: "WhatsApp number",
    next: "Continue →",
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
    eyebrow: "Create Account",
    title: "Create Your ",
    titleAccent: "Store",
    sub: "Save your draft and go live when you're ready.",
    valueLine: "Free forever for up to 10 products. No card details needed.",
    signUp: "Sign up",
    signIn: "Sign in",
    signInTitle: "Welcome ",
    signInTitleAccent: "back",
    signInSub: "Sign in to publish the store you just designed.",
    haveAccount: "Already have an account?",
    needAccount: "New here?",
    or: "or",
    orEmail: "or",
    continueGoogle: "Signup with Google",
    signInGoogle: "Continue with Google",
    create: "Create account",
    continueEmail: "Continue",
    checkEmail: "Your draft is saved — enter the code below to continue.",
    name: "Full name",
    email: "Email address",
    password: "Password",
    passwordHint: "Use 10+ characters with a letter and a number.",
    signInSubmit: "Send sign-in code",
    sendCode: "Submit",
    usePassword: "Use a password instead",
    useEmailCode: "Email me a code instead",
    summaryStore: "Store",
    summaryCategory: "Category",
    summaryTheme: "Theme",
    summaryLanguage: "Language",
    codeTitle: "Check your ",
    codeTitleAccent: "inbox",
    codeLabel: "Verification code",
    codeHint: "6-digit code from your email",
    codeSubmit: "Verify OTP",
    codeSent: "We sent a verification code to your email.",
    codeSentTo: (email) => `Enter the verification code sent to ${email}`,
    didntGetIt: "Didn't get it?",
    resend: "Resend code",
    resendIn: (seconds) => `Resend code in ${seconds}s`,
    resending: "Sending…",
    resent: "We sent a new code.",
    changeEmail: "Change the email address",
    agree: "By continuing you agree to the",
    terms: "Terms",
    and: "and",
    privacy: "Privacy Policy",
  },
  done: {
    badge: "Your store is live",
    title: "Your store is ",
    titleAccent: "open",
    sub: "Share your link and start taking orders.",
    subNamed: (name) => `${name} is ready. Share your link and start taking orders.`,
    copy: "Copy",
    copied: "Copied!",
    whatsapp: "Share on WhatsApp",
    dashboard: "Go to dashboard →",
    tryLook: "Try another look",
    journeyTitle: "From first tap to a live store",
    journeySub: "You walked the full path — language, mode, business, look, and account.",
    journeySteps: [
      { label: "Language", blurb: "Picked how you want to talk" },
      { label: "Mode", blurb: "Voice guide or quick quiz" },
      { label: "Business", blurb: "Named your shop & category" },
      { label: "Theme", blurb: "Chose a storefront look" },
      { label: "Account", blurb: "Saved & went live" },
    ],
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
    headline: "अपनी यात्रा शुरू करें",
    title: "कौन सी भाषा ",
    titleAccent: "घर",
    sub: "कौन सी भाषा घर जैसी लगती है?",
    continue: (name) => `${name} में जारी रखें →`,
    more: "और भारतीय भाषाएँ",
  },
  intent: {
    tara: "नमस्ते! मैं तारा हूँ। कुछ भी बनाने से पहले, मुझे अपने बारे में थोड़ा बताइए।",
    question: "आज आप Pictocart पर क्यों आए हैं?",
    continue: "आगे बढ़ें →",
  },
  path: {
    headline: "आप अपनी दुकान कैसे बनाना चाहेंगे?",
    title: "आप अपनी दुकान ",
    titleAccent: "कैसे बनाना",
    sub: "तारा से बात करें, या छोटा क्विज़ भरें — बाद में बदल सकते हैं।",
    voiceTitle: "AI वॉइस असिस्टेंट",
    voiceBadge: "बात करें",
    voiceDesc: "तारा से स्वाभाविक बात करें। वह सुनती है, सवाल पूछती है, और दुकान भर देती है।",
    quizTitle: "क्विक सेटअप क्विज़",
    quizBadge: "टैप",
    quizDesc: "कुछ आसान सवालों के जवाब दें। तेज़, साफ़, माइक की ज़रूरत नहीं।",
    ctaVoice: "तारा से बात करें →",
    ctaQuiz: "क्विज़ शुरू करें →",
    aiTitle: "AI वॉइस असिस्टेंट",
    aiBadge: "बात करें",
    aiDesc: "तारा से स्वाभाविक बात करें। वह सुनती है, सवाल पूछती है, और दुकान भर देती है।",
    aiBullets: ["स्वाभाविक बातचीत", "तारा दुकान की जानकारी भरती है", "लगभग 5 मिनट"],
    manualTitle: "क्विक सेटअप क्विज़",
    manualBadge: "टैप",
    manualDesc: "कुछ आसान सवालों के जवाब दें। तेज़, साफ़, माइक की ज़रूरत नहीं।",
    manualBullets: ["छोटे सवाल", "माइक नहीं चाहिए", "लगभग 3 मिनट"],
    ctaAi: "तारा से बात करें →",
    ctaManual: "क्विज़ शुरू करें →",
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
  quiz: {
    step: (n, total) => `सवाल ${n} / ${total}`,
    nameTitle: "आपकी दुकान का नाम क्या है?",
    nameHint: "जैसे Kia Garments",
    categoryTitle: "आप क्या बेचते हैं?",
    subcategoryTitle: "कौन सा प्रकार सबसे ठीक है?",
    more: "और कैटेगरी",
    less: "कम कैटेगरी",
    siteTitle: "हम क्या बनाएँ?",
    storeTitle: "ऑनलाइन दुकान",
    storeDesc: "कार्ट, चेकआउट और ऑर्डर वाली दुकान।",
    siteInfoTitle: "बिज़नेस वेबसाइट",
    siteInfoDesc: "जहाँ लोग आपके बारे में जानें और संपर्क करें।",
    cityTitle: "आप किस शहर में हैं?",
    cityHint: "जैसे जयपुर",
    taglineTitle: "दुकान के लिए एक छोटी लाइन?",
    taglineHint: "जैसे घर के करघे का हाथ का कपड़ा",
    skip: "छोड़ें",
    next: "आगे",
    finish: "आगे बढ़ें →",
  },
  business: {
    title: "अपने ",
    titleAccent: "बिज़नेस",
    storeName: "दुकान का नाम",
    tagline: "टैगलाइन",
    writeAi: "✦ AI से लिखें",
    category: "कैटेगरी",
    subcategory: "उप-कैटेगरी",
    productsServices: "आप क्या बेचते या देते हैं?",
    productsServicesHint: "जैसे बाँधी स्टोल, ब्लॉक-प्रिंट कुर्ते, कस्टम साइज़",
    city: "शहर",
    whatsapp: "WhatsApp नंबर",
    next: "आगे बढ़ें →",
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
    eyebrow: "अकाउंट बनाएँ",
    title: "अपनी ",
    titleAccent: "दुकान बनाएँ",
    sub: "ड्राफ्ट सेव करें और जब तैयार हों तब लाइव करें।",
    valueLine: "10 प्रोडक्ट तक हमेशा मुफ्त। कार्ड की ज़रूरत नहीं।",
    signUp: "साइन अप",
    signIn: "साइन इन",
    signInTitle: "वापस ",
    signInTitleAccent: "स्वागत है",
    signInSub: "जिस दुकान को डिज़ाइन किया है, उसे पब्लिश करने के लिए साइन इन करें।",
    haveAccount: "पहले से अकाउंट है?",
    needAccount: "नए हैं?",
    or: "या",
    orEmail: "या",
    continueGoogle: "Google से साइन अप",
    signInGoogle: "Google से जारी रखें",
    create: "अकाउंट बनाएँ",
    continueEmail: "आगे बढ़ें",
    checkEmail: "आपका ड्राफ्ट सुरक्षित है — नीचे कोड डालकर आगे बढ़ें।",
    name: "पूरा नाम",
    email: "ईमेल पता",
    password: "पासवर्ड",
    passwordHint: "10+ अक्षर, एक अक्षर और एक नंबर।",
    signInSubmit: "साइन-इन कोड भेजें",
    sendCode: "सबमिट",
    usePassword: "पासवर्ड इस्तेमाल करें",
    useEmailCode: "कोड ईमेल करें",
    summaryStore: "दुकान",
    summaryCategory: "कैटेगरी",
    summaryTheme: "थीम",
    summaryLanguage: "भाषा",
    codeTitle: "अपना ",
    codeTitleAccent: "इनबॉक्स देखें",
    codeLabel: "वेरिफिकेशन कोड",
    codeHint: "ईमेल में आया 6 अंकों का कोड",
    codeSubmit: "OTP वेरिफाई करें",
    codeSent: "हमने आपके ईमेल पर वेरिफिकेशन कोड भेजा है।",
    codeSentTo: (email) => `${email} पर भेजा गया वेरिफिकेशन कोड दर्ज करें`,
    didntGetIt: "नहीं मिला?",
    resend: "कोड फिर भेजें",
    resendIn: (seconds) => `${seconds} सेकंड में फिर भेजें`,
    resending: "भेजा जा रहा है…",
    resent: "नया कोड भेज दिया है।",
    changeEmail: "ईमेल पता बदलें",
    agree: "आगे बढ़कर आप सहमत होते हैं",
    terms: "नियम",
    and: "और",
    privacy: "गोपनीयता नीति",
  },
  done: {
    badge: "आपकी दुकान लाइव है",
    title: "आपकी दुकान ",
    titleAccent: "खुल गई है",
    sub: "लिंक शेयर करें और ऑर्डर लेना शुरू करें।",
    subNamed: (name) => `${name} तैयार है। लिंक शेयर करें और ऑर्डर लें।`,
    copy: "कॉपी",
    copied: "कॉपी हो गया!",
    whatsapp: "WhatsApp पर शेयर करें",
    dashboard: "डैशबोर्ड पर जाएं →",
    tryLook: "दूसरा लुक आज़माएं",
    journeyTitle: "पहले टैप से लाइव दुकान तक",
    journeySub: "आपने पूरी राह चली — भाषा, मोड, बिज़नेस, लुक और अकाउंट।",
    journeySteps: [
      { label: "भाषा", blurb: "बात करने का तरीका चुना" },
      { label: "मोड", blurb: "आवाज़ गाइड या क्विज़" },
      { label: "बिज़नेस", blurb: "नाम और कैटेगरी सेट" },
      { label: "थीम", blurb: "स्टोरफ्रंट लुक चुना" },
      { label: "अकाउंट", blurb: "सेव करके लाइव गए" },
    ],
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
