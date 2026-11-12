import { z } from "zod";
import { email, uuid } from "@/lib/validation/common";

/**
 * Public enquiry form (pure; client + server). Plan: name and phone required; email, service,
 * preferred date/time and message optional; consent line; honeypot handled by the action.
 */
const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const enquiryFormSchema = z.object({
  name: z.string({ error: "Enter your name" }).trim().min(2, "Enter your name").max(100),
  phone: z
    .string({ error: "Enter your phone number" })
    .trim()
    .transform((v) => v.replace(/[\s()-]/g, ""))
    .pipe(z.string().regex(/^\+?\d{6,15}$/, "Enter a valid phone number")),
  email: z.preprocess(blank, email.optional()),
  serviceId: z.preprocess(blank, uuid.optional()),
  preferredDate: z.preprocess(blank, z.iso.date("Pick a valid date").optional()),
  preferredTime: z.preprocess(blank, z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a valid time").optional()),
  message: z.preprocess(blank, z.string().trim().max(5000).optional()),
  source: z.enum(["CONTACT_FORM", "SERVICE_PAGE"]).catch("CONTACT_FORM"),
  consent: z.preprocess((v) => v === "on" || v === "true" || v === true, z.literal(true, { error: "Please agree so we can contact you" })),
});
export type EnquiryFormInput = z.infer<typeof enquiryFormSchema>;

/** Honeypot field name: hidden from people, filled by bots. */
export const HONEYPOT_FIELD = "website";
