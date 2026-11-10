"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { routeErrorDescription, type RouteErrorProps } from "@/components/app-shell/route-error";

/** Root error boundary. Shows a safe message only; details stay in server logs (keyed by digest). */
export default function RootError({ error, retry, reset }: RouteErrorProps) {
  const recover = () => {
    if (typeof retry === "function") retry();
    else if (typeof reset === "function") reset();
  };
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 items-center px-4 py-16">
      <ErrorState
        description={routeErrorDescription(error)}
        action={
          <Button variant="secondary" onClick={recover}>
            Try again
          </Button>
        }
      />
    </main>
  );
}
