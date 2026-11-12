import { beforeEach, describe, expect, it, vi } from "vitest";
import { enquiryFormSchema } from "@/features/informative/public/enquiry-schema";
import { informativeRoute } from "@/features/informative/public/paths";
import { enquiryFilterQuery, readEnquiryFilter } from "@/features/informative/panel/enquiry-filters";

const TENANT = { tenantId: "t1", slug: "calm", name: "Calm Clinic", status: "active", host: "calm.pictocart.in", primaryHost: "calm.pictocart.in", websiteType: "INFORMATIVE" as string };
let tenant: typeof TENANT | null = TENANT;
const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({ data: [{ enquiry_id: "e1", notify_email: "owner@calm.test", notify_email_enabled: true, business_name: "Calm Clinic" }], error: null as null | { code?: string; hint?: string; message?: string } }));
const rateLimit = vi.fn(async () => undefined);
const sendEmail = vi.fn(async () => ({ status: "sent" }));
const afterFns: (() => unknown)[] = [];

vi.mock("@/features/cart/context", () => ({
  requireStoreTenant: async () => {
    if (!tenant) throw Object.assign(new Error("x"), { code: "TENANT_UNAVAILABLE" });
    return tenant;
  },
  findStoreTenant: async () => tenant,
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ rpc }) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit, clientIpKey: async () => "ip1" }));
vi.mock("@/lib/email/send", () => ({ sendEmail }));
vi.mock("next/server", () => ({ after: (fn: () => unknown) => afterFns.push(fn) }));

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const valid = { name: "Asha Rao", phone: "98765 43210", consent: "on", source: "CONTACT_FORM" };

beforeEach(() => {
  tenant = { ...TENANT };
  process.env.FEATURE_INFORMATIVE_WEBSITE = "all";
  rpc.mockClear();
  rateLimit.mockClear();
  sendEmail.mockClear();
  afterFns.length = 0;
});

describe("enquiry form rules", () => {
  it("name + phone required, consent required, optional fields validated", () => {
    expect(enquiryFormSchema.safeParse(valid).success).toBe(true);
    expect(enquiryFormSchema.safeParse({ ...valid, consent: undefined }).success).toBe(false);
    expect(enquiryFormSchema.safeParse({ ...valid, phone: "12" }).success).toBe(false);
    expect(enquiryFormSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
    expect(enquiryFormSchema.safeParse({ ...valid, email: "x" }).success).toBe(false);
    expect(enquiryFormSchema.safeParse({ ...valid, preferredTime: "25:00" }).success).toBe(false);
    expect(enquiryFormSchema.parse({ ...valid, source: "WHATSAPP_CLICK" }).source).toBe("CONTACT_FORM");
    expect(enquiryFormSchema.parse(valid).phone).toBe("9876543210");
  });
  it("the consent link has a public /privacy page", () => {
    expect(informativeRoute("/privacy")).toEqual({ kind: "privacy" });
  });
});

describe("submitInformativeEnquiryAction", () => {
  it("saves through the RPC with the host's tenant, explicit nulls, rate limit 5 / 10 min per IP + site, then emails the owner", async () => {
    const { submitInformativeEnquiryAction } = await import("@/features/informative/public/enquiry-actions");
    const r = await submitInformativeEnquiryAction(null, fd({ ...valid, tenant: "attacker" }));
    expect(r.ok).toBe(true);
    expect(rateLimit).toHaveBeenCalledWith("info-enquiry", "t1:ip1", 5, 600);
    const [name, args] = rpc.mock.calls[0]!;
    expect(name).toBe("submit_info_enquiry");
    expect(args).toMatchObject({ p_tenant: "t1", p_name: "Asha Rao", p_phone: "9876543210", p_service: null, p_preferred_date: null, p_consent: true, p_source: "CONTACT_FORM" });
    expect(afterFns).toHaveLength(1);
    await afterFns[0]!();
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "owner@calm.test", kind: "informative_enquiry", tenantId: "t1" }));
  });

  it("honeypot: pretends success, stores nothing", async () => {
    const { submitInformativeEnquiryAction } = await import("@/features/informative/public/enquiry-actions");
    const r = await submitInformativeEnquiryAction(null, fd({ ...valid, website: "http://spam" }));
    expect(r.ok).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it("refuses without consent, for Online Stores and with the flag off", async () => {
    const { submitInformativeEnquiryAction } = await import("@/features/informative/public/enquiry-actions");
    const noConsent = await submitInformativeEnquiryAction(null, fd({ name: "Asha", phone: "9876543210" }));
    expect(noConsent.ok).toBe(false);
    tenant = { ...TENANT, websiteType: "ONLINE_STORE" };
    expect((await submitInformativeEnquiryAction(null, fd(valid))).ok).toBe(false);
    tenant = { ...TENANT };
    process.env.FEATURE_INFORMATIVE_WEBSITE = "off";
    expect((await submitInformativeEnquiryAction(null, fd(valid))).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps database refusals to friendly errors; no email when notifications are off", async () => {
    const { submitInformativeEnquiryAction } = await import("@/features/informative/public/enquiry-actions");
    rpc.mockResolvedValueOnce({ data: null as never, error: { hint: "RATE_LIMITED", message: "too many" } });
    const limited = await submitInformativeEnquiryAction(null, fd(valid));
    expect(!limited.ok && limited.error.code).toBe("RATE_LIMITED");
    rpc.mockResolvedValueOnce({ data: [{ enquiry_id: "e2", notify_email: "o@x.in", notify_email_enabled: false, business_name: "Calm" }], error: null });
    await submitInformativeEnquiryAction(null, fd(valid));
    expect(afterFns).toHaveLength(0);
  });
});

describe("WhatsApp click beacon", () => {
  const req = (origin: string | null, host = "calm.pictocart.in", body = "{}") =>
    new Request("https://calm.pictocart.in/api/informative/whatsapp-click", { method: "POST", body, headers: { "x-paliya-host": host, ...(origin ? { origin } : {}) } });
  it("records same-origin taps for Informative sites only, always 204", async () => {
    const { POST } = await import("@/app/api/informative/whatsapp-click/route");
    expect((await POST(req("https://calm.pictocart.in", "calm.pictocart.in", JSON.stringify({ serviceId: "21000000-0000-4000-a000-0000000000a1" })))).status).toBe(204);
    expect(rpc).toHaveBeenCalledWith("record_info_whatsapp_click", { p_tenant: "t1", p_service: "21000000-0000-4000-a000-0000000000a1" });
    rpc.mockClear();
    expect((await POST(req("https://evil.example"))).status).toBe(204);
    expect((await POST(req(null))).status).toBe(204);
    tenant = { ...TENANT, websiteType: "ONLINE_STORE" };
    await POST(req("https://calm.pictocart.in"));
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("inbox filters", () => {
  it("reads valid filters from the URL and ignores junk", () => {
    expect(readEnquiryFilter({ status: "NEW", service: "21000000-0000-4000-a000-0000000000a1", from: "2026-11-01", page: "2" })).toEqual({ status: "NEW", serviceId: "21000000-0000-4000-a000-0000000000a1", from: "2026-11-01", page: 2 });
    expect(readEnquiryFilter({ status: "SPAM" })).toEqual({ page: 1 });
    expect(enquiryFilterQuery({ status: "NEW" }, { open: "x" })).toBe("?status=NEW&open=x");
    expect(enquiryFilterQuery({})).toBe("");
  });
});
