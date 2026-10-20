import { describe, expect, it } from "vitest";
import { isConfirmationEmailFailure, shouldConfirmWithoutEmail, signupFailureMessage } from "@/features/auth/signup-errors";

describe("signup failure messages", () => {
  it("names the usual Auth failures", () => {
    expect(signupFailureMessage("user_already_exists", "User already registered")).toBe("An account with this email already exists.");
    expect(signupFailureMessage("email_address_invalid", "Unable to validate email address: invalid format")).toBe("Enter a valid email address.");
    expect(signupFailureMessage("weak_password", "Password should be at least 6 characters")).toBe("Use at least 10 characters, with a letter and a number.");
    expect(signupFailureMessage("over_request_rate_limit", "Request rate limit reached")).toBe("Too many attempts. Wait a moment and try again.");
    expect(signupFailureMessage(undefined, "Invalid redirect URL")).toBe("The sign-up link is not allowed. Try again from this site.");
    expect(signupFailureMessage("unexpected_failure", "database unavailable")).toBe("Couldn't create your account. Please try again.");
  });

  it("treats a missing provider or hook failure as an email delivery problem", () => {
    expect(isConfirmationEmailFailure(undefined, "Email provider is not configured")).toBe(true);
    expect(isConfirmationEmailFailure("hook_timeout", "Hook timed out")).toBe(true);
    expect(isConfirmationEmailFailure(undefined, "Error sending confirmation email")).toBe(true);
    expect(signupFailureMessage(undefined, "Error sending confirmation email")).toBe("We couldn't send the confirmation email. Try again in a moment.");
    expect(isConfirmationEmailFailure("over_email_send_rate_limit", "email rate limit exceeded")).toBe(false);
    expect(shouldConfirmWithoutEmail(false, "production", "pictocart.in")).toBe(true);
    expect(shouldConfirmWithoutEmail(true, "development", "pictocart.in")).toBe(true);
    expect(shouldConfirmWithoutEmail(true, "production", "localhost")).toBe(true);
    expect(shouldConfirmWithoutEmail(true, "production", "pictocart.in")).toBe(false);
    expect(isConfirmationEmailFailure("unexpected_failure", "something else broke")).toBe(false);
  });
});
