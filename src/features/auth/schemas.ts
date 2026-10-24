import { z } from "zod";
import { email } from "@/lib/validation/common";

export const password = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128)
  .regex(/[A-Za-z]/, "Include a letter")
  .regex(/[0-9]/, "Include a number");

export const signInSchema = z.object({ email, password: z.string({ error: "Enter your password" }).min(1, "Enter your password").max(128), next: z.string().optional() });
export const signUpSchema = z.object({
  displayName: z.string().trim().min(2, "Enter your name").max(80),
  email,
  password,
  /** Optional at the schema level so older links keep working; the merchant form always sends it. */
  storeName: z.string().trim().max(120).optional().transform((v) => v || undefined),
  next: z.string().optional(),
  /** Choices carried from the marketing site /start journey (validated again where they are used). */
  plan: z.string().regex(/^[a-z0-9][a-z0-9-]{0,31}$/).optional().catch(undefined),
  theme: z.string().regex(/^[a-z0-9-]{2,40}$/).optional().catch(undefined),
  lang: z.string().optional().catch(undefined),
  intent: z.string().optional().catch(undefined),
});
export const startEmailCodeSchema = z.object({
  email,
  displayName: z.string().trim().max(80).optional(),
  storeName: z.string().trim().max(120).optional().transform((v) => v || undefined),
  next: z.string().optional(),
  plan: z.string().regex(/^[a-z0-9][a-z0-9-]{0,31}$/).optional().catch(undefined),
  theme: z.string().regex(/^[a-z0-9-]{2,40}$/).optional().catch(undefined),
  lang: z.string().optional().catch(undefined),
  intent: z.string().optional().catch(undefined),
});
export const verifyStartCodeSchema = z.object({
  email,
  token: z.string().trim().regex(/^\d{6,10}$/, "Enter the code from the email"),
  type: z.enum(["signup", "email"]),
  next: z.string().optional(),
});
export const forgotSchema = z.object({ email });
/** Merchant email-code sign-up / sign-in (one screen for both; new emails get an account). */
export const merchantCodeSchema = startEmailCodeSchema.extend({ mode: z.enum(["signup", "signin"]).catch("signin") });
export const verifyMerchantCodeSchema = z.object({
  email,
  token: z.string().trim().regex(/^\d{6,10}$/, "Enter the code from the email"),
  next: z.string().optional(),
});
/** Password reset by the code in the reset email (the link in the same email also works). */
export const verifyResetCodeSchema = z.object({ email, token: z.string().trim().regex(/^\d{6,10}$/, "Enter the code from the email") });
export const resetSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });
