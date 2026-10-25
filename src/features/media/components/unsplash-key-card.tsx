"use client";

import { useActionState } from "react";
import { CheckCircle2, ExternalLink, KeyRound } from "lucide-react";
import type { ActionResult } from "@/lib/actions/result";
import { Badge, Card } from "@/components/ui/layout";
import { FormMessage, SubmitButton, fieldErrors } from "@/components/ui/form";
import { PasswordField } from "@/components/ui/password-field";
import { InlineAction } from "@/features/settings/ui/action-controls";
import { clearUnsplashKeyAction, saveUnsplashKeyAction, testUnsplashKeyAction } from "../unsplash-key-actions";

export type UnsplashKeyStatus = { configured: boolean; source: "db" | "env" | null; secretHint: string | null; savedInDb: boolean };

type Msg = ActionResult<{ message: string }> | null;

function Result({ state }: { state: Msg }) {
  if (!state) return null;
  return state.ok ? (
    <p role="status" className="rounded-md border border-success/25 bg-success/10 px-3 py-2 text-small text-success">
      {state.data.message}
    </p>
  ) : (
    <FormMessage state={state} />
  );
}

function TestButton() {
  const [state, action] = useActionState(testUnsplashKeyAction, null as Msg);
  return (
    <form action={action} className="space-y-2">
      <SubmitButton variant="secondary" size="sm">
        Test connection
      </SubmitButton>
      <Result state={state} />
    </form>
  );
}

const GUIDELINES = [
  "Photos are hotlinked from images.unsplash.com (never re-hosted for display).",
  "Every photo shows its credit: “Photo by [photographer] on Unsplash”, both linked with utm_source=pictocart&utm_medium=referral.",
  "Using or importing a photo calls its download_location endpoint, as Unsplash requires.",
  "The key stays on the server; browsers only see image URLs. Searches are cached and rate limited.",
  "We use Unsplash for store and marketing imagery, not to rebuild an Unsplash-like photo site.",
];

/** Admin → Media library: the platform's Unsplash Access Key (write-only) with a live test. */
export function UnsplashKeyCard({ status }: { status: UnsplashKeyStatus }) {
  const [state, action] = useActionState(saveUnsplashKeyAction, null as Msg);
  const e = fieldErrors(state);
  return (
    <Card
      title={
        <span className="inline-flex items-center gap-2">
          <KeyRound className="size-4 text-muted" aria-hidden /> Unsplash API key
        </span>
      }
      description="Lets the media library search all of Unsplash and gives themes and category cards fresh photos. Without a key, the built-in photos are used."
      actions={
        status.configured ? (
          <Badge tone="success">{status.source === "env" ? "Set by UNSPLASH_ACCESS_KEY" : `Saved ${status.secretHint ?? ""}`}</Badge>
        ) : (
          <Badge tone="warning">Not set</Badge>
        )
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,22rem)]">
        <div className="space-y-4">
          <form action={action} className="space-y-3">
            <Result state={state} />
            <PasswordField
              label={status.savedInDb ? "Replace Access Key" : "Access Key"}
              name="accessKey"
              autoComplete="off"
              required
              errors={e.accessKey}
              hint="From your app at unsplash.com/oauth/applications. Use the Access Key, never the Secret key. It is tested before it is saved, then stored encrypted and never shown again."
            />
            <SubmitButton size="sm">Save &amp; test key</SubmitButton>
          </form>
          {status.configured ? (
            <div className="flex flex-wrap items-start gap-3 border-t border-border pt-4">
              <TestButton />
              {status.savedInDb ? <InlineAction action={clearUnsplashKeyAction} label="Remove saved key" variant="ghost" success={status.source === "env" ? "Removed. UNSPLASH_ACCESS_KEY is used again." : "Removed. Built-in photos are used."} /> : null}
            </div>
          ) : null}
          <p className="text-caption text-muted">
            New Unsplash apps start in demo mode (50 requests an hour). Before going live, apply for production in your Unsplash app (5,000 requests an hour); Unsplash reviews that the guidelines on the right are followed.{" "}
            <a href="https://unsplash.com/oauth/applications" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              Your Unsplash apps <ExternalLink className="size-3" aria-hidden />
            </a>
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface-secondary/50 p-4">
          <p className="text-small font-medium">How Pictocart follows the Unsplash API guidelines</p>
          <ul className="mt-2 space-y-2 text-caption text-muted">
            {GUIDELINES.map((g) => (
              <li key={g} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                <span>{g}</span>
              </li>
            ))}
          </ul>
          <a href="https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-caption text-primary hover:underline">
            Read the Unsplash API guidelines <ExternalLink className="size-3" aria-hidden />
          </a>
        </div>
      </div>
    </Card>
  );
}
