"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Send, Sparkles, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { formatServicePrice } from "../pricing";
import { applyInformativeProposalAction, askInformativeAssistantAction, buildInformativeSiteWithAiAction } from "./actions";
import { ASSISTANT_MAX_TURNS, proposalTitle, proposalWrites, type Proposal } from "./schemas";

type Message = { role: "user" | "assistant"; content: string; proposals?: { proposal: Proposal; status: "open" | "applied" | "dismissed" }[]; error?: boolean };

const SUGGESTIONS = [
  "Write my About page",
  "Suggest 4 more services with prices",
  "Create FAQs my customers ask",
  "Improve my Google title and description",
];

const errorText = (r: { error: { message?: string; fieldErrors?: Record<string, string[]> } }) => r.error.fieldErrors?._form?.[0] ?? r.error.message ?? "Something went wrong. Try again.";

/** A short, readable preview of what Apply will write. */
function ProposalPreview({ proposal }: { proposal: Proposal }) {
  const w = proposalWrites(proposal);
  if (w.site)
    return (
      <div className="space-y-2">
        {w.site.tagline ? <p className="font-medium">“{w.site.tagline}”</p> : null}
        {w.site.about ? <p className="whitespace-pre-line text-muted">{w.site.about}</p> : null}
      </div>
    );
  if (w.seo)
    return (
      <div className="space-y-1">
        <p className="font-medium">{w.seo.title}</p>
        <p className="text-muted">{w.seo.description}</p>
      </div>
    );
  if (w.services)
    return (
      <ul className="space-y-2">
        {w.services.map((s, i) => (
          <li key={i}>
            <span className="font-medium">{s.name}</span>
            <span className="text-muted"> · {formatServicePrice(s.priceType, s.pricePaise) ?? "Price hidden"}</span>
            {s.shortDescription ? <p className="text-muted">{s.shortDescription}</p> : null}
          </li>
        ))}
      </ul>
    );
  if (w.faqs)
    return (
      <ul className="space-y-2">
        {w.faqs.map((f, i) => (
          <li key={i}>
            <p className="font-medium">{f.question}</p>
            <p className="text-muted">{f.answer}</p>
          </li>
        ))}
      </ul>
    );
  return null;
}

/**
 * Informative panel "AI assistant" (M9): a side panel where the owner asks for content. Answers come
 * with proposals; nothing changes until they press Apply (each Apply is one validated write).
 * "Rebuild my whole website" rewrites the site directly after a confirmation.
 */
export function InformativeAssistant({ canWrite }: { canWrite: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const router = useRouter();
  const { show } = useToast();

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!canWrite) return null;

  const ask = (text: string) => {
    const q = text.trim().slice(0, 2000);
    if (!q || pending) return;
    const history = [...messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content })), { role: "user" as const, content: q }].slice(-ASSISTANT_MAX_TURNS);
    setMessages((m) => [...m, { role: "user", content: q }]);
    setDraft("");
    start(async () => {
      // The conversation sent must start with the owner's message.
      const firstUser = history.findIndex((m) => m.role === "user");
      const r = await askInformativeAssistantAction({ messages: history.slice(firstUser) });
      if (!r.ok) {
        setMessages((m) => [...m, { role: "assistant", content: errorText(r), error: true }]);
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: r.data.reply, proposals: r.data.proposals.map((proposal) => ({ proposal, status: "open" as const })) }]);
    });
  };

  const setStatus = (mi: number, pi: number, status: "applied" | "dismissed") =>
    setMessages((m) => m.map((msg, i) => (i === mi ? { ...msg, proposals: msg.proposals?.map((p, j) => (j === pi ? { ...p, status } : p)) } : msg)));

  const apply = (mi: number, pi: number) => {
    const item = messages[mi]?.proposals?.[pi];
    if (!item || item.status !== "open" || busy) return;
    setBusy(`${mi}:${pi}`);
    void (async () => {
      const r = await applyInformativeProposalAction({ proposal: item.proposal });
      setBusy(null);
      if (!r.ok) return show({ tone: "error", message: errorText(r) });
      setStatus(mi, pi, "applied");
      show({ tone: "success", message: "Added to your website." });
      router.refresh();
    })();
  };

  const rebuild = () => {
    if (busy || !window.confirm("Rewrite your tagline, About text, service descriptions, FAQs and search engine text with AI? Your prices, photos and contact details stay as they are.")) return;
    setBusy("rebuild");
    void (async () => {
      const r = await buildInformativeSiteWithAiAction({ onboarding: false });
      setBusy(null);
      if (!r.ok) return show({ tone: "error", message: errorText(r) });
      show({ tone: r.data.built ? "success" : "warning", message: r.data.built ? "Your website was rewritten. Preview it before you publish." : "AI isn't available right now. Nothing was changed." });
      router.refresh();
    })();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-4 text-small font-semibold text-white shadow-lg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Sparkles aria-hidden className="size-4" /> AI assistant
      </button>
      {open ? (
        <div role="dialog" aria-modal="false" aria-labelledby={titleId} className="fixed inset-x-2 bottom-2 z-50 flex max-h-[85dvh] flex-col overflow-hidden rounded-xl border border-border bg-surface text-foreground shadow-2xl sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[420px]">
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 id={titleId} className="text-base font-semibold">Website assistant</h2>
              <p className="text-caption text-muted">Ask for content. Nothing changes until you press Apply. Each question uses AI credits.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="grid size-9 shrink-0 place-items-center rounded-lg hover:bg-surface-secondary" aria-label="Close assistant">
              <X aria-hidden className="size-4" />
            </button>
          </div>
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-small" aria-live="polite">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-muted">I can write your About page, suggest services with prices, create FAQs and improve how you appear on Google.</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => ask(s)} className="min-h-9 rounded-full border border-border px-3 text-caption hover:bg-surface-secondary">
                      {s}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={rebuild} disabled={busy !== null} className="w-full rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-left text-caption font-medium text-accent disabled:opacity-60">
                  {busy === "rebuild" ? "Rewriting your website…" : "Rebuild my whole website with AI"}
                </button>
              </div>
            ) : null}
            {messages.map((m, mi) => (
              <div key={mi} className={m.role === "user" ? "ml-8 rounded-lg bg-accent-soft px-3 py-2" : "mr-4 space-y-2"}>
                <p className={`whitespace-pre-line ${m.error ? "text-error" : ""}`}>{m.content}</p>
                {m.proposals?.map((p, pi) => (
                  <div key={pi} className="rounded-lg border border-border p-3">
                    <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-subtle">{proposalTitle(p.proposal)}</p>
                    <ProposalPreview proposal={p.proposal} />
                    <div className="mt-3 flex items-center gap-2">
                      {p.status === "open" ? (
                        <>
                          <button type="button" onClick={() => apply(mi, pi)} disabled={busy !== null} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-accent px-3 text-caption font-semibold text-white disabled:opacity-60">
                            <Check aria-hidden className="size-3.5" /> {busy === `${mi}:${pi}` ? "Applying…" : "Apply"}
                          </button>
                          <button type="button" onClick={() => setStatus(mi, pi, "dismissed")} className="min-h-9 rounded-lg px-3 text-caption hover:bg-surface-secondary">
                            Dismiss
                          </button>
                        </>
                      ) : (
                        <p className="text-caption text-muted">{p.status === "applied" ? "Applied" : "Dismissed"}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {pending ? <p className="text-muted">Thinking…</p> : null}
          </div>
          <form
            className="flex items-end gap-2 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              ask(draft);
            }}
          >
            <label htmlFor={`${titleId}-input`} className="sr-only">Message the website assistant</label>
            <textarea
              id={`${titleId}-input`}
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(draft);
                }
              }}
              rows={2}
              maxLength={2000}
              placeholder="e.g. Add services for home visits"
              className="min-h-11 flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-small"
            />
            <button type="submit" disabled={pending || !draft.trim()} className="grid size-11 place-items-center rounded-lg bg-accent text-white disabled:opacity-50" aria-label="Send">
              <Send aria-hidden className="size-4" />
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
