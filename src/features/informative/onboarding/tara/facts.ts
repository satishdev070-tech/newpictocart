import { z } from "zod";
import { INFO_CATEGORY_IDS, isInfoCategory, type InfoCategory } from "../../categories";
import { SERVICE_TYPES, findServiceType, type ServiceType } from "../../service-types";

/**
 * What Tara gathers for an Informative Website (pure; client + server, unit tested). These facts
 * pre-fill the existing Step 1 form + starter services; the form stays the confirmation and its own
 * validation decides. Nothing here is trusted on the server beyond shape: completion re-validates.
 */
export const MAX_TARA_SERVICES = 6;

export type InfoTaraService = { name: string; priceRupees: number | null };

export type InfoVoiceFacts = {
  businessName: string | null;
  category: InfoCategory | null;
  /** What they do, in their words or a known label ("Dentist / Dental clinic"). */
  serviceType: string | null;
  /** Matched SERVICE_TYPES id, or null when it's their own label. */
  serviceTypeId: string | null;
  city: string | null;
  /** 10 digits, no country code. */
  phone: string | null;
  email: string | null;
  address: string | null;
  tagline: string | null;
  services: InfoTaraService[];
};

export const EMPTY_INFO_FACTS: InfoVoiceFacts = {
  businessName: null,
  category: null,
  serviceType: null,
  serviceTypeId: null,
  city: null,
  phone: null,
  email: null,
  address: null,
  tagline: null,
  services: [],
};

const text = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim().slice(0, max))
    .nullable()
    .optional()
    .catch(null)
    .transform((s) => (s ? s : null));

/** Lenient input (from the model or the browser): bad fields become null, never fail the turn. */
export const infoVoiceFactsInputSchema = z.object({
  businessName: text(80),
  category: z.string().nullable().optional().catch(null),
  serviceType: text(60),
  serviceTypeId: z.string().max(40).nullable().optional().catch(null),
  city: text(80),
  phone: z.union([z.string(), z.number()]).nullable().optional().catch(null),
  email: z.string().max(200).nullable().optional().catch(null),
  address: text(300),
  tagline: text(120),
  services: z
    .array(z.union([z.string(), z.object({ name: z.string(), priceRupees: z.union([z.number(), z.string()]).nullable().optional() })]))
    .max(12)
    .nullable()
    .optional()
    .catch(null),
});

/** "+91 98765-43210" / "098765 43210" / "nine eight…" digits → "9876543210"; invalid → null. */
export function normalizePhone(raw: unknown): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, "");
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  return /^[6-9]\d{9}$/.test(ten) ? ten : null;
}

/** Spoken or typed email → address ("ramesh at the rate gmail dot com" → ramesh@gmail.com). */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // Whole spoken words only ("kathryn" keeps its "at"; "ramesh at gmail" becomes ramesh@gmail).
  const s = ` ${raw.toLowerCase()} `
    .replace(/\s(?:at the rate of|at the rate|at sign|at)\s/g, "@")
    .replace(/\s(?:dot|डॉट)\s/g, ".")
    .replace(/\s+/g, "")
    .replace(/[.,;]+$/, "");
  const ok = z.email().safeParse(s);
  return ok.success && s.length <= 254 ? s : null;
}

/** Map a category id or label/word to an Informative category. */
export function toInfoCategory(raw: unknown): InfoCategory | null {
  if (isInfoCategory(raw)) return raw;
  if (typeof raw !== "string") return null;
  const s = raw.toLowerCase();
  const pairs: [RegExp, InfoCategory][] = [
    [/clinic|doctor|dent|health|hospital|physio|derma|eye|ayur|homeo|diagnos|lab/, "clinic_healthcare"],
    [/salon|beauty|spa|parlou?r|makeup|hair|nail|bridal makeup|mehndi/, "salon_beauty"],
    [/gym|fitness|yoga|zumba|crossfit|trainer|pilates/, "gym_fitness"],
    [/dance|academy|coaching|tuition|class|school|music|tutor|institute/, "dance_academy_coaching"],
    [/event|wedding|planner|community|ngo|club|caterer|decor/, "events_community"],
    [/interior|architect|home design|modular|furnish/, "interior_design"],
    [/consult|ca\b|chartered|lawyer|advocate|legal|tax|finance|agency|marketing|it services|software/, "consultancy"],
    [/personal brand|coach|influencer|portfolio|photograph|artist|freelanc|speaker|author/, "personal_brand"],
  ];
  return pairs.find(([re]) => re.test(s))?.[1] ?? null;
}

/** Best known service type for what they said (same category first). */
export function matchServiceType(label: string | null, category: InfoCategory | null): ServiceType | null {
  if (!label) return null;
  const words = label.toLowerCase().split(/[^a-zऀ-ॿ]+/).filter((w) => w.length >= 3);
  if (!words.length) return null;
  let best: ServiceType | null = null;
  let bestScore = 0;
  for (const s of SERVICE_TYPES) {
    const hay = `${s.label} ${s.keywords}`.toLowerCase();
    let score = words.filter((w) => hay.includes(w)).length;
    if (!score) continue;
    if (category && s.family === category) score += 0.5;
    if (score > bestScore) {
      best = s;
      bestScore = score;
    }
  }
  return best;
}

function cleanServices(raw: unknown): InfoTaraService[] {
  if (!Array.isArray(raw)) return [];
  const out: InfoTaraService[] = [];
  for (const it of raw) {
    const name = (typeof it === "string" ? it : it && typeof it === "object" && "name" in it ? String((it as { name: unknown }).name) : "").replace(/\s+/g, " ").trim().slice(0, 120);
    if (name.length < 2 || out.some((o) => o.name.toLowerCase() === name.toLowerCase())) continue;
    const display = name.charAt(0).toLocaleUpperCase("en-IN") + name.slice(1);
    const p = it && typeof it === "object" && "priceRupees" in it ? Number(String((it as { priceRupees: unknown }).priceRupees ?? "").replace(/[^\d.]/g, "")) : NaN;
    out.push({ name: display, priceRupees: Number.isFinite(p) && p > 0 && p < 10_000_000 ? Math.round(p) : null });
    if (out.length >= MAX_TARA_SERVICES) break;
  }
  return out;
}

/** Validate + normalise any facts object (model output, browser state). */
export function normalizeInfoFacts(raw: unknown): InfoVoiceFacts {
  const p = infoVoiceFactsInputSchema.safeParse(raw ?? {});
  if (!p.success) return { ...EMPTY_INFO_FACTS };
  const v = p.data;
  const serviceType = v.serviceType ?? null;
  const category = toInfoCategory(v.category) ?? (findServiceType(v.serviceTypeId)?.family ?? null) ?? toInfoCategory(serviceType);
  const known = findServiceType(v.serviceTypeId) ?? matchServiceType(serviceType, category);
  return {
    businessName: v.businessName ?? null,
    category: category ?? known?.family ?? null,
    serviceType: serviceType ?? known?.label ?? null,
    serviceTypeId: known && (!category || known.family === category) ? known.id : null,
    city: v.city ?? null,
    phone: normalizePhone(v.phone),
    email: normalizeEmail(v.email),
    address: v.address ?? null,
    tagline: v.tagline ?? null,
    services: cleanServices(v.services),
  };
}

/** New facts win (corrections stick); empty values never erase known ones. */
export function mergeInfoFacts(prev: InfoVoiceFacts, next: Partial<InfoVoiceFacts>): InfoVoiceFacts {
  const out: InfoVoiceFacts = { ...prev };
  for (const k of Object.keys(EMPTY_INFO_FACTS) as (keyof InfoVoiceFacts)[]) {
    const v = next[k];
    if (k === "services") {
      if (Array.isArray(v) && v.length) out.services = v as InfoTaraService[];
    } else if (v != null && v !== "") {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

export type InfoFactKey = "businessName" | "serviceType" | "city" | "phone" | "email" | "services";

/** Required for the form: name, what they do (→ category), city, phone. */
export const REQUIRED_INFO_FACTS: readonly InfoFactKey[] = ["businessName", "serviceType", "city", "phone"];

/** What Tara still needs, in asking order (email and services are asked once, then optional). */
export function missingInfoFacts(f: InfoVoiceFacts): InfoFactKey[] {
  const out: InfoFactKey[] = [];
  if (!f.businessName) out.push("businessName");
  if (!f.serviceType || !f.category) out.push("serviceType");
  if (!f.city) out.push("city");
  if (!f.phone) out.push("phone");
  if (!f.email) out.push("email");
  if (!f.services.length) out.push("services");
  return out;
}

export function infoFactsReady(f: InfoVoiceFacts): boolean {
  return !missingInfoFacts(f).some((k) => (REQUIRED_INFO_FACTS as readonly string[]).includes(k));
}

/** Patch for the Step 1 form (only fields Tara knows). */
export function toBasicPatch(f: InfoVoiceFacts): Record<string, string> {
  const patch: Record<string, string> = {};
  if (f.businessName) patch.businessName = f.businessName;
  if (f.category) patch.category = f.category;
  if (f.serviceTypeId) {
    patch.serviceTypeId = f.serviceTypeId;
    patch.serviceType = findServiceType(f.serviceTypeId)?.label ?? f.serviceType ?? "";
  } else if (f.serviceType && f.category) {
    patch.serviceTypeId = "custom";
    patch.serviceType = f.serviceType;
  }
  if (f.tagline) patch.tagline = f.tagline;
  if (f.phone) patch.phone = f.phone;
  if (f.email) patch.email = f.email;
  if (f.city) patch.city = f.city;
  if (f.address) patch.address = f.address;
  return patch;
}

/** Starter services for the draft (prices in paise; no price → "on request"). */
export function toDraftServices(f: InfoVoiceFacts) {
  return f.services.slice(0, MAX_TARA_SERVICES).map((s) => ({
    name: s.name,
    shortDescription: "",
    priceType: s.priceRupees ? ("STARTING_FROM" as const) : ("ON_REQUEST" as const),
    pricePaise: s.priceRupees ? s.priceRupees * 100 : null,
    durationMinutes: null,
  }));
}

export const INFO_CATEGORY_LIST = INFO_CATEGORY_IDS.join(", ");
