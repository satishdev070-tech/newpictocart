import { describe, expect, it } from "vitest";
import { isNetworkRouteError, routeErrorDescription } from "@/components/app-shell/route-error-copy";

describe("route error copy", () => {
  it("detects network / timeout messages", () => {
    expect(isNetworkRouteError("TypeError: Failed to fetch")).toBe(true);
    expect(isNetworkRouteError("ERR_TIMED_OUT")).toBe(true);
    expect(isNetworkRouteError("network error")).toBe(true);
    expect(isNetworkRouteError("Load failed")).toBe(true);
    expect(isNetworkRouteError("Unexpected Application Error")).toBe(false);
  });

  it("uses connection copy for network failures and digest otherwise", () => {
    expect(routeErrorDescription(new Error("fetch failed"))).toMatch(/timed out|network/i);
    const withDigest = Object.assign(new Error("bug"), { digest: "abc123" });
    expect(routeErrorDescription(withDigest)).toBe("Reference: abc123");
    expect(routeErrorDescription(new Error("bug"))).toBe("Please try again.");
  });
});
