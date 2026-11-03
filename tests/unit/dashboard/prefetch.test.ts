import { describe, expect, it, vi } from "vitest";
import {
  HEAVY_ADMIN_HREFS,
  HEAVY_SELLER_HREFS,
  idlePrefetchHrefs,
  runPrefetchQueue,
  shouldSkipIdlePrefetch,
} from "@/components/app-shell/prefetch";

describe("idlePrefetchHrefs", () => {
  it("returns only the seller allowlist (not every nav href)", () => {
    expect(idlePrefetchHrefs("seller")).toEqual([...HEAVY_SELLER_HREFS]);
    expect(idlePrefetchHrefs("seller").length).toBeLessThan(20);
  });

  it("returns only the admin allowlist", () => {
    expect(idlePrefetchHrefs("admin")).toEqual([...HEAVY_ADMIN_HREFS]);
  });

  it("dedupes and keeps stable order across calls", () => {
    expect(idlePrefetchHrefs("seller")).toEqual(idlePrefetchHrefs("seller"));
    expect(idlePrefetchHrefs("admin").join("\0")).toBe(idlePrefetchHrefs("admin").join("\0"));
  });
});

describe("shouldSkipIdlePrefetch", () => {
  it("skips when the tab is hidden, save-data is on, or offline", () => {
    expect(shouldSkipIdlePrefetch({ hidden: true })).toBe(true);
    expect(shouldSkipIdlePrefetch({ saveData: true })).toBe(true);
    expect(shouldSkipIdlePrefetch({ onLine: false })).toBe(true);
  });

  it("allows prefetch when visible, online, and not save-data", () => {
    expect(shouldSkipIdlePrefetch({ hidden: false, saveData: false, onLine: true })).toBe(false);
    expect(shouldSkipIdlePrefetch({})).toBe(false);
  });
});

describe("runPrefetchQueue", () => {
  it("respects concurrency and still covers every href", async () => {
    const seen: string[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    await runPrefetchQueue(
      ["/a", "/b", "/c", "/d"],
      async (href) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        seen.push(href);
        await Promise.resolve();
        inFlight -= 1;
      },
      { concurrency: 2 },
    );
    expect(seen.sort()).toEqual(["/a", "/b", "/c", "/d"]);
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it("stops early when cancelled", async () => {
    const prefetch = vi.fn(async () => {
      await Promise.resolve();
    });
    let calls = 0;
    await runPrefetchQueue(["/a", "/b", "/c"], prefetch, {
      concurrency: 1,
      isCancelled: () => {
        calls += 1;
        return calls > 1;
      },
    });
    expect(prefetch.mock.calls.length).toBeLessThan(3);
  });
});
