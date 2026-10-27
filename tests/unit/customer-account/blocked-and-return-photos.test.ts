import { beforeEach, describe, expect, it, vi } from "vitest";
import { BLOCKED_ACCOUNT_MESSAGE, customerAccess } from "@/features/customer-account/blocked";
import { MAX_RETURN_PHOTO_BYTES, MAX_RETURN_PHOTOS, returnPhotoPath, validateReturnPhotos } from "@/features/customer-account/return-photos";

const redirect = vi.fn((url: string) => {
  throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;${url}` });
});
vi.mock("next/navigation", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/navigation")>()), redirect: (u: string) => redirect(u) }));
vi.mock("next/cache", () => ({ refresh: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(), clientIpKey: async () => "ip" }));
vi.mock("@/lib/observability/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("@/features/tracking/server/flag", () => ({ flagClientEvent: vi.fn() }));
vi.mock("@/features/notifications/events", () => ({ emit: vi.fn() }));
vi.mock("@/features/cart/service", () => ({ mergeGuestCartIntoCustomer: vi.fn() }));
vi.mock("@/features/cart/token", () => ({ clearCartCookie: vi.fn() }));
vi.mock("@/features/platform/server/public-config", () => ({ getPublicPlatformConfig: async () => ({}) }));
vi.mock("@/features/auth/server/auth-codes", () => ({ authCodeFailureMessage: () => "", knownCodeLength: () => 6, sendAuthCode: vi.fn() }));
vi.mock("@/features/checkout/analytics", () => ({ trackCommerceEvent: vi.fn() }));

const TENANT = "10000000-0000-4000-a000-00000000000a";
const ORDER = "40000000-0000-4000-a000-000000000001";
vi.mock("@/features/cart/context", () => ({ requireStoreTenant: async () => ({ tenantId: TENANT, host: "aangan.localhost" }) }));

let access: "none" | "active" | "blocked" = "blocked";
let linked: { id: string; tenantId: string } | null = null;
vi.mock("@/features/customer-account/session", () => ({
  ensureStoreCustomer: async () => linked,
  getStoreCustomer: async () => linked,
  getStoreCustomerAccess: async () => access,
}));

const signOut = vi.fn(async () => ({ error: null }));
const upload = vi.fn(async () => ({ error: null }));
const remove = vi.fn(async () => ({ error: null }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { signInWithPassword: async () => ({ error: null }), signOut },
    storage: { from: () => ({ upload, remove }) },
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({ data: { id: ORDER, fulfillment_status: "delivered", order_items: [{ id: "oi-1", quantity: 2, returned_quantity: 0 }] } }),
      };
      return q;
    },
  }),
}));
const rpc = vi.fn(async () => ({ data: "ret-1", error: null }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc }) }));

const { storeSignInAction, requestReturnAction, cancelMyOrderAction } = await import("@/features/customer-account/actions");

const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]);
const SVG = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>");

beforeEach(() => {
  redirect.mockClear();
  signOut.mockClear();
  upload.mockClear();
  remove.mockClear();
  rpc.mockClear();
  access = "blocked";
  linked = null;
});

describe("blocked shopper check", () => {
  it("maps customer rows to access", () => {
    expect(customerAccess(null)).toBe("none");
    expect(customerAccess({ status: "active" })).toBe("active");
    expect(customerAccess({ status: "blocked" })).toBe("blocked");
  });

  it("a blocked shopper with the right password is signed out and told the account is blocked", async () => {
    const f = new FormData();
    f.set("email", "shopper@example.test");
    f.set("password", "Paliya@12345");
    const res = await storeSignInAction(null, f);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.fieldErrors?._form).toEqual([BLOCKED_ACCOUNT_MESSAGE]);
    expect(signOut).toHaveBeenCalledOnce();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("an active shopper still signs in and is redirected", async () => {
    linked = { id: "c1", tenantId: TENANT };
    access = "active";
    const f = new FormData();
    f.set("email", "shopper@example.test");
    f.set("password", "Paliya@12345");
    await expect(storeSignInAction(null, f)).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/account");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("account actions from a blocked session say the account is blocked", async () => {
    const f = new FormData();
    f.set("orderId", ORDER);
    const res = await cancelMyOrderAction(null, f);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("FORBIDDEN");
      expect(res.error.fieldErrors?._form).toEqual([BLOCKED_ACCOUNT_MESSAGE]);
    }
  });
});

describe("return photo validation", () => {
  const f = (bytes: Uint8Array, size = bytes.length) => ({ size, bytes });

  it("accepts up to 5 JPG/PNG/WebP photos by real content", () => {
    const r = validateReturnPhotos([f(JPG), f(PNG)], "size_issue");
    expect(r.ok && r.photos.map((p) => p.ext)).toEqual(["jpg", "png"]);
  });
  it("photos are optional, except for damaged items", () => {
    expect(validateReturnPhotos([], "changed_mind").ok).toBe(true);
    expect(validateReturnPhotos([f(new Uint8Array(), 0)], "damaged")).toEqual({ ok: false, error: "Add at least one photo of the damage." });
    expect(validateReturnPhotos([f(JPG)], "damaged").ok).toBe(true);
  });
  it("rejects more than 5, oversized, GIF and SVG files", () => {
    expect(validateReturnPhotos(Array.from({ length: MAX_RETURN_PHOTOS + 1 }, () => f(JPG)), "other").ok).toBe(false);
    expect(validateReturnPhotos([f(JPG, MAX_RETURN_PHOTO_BYTES + 1)], "other").ok).toBe(false);
    expect(validateReturnPhotos([f(GIF)], "other").ok).toBe(false);
    expect(validateReturnPhotos([f(SVG)], "other").ok).toBe(false);
  });
  it("builds tenant- and order-scoped storage paths", () => {
    expect(returnPhotoPath(TENANT, ORDER, "abc", "jpg")).toBe(`tenant/${TENANT}/returns/${ORDER}/abc.jpg`);
  });

  const returnForm = (reason: string, files: { bytes: Uint8Array; type: string }[]) => {
    const fd = new FormData();
    fd.set("orderId", ORDER);
    fd.set("reason", reason);
    fd.set("qty_oi-1", "1");
    for (const [n, file] of files.entries()) fd.append("photos", new File([file.bytes as BlobPart], `p${n}`, { type: file.type }));
    return fd;
  };

  it("a damaged-item return without photos is refused before anything is created", async () => {
    linked = { id: "c1", tenantId: TENANT };
    const res = await requestReturnAction(null, returnForm("damaged", []));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.fieldErrors?.photos).toEqual(["Add at least one photo of the damage."]);
    expect(upload).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("a file renamed to .jpg that isn't an image is refused", async () => {
    linked = { id: "c1", tenantId: TENANT };
    const res = await requestReturnAction(null, returnForm("damaged", [{ bytes: SVG, type: "image/jpeg" }]));
    expect(res.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("uploads photos under the order's folder and stores the paths on the return", async () => {
    linked = { id: "c1", tenantId: TENANT };
    const res = await requestReturnAction(null, returnForm("damaged", [{ bytes: JPG, type: "image/jpeg" }, { bytes: PNG, type: "image/png" }]));
    expect(res.ok).toBe(true);
    expect(upload).toHaveBeenCalledTimes(2);
    const args = (rpc.mock.calls[0] as unknown as [string, { p_photos: string[] }])[1];
    expect(args.p_photos).toHaveLength(2);
    for (const p of args.p_photos) expect(p).toMatch(new RegExp(`^tenant/${TENANT}/returns/${ORDER}/[0-9a-f-]{36}\\.(jpg|png)$`));
  });

  it("removes uploaded photos when creating the return fails", async () => {
    linked = { id: "c1", tenantId: TENANT };
    rpc.mockResolvedValueOnce({ data: null, error: { code: "22023", message: "invalid return quantity" } } as never);
    const res = await requestReturnAction(null, returnForm("damaged", [{ bytes: JPG, type: "image/jpeg" }]));
    expect(res.ok).toBe(false);
    expect(remove).toHaveBeenCalledOnce();
  });
});
