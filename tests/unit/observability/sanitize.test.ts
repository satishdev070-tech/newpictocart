import { describe, expect, it } from "vitest";
import { normalizeRoute, redactValue, sanitizeHeaders } from "@/lib/observability/sanitization";

describe("sanitizeHeaders", () => {
  it("keeps allowlisted headers and drops others", () => {
    const out = sanitizeHeaders({
      Host: "aangan.localhost:3000",
      "User-Agent": "vitest",
      Authorization: "Bearer secret",
      Cookie: "session=abc",
      "X-Custom": "nope",
      "Content-Type": "application/json",
    });
    expect(out.host).toBe("aangan.localhost:3000");
    expect(out["user-agent"]).toBe("vitest");
    expect(out["content-type"]).toBe("application/json");
    expect(out.authorization).toBeUndefined();
    expect(out.cookie).toBeUndefined();
    expect(out["x-custom"]).toBeUndefined();
  });
});

describe("redactValue", () => {
  it("redacts secret-like keys", () => {
    const out = redactValue({ password: "x", nested: { api_key: "y", ok: 1 } }) as Record<string, unknown>;
    expect(out.password).toBe("[redacted]");
    expect((out.nested as Record<string, unknown>).api_key).toBe("[redacted]");
    expect((out.nested as Record<string, unknown>).ok).toBe(1);
  });
});

describe("normalizeRoute", () => {
  it("templates uuid and numeric ids", () => {
    expect(normalizeRoute("/dashboard/products/3fa85f64-5717-4562-b3fc-2c963f66afa6")).toBe("/dashboard/products/[id]");
    expect(normalizeRoute("/dashboard/orders/42")).toBe("/dashboard/orders/[id]");
    expect(normalizeRoute("/seller/login")).toBe("/seller/login");
    expect(normalizeRoute("/dashboard/products/[id]?x=1")).toBe("/dashboard/products/[id]");
  });
});
