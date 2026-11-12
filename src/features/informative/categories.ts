/**
 * Business categories offered in Informative onboarding Step 1 (docs/informative/PLAN.md). Codes
 * are stored in info_sites.category (check constraint in migration 8100); labels are display only.
 */
export const INFO_CATEGORIES = [
  { id: "consultancy", label: "Consultancy" },
  { id: "clinic_healthcare", label: "Clinic / Healthcare" },
  { id: "salon_beauty", label: "Salon / Beauty" },
  { id: "gym_fitness", label: "Gym / Fitness" },
  { id: "dance_academy_coaching", label: "Dance / Academy / Coaching" },
  { id: "events_community", label: "Events / Community" },
  { id: "interior_design", label: "Interior Design" },
  { id: "personal_brand", label: "Personal Brand" },
  { id: "other", label: "Other" },
] as const;

export type InfoCategory = (typeof INFO_CATEGORIES)[number]["id"];
export const INFO_CATEGORY_IDS = INFO_CATEGORIES.map((c) => c.id) as unknown as readonly [InfoCategory, ...InfoCategory[]];

export function isInfoCategory(v: unknown): v is InfoCategory {
  return typeof v === "string" && INFO_CATEGORIES.some((c) => c.id === v);
}

export function infoCategoryLabel(id: string): string {
  return INFO_CATEGORIES.find((c) => c.id === id)?.label ?? "Other";
}

/** Categories where the enquiry form shows preferred date/time by default (plan: clinic, salon, gym, academy). */
export const BOOKING_CATEGORIES: readonly InfoCategory[] = ["clinic_healthcare", "salon_beauty", "gym_fitness", "dance_academy_coaching"];
