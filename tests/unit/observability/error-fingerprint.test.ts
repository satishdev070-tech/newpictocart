import { describe, expect, it } from "vitest";
import {
  defaultErrorMessage,
  deriveErrorFingerprint,
  resolveErrorFields,
} from "@/lib/observability/error-fingerprint";
import { aggregateErrorGroups } from "@/lib/observability/server/ingest";
import type { BufferedRequestEvent } from "@/lib/observability/server/types";

describe("deriveErrorFingerprint", () => {
  it("is stable for the same route/method/status/message", () => {
    const a = deriveErrorFingerprint({
      routeTemplate: "/api/checkout",
      method: "post",
      status: 500,
      message: "boom",
    });
    const b = deriveErrorFingerprint({
      routeTemplate: "/api/checkout",
      method: "POST",
      status: 500,
      message: "boom",
    });
    expect(a).toBe(b);
    expect(a).toHaveLength(32);
  });

  it("changes when status or route changes", () => {
    const base = deriveErrorFingerprint({ routeTemplate: "/login", method: "GET", status: 500 });
    expect(deriveErrorFingerprint({ routeTemplate: "/login", method: "GET", status: 502 })).not.toBe(base);
    expect(deriveErrorFingerprint({ routeTemplate: "/seller/login", method: "GET", status: 500 })).not.toBe(base);
  });
});

describe("resolveErrorFields", () => {
  it("auto-derives fingerprint and default message for status >= 400", () => {
    const out = resolveErrorFields({
      status: 404,
      method: "GET",
      routeTemplate: "/missing",
    });
    expect(out.errorFingerprint).toHaveLength(32);
    expect(out.errorMessage).toBe("404 GET /missing");
  });

  it("leaves fingerprint null for successful responses", () => {
    const out = resolveErrorFields({
      status: 200,
      method: "GET",
      routeTemplate: "/login",
    });
    expect(out.errorFingerprint).toBeNull();
    expect(out.errorMessage).toBeNull();
  });

  it("keeps an explicit fingerprint and prefers explicit message", () => {
    const out = resolveErrorFields({
      status: 500,
      method: "GET",
      routeTemplate: "/login",
      errorFingerprint: "custom-fp",
      errorMessage: "db timeout",
    });
    expect(out.errorFingerprint).toBe("custom-fp");
    expect(out.errorMessage).toBe("db timeout");
  });

  it("builds the default message helper", () => {
    expect(defaultErrorMessage(503, "get", "/api/x")).toBe("503 GET /api/x");
  });
});

describe("aggregateErrorGroups", () => {
  const event = (over: Partial<BufferedRequestEvent>): BufferedRequestEvent => ({
    request_id: "r1",
    trace_id: "t1",
    timestamp: "2026-11-04T12:00:00.000Z",
    environment: "test",
    service: "web",
    route_template: "/api/a",
    method: "GET",
    status: 500,
    duration_ms: 10,
    tenant_id: null,
    user_id: null,
    error_fingerprint: "fp1",
    error_message: "fail",
    spans: [],
    attrs: {},
    ...over,
  });

  it("skips events without fingerprints and increments counts", () => {
    const groups = aggregateErrorGroups([
      event({}),
      event({ timestamp: "2026-11-04T12:01:00.000Z", error_message: "fail later" }),
      event({ error_fingerprint: null }),
      event({ error_fingerprint: "fp2", route_template: "/api/b", status: 404 }),
    ]);
    expect(groups).toHaveLength(2);
    const fp1 = groups.find((g) => g.fingerprint === "fp1")!;
    expect(fp1.count).toBe(2);
    expect(fp1.firstSeenAt).toBe("2026-11-04T12:00:00.000Z");
    expect(fp1.lastSeenAt).toBe("2026-11-04T12:01:00.000Z");
    expect(fp1.messageSample).toBe("fail later");
    expect(groups.find((g) => g.fingerprint === "fp2")!.status).toBe(404);
  });
});
