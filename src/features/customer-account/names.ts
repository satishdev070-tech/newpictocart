import { personName } from "@/lib/validation/common";

/**
 * Best display name from Supabase auth `user_metadata`. Google sign-in sets `full_name` / `name`
 * (and `given_name` / `family_name`); email sign-up sets `display_name`. Returns null unless the
 * value passes the shared person-name rules, so a handle like "user_123" is never prefilled.
 */
export function nameFromAuthMetadata(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const m = meta as Record<string, unknown>;
  const str = (k: string) => (typeof m[k] === "string" ? (m[k] as string) : "");
  const candidates = [str("display_name"), str("full_name"), str("name"), [str("given_name"), str("family_name")].filter(Boolean).join(" ")];
  for (const c of candidates) {
    const parsed = personName.safeParse(c);
    if (parsed.success) return parsed.data;
  }
  return null;
}

/** "Asha Mehta Rao" -> first "Asha", last "Mehta Rao" (customers.first_name / last_name, 80 chars each). */
export function splitPersonName(name: string): { first: string; last: string | null } {
  const [first = "", ...rest] = name.trim().split(/\s+/);
  return { first: first.slice(0, 80), last: rest.join(" ").slice(0, 80) || null };
}
