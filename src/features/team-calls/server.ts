import "server-only";
import { AppError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import { isMissingSchemaError } from "@/features/platform/schemas";
import { TEAM_CALL_ERRORS, type BookingStatus, type TeamCallBooking, type TeamCallSlot } from "./schemas";

/**
 * Free team calls (migration 9100). Every read and write uses the caller's own Supabase
 * session (anon on the marketing site): RLS shows only future active slots and the caller's
 * own bookings; writes go through SECURITY DEFINER functions. No secret-key client here.
 */

type PgError = { code?: string; message?: string; hint?: string } | null;

export function teamCallError(error: PgError): AppError {
  const hint = error?.hint ?? "";
  if (TEAM_CALL_ERRORS[hint]) return new AppError("CONFLICT", { message: TEAM_CALL_ERRORS[hint], fieldErrors: { _form: [TEAM_CALL_ERRORS[hint]] }, context: { hint } });
  if (isMissingSchemaError(error)) return new AppError("VALIDATION", { fieldErrors: { _form: ["Booking isn't open yet. Please try again later."] }, context: { reason: "migration_9100_missing" } });
  return mapDbError(error);
}

export type SlotList = { available: boolean; slots: TeamCallSlot[] };

/** Bookable slots (at least 30 minutes ahead, with a free seat), next 30 days. */
export async function listOpenSlots(now = new Date()): Promise<SlotList> {
  const supabase = await createSupabaseServerClient();
  const from = new Date(now.getTime() + 30 * 60_000).toISOString();
  const to = new Date(now.getTime() + 30 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("team_call_slots")
    .select("id, starts_at, duration_minutes, capacity, booked_count, active")
    .eq("active", true)
    .gt("starts_at", from)
    .lt("starts_at", to)
    .order("starts_at")
    .limit(300);
  if (error) {
    if (isMissingSchemaError(error)) return { available: false, slots: [] };
    throw mapDbError(error);
  }
  return {
    available: true,
    slots: (data ?? []).map((s) => ({ id: s.id, startsAt: s.starts_at, durationMinutes: s.duration_minutes, seatsLeft: Math.max(0, s.capacity - s.booked_count) })).filter((s) => s.seatsLeft > 0),
  };
}

type BookingRow = {
  id: string;
  slot_id: string;
  name: string;
  email: string | null;
  phone: string;
  topic: string | null;
  source: string;
  status: string;
  admin_note: string | null;
  tenant_id: string | null;
  created_at: string;
  team_call_slots: { starts_at: string; duration_minutes: number } | null;
  tenants?: { name: string } | null;
};

function toBooking(r: BookingRow): TeamCallBooking {
  return {
    id: r.id,
    slotId: r.slot_id,
    startsAt: r.team_call_slots?.starts_at ?? null,
    durationMinutes: r.team_call_slots?.duration_minutes ?? null,
    name: r.name,
    email: r.email,
    phone: r.phone,
    topic: r.topic,
    source: r.source === "landing" ? "landing" : "dashboard",
    status: r.status as BookingStatus,
    adminNote: r.admin_note,
    tenantId: r.tenant_id,
    tenantName: r.tenants?.name ?? null,
    createdAt: r.created_at,
  };
}

const BOOKING_COLUMNS = "id, slot_id, name, email, phone, topic, source, status, admin_note, tenant_id, created_at, team_call_slots(starts_at, duration_minutes)";

/** The signed-in person's own bookings (RLS: user_id = auth.uid()). */
export async function listMyBookings(): Promise<{ available: boolean; bookings: TeamCallBooking[] }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("team_call_bookings").select(BOOKING_COLUMNS).order("created_at", { ascending: false }).limit(20);
  if (error) {
    if (isMissingSchemaError(error)) return { available: false, bookings: [] };
    throw mapDbError(error);
  }
  return { available: true, bookings: ((data ?? []) as unknown as BookingRow[]).map(toBooking) };
}

export async function bookTeamCall(input: { slotId: string; name: string; email?: string | null; phone: string; topic?: string; source: "dashboard" | "landing"; tenantId?: string | null }): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("book_team_call", {
    p_slot: input.slotId,
    p_name: input.name,
    p_email: input.email ?? "",
    p_phone: input.phone,
    p_topic: input.topic ?? "",
    p_source: input.source,
    ...(input.tenantId ? { p_tenant: input.tenantId } : {}),
  });
  if (error) throw teamCallError(error);
  return String(data);
}

export async function cancelMyTeamCall(bookingId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cancel_my_team_call", { p_booking: bookingId });
  if (error) throw teamCallError(error);
}

// ------------------------------------------------------------------ Super Admin

export type AdminSlot = { id: string; startsAt: string; durationMinutes: number; capacity: number; booked: number; active: boolean; note: string | null };

/** Admin view (RLS lets platform.users.manage read every slot and booking). */
export async function listAdminTeamCalls(f: { status?: BookingStatus; when: "upcoming" | "past" | "all" }, now = new Date()) {
  const supabase = await createSupabaseServerClient();
  const nowIso = now.toISOString();
  let slotsQ = supabase.from("team_call_slots").select("id, starts_at, duration_minutes, capacity, booked_count, active, note").order("starts_at").limit(300);
  slotsQ = slotsQ.gt("starts_at", new Date(now.getTime() - 86_400_000).toISOString());
  let bookingsQ = supabase
    .from("team_call_bookings")
    .select(`${BOOKING_COLUMNS}, tenants(name)`)
    .order("created_at", { ascending: false })
    .limit(200);
  if (f.status) bookingsQ = bookingsQ.eq("status", f.status);
  const [slots, bookings] = await Promise.all([slotsQ, bookingsQ]);
  if (slots.error || bookings.error) {
    const err = slots.error ?? bookings.error;
    if (isMissingSchemaError(err)) return { available: false as const, slots: [] as AdminSlot[], bookings: [] as TeamCallBooking[] };
    throw mapDbError(err);
  }
  let list = ((bookings.data ?? []) as unknown as BookingRow[]).map(toBooking);
  if (f.when !== "all") list = list.filter((b) => (b.startsAt ? (f.when === "upcoming" ? b.startsAt >= nowIso : b.startsAt < nowIso) : f.when === "past"));
  list.sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? "") * (f.when === "past" ? -1 : 1));
  return {
    available: true as const,
    slots: (slots.data ?? []).map((s): AdminSlot => ({ id: s.id, startsAt: s.starts_at, durationMinutes: s.duration_minutes, capacity: s.capacity, booked: s.booked_count, active: s.active, note: s.note })),
    bookings: list,
  };
}

export async function saveSlot(input: { id?: string; startsAt: string; durationMinutes: number; capacity: number; active: boolean; note?: string }): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("platform_save_team_call_slot", {
    p_id: input.id ?? (null as unknown as string),
    p_starts_at: input.startsAt,
    p_duration: input.durationMinutes,
    p_capacity: input.capacity,
    p_active: input.active,
    p_note: input.note ?? "",
  });
  if (error) throw teamCallError(error);
  return String(data);
}

export async function addDaySlots(input: { day: string; from: string; to: string; every: number; durationMinutes: number; capacity: number }): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("platform_add_team_call_slots", {
    p_day: input.day,
    p_from: input.from,
    p_to: input.to,
    p_every: input.every,
    p_duration: input.durationMinutes,
    p_capacity: input.capacity,
    p_tz: "Asia/Kolkata",
  });
  if (error) throw teamCallError(error);
  return Number(data ?? 0);
}

export async function deleteSlot(id: string): Promise<"deleted" | "deactivated"> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("platform_delete_team_call_slot", { p_id: id });
  if (error) throw teamCallError(error);
  return data === "deleted" ? "deleted" : "deactivated";
}

export async function updateBooking(input: { id: string; status: BookingStatus; adminNote?: string }): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("platform_update_team_call_booking", { p_id: input.id, p_status: input.status, p_admin_note: input.adminNote ?? "" });
  if (error) throw teamCallError(error);
}
