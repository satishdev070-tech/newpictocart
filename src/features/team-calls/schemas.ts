import { z } from "zod";
import { phoneSchema } from "@/lib/validation/phone";

/** "Book a free call with our team" — shared rules (client + server). Times shown in IST. */
export const TEAM_CALL_TZ = "Asia/Kolkata";

export const BOOKING_STATUSES = ["requested", "confirmed", "completed", "cancelled", "no_show"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};
export const BOOKING_STATUS_TONE: Record<BookingStatus, "warning" | "success" | "neutral" | "error" | "info"> = {
  requested: "warning",
  confirmed: "info",
  completed: "success",
  cancelled: "neutral",
  no_show: "error",
};

export type TeamCallSlot = { id: string; startsAt: string; durationMinutes: number; seatsLeft: number };
export type TeamCallBooking = {
  id: string;
  slotId: string;
  startsAt: string | null;
  durationMinutes: number | null;
  name: string;
  email: string | null;
  phone: string;
  topic: string | null;
  source: "dashboard" | "landing";
  status: BookingStatus;
  adminNote: string | null;
  tenantId: string | null;
  tenantName: string | null;
  createdAt: string;
};

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined);

/** Dashboard booking (the merchant is signed in; their name comes from the form). */
export const bookTeamCallSchema = z.object({
  slotId: z.uuid("Pick a time"),
  name: z.string().trim().min(2, "Enter your name").max(120),
  phone: phoneSchema,
  topic: optionalText(500),
});

/** Public booking from the marketing site: email is required so the team can confirm. */
export const bookTeamCallPublicSchema = bookTeamCallSchema.extend({
  email: z.email("Enter a valid email").max(254),
  /** Honeypot: real visitors never see or fill this. */
  website: z.string().max(200).optional(),
});

export const cancelTeamCallSchema = z.object({ bookingId: z.uuid() });

export const saveSlotSchema = z.object({
  id: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  /** `YYYY-MM-DDTHH:mm` from <input type="datetime-local">, read as IST. */
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a date and time"),
  durationMinutes: z.coerce.number().int().min(10).max(180).default(30),
  capacity: z.coerce.number().int().min(1).max(20).default(1),
  active: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()).default(true),
  note: optionalText(200),
});

export const addDaySlotsSchema = z
  .object({
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a day"),
    from: z.string().regex(/^\d{2}:\d{2}$/),
    to: z.string().regex(/^\d{2}:\d{2}$/),
    every: z.coerce.number().int().min(10).max(240).default(30),
    durationMinutes: z.coerce.number().int().min(10).max(180).default(30),
    capacity: z.coerce.number().int().min(1).max(20).default(1),
  })
  .refine((v) => v.to > v.from, { path: ["to"], message: "End must be after start" });

export const slotIdSchema = z.object({ id: z.uuid() });

export const updateBookingSchema = z.object({
  id: z.uuid(),
  status: z.enum(BOOKING_STATUSES),
  adminNote: optionalText(1000),
});

export const bookingFilterSchema = z.object({
  status: z.enum(BOOKING_STATUSES).optional().catch(undefined),
  when: z.enum(["upcoming", "past", "all"]).default("upcoming").catch("upcoming"),
});

/** "2026-11-30T10:30" in IST → ISO instant (IST has no DST, so a fixed +05:30 is exact). */
export function istLocalToIso(local: string): string {
  return new Date(`${local}:00+05:30`).toISOString();
}

/** IST calendar day key ("2026-11-30") for grouping slots by day. */
export function istDayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TEAM_CALL_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

const dayFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TEAM_CALL_TZ, weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TEAM_CALL_TZ, hour: "numeric", minute: "2-digit", hour12: true });
export const formatCallDay = (iso: string) => dayFmt.format(new Date(iso));
export const formatCallTime = (iso: string) => timeFmt.format(new Date(iso)).replace(/\s?([ap])m$/i, (_, p: string) => ` ${p.toUpperCase()}M`);
export const formatCallWhen = (iso: string) => `${formatCallDay(iso)}, ${formatCallTime(iso)} IST`;

/** Slots grouped by IST day, in time order, only those with a free seat. */
export function groupSlotsByDay(slots: readonly TeamCallSlot[]): { day: string; label: string; slots: TeamCallSlot[] }[] {
  const byDay = new Map<string, TeamCallSlot[]>();
  for (const s of [...slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    if (s.seatsLeft <= 0) continue;
    const k = istDayKey(s.startsAt);
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }
  return [...byDay.entries()].map(([day, list]) => ({ day, label: formatCallDay(list[0]!.startsAt), slots: list }));
}

/** Friendly text for the booking function's business errors (SQL HINTs). */
export const TEAM_CALL_ERRORS: Record<string, string> = {
  TEAM_CALL_SLOT_FULL: "That time was just booked. Please pick another time.",
  TEAM_CALL_SLOT_GONE: "That time is no longer available. Please pick another time.",
  TEAM_CALL_DUPLICATE: "You've already booked this time.",
  TEAM_CALL_LIMIT: "This number already has 3 upcoming calls booked. Cancel one to book another.",
  TEAM_CALL_CAPACITY: "There are more bookings than that. Raise the seats or cancel bookings first.",
};

/** Tomorrow's IST day key (default for "Add a day of slots"). */
export function tomorrowIstDay(now: Date = new Date()): string {
  return istDayKey(new Date(now.getTime() + 86_400_000).toISOString());
}
