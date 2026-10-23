"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

/** Auth-route error boundary. Same safe UI as the root; logs digest for seller/admin sign-in diagnosis. */
export default function AuthError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(JSON.stringify({ level: "error", msg: "auth.route_error", digest: error.digest, message: error.message, time: new Date().toISOString() }));
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 items-center px-4 py-16">
      <ErrorState
        description={error.digest ? `Reference: ${error.digest}` : "Please try again in a moment."}
        action={
          <Button variant="secondary" onClick={() => retry()}>
            Try again
          </Button>
        }
      />
    </main>
  );
}
