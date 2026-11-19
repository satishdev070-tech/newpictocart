"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Megaphone, Sparkles } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { CheckboxField, SelectField, TextField } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { InlineAction } from "@/features/settings/ui/action-controls";
import { cn } from "@/lib/cn";
import { announceLaunchAction, connectLinkedInManualAction, connectMetaManualAction, rewritePostWithAiAction, saveAutomationAction } from "../desk-actions";
import { ALL_CHANNELS, CHANNEL_LABELS, isAutoPlatform, whatsappShareUrl, type Channel, type SocialPlatform } from "../compose";
import type { AutomationSettings } from "../automation";
import { ChannelChip } from "./channels";

// ------------------------------------------------------------------ manual connect

const MANUAL_COPY = {
  meta: {
    title: "Connect Facebook & Instagram with your own token",
    trigger: "Connect with token",
    steps: [
      "Create (or open) your app at developers.facebook.com and add the Facebook Login for Business product.",
      "Open Graph API Explorer, pick your app, add pages_show_list, pages_read_engagement, pages_manage_posts, instagram_basic and instagram_content_publish, then Generate Access Token.",
      "Paste the token here. A Page token works as is. For a user token, also add your App ID and App secret so we can swap it for a token that doesn't expire.",
    ],
    help: "https://developers.facebook.com/tools/explorer/",
    helpLabel: "Open Graph API Explorer",
  },
  linkedin: {
    title: "Connect LinkedIn with your own token",
    trigger: "Connect with token",
    steps: [
      "Create an app at linkedin.com/developers and add the products \"Sign In with LinkedIn using OpenID Connect\" and \"Share on LinkedIn\".",
      "Open the OAuth token generator, choose your app and the scopes openid, profile and w_member_social (or w_organization_social for a company page), then request the token.",
      "Paste the token. For a company page, also enter its numeric ID (from the page admin URL). Tokens last 60 days; reconnect when it expires.",
    ],
    help: "https://www.linkedin.com/developers/tools/oauth/token-generator",
    helpLabel: "Open the LinkedIn token generator",
  },
} as const;

/** Paste-your-own-token connect. The token is checked with the network before it's stored (encrypted). */
export function ManualConnectDialog({ network }: { network: "meta" | "linkedin" }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, action] = useActionState(network === "meta" ? connectMetaManualAction : connectLinkedInManualAction, null);
  const copy = MANUAL_COPY[network];
  const done = state?.ok ? state.data : null;
  useEffect(() => {
    if (state?.ok) ref.current?.close();
  }, [state]);
  const errors = state && !state.ok ? (state.error.fieldErrors ?? {}) : {};
  return (
    <>
      <span className="inline-flex flex-col items-start gap-1">
        <Button variant="secondary" size="sm" onClick={() => ref.current?.showModal()}>
          <KeyRound aria-hidden /> {copy.trigger}
        </Button>
        {done ? (
          <span role="status" className="max-w-xs text-caption text-success">
            {done}
          </span>
        ) : null}
      </span>
      <dialog ref={ref} aria-labelledby={titleId} className="m-auto w-[min(94vw,540px)] rounded-lg border border-border bg-surface p-0 text-foreground backdrop:bg-black/40">
        <form action={action} className="space-y-4 p-5" autoComplete="off">
          <div>
            <h2 id={titleId} className="text-base font-semibold">
              {copy.title}
            </h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-caption text-muted">
              {copy.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <a href={copy.help} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-caption font-medium text-accent hover:underline">
              {copy.helpLabel} ↗<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
          {state && !state.ok ? <FormMessage state={state} /> : null}
          <TextField label="Access token" name="token" type="password" required errors={errors.token} hint="Stored encrypted. We never show it again." />
          {network === "meta" ? (
            <>
              <TextField label="Page ID" name="pageId" inputMode="numeric" errors={errors.pageId} hint="Needed when the token manages more than one Page." optional />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="App ID" name="appId" inputMode="numeric" errors={errors.appId} optional />
                <TextField label="App secret" name="appSecret" type="password" errors={errors.appSecret} optional />
              </div>
              <CheckboxField label="Also connect the Instagram professional account linked to this Page" name="instagram" defaultChecked />
            </>
          ) : (
            <TextField label="Company page ID" name="organizationId" inputMode="numeric" errors={errors.organizationId} hint="Leave empty to post on your own profile." optional />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => ref.current?.close()}>
              Cancel
            </Button>
            <SubmitButton>Check and connect</SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}

// ------------------------------------------------------------------ automation

export function AutomationForm({ settings, connected, canWrite }: { settings: AutomationSettings; connected: SocialPlatform[]; canWrite: boolean }) {
  const [state, action] = useActionState(saveAutomationAction, null);
  const [mode, setMode] = useState(settings.mode);
  const [ai, setAi] = useState(settings.useAi);
  const errors = state && !state.ok ? (state.error.fieldErrors ?? {}) : {};
  const choosable = ALL_CHANNELS.filter((c) => c !== "youtube");
  return (
    <form action={action} className="space-y-5">
      <FormMessage state={state} success={state?.ok ? state.data : null} />
      <fieldset disabled={!canWrite} className="space-y-5">
        <div className="space-y-2">
          <legend className="text-label">When to create a post</legend>
          <CheckboxField label="When my store goes live: a “we're open” post" name="launchEnabled" defaultChecked={settings.launchEnabled} />
          <CheckboxField label="When I publish a new product: a post with its photo, price and link" name="productEnabled" defaultChecked={settings.productEnabled} hint="Only products published after you switch this on. One post per product." />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="What happens next"
            name="mode"
            value={mode}
            onChange={(e) => setMode(e.target.value === "auto" ? "auto" : "review")}
            options={[
              { value: "review", label: "Save as a draft for me to review" },
              { value: "auto", label: "Publish automatically after a short delay" },
            ]}
            errors={errors.mode}
          />
          <TextField label="Delay before publishing (minutes)" name="delayMinutes" type="number" min={5} max={1440} defaultValue={settings.delayMinutes} errors={errors.delayMinutes} hint="You can cancel the post from Posts until then." disabled={mode !== "auto"} />
          {mode !== "auto" ? <input type="hidden" name="delayMinutes" value={settings.delayMinutes} /> : null}
        </div>
        <div>
          <p className="mb-1.5 text-label">Networks</p>
          <div className="flex flex-wrap gap-2">
            {choosable.map((c) => {
              const auto = isAutoPlatform(c);
              const ok = !auto || connected.includes(c);
              return (
                <label key={c} className={cn("flex min-h-9 items-center gap-2 rounded-md border border-border px-3 py-1.5 text-small has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-accent/30", ok ? "cursor-pointer" : "opacity-60")}>
                  <input type="checkbox" name="platforms" value={c} defaultChecked={settings.platforms.includes(c as Channel)} />
                  <ChannelChip channel={c} />
                  {CHANNEL_LABELS[c]}
                  {!auto ? <span className="text-caption text-muted">(reminder)</span> : !ok ? <span className="text-caption text-muted">(not connected)</span> : null}
                </label>
              );
            })}
          </div>
          {errors.platforms ? <p role="alert" className="mt-1 text-caption text-error">{errors.platforms[0]}</p> : null}
          <p className="mt-1.5 text-caption text-muted">Facebook, Instagram, LinkedIn, Pinterest and Google publish by themselves once connected. WhatsApp, X and Threads get the text ready for you to share.</p>
        </div>
        <div className="rounded-md border border-border p-3">
          <CheckboxField label="Write the text with AI (1 credit per post)" name="useAi" checked={ai} onChange={(e) => setAi(e.target.checked)} hint="AI writes a version for each network in your brand voice. If credits run out or AI fails, the simple template text is used and nothing is charged." />
        </div>
      </fieldset>
      {canWrite ? <SubmitButton>Save automation</SubmitButton> : null}
    </form>
  );
}

export function AnnounceLaunchButton() {
  const router = useRouter();
  const [state, action] = useActionState(announceLaunchAction, null);
  useEffect(() => {
    if (state?.ok && state.data) router.push(`/dashboard/marketing/social/posts/${state.data}`);
  }, [state, router]);
  return (
    <form action={action} className="space-y-2">
      <FormMessage state={state && !state.ok ? state : null} />
      <SubmitButton variant="secondary">
        <Megaphone aria-hidden /> Create my store launch post
      </SubmitButton>
    </form>
  );
}

export function RewriteWithAiButton({ id }: { id: string }) {
  return <InlineAction action={rewritePostWithAiAction} fields={{ id }} label={<><Sparkles aria-hidden className="size-4" /> Rewrite with AI (1 credit)</>} variant="secondary" success="Rewritten" />;
}

// ------------------------------------------------------------------ WhatsApp (assisted)

/** WhatsApp can't be posted by an app: one tap opens WhatsApp with the message ready to share. */
export function WhatsAppShare({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={whatsappShareUrl(text)} target="_blank" rel="noopener noreferrer" className={buttonClass({ size: "sm" })}>
        Share on WhatsApp<span className="sr-only"> (opens in a new tab)</span>
      </a>
      <Button
        size="sm"
        variant="ghost"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copied" : "Copy message"}
      </Button>
      <span className="text-caption text-muted">Send it to your Status, Channel or customer groups.</span>
    </div>
  );
}

export function AutoPostLink({ id, title }: { id: string; title: string }) {
  return (
    <Link href={`/dashboard/marketing/social/posts/${id}`} className="font-medium text-accent hover:underline">
      {title}
    </Link>
  );
}
