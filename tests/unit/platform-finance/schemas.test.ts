import { describe, expect, it } from "vitest";
import {
  aiCostByModel,
  bpsToPercentInput,
  commissionListFilterSchema,
  commissionOnGmv,
  commissionPercentField,
  defaultInvoiceMonth,
  generateInvoicesSchema,
  invoiceDisplayStatus,
  invoiceTotals,
  istToday,
  markInvoicePaidSchema,
  modelKey,
  themeAdoption,
  waiveInvoiceSchema,
} from "@/features/platform-finance/schemas";
import { aiCallCostMinor } from "@/features/platform-finance/calc";
import { planSchema } from "@/features/platform/schemas";

const ID = "6f1c2b9e-4d3a-4f5b-9c8d-7e6f5a4b3c2d";

describe("commission action inputs", () => {
  it("generation takes a YYYY-MM month and returns the first of that month", () => {
    expect(generateInvoicesSchema.parse({ period: "2026-09" })).toEqual({ period: "2026-09-01" });
    expect(generateInvoicesSchema.safeParse({ period: "2026-13" }).success).toBe(false);
    expect(generateInvoicesSchema.safeParse({ period: "2026-09-01" }).success).toBe(false);
    expect(generateInvoicesSchema.safeParse({}).success).toBe(false);
  });

  it("mark paid: uuid required, reference optional and capped at 160", () => {
    expect(markInvoicePaidSchema.parse({ invoiceId: ID })).toEqual({ invoiceId: ID });
    expect(markInvoicePaidSchema.parse({ invoiceId: ID, reference: "  UTR123 " })).toEqual({ invoiceId: ID, reference: "UTR123" });
    expect(markInvoicePaidSchema.parse({ invoiceId: ID, reference: "" })).toEqual({ invoiceId: ID });
    expect(markInvoicePaidSchema.safeParse({ invoiceId: ID, reference: "x".repeat(161) }).success).toBe(false);
    expect(markInvoicePaidSchema.safeParse({ invoiceId: "nope" }).success).toBe(false);
  });

  it("waive needs a reason of 3–500 characters", () => {
    expect(waiveInvoiceSchema.parse({ invoiceId: ID, reason: " Goodwill " })).toEqual({ invoiceId: ID, reason: "Goodwill" });
    expect(waiveInvoiceSchema.safeParse({ invoiceId: ID, reason: "ok" }).success).toBe(false);
    expect(waiveInvoiceSchema.safeParse({ invoiceId: ID }).success).toBe(false);
    expect(waiveInvoiceSchema.safeParse({ invoiceId: ID, reason: "x".repeat(501) }).success).toBe(false);
  });

  it("list filter drops junk instead of failing", () => {
    expect(commissionListFilterSchema.parse({})).toMatchObject({ page: 1, pageSize: 25 });
    expect(commissionListFilterSchema.parse({ status: "bogus", q: "", pageSize: "9999" })).toMatchObject({ status: undefined, q: undefined, pageSize: 25 });
    expect(commissionListFilterSchema.parse({ status: "overdue", q: " PC-2026 ", page: "3" })).toMatchObject({ status: "overdue", q: "PC-2026", page: 3 });
  });
});

describe("GMV commission % on plans", () => {
  const parse = (v: unknown) => commissionPercentField.safeParse(v);
  it("converts percentages to basis points without float maths", () => {
    expect(parse("2").data).toBe(200);
    expect(parse("1.5").data).toBe(150);
    expect(parse("0.25").data).toBe(25);
    expect(parse("2.01").data).toBe(201);
    expect(parse("100").data).toBe(10_000);
    expect(parse("0").data).toBe(0);
    expect(parse("").data).toBeUndefined();
    expect(parse(undefined).data).toBeUndefined();
  });

  it("rejects out of range and malformed values", () => {
    for (const v of ["100.01", "101", "-1", "1.234", "abc", "1,5"]) expect(parse(v).success, v).toBe(false);
  });

  it("round-trips through the form value", () => {
    for (const bps of [0, 1, 25, 150, 200, 201, 1234, 10_000]) expect(parse(bpsToPercentInput(bps)).data).toBe(bps);
    expect(bpsToPercentInput(150)).toBe("1.5");
    expect(bpsToPercentInput(200)).toBe("2");
    expect(bpsToPercentInput(5)).toBe("0.05");
  });

  it("planSchema carries the commission when the field is present", () => {
    const base = { code: "growth", name: "Growth", priceMonthly: "999", priceYearly: "9990", trialDays: "14" };
    expect(planSchema.parse({ ...base, commissionPercent: "2.5" }).commissionPercent).toBe(250);
    expect(planSchema.parse(base).commissionPercent).toBeUndefined();
    expect(planSchema.safeParse({ ...base, commissionPercent: "150" }).success).toBe(false);
  });
});

describe("invoice status and totals", () => {
  it("pending past its due date is overdue; settled invoices never are", () => {
    expect(invoiceDisplayStatus("pending", "2026-10-15", "2026-10-16")).toBe("overdue");
    expect(invoiceDisplayStatus("pending", "2026-10-15", "2026-10-15")).toBe("pending");
    expect(invoiceDisplayStatus("paid", "2026-01-01", "2026-10-16")).toBe("paid");
    expect(invoiceDisplayStatus("waived", "2026-01-01", "2026-10-16")).toBe("waived");
  });

  it("sums GMV, commission, collected, outstanding and overdue", () => {
    const t = invoiceTotals(
      [
        { status: "paid", dueDate: "2026-10-15", gmvMinor: 100_000, commissionMinor: 2_000 },
        { status: "pending", dueDate: "2026-10-15", gmvMinor: 50_000, commissionMinor: 1_000 },
        { status: "pending", dueDate: "2026-11-15", gmvMinor: 25_000, commissionMinor: 500 },
        { status: "waived", dueDate: "2026-10-15", gmvMinor: 10_000, commissionMinor: 200 },
      ],
      "2026-10-25",
    );
    expect(t).toEqual({ count: 4, gmvMinor: 185_000, commissionMinor: 3_700, collectedMinor: 2_000, outstandingMinor: 1_500, overdueMinor: 1_000, waivedMinor: 200 });
  });
});

describe("IST dates", () => {
  it("today and the default invoice month follow IST, not UTC", () => {
    // 2026-10-31 20:00 UTC is already 1 Nov in India.
    const lateUtc = new Date("2026-10-31T20:00:00Z");
    expect(istToday(lateUtc)).toBe("2026-11-01");
    expect(defaultInvoiceMonth(lateUtc)).toBe("2026-10");
    expect(defaultInvoiceMonth(new Date("2026-10-31T12:00:00Z"))).toBe("2026-09");
    expect(defaultInvoiceMonth(new Date("2026-01-10T00:00:00Z"))).toBe("2025-12");
  });
});

describe("revenue helpers", () => {
  it("commission uses each store's own rate, rounded per store", () => {
    const rates = new Map([
      ["a", 200],
      ["b", 150],
    ]);
    // a: 1234.50 × 2% = 24.69; b: 333.33 × 1.5% = 4.99995 → 5.00; c has no rate.
    expect(commissionOnGmv([{ tenantId: "a", gmvMinor: 123_450 }, { tenantId: "b", gmvMinor: 33_333 }, { tenantId: "c", gmvMinor: 99_999 }], rates)).toEqual({
      gmvMinor: 256_782,
      commissionMinor: 2_469 + 500,
    });
  });

  it("theme adoption counts distinct stores and names the theme by its most common label", () => {
    expect(
      themeAdoption([
        { tenantId: "a", themeKey: "classic", label: "Classic" },
        { tenantId: "a", themeKey: "classic", label: "Classic" },
        { tenantId: "b", themeKey: "classic", label: "My classic" },
        { tenantId: "c", themeKey: "classic", label: "Classic" },
        { tenantId: "d", themeKey: "bloom", label: null },
      ]),
    ).toEqual([
      { themeKey: "classic", label: "Classic", stores: 3 },
      { themeKey: "bloom", label: "bloom", stores: 1 },
    ]);
  });

  it("AI cost prices tokens per model and lists unpriced models", () => {
    const prices = new Map([[modelKey("gemini", "gemini-2.5-flash"), 3_000]]); // ₹30 per 1M tokens
    const cost = (tokens: number, p: number) => aiCallCostMinor(tokens, 0, { inputPerMillionMinor: p, outputPerMillionMinor: 0 });
    const r = aiCostByModel(
      [
        { provider: "gemini", model: "gemini-2.5-flash", calls: 10, tokens: 1_500_001 },
        { provider: "groq", model: "llama", calls: 3, tokens: 9_000 },
        { provider: "sarvam", model: "", calls: 1, tokens: 0 },
      ],
      prices,
      cost,
    );
    expect(r.totalMinor).toBe(4_501); // 1,500,001 × 3,000 / 1M = 4,500.003 → rounded up
    expect(r.rows[0]).toMatchObject({ provider: "gemini", costMinor: 4_501, pricePerMillionMinor: 3_000 });
    expect(r.unpriced.map((u) => u.provider)).toEqual(["groq"]);
  });
});
