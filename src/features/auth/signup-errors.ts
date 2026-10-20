/**
 * Safe sentences for Auth signup failures. The raw GoTrue message is logged, never shown.
 */

/**
 * Confirm the new account without a delivered email when no provider is configured, and also on a
 * local or non-production server when a saved Resend key still cannot send. Production with a
 * configured provider keeps the email error.
 */
export function shouldConfirmWithoutEmail(hasProvider: boolean, nodeEnv: string, rootDomain: string): boolean {
  if (!hasProvider) return true;
  if (nodeEnv !== "production") return true;
  return rootDomain === "localhost";
}

export function isConfirmationEmailFailure(code: string | undefined, message: string): boolean {
  const codeL = (code ?? "").toLowerCase();
  const text = message.toLowerCase();
  if (codeL === "hook_timeout") return true;
  if (text.includes("email provider")) return true;
  if (text.includes("confirmation email") || text.includes("confirmation mail")) return true;
  if (text.includes("error sending") && (text.includes("email") || text.includes("mail"))) return true;
  if (text.includes("could not be sent") || text.includes("couldn't be sent")) return true;
  if (text.includes("smtp") || text.includes("mailer")) return true;
  if (codeL === "unexpected_failure" && (text.includes("email") || text.includes("hook") || text.includes("mail"))) return true;
  return false;
}

export function signupFailureMessage(code: string | undefined, message: string): string {
  const codeL = (code ?? "").toLowerCase();
  const text = message.toLowerCase();
  if (
    text.includes("registered") ||
    text.includes("already exists") ||
    text.includes("already been registered") ||
    codeL === "user_already_exists" ||
    codeL === "email_exists"
  ) {
    return "An account with this email already exists.";
  }
  if (codeL === "email_address_invalid" || (text.includes("invalid") && text.includes("email"))) {
    return "Enter a valid email address.";
  }
  if (
    codeL === "weak_password" ||
    (text.includes("password") && (text.includes("weak") || text.includes("short") || text.includes("at least") || text.includes("characters")))
  ) {
    return "Use at least 10 characters, with a letter and a number.";
  }
  if (codeL === "over_request_rate_limit" || codeL === "over_email_send_rate_limit" || text.includes("rate limit")) {
    return "Too many attempts. Wait a moment and try again.";
  }
  if (isConfirmationEmailFailure(code, message)) {
    return "We couldn't send the confirmation email. Try again in a moment.";
  }
  if (text.includes("redirect")) {
    return "The sign-up link is not allowed. Try again from this site.";
  }
  return "Couldn't create your account. Please try again.";
}
