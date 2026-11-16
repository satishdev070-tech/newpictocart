import type { SarvamLocaleCode } from "@/lib/sarvam/locales";
import type { VoiceFactsInput } from "./facts";

/**
 * Tara's next question when the AI chat is unavailable (Sarvam down, out of credits, timeout).
 * Facts then come only from the local extractor, and Tara still walks the seller through the
 * same steps as the quiz, so onboarding never dead-ends on an AI outage. Pure; no I/O.
 */
export type OfflineStep = "name" | "category" | "products" | "city" | "ready";

type Lines = Record<OfflineStep, string>;

const LINES: Partial<Record<SarvamLocaleCode, Lines>> & { "en-IN": Lines } = {
  "en-IN": {
    name: "Thank you! What's your store called?",
    category: "Lovely. What do you sell? For example jewellery, clothes, food or home décor.",
    products: "Great. Which kinds of products exactly? For example fashion jewellery or bridal sets.",
    city: "Which city are you in? You can also skip this.",
    ready: "Thank you! Please check the details card and tap “Looks good” to continue.",
  },
  "hi-IN": {
    name: "धन्यवाद! आपकी दुकान का नाम क्या है?",
    category: "बहुत बढ़िया। आप क्या बेचते हैं? जैसे गहने, कपड़े, खाने का सामान या घर की सजावट।",
    products: "अच्छा। कौन-कौन से प्रोडक्ट? जैसे फैशन ज्वेलरी या ब्राइडल सेट।",
    city: "आप किस शहर में हैं? चाहें तो इसे छोड़ भी सकते हैं।",
    ready: "धन्यवाद! कृपया जानकारी वाला कार्ड देखें और आगे बढ़ने के लिए “सब सही है” दबाएँ।",
  },
  "bn-IN": {
    name: "ধন্যবাদ! আপনার দোকানের নাম কী?",
    category: "খুব ভালো। আপনি কী বিক্রি করেন? যেমন গয়না, জামাকাপড়, খাবার বা ঘর সাজানোর জিনিস।",
    products: "দারুণ। ঠিক কোন কোন প্রোডাক্ট? যেমন ফ্যাশন জুয়েলারি বা ব্রাইডাল সেট।",
    city: "আপনি কোন শহরে আছেন? চাইলে এটা বাদও দিতে পারেন।",
    ready: "ধন্যবাদ! তথ্যের কার্ডটা দেখে নিন, তারপর এগোতে “সব ঠিক আছে” চাপুন।",
  },
  "ta-IN": {
    name: "நன்றி! உங்கள் கடையின் பெயர் என்ன?",
    category: "அருமை. நீங்கள் என்ன விற்கிறீர்கள்? உதாரணமாக நகைகள், ஆடைகள், உணவு அல்லது வீட்டு அலங்காரம்.",
    products: "சரி. எந்தெந்த பொருட்கள்? உதாரணமாக ஃபேஷன் நகைகள் அல்லது திருமண செட்.",
    city: "நீங்கள் எந்த ஊரில் இருக்கிறீர்கள்? வேண்டுமானால் இதைத் தவிர்க்கலாம்.",
    ready: "நன்றி! விவரங்கள் அட்டையைப் பார்த்துவிட்டு, தொடர “சரியாக உள்ளது” என்பதைத் தட்டுங்கள்.",
  },
  "te-IN": {
    name: "ధన్యవాదాలు! మీ షాప్ పేరు ఏమిటి?",
    category: "చాలా బాగుంది. మీరు ఏమి అమ్ముతారు? ఉదాహరణకు నగలు, బట్టలు, ఆహారం లేదా ఇంటి అలంకరణ.",
    products: "సరే. ఏ ఏ ప్రొడక్ట్స్? ఉదాహరణకు ఫ్యాషన్ జ్యువెలరీ లేదా బ్రైడల్ సెట్స్.",
    city: "మీరు ఏ ఊరిలో ఉన్నారు? కావాలంటే ఇది వదిలేయవచ్చు.",
    ready: "ధన్యవాదాలు! వివరాల కార్డు చూసి, ముందుకు వెళ్లడానికి “అంతా సరిగ్గా ఉంది” నొక్కండి.",
  },
  "mr-IN": {
    name: "धन्यवाद! तुमच्या दुकानाचं नाव काय आहे?",
    category: "छान. तुम्ही काय विकता? उदा. दागिने, कपडे, खाद्यपदार्थ किंवा घराची सजावट.",
    products: "बरं. नेमके कोणते प्रोडक्ट्स? उदा. फॅशन ज्वेलरी किंवा ब्रायडल सेट.",
    city: "तुम्ही कोणत्या शहरात आहात? हवं तर हे वगळू शकता.",
    ready: "धन्यवाद! माहितीचं कार्ड तपासा आणि पुढे जाण्यासाठी “सगळं बरोबर आहे” दाबा.",
  },
  "gu-IN": {
    name: "આભાર! તમારી દુકાનનું નામ શું છે?",
    category: "સરસ. તમે શું વેચો છો? જેમ કે ઘરેણાં, કપડાં, ખાવાની વસ્તુઓ કે ઘરની સજાવટ.",
    products: "સારું. બરાબર કઈ કઈ પ્રોડક્ટ્સ? જેમ કે ફેશન જ્વેલરી કે બ્રાઇડલ સેટ.",
    city: "તમે કયા શહેરમાં છો? ઇચ્છો તો આ છોડી પણ શકો છો.",
    ready: "આભાર! વિગતોનું કાર્ડ જોઈ લો અને આગળ વધવા “બધું બરાબર છે” દબાવો.",
  },
  "kn-IN": {
    name: "ಧನ್ಯವಾದ! ನಿಮ್ಮ ಅಂಗಡಿಯ ಹೆಸರೇನು?",
    category: "ಚೆನ್ನಾಗಿದೆ. ನೀವು ಏನು ಮಾರುತ್ತೀರಿ? ಉದಾಹರಣೆಗೆ ಆಭರಣ, ಬಟ್ಟೆ, ಆಹಾರ ಅಥವಾ ಮನೆ ಅಲಂಕಾರ.",
    products: "ಸರಿ. ಯಾವ ಯಾವ ಪ್ರಾಡಕ್ಟ್‌ಗಳು? ಉದಾಹರಣೆಗೆ ಫ್ಯಾಷನ್ ಜ್ಯುವೆಲರಿ ಅಥವಾ ಬ್ರೈಡಲ್ ಸೆಟ್.",
    city: "ನೀವು ಯಾವ ಊರಿನಲ್ಲಿದ್ದೀರಿ? ಬೇಕಿದ್ದರೆ ಇದನ್ನು ಬಿಡಬಹುದು.",
    ready: "ಧನ್ಯವಾದ! ವಿವರಗಳ ಕಾರ್ಡ್ ನೋಡಿ, ಮುಂದುವರಿಯಲು “ಎಲ್ಲಾ ಸರಿ ಇದೆ” ಒತ್ತಿ.",
  },
  "ml-IN": {
    name: "നന്ദി! നിങ്ങളുടെ കടയുടെ പേര് എന്താണ്?",
    category: "കൊള്ളാം. നിങ്ങൾ എന്താണ് വിൽക്കുന്നത്? ഉദാഹരണത്തിന് ആഭരണങ്ങൾ, വസ്ത്രങ്ങൾ, ഭക്ഷണം അല്ലെങ്കിൽ വീട്ടലങ്കാരം.",
    products: "ശരി. ഏതൊക്കെ പ്രോഡക്ടുകൾ? ഉദാഹരണത്തിന് ഫാഷൻ ജ്വല്ലറി അല്ലെങ്കിൽ ബ്രൈഡൽ സെറ്റ്.",
    city: "നിങ്ങൾ ഏത് നഗരത്തിലാണ്? വേണമെങ്കിൽ ഇത് ഒഴിവാക്കാം.",
    ready: "നന്ദി! വിവരങ്ങളുടെ കാർഡ് നോക്കി, തുടരാൻ “എല്ലാം ശരിയാണ്” അമർത്തുക.",
  },
  "pa-IN": {
    name: "ਧੰਨਵਾਦ! ਤੁਹਾਡੀ ਦੁਕਾਨ ਦਾ ਨਾਂ ਕੀ ਹੈ?",
    category: "ਬਹੁਤ ਵਧੀਆ। ਤੁਸੀਂ ਕੀ ਵੇਚਦੇ ਹੋ? ਜਿਵੇਂ ਗਹਿਣੇ, ਕੱਪੜੇ, ਖਾਣ-ਪੀਣ ਦਾ ਸਮਾਨ ਜਾਂ ਘਰ ਦੀ ਸਜਾਵਟ।",
    products: "ਠੀਕ ਹੈ। ਕਿਹੜੇ-ਕਿਹੜੇ ਪ੍ਰੋਡਕਟ? ਜਿਵੇਂ ਫੈਸ਼ਨ ਜਿਊਲਰੀ ਜਾਂ ਬ੍ਰਾਈਡਲ ਸੈੱਟ।",
    city: "ਤੁਸੀਂ ਕਿਹੜੇ ਸ਼ਹਿਰ ਵਿੱਚ ਹੋ? ਚਾਹੋ ਤਾਂ ਇਹ ਛੱਡ ਵੀ ਸਕਦੇ ਹੋ।",
    ready: "ਧੰਨਵਾਦ! ਜਾਣਕਾਰੀ ਵਾਲਾ ਕਾਰਡ ਦੇਖੋ ਅਤੇ ਅੱਗੇ ਵਧਣ ਲਈ “ਸਭ ਠੀਕ ਹੈ” ਦਬਾਓ।",
  },
};

/** Which fact to ask for next (same order as the quiz). `cityAsked` = Tara already asked once. */
export function nextOfflineStep(facts: VoiceFactsInput, cityAsked: boolean): OfflineStep {
  if (!facts.name?.trim()) return "name";
  const categories = facts.categories?.length ? facts.categories : facts.category ? [facts.category] : [];
  if (!categories.length) return "category";
  const subs = facts.subcategories?.length ? facts.subcategories : facts.subcategory ? [facts.subcategory] : [];
  if (!subs.length) return "products";
  if (!facts.city?.trim() && !cityAsked) return "city";
  return "ready";
}

export function offlineReply(locale: SarvamLocaleCode, step: OfflineStep): string {
  return (LINES[locale] ?? LINES["en-IN"])[step];
}

/** Whether Tara's earlier lines already asked for the city (any locale). */
export function cityAlreadyAsked(history: readonly { role: string; text: string }[] | undefined): boolean {
  const asks = Object.values(LINES).map((l) => l.city);
  return (history ?? []).some((h) => h.role === "tara" && asks.includes(h.text));
}
