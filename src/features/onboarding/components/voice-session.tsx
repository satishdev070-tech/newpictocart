"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { Mic, MicOff, Send } from "lucide-react";
import { cn } from "@/lib/cn";
import { buttonClass } from "@/features/marketing-site/components/ui";
import { INDUSTRIES } from "@/features/stores/industries";
import { SITE_MODE_LABELS, type SiteMode } from "@/features/stores/site-mode";
import type { SarvamLocaleCode } from "@/lib/sarvam/locales";
import { voiceTurnAction, type VoiceTurnData } from "../voice/actions";
import { EMPTY_FACTS, suggestSlugFromName, type VoiceFacts } from "../voice/facts";
import { fileExtension, useVoiceRecorder } from "../voice/use-voice-recorder";
import { onboardingHref } from "../steps";
import { saveBusinessAction } from "../actions";
import { FormMessage, SubmitButton, fieldErrors } from "@/components/ui/form";
import { TextField, SelectField } from "@/components/ui/field";
import { useActionState } from "react";

type Bubble = { role: "user" | "tara"; text: string };

function playBase64Audio(base64: string, mime: string) {
  try {
    const src = `data:${mime};base64,${base64}`;
    const audio = new Audio(src);
    void audio.play().catch(() => undefined);
  } catch {
    /* ignore autoplay failures */
  }
}

export function VoiceSession({
  locale,
  plan,
  theme,
  rootDomain,
  defaultName,
}: {
  locale: SarvamLocaleCode;
  plan: string | null;
  theme: string | null;
  rootDomain: string;
  defaultName: string;
}) {
  const [facts, setFacts] = useState<VoiceFacts>(() => ({
    ...EMPTY_FACTS,
    name: defaultName || null,
  }));
  const [bubbles, setBubbles] = useState<Bubble[]>([
    { role: "tara", text: "Hi, I’m Tara. Tell me about your business — what’s the name?" },
  ]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const runTurn = useCallback(
    (payload: { text?: string; audio?: Blob }) => {
      setError(null);
      startTransition(async () => {
        const fd = new FormData();
        fd.set("locale", locale);
        fd.set("factsJson", JSON.stringify(facts));
        fd.set(
          "historyJson",
          JSON.stringify(
            bubbles.slice(-12).map((b) => ({
              role: b.role === "tara" ? ("tara" as const) : ("seller" as const),
              text: b.text.slice(0, 800),
            })),
          ),
        );
        if (payload.text) fd.set("text", payload.text);
        if (payload.audio) {
          const mime = payload.audio.type || "audio/webm";
          fd.set("audio", payload.audio, `turn.${fileExtension(mime)}`);
        }
        const result = await voiceTurnAction(null, fd);
        if (!result.ok) {
          setError(result.error.fieldErrors?._form?.[0] ?? result.error.message);
          return;
        }
        const data = result.data as VoiceTurnData;
        setBubbles((b) => [...b, { role: "user", text: data.transcript }, { role: "tara", text: data.reply }]);
        setFacts(data.facts);
        setDone(data.done);
        if (data.audioBase64 && data.audioMimeType) playBase64Audio(data.audioBase64, data.audioMimeType);
      });
    },
    [bubbles, facts, locale],
  );

  const { recording, toggle } = useVoiceRecorder({
    onRecordingComplete: (blob) => runTurn({ audio: blob }),
    onError: (kind) => {
      setError(
        kind === "denied"
          ? "Microphone access is needed for voice. You can type instead, or use the form."
          : "Voice recording isn't available in this browser. You can type instead, or use the form.",
      );
    },
  });

  if (done && facts.name && facts.category && facts.siteMode) {
    return (
      <VoiceConfirm
        facts={facts as VoiceFacts & { name: string; category: NonNullable<VoiceFacts["category"]>; siteMode: SiteMode }}
        locale={locale}
        plan={plan}
        theme={theme}
        rootDomain={rootDomain}
      />
    );
  }

  return (
    <div className="space-y-5">
      <FactChips facts={facts} />
      <div className="flex max-h-72 flex-col gap-3 overflow-y-auto rounded-brand-md bg-brand-canvas/60 p-4">
        {bubbles.map((b, i) => (
          <div
            key={`${i}-${b.role}`}
            className={cn("max-w-[90%] rounded-brand-md px-3 py-2 text-sm", b.role === "tara" ? "self-start bg-white text-brand-ink shadow-sm" : "self-end bg-brand text-white")}
          >
            {b.text}
          </div>
        ))}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={pending}
          className={cn(
            "grid size-14 place-items-center rounded-full transition",
            recording ? "bg-danger text-white animate-pulse" : "bg-brand text-white hover:bg-brand/90",
            pending && "opacity-60",
          )}
          aria-pressed={recording}
          aria-label={recording ? "Stop recording" : "Start recording"}
        >
          {recording ? <MicOff className="size-6" /> : <Mic className="size-6" />}
        </button>
        <form
          className="flex min-w-0 flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = text.trim();
            if (!v || pending) return;
            setText("");
            runTurn({ text: v });
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Or type your answer…"
            className="min-w-0 flex-1 rounded-brand-md border border-border px-3 py-2 text-sm"
            disabled={pending || recording}
          />
          <button type="submit" className={buttonClass("secondary")} disabled={pending || !text.trim()} aria-label="Send">
            <Send className="size-4" />
          </button>
        </form>
      </div>
      <p className="text-sm text-muted">
        Prefer typing everything?{" "}
        <Link href={onboardingHref("business", null, { plan, theme, locale, method: "form" })} className="font-semibold text-brand underline-offset-2 hover:underline">
          Switch to form
        </Link>
      </p>
      {pending ? <p className="text-sm text-muted">Tara is listening…</p> : null}
    </div>
  );
}

function FactChips({ facts }: { facts: VoiceFacts }) {
  const chips: { label: string; value: string }[] = [];
  if (facts.name) chips.push({ label: "Name", value: facts.name });
  if (facts.category) {
    const ind = INDUSTRIES.find((i) => i.slug === facts.category);
    chips.push({ label: "Category", value: ind?.short ?? facts.category });
  }
  if (facts.siteMode) chips.push({ label: "Mode", value: SITE_MODE_LABELS[facts.siteMode].title });
  if (facts.tagline) chips.push({ label: "Tagline", value: facts.tagline });
  if (facts.city) chips.push({ label: "City", value: facts.city });
  if (!chips.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <li key={c.label} className="rounded-full bg-brand-soft/50 px-3 py-1 text-xs font-semibold text-brand-ink">
          <span className="text-muted">{c.label}: </span>
          {c.value}
        </li>
      ))}
    </ul>
  );
}

function VoiceConfirm({
  facts,
  locale,
  plan,
  theme,
  rootDomain,
}: {
  facts: VoiceFacts & { name: string; category: NonNullable<VoiceFacts["category"]>; siteMode: SiteMode };
  locale: SarvamLocaleCode;
  plan: string | null;
  theme: string | null;
  rootDomain: string;
}) {
  const [state, action] = useActionState(saveBusinessAction, null);
  const errors = fieldErrors(state);
  const [slug, setSlug] = useState(() => suggestSlugFromName(facts.name));
  return (
    <form action={action} className="space-y-5">
      <p className="rounded-brand-md bg-brand-canvas p-4 text-sm text-brand-ink">Looks good — confirm these details and we’ll build your draft store.</p>
      <FormMessage state={state} />
      {plan ? <input type="hidden" name="plan" value={plan} /> : null}
      {theme ? <input type="hidden" name="theme" value={theme} /> : null}
      <input type="hidden" name="locale" value={locale} />
      {facts.tagline ? <input type="hidden" name="tagline" value={facts.tagline} /> : null}
      <input type="hidden" name="siteMode" value={facts.siteMode} />
      <TextField label="Business name" name="name" required defaultValue={facts.name} errors={errors.name} />
      <SelectField
        label="Business category"
        name="category"
        required
        options={INDUSTRIES.map((i) => ({ value: i.slug, label: i.name }))}
        defaultValue={facts.category}
        errors={errors.category}
      />
      <TextField
        label="Store address"
        name="slug"
        required
        value={slug}
        onChange={(e) => setSlug(suggestSlugFromName(e.target.value) || e.target.value)}
        errors={errors.slug}
        hint={`Your store will be at ${slug || "…"}.${rootDomain}`}
      />
      <div className="flex flex-wrap gap-3">
        <SubmitButton size="lg">Create my store</SubmitButton>
        <Link href={onboardingHref("business", null, { plan, theme, locale, method: "form" })} className={buttonClass("secondary")}>
          Edit in form
        </Link>
      </div>
    </form>
  );
}
