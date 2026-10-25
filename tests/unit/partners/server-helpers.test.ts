import { describe, expect, it } from "vitest";
import { codeDisplayStatus, leaderboardTotals, licenseCounts, orgTotals, type PartnerOrgRow } from "@/features/partners/server";

const org = (o: Partial<PartnerOrgRow>): PartnerOrgRow => ({
  id: "x",
  name: "X",
  companyName: null,
  email: "x@x.test",
  code: "PCC1001",
  type: "agency",
  tier: "partner",
  status: "active",
  parentId: null,
  parentName: null,
  teamCount: 0,
  licensesTotal: 0,
  licensesRedeemed: 0,
  amountPaidMinor: 0,
  creditMinor: 0,
  createdAt: "2026-10-01T00:00:00Z",
  ...o,
});

describe("partner list helpers", () => {
  it("totals organisations", () => {
    expect(orgTotals([])).toEqual({ count: 0, licensesRedeemed: 0, licensesTotal: 0, amountPaidMinor: 0, teamCount: 0 });
    expect(orgTotals([org({ licensesTotal: 10, licensesRedeemed: 4, amountPaidMinor: 29_900, teamCount: 2 }), org({ licensesTotal: 1, licensesRedeemed: 1, amountPaidMinor: 100, teamCount: 0 })])).toEqual({ count: 2, licensesRedeemed: 5, licensesTotal: 11, amountPaidMinor: 30_000, teamCount: 2 });
  });

  it("counts licences by status", () => {
    expect(licenseCounts([{ status: "available" }, { status: "consumed" }, { status: "available" }, { status: "weird" }])).toEqual({ available: 2, consumed: 1, revoked: 0 });
  });

  it("shows active codes past their expiry as expired", () => {
    expect(codeDisplayStatus({ status: "active", expiresAt: "2026-10-24" }, "2026-10-25")).toBe("expired");
    expect(codeDisplayStatus({ status: "active", expiresAt: "2026-10-25" }, "2026-10-25")).toBe("active");
    expect(codeDisplayStatus({ status: "used", expiresAt: "2026-01-01" }, "2026-10-25")).toBe("used");
    expect(codeDisplayStatus({ status: "active", expiresAt: null }, "2026-10-25")).toBe("active");
  });

  it("totals the leaderboard", () => {
    expect(leaderboardTotals([{ partnerId: "a", name: "A", tier: "partner", state: null, licenses: 3, gmvMinor: 300, commissionMinor: 50 }, { partnerId: "b", name: "B", tier: "partner", state: null, licenses: 1, gmvMinor: 100, commissionMinor: 0 }])).toEqual({ gmvMinor: 400, commissionMinor: 50, licenses: 4 });
  });
});
