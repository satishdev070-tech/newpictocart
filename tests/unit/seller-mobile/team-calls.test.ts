import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatPhone, toE164Phone } from "@/lib/validation/phone";
import { addDaySlotsSchema, bookTeamCallPublicSchema, bookTeamCallSchema, formatCallWhen, groupSlotsByDay, istDayKey, istLocalToIso, TEAM_CALL_ERRORS } from "@/features/team-calls/schemas";
import { DASHBOARD_NAV } from "@/components/dashboard/nav";
import { ADMIN_NAV } from "@/features/platform/nav";

const SLOT = "6a1c2a2e-1b0f-4c8e-9a51-2a5b3b6c7d8e";

describe("phone numbers", () => {
  it("normalises the ways Indians type mobile numbers", () => {
    for (const raw of ["98765 43210", "098765-43210", "+91 98765 43210", "919876543210", "0091 9876543210"]) expect(toE164Phone(raw)).toBe("+919876543210");
    expect(toE164Phone("+44 20 7946 0958")).toBe("+442079460958");
    for (const bad of ["", "12345", "5876543210", "+91 12345 67890", "abc"]) expect(toE164Phone(bad)).toBeNull();
    expect(formatPhone("+919876543210")).toBe("+91 98765 43210");
  });
});

describe("team call booking", () => {
  it("validates dashboard and public bookings", () => {
    expect(bookTeamCallSchema.parse({ slotId: SLOT, name: "Asha", phone: "98765 43210" })).toEqual({ slotId: SLOT, name: "Asha", phone: "+919876543210", topic: undefined });
    expect(() => bookTeamCallSchema.parse({ slotId: SLOT, name: "Asha", phone: "123" })).toThrow();
    expect(() => bookTeamCallPublicSchema.parse({ slotId: SLOT, name: "Asha", phone: "9876543210" })).toThrow(); // email required
    expect(bookTeamCallPublicSchema.parse({ slotId: SLOT, name: "Asha", phone: "9876543210", email: "a@b.in", website: "" }).email).toBe("a@b.in");
  });

  it("reads admin times as IST and groups slots by IST day", () => {
    expect(istLocalToIso("2026-11-30T10:30")).toBe("2026-11-30T05:00:00.000Z");
    // 20:00 UTC on the 30th is already 1 Dec in IST.
    expect(istDayKey("2026-11-30T20:00:00.000Z")).toBe("2026-12-01");
    const g = groupSlotsByDay([
      { id: "b", startsAt: "2026-12-01T05:00:00.000Z", durationMinutes: 30, seatsLeft: 1 },
      { id: "a", startsAt: "2026-11-30T05:00:00.000Z", durationMinutes: 30, seatsLeft: 1 },
      { id: "full", startsAt: "2026-11-30T06:00:00.000Z", durationMinutes: 30, seatsLeft: 0 },
    ]);
    expect(g.map((d) => [d.day, d.slots.map((s) => s.id)])).toEqual([
      ["2026-11-30", ["a"]],
      ["2026-12-01", ["b"]],
    ]);
    expect(formatCallWhen("2026-11-30T05:00:00.000Z")).toMatch(/30 Nov, 10:30 AM IST/);
    expect(() => addDaySlotsSchema.parse({ day: "2026-12-01", from: "18:00", to: "10:00" })).toThrow();
  });

  it("has seller-facing text for every booking error hint in the migration", () => {
    const sql = readFileSync("supabase/migrations/20261127009100_team_calls.sql", "utf8");
    const hints = [...sql.matchAll(/hint = '(TEAM_CALL_[A-Z_]+)'/g)].map((m) => m[1]!);
    expect(hints.length).toBeGreaterThan(3);
    for (const h of hints) expect(TEAM_CALL_ERRORS[h], h).toBeTruthy();
    // Bookings are never writable directly; booking is open to anon only through the function.
    expect(sql).toMatch(/revoke all on public\.team_call_slots, public\.team_call_bookings from anon, authenticated/);
    expect(sql).toMatch(/grant execute on function public\.book_team_call\([^)]*\) to anon, authenticated/);
    expect(sql).not.toMatch(/grant (insert|update|delete)[^;]*team_call_bookings[^;]*to (anon|authenticated)/);
  });

  it("is linked from the seller and admin navigation", () => {
    expect(DASHBOARD_NAV.flatMap((g) => g.items).some((i) => i.href === "/dashboard/book-call")).toBe(true);
    expect(ADMIN_NAV.flatMap((g) => g.items).some((i) => i.href === "/admin/team-calls" && i.permission === "platform.users.manage")).toBe(true);
  });
});
