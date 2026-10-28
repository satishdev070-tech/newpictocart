"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Bot, RotateCcw, Send, X } from "lucide-react";
import { askStoreAgentAction } from "@/features/seller-ai/actions";
import { AGENT_MAX_TURNS, type AgentReplyResult } from "@/features/seller-ai/schemas";

export type StoreAgentText = {
  open: string;
  title: string;
  subtitle: string;
  placeholder: string;
  send: string;
  thinking: string;
  close: string;
  clear: string;
  welcome: string;
  s1: string;
  s2: string;
  s3: string;
  cost: string;
  error: string;
};

type Message = { role: "user" | "assistant"; content: string; links?: AgentReplyResult["links"]; error?: boolean };

/** Chat panel (lazy chunk). History lives in this component only; the server re-reads store data each turn. */
export function StoreAgentPanel({ text, open, onClose }: { text: StoreAgentText; open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const ask = (question: string) => {
    const q = question.trim().slice(0, 2000);
    if (!q || pending) return;
    const history = [...messages.filter((m) => !m.error), { role: "user" as const, content: q }];
    setMessages((m) => [...m, { role: "user", content: q }]);
    setDraft("");
    start(async () => {
      const r = await askStoreAgentAction({ messages: history.slice(-AGENT_MAX_TURNS * 2).map(({ role, content }) => ({ role, content: content.slice(0, 2000) })) });
      if (!r.ok) {
        setMessages((m) => [...m, { role: "assistant", content: r.error.fieldErrors?._form?.[0] ?? r.error.message ?? text.error, error: true }]);
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: r.data.answer, links: r.data.links }]);
    });
  };

  if (!open) return null;
  return (
    <div role="dialog" aria-modal="false" aria-label={text.title} className="fixed inset-x-2 bottom-2 z-50 flex max-h-[min(85dvh,calc(100dvh-1rem))] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[min(32rem,calc(100vw-1rem))]">
      <header className="flex items-center gap-3 bg-gradient-to-br from-[#7c3aed] to-[#c026d3] px-4 py-3 text-white">
        <Bot aria-hidden className="size-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-small font-semibold">{text.title}</p>
          <p className="truncate text-caption text-white/80">{text.subtitle}</p>
        </div>
        {messages.length ? (
          <button type="button" onClick={() => setMessages([])} className="grid size-8 place-items-center rounded-lg hover:bg-white/15" aria-label={text.clear} title={text.clear}>
            <RotateCcw aria-hidden className="size-4" />
          </button>
        ) : null}
        <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-lg hover:bg-white/15" aria-label={text.close}>
          <X aria-hidden className="size-4" />
        </button>
      </header>
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
        <p className="rounded-xl bg-surface-secondary px-3 py-2 text-small">{text.welcome}</p>
        {!messages.length ? (
          <div className="flex flex-wrap gap-2">
            {[text.s1, text.s2, text.s3].map((s) => (
              <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-[#7c3aed]/30 px-3 py-1 text-caption text-[#7c3aed] hover:bg-[#7c3aed]/10 dark:text-[#c4b5fd]">
                {s}
              </button>
            ))}
          </div>
        ) : null}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <p key={i} className="ml-auto w-fit max-w-[85%] rounded-xl bg-[#7c3aed] px-3 py-2 text-small whitespace-pre-wrap text-white">
              {m.content}
            </p>
          ) : (
            <div key={i} className={`max-w-[92%] rounded-xl px-3 py-2 text-small ${m.error ? "border border-error/25 bg-error/10 text-error" : "bg-surface-secondary"}`}>
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.links?.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.links.map((l) => (
                    <Link key={l.key} href={l.href} onClick={onClose} className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-caption font-medium hover:border-accent hover:text-accent">
                      {l.label} <ArrowRight aria-hidden className="size-3" />
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ),
        )}
        {pending ? <p className="w-fit animate-pulse rounded-xl bg-surface-secondary px-3 py-2 text-small text-muted">{text.thinking}</p> : null}
      </div>
      <form
        className="border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            maxLength={2000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(draft);
              }
            }}
            placeholder={text.placeholder}
            aria-label={text.placeholder}
            className="max-h-28 min-h-10 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-small focus:border-accent focus:outline-none"
          />
          <button type="submit" disabled={pending || !draft.trim()} className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#7c3aed] text-white disabled:opacity-50" aria-label={text.send}>
            <Send aria-hidden className="size-4" />
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-subtle">{text.cost}</p>
      </form>
    </div>
  );
}
