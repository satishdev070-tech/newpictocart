"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

type AuthErrorProps = {
  error: Error & { digest?: string };
  /** Next.js 16 App Router recovery (preferred). */
  retry?: () => void;
  /** Older / dual prop name — same recovery when `retry` is absent. */
  reset?: () => void;
};

/** Auth-route error boundary. Same safe UI as the root; logs digest for seller/admin sign-in diagnosis. */
export default function AuthError({ error, retry, reset }: AuthErrorProps) {
  useEffect(() => {
    const message = error instanceof Error ? error.message : String(error);
    const digest = error && typeof error === "object" && "digest" in error ? String((error as { digest?: unknown }).digest ?? "") : "";
    console.error(JSON.stringify({ level: "error", msg: "auth.route_error", digest: digest || null, message, time: new Date().toISOString() }));
  }, [error]);

  const recover = () => {
    if (typeof retry === "function") retry();
    else if (typeof reset === "function") reset();
    else window.location.assign(window.location.pathname + window.location.search);
  };

  const digest = error && typeof error === "object" && "digest" in error ? (error as { digest?: string }).digest : undefined;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 items-center px-4 py-16">
      <ErrorState
        description={digest ? `Reference: ${digest}` : "Please try again in a moment."}
        action={
          <Button variant="secondary" onClick={recover}>
            Try again
          </Button>
        }
      />
    </main>
  );
}
