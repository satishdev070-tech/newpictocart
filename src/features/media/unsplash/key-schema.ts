import { z } from "zod";

/** Unsplash Access Keys are 43-character URL-safe strings; allow some slack for future formats. */
export const unsplashKeySchema = z.object({
  accessKey: z
    .string()
    .trim()
    .min(20, "That doesn't look like an Unsplash Access Key")
    .max(200)
    .regex(/^[A-Za-z0-9_-]+$/, "Paste the Access Key exactly as shown (letters, numbers, - and _ only)"),
});
