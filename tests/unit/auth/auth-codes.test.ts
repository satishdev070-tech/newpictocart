import { beforeEach, describe, expect, it, vi } from "vitest";

/** App-sent auth codes (features/auth/server/auth-codes.ts): generateLink → branded email via Resend. */

type LinkResult = { data: { user: { id: string; email_confirmed_at: string | null; user_metadata: Record<string, unknown> } | null; properties: { email_otp: string; hashed_token: string } | null } | null; error: { code?: string; message: string } | null };
const linkResults: LinkResult[] = [];
const generateLink = vi.fn(async () => linkResults.shift()!);
const createUser = vi.fn(async () => ({ data: { user: { id: "u-new" } }, error: null as null | { message: string } }));
const updateUserById = vi.fn(async () => ({ data: {}, error: null }));
const handleAuthEmailHook = vi.fn(async () => ({ ok: true as const, sent: [{ status: "sent" as const }] }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ auth: { admin: { generateLink, createUser, updateUserById } } }) }));
vi.mock("@/lib/observability/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock("@/features/notifications/email/auth-hook", () => ({ handleAuthEmailHook }));

const ok = (confirmed: boolean): LinkResult => ({
  data: { user: { id: "u1", email_confirmed_at: confirmed ? "2026-10-01T00:00:00Z" : null, user_metadata: {} }, properties: { email_otp: "855189", hashed_token: "hash123" } },
  error: null,
});

beforeEach(() => {
  linkResults.length = 0;
  vi.clearAllMocks();
});

describe("sendAuthCode", () => {
  it("emails a sign-in code for an existing account through the hook renderer (link type email)", async () => {
    const { sendAuthCode } = await import("@/features/auth/server/auth-codes");
    linkResults.push(ok(true));
    const r = await sendAuthCode({ email: "Seller@Example.com", kind: "signin", redirectTo: "https://pictocartdev.in/auth/callback?next=%2Fdashboard" });
    expect(r).toEqual({ status: "sent", codeLength: 6 });
    expect(generateLink).toHaveBeenCalledWith({ type: "magiclink", email: "seller@example.com", options: { redirectTo: "https://pictocartdev.in/auth/callback?next=%2Fdashboard" } });
    const [payload, opts] = handleAuthEmailHook.mock.calls[0] as unknown as [{ email_data: { token: string; token_hash: string; email_action_type: string } }, { linkType: string }];
    expect(payload.email_data).toMatchObject({ token: "855189", token_hash: "hash123", email_action_type: "magiclink" });
    expect(opts).toEqual({ linkType: "email" });
  });

  it("creates the account when it doesn't exist and sends the confirm copy", async () => {
    const { sendAuthCode } = await import("@/features/auth/server/auth-codes");
    linkResults.push({ data: null, error: { code: "user_not_found", message: "User not found" } }, ok(false));
    const r = await sendAuthCode({ email: "new@example.com", kind: "signin", createUser: true, redirectTo: "https://pictocartdev.in/auth/callback", userMetadata: { store_name: "Asha Crafts" } });
    expect(r).toEqual({ status: "sent", codeLength: 6 });
    expect(createUser).toHaveBeenCalledWith({ email: "new@example.com", email_confirm: false, user_metadata: { store_name: "Asha Crafts" } });
    expect((handleAuthEmailHook.mock.calls[0] as unknown as [{ email_data: { email_action_type: string } }])[0].email_data.email_action_type).toBe("signup");
  });

  it("sends password reset codes with the recovery link type and hides unknown emails", async () => {
    const { sendAuthCode } = await import("@/features/auth/server/auth-codes");
    linkResults.push(ok(true));
    expect(await sendAuthCode({ email: "a@example.com", kind: "recovery", redirectTo: "https://shop.pictocartdev.in/account/auth/callback" })).toEqual({ status: "sent", codeLength: 6 });
    expect((handleAuthEmailHook.mock.calls[0] as unknown as [unknown, { linkType: string }])[1]).toEqual({ linkType: "recovery" });
    linkResults.push({ data: null, error: { code: "user_not_found", message: "User not found" } });
    expect(await sendAuthCode({ email: "nobody@example.com", kind: "recovery", redirectTo: "https://pictocartdev.in/auth/callback" })).toEqual({ status: "no-account" });
  });

  it("always reports codeLength 6 even when Supabase returns a longer OTP", async () => {
    const { sendAuthCode, codeLengthOf, knownCodeLength } = await import("@/features/auth/server/auth-codes");
    linkResults.push({ data: { user: { id: "u1", email_confirmed_at: "2026-10-01T00:00:00Z", user_metadata: {} }, properties: { email_otp: "21914449", hashed_token: "h" } }, error: null });
    expect(await sendAuthCode({ email: "a@example.com", kind: "signin", redirectTo: "https://pictocartdev.in/auth/callback" })).toEqual({ status: "sent", codeLength: 6 });
    expect(knownCodeLength()).toBe(6);
    expect(codeLengthOf(null)).toBe(6);
    expect(codeLengthOf("21914449")).toBe(6);
  });

  it("reports a provider failure when the email could not be delivered", async () => {
    const { sendAuthCode, authCodeFailureMessage } = await import("@/features/auth/server/auth-codes");
    linkResults.push(ok(true));
    handleAuthEmailHook.mockResolvedValueOnce({ ok: true, sent: [{ status: "logged" as never }] });
    const r = await sendAuthCode({ email: "a@example.com", kind: "signin", redirectTo: "https://pictocartdev.in/auth/callback" });
    expect(r).toEqual({ status: "failed", reason: "provider" });
    expect(authCodeFailureMessage(r)).toMatch(/couldn't send the email/);
  });
});
