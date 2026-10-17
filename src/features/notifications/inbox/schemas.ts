import { z } from "zod";
import { NOTIFICATION_TYPES, type NotificationType } from "./catalog";

export const scopeSchema = z.enum(["tenant", "platform"]);

export const markReadSchema = z.object({ scope: scopeSchema, ids: z.array(z.uuid()).min(1).max(100) });
export const markAllReadSchema = z.object({ scope: scopeSchema });
export const markUnreadSchema = z.object({ scope: scopeSchema, id: z.uuid() });

const typeSchema = z.string().refine((t): t is NotificationType => t in NOTIFICATION_TYPES, "Unknown notification type");

/** Preferences form: one checkbox per type the user can receive ("enabled[]"); unchecked = muted. */
export const preferencesSchema = z.object({
  scope: scopeSchema,
  offered: z.array(typeSchema).max(50).default([]),
  enabled: z.array(typeSchema).max(50).default([]),
});
