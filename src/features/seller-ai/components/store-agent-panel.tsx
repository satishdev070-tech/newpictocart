"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Bot, RotateCcw, Send, X } from "lucide-react";
import { askStoreAgentAction, applyFaqsProposalAction } from "@/features/seller-ai/actions";
import { AGENT_MAX_TURNS, type AgentReplyResult, type FaqProposal } from "@/features/seller-ai/schemas";
import { useToast } from "@/components/ui/toast";

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
  faqTitle: string;
  faqApply: string;
  faqApplyCost: string;
  faqDismiss: string;
  faqApplying: string;
  faqApplied: string;
  faqApplyFailed: string;
  faqNeedWrite: string;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  links?: AgentReplyResult["links"];
  proposal?: FaqProposal | null;
  applyCredits?: number;
  proposalStatus?: "open" | "applied" | "dismissed";
  error?: boolean;
};

function applyLabel(text: StoreAgentText, credits: number | undefined) {
  if (credits == null || credits < 0) return text.faqApply;
  return text.faqApplyCost.replace("{credits}", String(credits));
}

/** Chat panel (lazy chunk). History lives in this component only; the server re-reads store data each turn. */
export function StoreAgentPanel({
  text,
  open,
  onClose,
  canApplyFaqs = false,
  faqApplyCredits = 5,
}: {
  text: StoreAgentText;
  open: boolean;
  onClose: () => void;
  /** Seller must have content.write to confirm-Apply FAQ proposals. */
  canApplyFaqs?: boolean;
  /** Fallback cost shown before the server attaches applyCredits on a proposal. */
  faqApplyCredits?: number;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const [applyingIdx, setApplyingIdx] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { show } = useToast();

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending, applyingIdx]);
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
      const proposal = r.data.proposal?.type === "faq" ? r.data.proposal : null;
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: r.data.answer,
          links: r.data.links,
          proposal,
          applyCredits: r.data.applyCredits ?? faqApplyCredits,
          proposalStatus: proposal ? "open" : undefined,
        },
      ]);
    });
  };

  const dismissProposal = (index: number) => {
    setMessages((m) => m.map((msg, i) => (i === index ? { ...msg, proposalStatus: "dismissed" as const } : msg)));
  };

  const applyProposal = (index: number) => {
    const msg = messages[index];
    if (!msg?.proposal || msg.proposalStatus !== "open" || applyingIdx != null) return;
    if (!canApplyFaqs) {
      show({ tone: "warning", message: text.faqNeedWrite });
      return;
    }
    setApplyingIdx(index);
    start(async () => {
      const r = await applyFaqsProposalAction({
        groupName: msg.proposal!.groupName,
        items: msg.proposal!.items,
      });
      setApplyingIdx(null);
      if (!r.ok) {
        show({ tone: "error", message: r.error.fieldErrors?._form?.[0] ?? r.error.message ?? text.faqApplyFailed });
        return;
      }
      setMessages((m) => m.map((row, i) => (i === index ? { ...row, proposalStatus: "applied" as const } : row)));
      show({ tone: "success", message: text.faqApplied.replace("{count}", String(r.data.inserted)) });
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
              {m.proposal?.type === "faq" && m.proposalStatus === "open" ? (
                <div className="mt-3 space-y-2 rounded-lg border border-border bg-surface p-3">
                  <p className="text-caption font-semibold text-foreground">{text.faqTitle}</p>
                  <ol className="space-y-2">
                    {m.proposal.items.map((item, qi) => (
                      <li key={qi} className="text-caption">
                        <p className="font-medium text-foreground">
                          {qi + 1}. {item.question}
                        </p>
                        <p className="mt-0.5 text-muted">{item.answer}</p>
                      </li>
                    ))}
                  </ol>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      disabled={applyingIdx != null || pending}
                      onClick={() => applyProposal(i)}
                      className="rounded-md bg-[#7c3aed] px-3 py-1.5 text-caption font-semibold text-white disabled:opacity-50"
                    >
                      {applyingIdx === i ? text.faqApplying : applyLabel(text, m.applyCredits ?? faqApplyCredits)}
                    </button>
                    <button type="button" disabled={applyingIdx != null} onClick={() => dismissProposal(i)} className="rounded-md border border-border px-3 py-1.5 text-caption font-medium hover:bg-surface-secondary disabled:opacity-50">
                      {text.faqDismiss}
                    </button>
                  </div>
                </div>
              ) : null}
              {m.proposal?.type === "faq" && m.proposalStatus === "applied" ? (
                <p className="mt-2 text-caption font-medium text-success">{text.faqApplied.replace("{count}", String(m.proposal.items.length))}</p>
              ) : null}
            </div>
          ),
        )}
        {pending && applyingIdx == null ? <p className="w-fit animate-pulse rounded-xl bg-surface-secondary px-3 py-2 text-small text-muted">{text.thinking}</p> : null}
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
