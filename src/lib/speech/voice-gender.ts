/**
 * Female-voice preference for browser speechSynthesis (pure; unit tested). The Web Speech API has
 * no gender field, so this reads the voice name. Known names across Chrome (Google), Apple and
 * Microsoft voices for Indian English, Hindi and other Indian languages, plus generic words.
 * Positive = female, negative = male, 0 = unknown. Pickers add it inside a language group so a
 * female voice wins among voices that speak the language, but never beats the right language.
 */
const FEMALE = [
  "female", "woman", "girl",
  // Apple
  "lekha", "veena", "samantha", "karen", "moira", "tessa", "fiona", "victoria", "kanya", "sara", "nora", "zuzana", "ioana", "yuna", "mei-jia", "ting-ting",
  // Microsoft (hi-IN / en-IN / Indian languages)
  "heera", "swara", "neerja", "kalpana", "aarti", "ananya", "kavya", "shruti", "tanishaa", "pallavi", "vani", "sapna", "aditi", "zira", "aria", "jenny", "sonia", "libby", "hazel", "susan", "catherine",
  // Amazon / other common names
  "raveena", "kajal", "priya", "ritu", "anushka", "manisha", "vidya", "arya",
];
const MALE = [
  "male", "man", "boy",
  "rishi", "ravi", "hemant", "prabhat", "madhur", "kunal", "aarav", "arjun", "valluvar", "mohan", "manohar", "dhruv",
  "daniel", "alex", "fred", "aaron", "arthur", "gordon", "oliver", "thomas", "david", "mark", "george", "guy", "ryan", "james",
];

const words = (name: string) => name.toLowerCase().split(/[^a-z\-]+/).filter(Boolean);

export function voiceGenderScore(name: string): number {
  const w = words(name);
  if (w.some((x) => FEMALE.includes(x))) return 1;
  if (w.some((x) => MALE.includes(x))) return -1;
  // Chrome's "Google हिन्दी" / "Google <lang>" voices are female.
  if (/^google\b/i.test(name) && !/\bmale\b/i.test(name)) return 0.5;
  return 0;
}
