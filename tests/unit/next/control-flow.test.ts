import { describe, expect, it } from "vitest";
import { isNextControlFlowError } from "@/lib/next/control-flow";

describe("isNextControlFlowError", () => {
  it("recognises dynamic bailout, redirect and not-found digests", () => {
    expect(isNextControlFlowError(Object.assign(new Error("x"), { digest: "DYNAMIC_SERVER_USAGE" }))).toBe(true);
    expect(isNextControlFlowError(Object.assign(new Error("x"), { digest: "NEXT_REDIRECT;/" }))).toBe(true);
    expect(isNextControlFlowError(Object.assign(new Error("x"), { digest: "NEXT_NOT_FOUND" }))).toBe(true);
  });

  it("ignores ordinary errors", () => {
    expect(isNextControlFlowError(new Error("network down"))).toBe(false);
    expect(isNextControlFlowError(null)).toBe(false);
  });
});
