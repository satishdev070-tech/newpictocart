import { AppError } from "@/lib/errors";
import { EnvValidationError } from "@/lib/env/schema";

const GENERIC_FINISH = "The store could not be finished. Try again.";

const OPERATION_MESSAGES: Record<string, string> = {
  create_tenant: "We couldn't create your store. Try again in a moment.",
  seed_save_product: "Your account is ready, but sample products couldn't be saved. Try again.",
  seed_theme_draft: "Your account is ready, but the store theme couldn't be applied. Try again.",
};

/**
 * Maps any throw from the create/seed portion of `start.finalize` into an AppError
 * with a seller-safe `_form` message. Never leaks DB details or secret values.
 */
export function mapStartFinalizeError(err: unknown): AppError {
  if (err instanceof EnvValidationError) {
    return new AppError("INTERNAL", {
      fieldErrors: { _form: ["Server configuration error — contact support."] },
      context: { reason: "env_invalid", issues: err.issues.slice(0, 8) },
    });
  }

  if (err instanceof AppError) {
    const line = err.fieldErrors?._form?.[0] ?? err.fieldErrors?.slug?.[0];
    if (line) return err;

    if (err.code !== "INTERNAL") {
      return new AppError(err.code, {
        fieldErrors: { _form: [err.publicMessage] },
        context: err.context,
        message: err.message,
        cause: err,
      });
    }

    const op = typeof err.context?.operation === "string" ? err.context.operation : null;
    const msg = (op && OPERATION_MESSAGES[op]) || GENERIC_FINISH;
    return new AppError("VALIDATION", {
      fieldErrors: { _form: [msg] },
      context: err.context,
      cause: err,
    });
  }

  return new AppError("VALIDATION", {
    fieldErrors: { _form: [GENERIC_FINISH] },
    context: { reason: "unknown_throw" },
  });
}
