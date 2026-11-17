"use client";

import { useState, useTransition } from "react";
import { Check, Copy, ExternalLink, Rocket } from "lucide-react";
import { publishStoreAction } from "@/features/stores/actions";
import { refreshPreviewUrlAction } from "@/features/theme/actions";
import { OnbHeading, OnbSub, onbButton } from "@/components/onboarding-ui";
import { publicEnv } from "@/lib/env/public";
import { storefrontPreviewUrl } from "@/lib/platform/urls";
import { startCopy } from "../copy";
import { LivePreview } from "../components/live-preview";

type PublishResult = { ok: true } | { ok: false; error: { message: string } };

/**
 * Publishes the store and, only on success, leaves for the dashboard. Returns the message to show
 * when publishing failed (thrown network errors included), else null.
 */
export async function publishThenLeave(
  publish: () => Promise<PublishResult>,
  leave: () => void,
  fallback: string,
): Promise<string | null> {
  const res = await publish().catch(() => null);
  if (!res) return fallback;
  if (!res.ok) return res.error.message || fallback;
  leave();
  return null;
}

export function DoneScreen({
  locale,
  slug,
  rootDomain,
  storeName,
  onDashboard,
  onLeave,
}: {
  locale: string;
  slug: string;
  rootDomain: string;
  storeName?: string | null;
  /** "Go to my dashboard" (and the redirect after publishing). */
  onDashboard: () => void;
  /** Called just before a publish redirect so the journey stops reacting to the cleared draft. */
  onLeave?: () => void;
}) {
  const c = startCopy(locale);
  const host = `${slug}.${rootDomain}`;
  const url = storefrontPreviewUrl(host, publicEnv().NEXT_PUBLIC_PLATFORM_URL);
  const [copied, setCopied] = useState(false);
  const [publishing, startPublish] = useTransition();
  const [previewing, startPreview] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const name = storeName?.trim() || "";
  const subtitle = name.length >= 2 ? c.done.subNamed(name) : c.done.sub;

  /** Same server action as the dashboard's "Publish store" (settings.write on the active store). */
  function publish() {
    startPublish(async () => {
      setError(null);
      const failed = await publishThenLeave(publishStoreAction, () => {
        onLeave?.();
        onDashboard();
      }, c.done.publishFailed);
      if (failed) setError(failed);
    });
  }

  /** Signed preview (works while the store is still a draft), like the dashboard's "Preview store". */
  function preview() {
    startPreview(async () => {
      setError(null);
      // Open synchronously (popup blockers), then point it at the signed preview URL.
      const tab = window.open("about:blank", "_blank");
      const res = await refreshPreviewUrlAction().catch(() => null);
      if (res?.ok && tab) {
        tab.opener = null;
        tab.location.href = res.data.url;
      } else if (tab) {
        tab.opener = null;
        tab.location.href = url;
      }
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="relative grid w-full items-start gap-8 pt-4 sm:pt-8 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.6fr)] lg:gap-12">
      <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-6">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-mk-accent/40 bg-mk-accent-tint px-3 py-1 font-mk-mono text-[11px] uppercase tracking-[0.14em] text-mk-text">
          <span className="size-2 rounded-full bg-mk-accent" aria-hidden />
          {c.done.readyBadge}
        </span>
        <OnbHeading as="h2" accent={c.done.titleAccent.trim()}>
          {c.done.title.trim()}
        </OnbHeading>
        <OnbSub className="max-w-md">{subtitle}</OnbSub>
        <p className="max-w-md text-sm text-mk-muted">{c.done.draftNote}</p>
        <div className="flex min-w-0 items-center gap-2 rounded-[var(--r-md)] border border-mk-line-strong bg-mk-elev-1 p-2">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 flex-1 truncate px-2 text-sm text-mk-text underline-offset-4 hover:underline"
          >
            {host}
          </a>
          <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-[var(--r-sm)] bg-mk-elev-2 px-3 text-sm font-medium text-mk-text transition-colors hover:bg-white/10"
          >
            {copied ? <Check aria-hidden className="size-4 text-mk-accent" /> : <Copy aria-hidden className="size-4" />}
            {copied ? c.done.copied : c.done.copy}
          </button>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button type="button" onClick={publish} disabled={publishing} className={onbButton.primary}>
            <Rocket aria-hidden className="size-4" /> {publishing ? c.done.publishing : c.done.publish}
          </button>
          <button type="button" onClick={onDashboard} disabled={publishing} className={onbButton.secondary}>
            {c.done.myDashboard}
          </button>
          <button type="button" onClick={preview} disabled={previewing} className={onbButton.secondary}>
            <ExternalLink aria-hidden className="size-4" /> {c.done.preview}
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noreferrer"
            className={onbButton.secondary}
          >
            {c.done.whatsapp}
          </a>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        ) : null}
      </aside>

      <div className="min-w-0 max-h-[640px] overflow-hidden lg:max-h-[720px]">
        <LivePreview locale={locale} rootDomain={rootDomain} liveSlug={slug} size="hero" />
      </div>
    </section>
  );
}
