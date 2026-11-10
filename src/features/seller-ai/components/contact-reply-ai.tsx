"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { generateContactReplyAction } from "@/features/seller-ai/actions";

export function ContactReplyAi({
  messageId,
  name,
  email,
  subject,
  message,
}: {
  messageId: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
}) {
  const [draft, setDraft] = useState<{ subject: string; reply: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const run = () => {
    setError(null);
    setCopied(false);
    start(async () => {
      const r = await generateContactReplyAction({ messageId, name, email, subject: subject ?? "", message });
      if (!r.ok) {
        setError(r.error.fieldErrors?._form?.[0] ?? r.error.message);
        setDraft(null);
        return;
      }
      setDraft({ subject: r.data.subject, reply: r.data.reply });
    });
  };

  const copy = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.reply}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="secondary" pending={pending} onClick={run}>
          {pending ? "Drafting…" : "Draft AI reply"}
        </Button>
        {draft ? (
          <a href={`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.reply)}`} className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm hover:bg-background">
            Open in email
          </a>
        ) : null}
        {draft ? (
          <Button type="button" size="sm" variant="ghost" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}
      {draft ? (
        <div className="rounded-md border border-border bg-background p-3 text-sm">
          <p className="font-medium">{draft.subject}</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-muted">{draft.reply}</p>
        </div>
      ) : null}
    </div>
  );
}
