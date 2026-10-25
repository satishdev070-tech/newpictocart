import { describe, expect, it } from "vitest";
import {
  INVITE_TOKEN_RE,
  acceptInviteSchema,
  agenciesPageSchema,
  analyticsFilterSchema,
  createCodeSchema,
  createPartnerDirectSchema,
  creditAdjustSchema,
  decideLicenseRequestSchema,
  defaultPayoutCutoff,
  invitePartnerSchema,
  inviteErrorMessage,
  issueBatchSchema,
  leaderboardCsvRows,
  maskAccount,
  matchesSearch,
  normalisePhone,
  numericToMinor,
  partnersPageSchema,
  payoutDetailsSchema,
  payoutSummary,
  percentInputToBps,
  promotePartnerSchema,
  redeemCodeSchema,
  resolveAnalyticsRange,
  runPayoutBatchSchema,
  rupeesToMinor,
  settlePayoutSchema,
  tierLabel,
  typeLabel,
} from "@/features/partners/schemas";
import { renderPartnerInviteEmail } from "@/features/partners/email";

const ID = "6f1c2b9e-4d3a-4c1b-9e8f-0a1b2c3d4e5f";

describe("money and rate inputs", () => {
  it("parses rupees to integer paise", () => {
    expect(rupeesToMinor("1,299.50")).toBe(129_950);
    expect(rupeesToMinor("₹ 499")).toBe(49_900);
    expect(rupeesToMinor(0)).toBe(0);
    expect(rupeesToMinor("")).toBeUndefined();
    expect(rupeesToMinor("12.345")).toBeNaN();
    expect(rupeesToMinor("abc")).toBeNaN();
  });

  it("parses percentages to basis points", () => {
    expect(percentInputToBps("12.5")).toBe(1250);
    expect(percentInputToBps("20%")).toBe(2000);
    expect(percentInputToBps("")).toBeUndefined();
    expect(percentInputToBps("101")).toBeNaN();
  });

  it("converts Postgres numerics to paise without float drift", () => {
    expect(numericToMinor("599.80")).toBe(59_980);
    expect(numericToMinor(149.95)).toBe(14_995);
    expect(numericToMinor(null)).toBe(0);
    expect(numericToMinor("bad")).toBe(0);
  });

  it("normalises Indian mobiles", () => {
    expect(normalisePhone("98765 43210")).toBe("+919876543210");
    expect(normalisePhone("09876543210")).toBe("+919876543210");
    expect(normalisePhone("+14155550100")).toBe("+14155550100");
    expect(normalisePhone("")).toBeUndefined();
  });
});

describe("partner forms", () => {
  it("invite: lower-cases the email and defaults the tier", () => {
    const v = invitePartnerSchema.parse({ name: "Kiran Rao", email: " Kiran@Agency.Test ", partnerType: "agency", phone: "9876543210" });
    expect(v).toMatchObject({ email: "kiran@agency.test", tier: "partner", phone: "+919876543210" });
    expect(invitePartnerSchema.safeParse({ name: "K", email: "x", partnerType: "boss" }).success).toBe(false);
  });

  it("create directly: needs a strong, confirmed password", () => {
    const base = { name: "Kiran Rao", email: "k@a.test", partnerType: "freelancer" };
    expect(createPartnerDirectSchema.safeParse({ ...base, password: "weak", confirm: "weak" }).success).toBe(false);
    const mismatch = createPartnerDirectSchema.safeParse({ ...base, password: "Str0ngPassword", confirm: "Str0ngPassw0rd" });
    expect(mismatch.success).toBe(false);
    expect(mismatch.error?.issues[0]?.path).toEqual(["confirm"]);
    expect(createPartnerDirectSchema.safeParse({ ...base, password: "Str0ngPassword", confirm: "Str0ngPassword" }).success).toBe(true);
  });

  it("payout details: UPI needs an ID, bank needs holder + IFSC; blank account keeps the saved one", () => {
    expect(payoutDetailsSchema.safeParse({ partnerId: ID, payoutMethod: "upi" }).success).toBe(false);
    expect(payoutDetailsSchema.parse({ partnerId: ID, payoutMethod: "upi", upiId: "kiran@okhdfc" }).upiId).toBe("kiran@okhdfc");
    const bank = payoutDetailsSchema.safeParse({ partnerId: ID, payoutMethod: "bank", bankAccountHolder: "Kiran", bankIfsc: "hdfc0001234", bankAccountNumber: "" });
    expect(bank.success && bank.data).toMatchObject({ bankIfsc: "HDFC0001234", bankAccountNumber: undefined });
    expect(payoutDetailsSchema.safeParse({ partnerId: ID, payoutMethod: "bank", bankAccountHolder: "K", bankIfsc: "BAD" }).success).toBe(false);
  });

  it("promote: override percent becomes bps", () => {
    expect(promotePartnerSchema.parse({ partnerId: ID, tier: "state_head", overridePercent: "5", stateName: "Rajasthan" })).toMatchObject({ overridePercent: 500, stateName: "Rajasthan" });
    expect(promotePartnerSchema.safeParse({ partnerId: ID, tier: "ceo", overridePercent: "5" }).success).toBe(false);
  });

  it("credit: signed rupee amounts, non-zero, with a reason", () => {
    expect(creditAdjustSchema.parse({ partnerId: ID, amount: "-100.50", note: "Correction", kind: "adjustment" }).amount).toBe(-10_050);
    expect(creditAdjustSchema.parse({ partnerId: ID, amount: "500", note: "Welcome" }).kind).toBe("onboarding_credit");
    expect(creditAdjustSchema.safeParse({ partnerId: ID, amount: "0", note: "Nothing" }).success).toBe(false);
    expect(creditAdjustSchema.safeParse({ partnerId: ID, amount: "10", note: "x" }).success).toBe(false);
  });

  it("one-time codes: normalised to upper case; value at least ₹1", () => {
    expect(redeemCodeSchema.parse({ partnerId: ID, code: " otc-1a2b3c4d5e6f " }).code).toBe("OTC-1A2B3C4D5E6F");
    expect(redeemCodeSchema.safeParse({ partnerId: ID, code: "OTC-123" }).success).toBe(false);
    expect(createCodeSchema.parse({ value: "250" }).value).toBe(25_000);
    expect(createCodeSchema.safeParse({ value: "0.50" }).success).toBe(false);
  });

  it("licence batch and request decisions", () => {
    expect(issueBatchSchema.parse({ partnerId: ID, licenseType: "growth", qty: "25", unitPrice: "299", paid: "on" })).toMatchObject({ qty: 25, unitPrice: 29_900, paid: true });
    expect(issueBatchSchema.safeParse({ partnerId: ID, licenseType: "growth", qty: "0", unitPrice: "299" }).success).toBe(false);
    expect(decideLicenseRequestSchema.safeParse({ requestId: ID, decision: "reject" }).success).toBe(false);
    expect(decideLicenseRequestSchema.parse({ requestId: ID, decision: "approve" }).unitPrice).toBeUndefined();
  });

  it("payout batch and settlement", () => {
    expect(runPayoutBatchSchema.parse({ cutoff: "2026-09-30", method: "upi" }).minAmount).toBe(0);
    expect(runPayoutBatchSchema.parse({ cutoff: "2026-09-30", method: "bank", minAmount: "500" }).minAmount).toBe(50_000);
    expect(settlePayoutSchema.safeParse({ payoutId: ID, outcome: "paid" }).success).toBe(false);
    expect(settlePayoutSchema.safeParse({ payoutId: ID, outcome: "paid", utr: "UTR123456" }).success).toBe(true);
    expect(settlePayoutSchema.safeParse({ payoutId: ID, outcome: "failed" }).success).toBe(false);
  });
});

describe("filters", () => {
  it("falls back to safe defaults for unknown tabs", () => {
    expect(partnersPageSchema.parse({ tab: "nope" }).tab).toBe("partners");
    expect(partnersPageSchema.parse({ tab: "codes", q: "Ravi, (x)" })).toMatchObject({ tab: "codes", q: "ravi x" });
    expect(agenciesPageSchema.parse({}).type).toBe("agency");
    expect(agenciesPageSchema.parse({ type: "intern" }).type).toBe("intern");
    expect(analyticsFilterSchema.parse({ rank: "bogus", preset: "1y" })).toMatchObject({ rank: "commission", preset: undefined });
  });

  it("resolves analytics ranges from presets or explicit dates", () => {
    expect(resolveAnalyticsRange({}, "2026-10-25")).toEqual({ from: "2026-09-25", to: "2026-10-25", preset: "30d" });
    expect(resolveAnalyticsRange({ preset: "ytd" }, "2026-10-25")).toEqual({ from: "2026-01-01", to: "2026-10-25", preset: "ytd" });
    expect(resolveAnalyticsRange({ from: "2026-10-10", to: "2026-10-01" }, "2026-10-25")).toEqual({ from: "2026-10-01", to: "2026-10-10", preset: null });
    expect(resolveAnalyticsRange({ from: "2026-10-01", to: "2026-12-31" }, "2026-10-25").to).toBe("2026-10-25");
  });

  it("defaults the payout cutoff to the end of last month", () => {
    expect(defaultPayoutCutoff("2026-10-25")).toBe("2026-09-30");
    expect(defaultPayoutCutoff("2026-03-01")).toBe("2026-02-28");
    expect(defaultPayoutCutoff("2026-01-15")).toBe("2025-12-31");
  });

  it("matches search terms on any field", () => {
    expect(matchesSearch(undefined, "x")).toBe(true);
    expect(matchesSearch("pcc10", "Ravi", "PCC1001")).toBe(true);
    expect(matchesSearch("zz", "Ravi", null)).toBe(false);
  });
});

describe("display helpers", () => {
  it("never shows a full bank account number", () => {
    expect(maskAccount("123456789012")).toBe("•••• 9012");
    expect(maskAccount("9012")).toBe("•••• 9012");
    expect(maskAccount("12")).toBe("—");
    expect(maskAccount(null)).toBe("—");
    const s = payoutSummary({ payoutMethod: "bank", upiId: null, bankAccountHolder: "Kiran", bankLast4: "9012", bankIfsc: "HDFC0001234" });
    expect(s).toBe("Kiran · •••• 9012 · HDFC0001234");
    expect(payoutSummary({ payoutMethod: "upi", upiId: "k@ok", bankAccountHolder: null, bankLast4: null, bankIfsc: null })).toBe("UPI k@ok");
    expect(payoutSummary({ payoutMethod: null, upiId: null, bankAccountHolder: null, bankLast4: null, bankIfsc: null })).toBe("Not set");
  });

  it("labels tiers and types", () => {
    expect(tierLabel("state_head")).toBe("State head");
    expect(typeLabel("agent")).toBe("Agent");
    expect(typeLabel("other")).toBe("other");
  });

  it("builds leaderboard CSV rows in rupees with ranks", () => {
    const rows = leaderboardCsvRows([{ code: "PCC1001", name: "Ravi", type: "agent", tier: "partner", state: null, licenses: 3, gmvMinor: 30_000, commissionMinor: 59_980 }]);
    expect(rows).toEqual([[1, "PCC1001", "Ravi", "Agent", "Partner", "", 3, "300.00", "599.80"]]);
  });
});

describe("invites", () => {
  it("accepts only well-formed tokens", () => {
    expect(INVITE_TOKEN_RE.test("a".repeat(43))).toBe(true);
    expect(acceptInviteSchema.safeParse({ token: "short" }).success).toBe(false);
    expect(acceptInviteSchema.safeParse({ token: "../../etc/passwd-aaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }).success).toBe(false);
  });

  it("maps SQL hints to clear messages", () => {
    expect(inviteErrorMessage("INVITE_EMAIL_MISMATCH")).toMatch(/different email/);
    expect(inviteErrorMessage("INVITE_INVALID")).toMatch(/not valid any more/);
    expect(inviteErrorMessage("INVITE_ACCOUNT_TAKEN")).toMatch(/another partner/);
    expect(inviteErrorMessage(undefined)).toMatch(/could not be accepted/);
  });

  it("escapes partner names in the invite email", () => {
    const mail = renderPartnerInviteEmail({ brand: { storeName: "Pictocart", logoUrl: null, storeUrl: "https://pictocart.in", accent: null, supportEmail: null }, partnerName: "<b>Ravi</b>", partnerCode: "PCC1001", acceptUrl: "https://pictocart.in/partner/accept/abc", expiresInDays: 7 });
    expect(mail.html).not.toContain("<b>Ravi</b>");
    expect(mail.html).toContain("https://pictocart.in/partner/accept/abc");
    expect(mail.text).toContain("PCC1001");
  });
});
