"use client";

import { useState, useTransition } from "react";
import { PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextAreaField, TextField } from "@/components/ui/field";
import { draftContactReplyAction } from "../actions";

/** Per contact-message draft reply (not sent). Seller copies into their email client. */
export function ContactReplyDraft({ messageId }: { messageId: string }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [reply, setReply] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const draft = () =>
    start(async () => {
      setNote(null);
      const r = await draftContactReplyAction({ messageId });
      if (!r.ok) {
        setNote(r.error.fieldErrors?._form?.[0] ?? r.error.message);
        return;
      }
      setSubject(r.data.subject);
      setReply(r.data.reply);
      setOpen(true);
      setNote("Draft ready — copy and send from your email.");
    });

  const copy = async () => {
    const text = subject ? `Subject: ${subject}\n\n${reply}` : reply;
    try {
      await navigator.clipboard.writeText(text);
      setNote("Copied.");
    } catch {
      setNote("Select the text and copy manually.");
    }
  };

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" pending={pending} onClick={draft}>
          <PenLine aria-hidden className="size-3.5" />
          Draft reply
        </Button>
        {open ? (
          <Button type="button" variant="ghost" size="sm" onClick={copy} disabled={!reply.trim()}>
            Copy
          </Button>
        ) : null}
      </div>
      {note ? (
        <p role="status" className="text-small text-muted">
          {note}
        </p>
      ) : null}
      {open ? (
        <div className="space-y-2">
          <TextField label="Subject" name={`reply-subject-${messageId}`} value={subject} onChange={(e) => setSubject(e.target.value)} />
          <TextAreaField label="Reply" name={`reply-body-${messageId}`} rows={6} value={reply} onChange={(e) => setReply(e.target.value)} />
        </div>
      ) : null}
    </div>
  );
}
