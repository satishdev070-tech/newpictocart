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

type RetryStep = "name" | "category" | "products";

/** Second ask, rephrased with an example, so Tara never repeats the exact same line. */
const RETRY: Partial<Record<SarvamLocaleCode, Record<RetryStep, string>>> & { "en-IN": Record<RetryStep, string> } = {
  "en-IN": {
    name: "Sorry, I missed the name. Just say the store name, for example “Vinod General Store”.",
    category: "Sorry, what kind of shop is it? For example grocery, clothes, jewellery or electronics.",
    products: "Which items do you sell most? Just name them, for example “rice, dal and spices”.",
  },
  "hi-IN": {
    name: "माफ़ कीजिए, नाम नहीं समझ पाई। बस दुकान का नाम बोलिए, जैसे “विनोद जनरल स्टोर”।",
    category: "माफ़ कीजिए, यह किस तरह की दुकान है? जैसे किराना, कपड़े, गहने या इलेक्ट्रॉनिक्स।",
    products: "आप सबसे ज़्यादा क्या-क्या बेचते हैं? बस नाम बताइए, जैसे “चावल, दाल और मसाले”।",
  },
  "bn-IN": {
    name: "দুঃখিত, নামটা বুঝতে পারিনি। শুধু দোকানের নামটা বলুন, যেমন “বিনোদ জেনারেল স্টোর”।",
    category: "দুঃখিত, এটা কোন ধরনের দোকান? যেমন মুদি, জামাকাপড়, গয়না বা ইলেকট্রনিক্স।",
    products: "আপনি সবচেয়ে বেশি কী কী বিক্রি করেন? শুধু নাম বলুন, যেমন “চাল, ডাল আর মশলা”।",
  },
  "ta-IN": {
    name: "மன்னிக்கவும், பெயர் புரியவில்லை. கடையின் பெயரை மட்டும் சொல்லுங்கள், உதாரணமாக “வினோத் ஜெனரல் ஸ்டோர்”.",
    category: "மன்னிக்கவும், இது எந்த வகைக் கடை? உதாரணமாக மளிகை, ஆடைகள், நகைகள் அல்லது எலக்ட்ரானிக்ஸ்.",
    products: "நீங்கள் அதிகம் விற்பது எவை? பெயர்களை மட்டும் சொல்லுங்கள், உதாரணமாக “அரிசி, பருப்பு, மசாலா”.",
  },
  "te-IN": {
    name: "క్షమించండి, పేరు అర్థం కాలేదు. షాప్ పేరు మాత్రమే చెప్పండి, ఉదాహరణకు “వినోద్ జనరల్ స్టోర్”.",
    category: "క్షమించండి, ఇది ఏ రకమైన షాప్? ఉదాహరణకు కిరాణా, బట్టలు, నగలు లేదా ఎలక్ట్రానిక్స్.",
    products: "మీరు ఎక్కువగా ఏమేమి అమ్ముతారు? పేర్లు చెప్పండి, ఉదాహరణకు “బియ్యం, పప్పు, మసాలాలు”.",
  },
  "mr-IN": {
    name: "माफ करा, नाव समजलं नाही. फक्त दुकानाचं नाव सांगा, उदा. “विनोद जनरल स्टोअर”.",
    category: "माफ करा, हे कोणत्या प्रकारचं दुकान आहे? उदा. किराणा, कपडे, दागिने किंवा इलेक्ट्रॉनिक्स.",
    products: "तुम्ही सगळ्यात जास्त काय विकता? फक्त नावं सांगा, उदा. “तांदूळ, डाळ आणि मसाले”.",
  },
  "gu-IN": {
    name: "માફ કરશો, નામ સમજાયું નહીં. ફક્ત દુકાનનું નામ કહો, જેમ કે “વિનોદ જનરલ સ્ટોર”.",
    category: "માફ કરશો, આ કયા પ્રકારની દુકાન છે? જેમ કે કરિયાણું, કપડાં, ઘરેણાં કે ઇલેક્ટ્રોનિક્સ.",
    products: "તમે સૌથી વધુ શું શું વેચો છો? ફક્ત નામ કહો, જેમ કે “ચોખા, દાળ અને મસાલા”.",
  },
  "kn-IN": {
    name: "ಕ್ಷಮಿಸಿ, ಹೆಸರು ಅರ್ಥವಾಗಲಿಲ್ಲ. ಅಂಗಡಿಯ ಹೆಸರನ್ನು ಮಾತ್ರ ಹೇಳಿ, ಉದಾಹರಣೆಗೆ “ವಿನೋದ್ ಜನರಲ್ ಸ್ಟೋರ್”.",
    category: "ಕ್ಷಮಿಸಿ, ಇದು ಯಾವ ರೀತಿಯ ಅಂಗಡಿ? ಉದಾಹರಣೆಗೆ ದಿನಸಿ, ಬಟ್ಟೆ, ಆಭರಣ ಅಥವಾ ಎಲೆಕ್ಟ್ರಾನಿಕ್ಸ್.",
    products: "ನೀವು ಹೆಚ್ಚಾಗಿ ಏನೇನು ಮಾರುತ್ತೀರಿ? ಹೆಸರುಗಳನ್ನು ಹೇಳಿ, ಉದಾಹರಣೆಗೆ “ಅಕ್ಕಿ, ಬೇಳೆ, ಮಸಾಲೆ”.",
  },
  "ml-IN": {
    name: "ക്ഷമിക്കണം, പേര് മനസ്സിലായില്ല. കടയുടെ പേര് മാത്രം പറയൂ, ഉദാഹരണത്തിന് “വിനോദ് ജനറൽ സ്റ്റോർ”.",
    category: "ക്ഷമിക്കണം, ഇത് ഏത് തരം കടയാണ്? ഉദാഹരണത്തിന് പലചരക്ക്, വസ്ത്രങ്ങൾ, ആഭരണങ്ങൾ അല്ലെങ്കിൽ ഇലക്ട്രോണിക്സ്.",
    products: "നിങ്ങൾ കൂടുതലായി എന്തൊക്കെ വിൽക്കുന്നു? പേരുകൾ പറയൂ, ഉദാഹരണത്തിന് “അരി, പരിപ്പ്, മസാല”.",
  },
  "pa-IN": {
    name: "ਮਾਫ਼ ਕਰਨਾ, ਨਾਂ ਸਮਝ ਨਹੀਂ ਆਇਆ। ਬੱਸ ਦੁਕਾਨ ਦਾ ਨਾਂ ਦੱਸੋ, ਜਿਵੇਂ “ਵਿਨੋਦ ਜਨਰਲ ਸਟੋਰ”।",
    category: "ਮਾਫ਼ ਕਰਨਾ, ਇਹ ਕਿਸ ਤਰ੍ਹਾਂ ਦੀ ਦੁਕਾਨ ਹੈ? ਜਿਵੇਂ ਕਰਿਆਨਾ, ਕੱਪੜੇ, ਗਹਿਣੇ ਜਾਂ ਇਲੈਕਟ੍ਰਾਨਿਕਸ।",
    products: "ਤੁਸੀਂ ਸਭ ਤੋਂ ਵੱਧ ਕੀ-ਕੀ ਵੇਚਦੇ ਹੋ? ਬੱਸ ਨਾਂ ਦੱਸੋ, ਜਿਵੇਂ “ਚੌਲ, ਦਾਲ ਤੇ ਮਸਾਲੇ”।",
  },
};

/** How many times Tara already asked for `step` (either wording, any locale). */
export function timesAsked(history: readonly { role: string; text: string }[] | undefined, step: OfflineStep): number {
  const lines = new Set<string>();
  for (const l of Object.values(LINES)) lines.add(l[step]);
  if (step !== "city" && step !== "ready") for (const r of Object.values(RETRY)) lines.add(r[step]);
  return (history ?? []).filter((h) => h.role === "tara" && lines.has(h.text)).length;
}

/** Next line for `step`: first ask, then a rephrased retry (never the same line twice in a row). */
export function offlineQuestion(locale: SarvamLocaleCode, step: OfflineStep, asked: number): string {
  if (asked >= 1 && step !== "city" && step !== "ready") return (RETRY[locale] ?? RETRY["en-IN"])[step];
  return offlineReply(locale, step);
}
