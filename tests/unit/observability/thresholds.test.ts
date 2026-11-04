import { describe, expect, it } from "vitest";
import { classifyDuration } from "@/lib/observability/thresholds";

describe("classifyDuration", () => {
  it("bands healthy / moderate / slow / critical", () => {
    expect(classifyDuration(0)).toBe("healthy");
    expect(classifyDuration(299)).toBe("healthy");
    expect(classifyDuration(300)).toBe("moderate");
    expect(classifyDuration(799)).toBe("moderate");
    expect(classifyDuration(800)).toBe("slow");
    expect(classifyDuration(2000)).toBe("slow");
    expect(classifyDuration(2001)).toBe("critical");
    expect(classifyDuration(10_000)).toBe("critical");
  });
});
