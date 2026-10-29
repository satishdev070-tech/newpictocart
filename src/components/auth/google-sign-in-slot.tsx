import { Suspense } from "react";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import { GoogleIdentityButton } from "@/components/auth/google-identity";
import { googleSignInAction } from "@/features/auth/actions";
import { googleIdentityClientId, googleSignInAvailable } from "@/features/auth/google";
import { logger } from "@/lib/observability/logger";
import { isNextControlFlowError } from "@/lib/next/control-flow";

export type GoogleSignInMode = { kind: "none" } | { kind: "redirect" } | { kind: "gis"; clientId: string };

/**
 * Resolve whether to show Google on merchant auth. Never throws for I/O failures — callers hide
 * the CTA so email/password still work. Used by the streamed slot and unit-tested fail-soft.
 */
export async function resolveGoogleSignInMode(): Promise<GoogleSignInMode> {
  try {
    const google = await googleSignInAvailable("sellers");
    if (!google) return { kind: "none" };
    const clientId = await googleIdentityClientId();
    return clientId ? { kind: "gis", clientId } : { kind: "redirect" };
  } catch (err) {
    if (isNextControlFlowError(err)) throw err;
    logger.warn("auth.google_slot_unavailable", { error: err });
    return { kind: "none" };
  }
}

/**
 * Google CTA for merchant sign-in/up. Streamed behind Suspense so the email form paints without
 * waiting on platform config + Supabase /auth/v1/settings (and optional GIS client-id lookup).
 */
async function GoogleSignInInner({
  next,
  text = "continue_with",
  label,
}: {
  next?: string;
  text?: "continue_with" | "signup_with" | "signin_with";
  label?: string;
}) {
  const mode = await resolveGoogleSignInMode();
  if (mode.kind === "none") return null;
  const button =
    mode.kind === "gis" ? (
      <GoogleIdentityButton
        clientId={mode.clientId}
        next={next}
        text={text}
        fallback={<GoogleButton action={googleSignInAction} next={next ?? ""} label={label} />}
      />
    ) : (
      <GoogleButton action={googleSignInAction} next={next ?? ""} label={label} />
    );
  return (
    <>
      {button}
      <OrDivider />
    </>
  );
}

export function GoogleSignInSlot(props: { next?: string; text?: "continue_with" | "signup_with" | "signin_with"; label?: string }) {
  return (
    <Suspense fallback={null}>
      <GoogleSignInInner {...props} />
    </Suspense>
  );
}
