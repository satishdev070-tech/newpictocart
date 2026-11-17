import type { PublicError } from "@/lib/errors";

/** The message to show for a failed action (form-level message first: credits, limits, conflicts). */
export function actionErrorText(error: PublicError): string {
  return error.fieldErrors?._form?.[0] ?? error.message;
}
