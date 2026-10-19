export type StartMood = {
  id: string;
  labelEn: string;
  labelHi: string;
  bg: string;
  accentA: string;
  accentB: string;
};

export const START_MOODS: StartMood[] = [
  { id: "mewa", labelEn: "Mewa", labelHi: "मेवा", bg: "#FFF4E8", accentA: "#F97316", accentB: "#FDBA74" },
  { id: "kamal", labelEn: "Kamal", labelHi: "कमल", bg: "#FFF0F5", accentA: "#EC4899", accentB: "#F9A8D4" },
  { id: "neel", labelEn: "Neel", labelHi: "नील", bg: "#EEF6FF", accentA: "#3B82F6", accentB: "#93C5FD" },
  { id: "neem", labelEn: "Neem", labelHi: "नीम", bg: "#ECFDF5", accentA: "#22C55E", accentB: "#86EFAC" },
  { id: "monsoon", labelEn: "Monsoon", labelHi: "मानसून", bg: "#E6FFFA", accentA: "#14B8A6", accentB: "#5EEAD4" },
  { id: "haldi", labelEn: "Haldi", labelHi: "हल्दी", bg: "#FFFBEB", accentA: "#EAB308", accentB: "#FDE047" },
  { id: "mehndi", labelEn: "Mehndi", labelHi: "मेहंदी", bg: "#F7FEE7", accentA: "#84CC16", accentB: "#BEF264" },
  { id: "jamun", labelEn: "Jamun", labelHi: "जामुन", bg: "#F3E8FF", accentA: "#9333EA", accentB: "#C4B5FD" },
];

export const ACCENT_SWATCHES = ["#F97316", "#EC4899", "#9333EA", "#3B82F6", "#22C55E", "#1E293B"] as const;

export function moodById(id: string | null): StartMood | null {
  if (!id) return null;
  return START_MOODS.find((m) => m.id === id) ?? null;
}
