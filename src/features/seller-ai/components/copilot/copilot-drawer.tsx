"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Copy, Loader2, Mic, RotateCcw, Send, Sparkles, Square, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { COPILOT_LANGUAGES, COPILOT_LANGUAGE_NAMES, isCopilotLanguage, type CopilotLanguage } from "@/features/seller-ai/copilot/languages";
import { QUICK_ACTIONS, quickAction, quickActionMessage, type CopilotIntent } from "@/features/seller-ai/copilot/quick-actions";
import { copilotCopy, fill, type CopilotCopy } from "@/features/seller-ai/copilot/copy";
import { historyFor } from "@/features/seller-ai/copilot/history";
import type { CopilotAdapter, CopilotCosts, CopilotLink, CopilotProposalView } from "@/features/seller-ai/copilot/types";
import { isPlanConfirmation, planCredits } from "@/features/seller-ai/copilot/actions-plan";
import { MarkdownLite } from "./markdown-lite";
import { useCopilotMic } from "./use-copilot-mic";
import { cancelSpeech, speak as speakInBrowser } from "@/lib/speech/browser-speech";

type ProposalState = {
  view: CopilotProposalView;
  status: "open" | "running" | "applied" | "failed" | "discarded";
  /** Server's message for a finished step (what changed, or why it failed). */
  result?: string;
  href?: string;
};
type Message = {
  role: "user" | "assistant";
  content: string;
  intent?: CopilotIntent | null;
  links?: CopilotLink[];
  proposals?: ProposalState[];
  error?: boolean;
};

/**
 * Chat history lives in this tab's sessionStorage, keyed by panel + store + signed-in member, so
 * switching store, "Log in as store", or another person signing in never shows someone else's chat.
 * (The server never trusts this history for access: every question re-reads the member's store.)
 */
export const storageKey = (site: string, scope: string) => `pc-copilot:${site}:${scope}`;

/** Removes the old shared keys (`pc-copilot:store`) left by earlier versions. */
function dropLegacyHistory(site: string) {
  try {
    window.sessionStorage.removeItem(`pc-copilot:${site}`);
  } catch {
    /* storage blocked */
  }
}

function readSession(site: string, scope: string): Message[] {
  try {
    dropLegacyHistory(site);
    const raw = window.sessionStorage.getItem(storageKey(site, scope));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as Message[]).filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-40) : [];
  } catch {
    return [];
  }
}
function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

const joinSpoken = (base: string, spoken: string) => (base.trim() ? `${base.trim()} ${spoken}`.trim() : spoken);

const errorText = (r: { error: { message?: string; fieldErrors?: Record<string, string[]> } }, fallback: string) => r.error.fieldErrors?._form?.[0] ?? r.error.message ?? fallback;

function FieldDiff({ field, copy }: { field: CopilotProposalView["fields"][number]; copy: CopilotCopy }) {
  return (
    <div className="space-y-1.5">
      <p className="text-caption font-semibold text-foreground">{field.label}</p>
      {field.before !== null ? (
        <div className="rounded-md border border-error/20 bg-error/5 px-2.5 py-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-error/80">{copy.current}</p>
          <p className="line-clamp-4 whitespace-pre-line text-caption text-muted line-through decoration-error/40">{field.before || copy.empty}</p>
        </div>
      ) : null}
      <div className="rounded-md border border-success/25 bg-success/5 px-2.5 py-1.5">
        {field.before !== null ? <p className="text-[11px] font-semibold uppercase tracking-wide text-success">{copy.proposed}</p> : null}
        <p className="whitespace-pre-line text-caption text-foreground">{field.after}</p>
      </div>
    </div>
  );
}

/** "Tara's plan · N steps" + Do it (total credits) for the open steps; hidden once all ran. */
function PlanHeader({ count, open, busy, running, onRun, copy }: { count: number; open: ProposalState[]; busy: boolean; running: boolean; onRun: () => void; copy: CopilotCopy }) {
  if (!open.length && !running) return null;
  const credits = planCredits(open.map((p) => p.view));
  return (
    <div className="space-y-2 rounded-xl border border-accent/30 bg-accent-soft/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-caption font-semibold text-foreground">{fill(copy.planTitle, { count })}</p>
        <button
          type="button"
          onClick={onRun}
          disabled={busy || !open.length}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-caption font-semibold text-white disabled:opacity-60"
        >
          {running ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Check aria-hidden className="size-3.5" />}
          {running ? copy.running : credits > 0 ? fill(copy.doItCost, { credits }) : copy.doIt}
        </button>
      </div>
      {open.length && !running ? <p className="text-[11px] text-muted">{copy.sayYes}</p> : null}
    </div>
  );
}

/**
 * Shared "Ask Pictocart AI" drawer for both seller panels. Panel-specific server actions arrive
 * through `adapter`; this component only renders and never decides tenant or permission.
 * Desktop: right-side drawer. Mobile: full-screen sheet.
 */
export function CopilotDrawer({
  adapter,
  open,
  onClose,
  panelLanguage,
  footerExtra,
  scope,
}: {
  /** `<storeId>:<memberId>`: whose chat this is (history key). */
  scope: string;
  adapter: CopilotAdapter;
  open: boolean;
  onClose: () => void;
  /** Seller panel language; default reply language until the seller picks one. */
  panelLanguage?: string | null;
  /** Extra action shown under the quick actions on an empty chat (e.g. informative rebuild). */
  footerExtra?: (copy: CopilotCopy) => React.ReactNode;
}) {
  const site = adapter.siteType;
  const copy = copilotCopy(panelLanguage);
  const [messages, setMessages] = useState<Message[]>(() => (typeof window === "undefined" ? [] : readSession(site, scope)));
  const [draft, setDraft] = useState("");
  const [intent, setIntent] = useState<CopilotIntent | null>(null);
  const [pending, setPending] = useState(false);
  const [busyProposal, setBusyProposal] = useState<string | null>(null);
  const [costs, setCosts] = useState<CopilotCosts | null>(null);
  const [language, setLanguage] = useState<CopilotLanguage>(() => {
    const saved = typeof window === "undefined" ? null : readLocal("pc-copilot-lang");
    if (isCopilotLanguage(saved)) return saved;
    const base = panelLanguage?.toLowerCase().split(/[-_]/)[0];
    return isCopilotLanguage(base) ? base : "en";
  });
  // Tara speaks her replies by default (female voice); muting is remembered.
  const [speak, setSpeak] = useState(() => typeof window !== "undefined" && readLocal("pc-copilot-speak") !== "0");
  const [transcribing, setTranscribing] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const titleId = useId();
  const { show } = useToast();

  // Persist per tab.
  useEffect(() => {
    try {
      window.sessionStorage.setItem(storageKey(site, scope), JSON.stringify(messages.slice(-40)));
    } catch {
      /* quota / private mode */
    }
  }, [messages, scope, site]);

  const loadCosts = useCallback(() => {
    void adapter.costs().then((r) => r.ok && setCosts(r.data));
  }, [adapter]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    loadCosts();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, loadCosts]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      cancelSpeech();
    },
    [],
  );

  const playReply = useCallback(
    async (text: string) => {
      audioRef.current?.pause();
      cancelSpeech();
      const r = await adapter.speak({ text: text.slice(0, 2400), language });
      if (!r.ok || !r.data) {
        // Sarvam unavailable (no credits / outage / limit): the browser's own female voice.
        void speakInBrowser(text.replace(/\*\*|`|^#+\s*/gm, "").replace(/^\s*[-*]\s+/gm, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1"), `${language}-IN`);
        return;
      }
      const audio = new Audio(`data:${r.data.mimeType};base64,${r.data.audioBase64}`);
      audioRef.current = audio;
      void audio.play().catch(() => undefined);
    },
    [adapter, language],
  );

  const send = useCallback(
    (question: string, withIntent: CopilotIntent | null, base: Message[] = messages) => {
      const q = question.trim().slice(0, 2000);
      if (!q || pending) return;
      const history = historyFor(base, q);
      setMessages([...base, { role: "user", content: q, intent: withIntent }]);
      setDraft("");
      setIntent(null);
      setPending(true);
      void (async () => {
        const r = await adapter.ask({ messages: history, language, intent: withIntent });
        setPending(false);
        if (!r.ok) {
          setMessages((m) => [...m, { role: "assistant", content: errorText(r, copy.errorGeneric), error: true }]);
          return;
        }
        setMessages((m) => [
          ...m,
          { role: "assistant", content: r.data.answer, links: r.data.links, proposals: r.data.proposals.map((view) => ({ view, status: "open" as const })) },
        ]);
        loadCosts();
        if (speak) void playReply(r.data.answer);
      })();
    },
    [adapter, copy.errorGeneric, language, loadCosts, messages, pending, playReply, speak],
  );

  const submit = () => {
    const planAt = intent ? -1 : openPlanIndex();
    if (planAt >= 0 && isPlanConfirmation(draft)) {
      // "yes / haan / kar do": run the plan shown above; no extra AI question (no credits for asking).
      setMessages((m) => [...m, { role: "user", content: draft.trim() }]);
      setDraft("");
      runPlan(planAt);
      return;
    }
    if (intent) {
      const msg = quickActionMessage(site, intent, draft);
      if (msg) send(msg, intent);
      return;
    }
    send(draft, null);
  };

  const retry = (index: number) => {
    // Drop the error turn and re-ask the seller's question before it.
    const userIdx = index - 1;
    const user = messages[userIdx];
    if (!user || user.role !== "user") return;
    send(user.content, user.intent ?? null, messages.slice(0, userIdx));
  };

  const chooseQuick = (id: CopilotIntent) => {
    const action = quickAction(site, id);
    if (!action) return;
    if (!action.subject) {
      const msg = quickActionMessage(site, id);
      if (msg) send(msg, id);
      return;
    }
    setIntent(id);
    setDraft("");
    inputRef.current?.focus();
  };

  const setProposal = (mi: number, pid: string, patch: Partial<ProposalState>) =>
    setMessages((m) => m.map((msg, i) => (i === mi ? { ...msg, proposals: msg.proposals?.map((p) => (p.view.id === pid ? { ...p, ...patch } : p)) } : msg)));
  const setProposalStatus = (mi: number, pid: string, status: ProposalState["status"]) => setProposal(mi, pid, { status });

  /** Runs one step on the server (it re-checks permission and charges the step's credits). */
  const runStep = async (mi: number, p: ProposalState): Promise<{ ok: boolean; text: string }> => {
    setProposal(mi, p.view.id, { status: "running" });
    const r = await adapter.apply(p.view.payload);
    if (!r.ok) {
      const text = errorText(r, copy.errorGeneric);
      setProposal(mi, p.view.id, { status: "failed", result: text });
      return { ok: false, text: `${p.view.title}: ${text}` };
    }
    setProposal(mi, p.view.id, { status: "applied", result: r.data.message, href: r.data.href });
    return { ok: true, text: r.data.message };
  };

  const apply = (mi: number, p: ProposalState) => {
    if (busyProposal || p.status !== "open") return;
    setBusyProposal(`${mi}:${p.view.id}`);
    void (async () => {
      const r = await runStep(mi, p);
      setBusyProposal(null);
      show({ tone: r.ok ? "success" : "error", message: r.text });
      loadCosts();
    })();
  };

  /** "Do it" (or a spoken/typed "yes"): every open step of that reply, in order, then a spoken summary. */
  const runPlan = (mi: number) => {
    const steps = (messages[mi]?.proposals ?? []).filter((p) => p.status === "open");
    if (busyProposal || pending || !steps.length) return;
    setBusyProposal(`${mi}:plan`);
    void (async () => {
      const done: string[] = [];
      const failed: string[] = [];
      for (const p of steps) {
        const r = await runStep(mi, p);
        (r.ok ? done : failed).push(r.text);
      }
      setBusyProposal(null);
      loadCosts();
      const summary = [failed.length ? "" : copy.planDone, ...done, ...(failed.length ? [copy.planPartly, ...failed] : [])].filter(Boolean).join("\n");
      setMessages((m) => [...m, { role: "assistant", content: summary, error: failed.length > 0 && !done.length }]);
      if (speak) void playReply(summary);
    })();
  };

  /** Index of the latest reply whose plan still has open steps (a "yes" runs it). */
  const openPlanIndex = (): number => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]!;
      if (m.role === "user") return -1; // the seller already moved on
      if (m.proposals?.some((p) => p.status === "open")) return i;
    }
    return -1;
  };

  const onAudio = useCallback(
    (audio: Blob) => {
      const fd = new FormData();
      fd.set("audio", audio, `copilot.${audio.type.includes("mp4") ? "mp4" : audio.type.includes("ogg") ? "ogg" : "webm"}`);
      fd.set("language", language);
      setTranscribing(true);
      void adapter.transcribe(fd).then((r) => {
        setTranscribing(false);
        if (!r.ok) return show({ tone: "error", message: errorText(r, copy.errorGeneric) });
        setDraft((d) => (d.trim() ? `${d.trim()} ${r.data.transcript}` : r.data.transcript));
        inputRef.current?.focus();
      });
    },
    [adapter, copy.errorGeneric, language, show],
  );
  const onVoiceError = useCallback(
    (reason: "unsupported" | "denied" | "network" | "no-speech") => {
      if (reason === "no-speech") return; // nothing heard: just let them try again
      show({ tone: "warning", message: reason === "unsupported" ? copy.micUnsupported : reason === "denied" ? copy.micDenied : copy.errorGeneric });
    },
    [copy, show],
  );
  // What was typed before the mic started; live words are shown after it and replaced as they change.
  const spokenBase = useRef("");
  const onSpokenInterim = useCallback((t: string) => setDraft(joinSpoken(spokenBase.current, t)), []);
  const onSpokenText = useCallback((t: string) => {
    setDraft(joinSpoken(spokenBase.current, t));
    inputRef.current?.focus();
  }, []);
  // Browser speech recognition first (free, no upload, listens until Stop); Sarvam recording only as a fallback.
  const voice = useCopilotMic({ lang: `${language}-IN`, onText: onSpokenText, onInterim: onSpokenInterim, onAudio, onError: onVoiceError });
  const toggleMic = () => {
    if (voice.recording) return voice.stop();
    spokenBase.current = draft;
    void voice.start();
  };

  const copyAnswer = (i: number, text: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx((c) => (c === i ? null : c)), 1500);
    });
  };

  if (!open) return null;

  const activeQuick = intent ? quickAction(site, intent) : undefined;
  const costLine = costs?.ask != null ? fill(copy.costAsk, { credits: costs.ask }) : copy.costUnknown;
  const quickActions = QUICK_ACTIONS[site];

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex flex-col bg-surface text-foreground shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[min(440px,100vw)] sm:border-l sm:border-border"
    >
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent ring-1 ring-inset ring-accent/20">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-small font-semibold">
            {copy.title}
          </h2>
          <p className="truncate text-caption text-muted">{site === "store" ? copy.subtitleStore : copy.subtitleInformative}</p>
        </div>
        <label className="sr-only" htmlFor={`${titleId}-lang`}>
          {copy.language}
        </label>
        <select
          id={`${titleId}-lang`}
          value={language}
          onChange={(e) => {
            const v = e.target.value;
            if (!isCopilotLanguage(v)) return;
            setLanguage(v);
            writeLocal("pc-copilot-lang", v);
          }}
          title={copy.language}
          className="h-8 max-w-[7.5rem] rounded-lg border border-border bg-surface px-1.5 text-caption"
        >
          {COPILOT_LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {COPILOT_LANGUAGE_NAMES[l].native}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            setSpeak((s) => {
              writeLocal("pc-copilot-speak", s ? "0" : "1");
              if (s) audioRef.current?.pause();
              return !s;
            });
          }}
          aria-pressed={speak}
          className="grid size-8 place-items-center rounded-lg hover:bg-surface-secondary"
          aria-label={speak ? copy.speakOn : copy.speakOff}
          title={speak ? copy.speakOn : copy.speakOff}
        >
          {speak ? <Volume2 aria-hidden className="size-4" /> : <VolumeX aria-hidden className="size-4" />}
        </button>
        {messages.length ? (
          <button
            type="button"
            onClick={() => {
              setMessages([]);
              audioRef.current?.pause();
            }}
            className="grid size-8 place-items-center rounded-lg hover:bg-surface-secondary"
            aria-label={copy.clear}
            title={copy.clear}
          >
            <Trash2 aria-hidden className="size-4" />
          </button>
        ) : null}
        <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-lg hover:bg-surface-secondary" aria-label={copy.close}>
          <X aria-hidden className="size-4" />
        </button>
      </header>

      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-small" aria-live="polite">
        <div className="rounded-xl bg-surface-secondary px-3 py-2.5 text-small">{site === "store" ? copy.welcomeStore : copy.welcomeInformative}</div>
        {!messages.length ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {quickActions.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => chooseQuick(a.id)}
                  disabled={pending}
                  className="min-h-9 rounded-full border border-border px-3 text-caption hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  {copy.quick[a.id] ?? a.label}
                </button>
              ))}
            </div>
            {footerExtra?.(copy)}
          </div>
        ) : null}

        {messages.map((m, mi) =>
          m.role === "user" ? (
            <p key={mi} className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent px-3 py-2 text-small text-white">
              {m.content}
            </p>
          ) : (
            <div key={mi} className="space-y-2">
              <div className={`group relative max-w-[95%] rounded-2xl rounded-bl-md px-3 py-2 ${m.error ? "border border-error/25 bg-error/10 text-error" : "bg-surface-secondary"}`}>
                {m.error ? <p className="whitespace-pre-line">{m.content}</p> : <MarkdownLite text={m.content} />}
                {m.error ? (
                  <button type="button" onClick={() => retry(mi)} disabled={pending} className="mt-2 inline-flex min-h-8 items-center gap-1 rounded-md border border-error/30 px-2 text-caption font-medium hover:bg-error/10 disabled:opacity-50">
                    <RotateCcw aria-hidden className="size-3.5" /> {copy.retry}
                  </button>
                ) : (
                  <div className="mt-1.5 flex items-center gap-1">
                    <button type="button" onClick={() => copyAnswer(mi, m.content)} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-subtle hover:bg-surface hover:text-foreground">
                      {copiedIdx === mi ? <Check aria-hidden className="size-3" /> : <Copy aria-hidden className="size-3" />} {copiedIdx === mi ? copy.copied : copy.copy}
                    </button>
                    <button type="button" onClick={() => void playReply(m.content)} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-subtle hover:bg-surface hover:text-foreground" aria-label={copy.speakOn}>
                      <Volume2 aria-hidden className="size-3" />
                    </button>
                  </div>
                )}
              </div>
              {m.links?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {m.links.map((l) => (
                    <Link key={l.href} href={l.href} className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-caption font-medium hover:border-accent hover:text-accent">
                      {l.label} <ArrowRight aria-hidden className="size-3" />
                    </Link>
                  ))}
                </div>
              ) : null}
              {m.proposals?.length ? <PlanHeader count={m.proposals.length} open={m.proposals.filter((p) => p.status === "open")} busy={busyProposal !== null || pending} running={busyProposal === `${mi}:plan`} onRun={() => runPlan(mi)} copy={copy} /> : null}
              {m.proposals?.map((p, pi) => {
                const key = `${mi}:${p.view.id}`;
                return (
                  <section key={p.view.id} className="space-y-3 rounded-xl border border-border bg-surface p-3" aria-label={p.view.title}>
                    <p className="flex gap-2 text-caption font-semibold text-foreground">
                      <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] text-accent">
                        {pi + 1}
                      </span>
                      {p.view.title}
                    </p>
                    {p.status === "open" || p.status === "running" ? (
                      <>
                        <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                          {p.view.fields.map((f, fi) => (
                            <FieldDiff key={fi} field={f} copy={copy} />
                          ))}
                        </div>
                        {p.status === "running" ? (
                          <p className="inline-flex items-center gap-1.5 text-caption font-medium text-accent" role="status">
                            <Loader2 aria-hidden className="size-3.5 animate-spin" /> {copy.running}
                          </p>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => apply(mi, p)}
                              disabled={busyProposal !== null}
                              className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-accent px-3 text-caption font-semibold text-accent disabled:opacity-60"
                            >
                              {busyProposal === key ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Check aria-hidden className="size-3.5" />}
                              {busyProposal === key ? copy.applying : p.view.applyCredits > 0 ? fill(copy.applyCost, { credits: p.view.applyCredits }) : copy.applyFree}
                            </button>
                            <button type="button" onClick={() => setProposalStatus(mi, p.view.id, "discarded")} disabled={busyProposal !== null} className="min-h-9 rounded-lg px-3 text-caption hover:bg-surface-secondary disabled:opacity-60">
                              {copy.discard}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className={`space-y-1 text-caption ${p.status === "applied" ? "text-success" : p.status === "failed" ? "text-error" : "text-muted"}`}>
                        <p className="font-medium">{p.status === "applied" ? `✓ ${copy.applied}` : p.status === "failed" ? copy.failed : copy.discarded}</p>
                        {p.result ? <p className="whitespace-pre-line text-foreground">{p.result}</p> : null}
                        {p.href ? (
                          <Link href={p.href} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                            {copy.openResult} <ArrowRight aria-hidden className="size-3" />
                          </Link>
                        ) : null}
                        {p.status === "failed" ? (
                          <button type="button" onClick={() => setProposalStatus(mi, p.view.id, "open")} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-error/30 px-2 font-medium hover:bg-error/10">
                            <RotateCcw aria-hidden className="size-3.5" /> {copy.retry}
                          </button>
                        ) : null}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          ),
        )}
        {pending ? (
          <div className="flex w-fit items-center gap-1 rounded-2xl rounded-bl-md bg-surface-secondary px-3 py-3" role="status" aria-label={copy.thinking}>
            {[0, 150, 300].map((d) => (
              <span key={d} aria-hidden className="size-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        ) : null}
      </div>

      <form
        className="border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {activeQuick ? (
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-caption font-medium text-accent">
              <Sparkles aria-hidden className="size-3" /> {copy.quick[activeQuick.id] ?? activeQuick.label}
            </span>
            <button type="button" onClick={() => setIntent(null)} className="text-caption text-muted hover:text-foreground">
              {copy.cancelQuick}
            </button>
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <label htmlFor={`${titleId}-input`} className="sr-only">
            {copy.placeholder}
          </label>
          <textarea
            id={`${titleId}-input`}
            ref={inputRef}
            rows={activeQuick?.subject && activeQuick.subject.max > 300 ? 3 : 1}
            maxLength={activeQuick?.subject?.max ?? 2000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={transcribing ? copy.transcribing : (activeQuick?.subject?.placeholder ?? copy.placeholder)}
            className="max-h-36 min-h-10 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-small focus:border-accent focus:outline-none"
          />
          {voice.supported ? (
            <button
              type="button"
              onClick={toggleMic}
              disabled={transcribing || pending}
              aria-pressed={voice.recording}
              className={`grid size-10 shrink-0 place-items-center rounded-lg border disabled:opacity-50 ${voice.recording ? "animate-pulse border-error bg-error/10 text-error" : "border-border hover:bg-surface-secondary"}`}
              aria-label={voice.recording ? copy.micStop : copy.micStart}
              title={voice.recording ? copy.micStop : copy.micStart}
            >
              {transcribing ? <Loader2 aria-hidden className="size-4 animate-spin" /> : voice.recording ? <Square aria-hidden className="size-4" /> : <Mic aria-hidden className="size-4" />}
            </button>
          ) : null}
          <button type="submit" disabled={pending || !draft.trim()} className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-white disabled:opacity-50" aria-label={copy.send}>
            <Send aria-hidden className="size-4" />
          </button>
        </div>
        {voice.recording ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-caption font-medium text-error" role="status">
            <span aria-hidden className="size-2 animate-pulse rounded-full bg-error" /> {copy.micListening}
          </p>
        ) : null}
        <p className="mt-1.5 text-[11px] text-subtle">
          {costLine}
          {costs?.balance != null ? ` · ${fill(copy.balance, { balance: costs.balance })}` : ""}
        </p>
      </form>
    </div>
  );
}
