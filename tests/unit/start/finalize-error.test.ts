import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { EnvValidationError } from "@/lib/env/schema";
import { mapStartFinalizeError } from "@/features/start/finalize-error";

describe("mapStartFinalizeError", () => {
  it("preserves AppError fieldErrors._form", () => {
    const err = new AppError("VALIDATION", { fieldErrors: { _form: ["Add a business name before finishing."] } });
    expect(mapStartFinalizeError(err)).toBe(err);
  });

  it("preserves AppError fieldErrors.slug", () => {
    const err = new AppError("VALIDATION", { fieldErrors: { slug: ["That store address is taken. Try another name."] } });
    expect(mapStartFinalizeError(err)).toBe(err);
  });

  it("maps bare INTERNAL to generic finish message", () => {
    const mapped = mapStartFinalizeError(new AppError("INTERNAL"));
    expect(mapped.code).toBe("VALIDATION");
    expect(mapped.fieldErrors?._form?.[0]).toBe("The store could not be finished. Try again.");
  });

  it("maps INTERNAL create_tenant to a clearer message", () => {
    const mapped = mapStartFinalizeError(new AppError("INTERNAL", { context: { operation: "create_tenant" } }));
    expect(mapped.fieldErrors?._form?.[0]).toMatch(/couldn't create your store/i);
  });

  it("maps INTERNAL seed_save_product to a clearer message", () => {
    const mapped = mapStartFinalizeError(new AppError("INTERNAL", { context: { operation: "seed_save_product" } }));
    expect(mapped.fieldErrors?._form?.[0]).toMatch(/sample products/i);
  });

  it("preserves non-INTERNAL codes via publicMessage as _form", () => {
    const mapped = mapStartFinalizeError(new AppError("FORBIDDEN"));
    expect(mapped.code).toBe("FORBIDDEN");
    expect(mapped.fieldErrors?._form?.[0]).toBe("You don't have permission to do that.");
  });

  it("maps EnvValidationError to a server-config message", () => {
    const mapped = mapStartFinalizeError(new EnvValidationError(["APP_SECRET: Too small"]));
    expect(mapped.code).toBe("INTERNAL");
    expect(mapped.fieldErrors?._form?.[0]).toMatch(/Server configuration error/i);
    expect(mapped.context?.reason).toBe("env_invalid");
  });

  it("maps unknown throws to generic finish message", () => {
    const mapped = mapStartFinalizeError(new Error("boom"));
    expect(mapped.code).toBe("VALIDATION");
    expect(mapped.fieldErrors?._form?.[0]).toBe("The store could not be finished. Try again.");
  });
});
