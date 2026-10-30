"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

type ThemeErrorProps = {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
};

/** Theme-editor segment boundary — keeps the live storefront untouched when the builder crashes. */
export default function ThemeEditorError({ error, retry, reset }: ThemeErrorProps) {
  const router = useRouter();

  useEffect(() => {
    const message = error instanceof Error ? error.message : String(error);
    const digest = error && typeof error === "object" && "digest" in error ? String((error as { digest?: unknown }).digest ?? "") : "";
    console.error(JSON.stringify({ level: "error", msg: "dashboard.theme.route_error", digest: digest || null, message, time: new Date().toISOString() }));
  }, [error]);

  const recover = () => {
    if (typeof retry === "function") retry();
    else if (typeof reset === "function") reset();
    else {
      router.push("/dashboard/theme");
      router.refresh();
    }
  };

  const digest = error && typeof error === "object" && "digest" in error ? (error as { digest?: string }).digest : undefined;

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <ErrorState
        title="Theme editor couldn't load — live store unchanged"
        description={digest ? `Reference: ${digest}` : "Please try again in a moment."}
        action={
          <Button variant="secondary" onClick={recover}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
