"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, BarChart3, ExternalLink, MessageCircle, Search, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Embeds } from "@/features/theme/schema/site";
import { whatsappUrl } from "@/features/storefront/store-profile";
import { saveWhatsappNumberAction } from "@/features/settings/actions";
import { useBuilder } from "../../context";
import { CANVAS_RELOAD_EVENT } from "../canvas-frame";
import { FieldRow, input, PanelFrame, Toggle } from "../ui";

/**
 * Embed apps (site builder left panel): built-in storefront widgets stored in config.embeds
 * (WhatsApp chat button, back-to-top) plus links to the integrations configured elsewhere.
 * The WhatsApp button needs the store's number (stores.whatsapp); without a valid one the panel
 * asks for it inline, since the storefront hides the button.
 */

/** Inline "add your WhatsApp number" form; saves the store setting and reloads the canvas. */
function WhatsappNumberForm({ current }: { current: string | null }) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState(current ?? "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const save = () =>
    startTransition(async () => {
      const r = await saveWhatsappNumberAction({ whatsapp: value });
      if (!r.ok) return setError(r.error.fieldErrors?.whatsapp?.[0] ?? r.error.message);
      setError("");
      router.refresh();
      window.dispatchEvent(new Event(CANVAS_RELOAD_EVENT));
    });
  return (
    <form
      className="space-y-2 rounded-md bg-warning/10 p-2"
      onSubmit={(ev) => {
        ev.preventDefault();
        save();
      }}
    >
      <p className="flex items-start gap-1.5 text-xs text-warning">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
        <span>
          {current ? `“${current}” isn't a valid Indian mobile number,` : "Your store has no WhatsApp number yet,"} so the button stays hidden on your store. Add it here or in{" "}
          <a href="/dashboard/settings" target="_blank" rel="noopener noreferrer" className="font-medium underline">
            Settings → Store details
          </a>
          .
        </span>
      </p>
      <FieldRow label="WhatsApp number" htmlFor={id}>
        <div className="flex gap-2">
          <input
            id={id}
            className={input}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="98765 43210"
            maxLength={20}
            value={value}
            onChange={(ev) => {
              setValue(ev.target.value);
              setError("");
            }}
          />
          <Button type="submit" size="sm" variant="accent" pending={pending}>
            Save
          </Button>
        </div>
        {error ? <p className="text-xs text-error">{error}</p> : null}
      </FieldRow>
    </form>
  );
}

function AppCard({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children?: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-start gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-accent-soft text-accent [&_svg]:size-4">{icon}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-small font-semibold">{title}</h3>
          <p className="text-xs text-muted">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function LinkCard({ href, icon, title, description }: { href: string; icon: ReactNode; title: string; description: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2.5 rounded-lg border border-border bg-surface p-3 hover:border-border-strong hover:bg-surface-secondary">
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-secondary text-muted [&_svg]:size-4">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-small font-semibold">{title}</span>
        <span className="block text-xs text-muted">{description}</span>
      </span>
      <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted" aria-label="Opens in a new tab" />
    </a>
  );
}

export function EmbedsPanel() {
  const { config, apply, setPanel, store } = useBuilder();
  const e = config.embeds;
  const msgId = useId();
  const posId = useId();

  const setWhatsapp = (patch: Partial<Embeds["whatsapp"]>, field: string) =>
    apply((c) => ({ ...c, embeds: { ...c.embeds, whatsapp: { ...c.embeds.whatsapp, ...patch } } }), `embeds.whatsapp.${field}`);
  const setBackToTop = (enabled: boolean) => apply((c) => ({ ...c, embeds: { ...c.embeds, backToTop: { enabled } } }), "embeds.backToTop.enabled");

  return (
    <PanelFrame title="Embed apps" subtitle="Widgets on every page" onClose={() => setPanel(null)}>
      <div className="space-y-3">
        <AppCard icon={<MessageCircle />} title="WhatsApp chat button" description="A floating button that opens a WhatsApp chat with your store.">
          <Toggle label="Show the button" checked={e.whatsapp.enabled} onChange={(v) => setWhatsapp({ enabled: v }, "enabled")} />
          {whatsappUrl(store.whatsapp) ? (
            <p className="text-xs text-muted">
              Chats go to <span className="font-medium text-foreground">{store.whatsapp}</span>. Change it in{" "}
              <a href="/dashboard/settings" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                Settings → Store details
              </a>
              .
            </p>
          ) : (
            <WhatsappNumberForm current={store.whatsapp} />
          )}
          {e.whatsapp.enabled ? (
            <>
              <FieldRow label="Position" htmlFor={posId}>
                <select id={posId} className={input} value={e.whatsapp.position} onChange={(ev) => setWhatsapp({ position: ev.target.value === "left" ? "left" : "right" }, "position")}>
                  <option value="right">Bottom right</option>
                  <option value="left">Bottom left</option>
                </select>
              </FieldRow>
              <FieldRow label="Pre-filled message" htmlFor={msgId} hint={`${e.whatsapp.message.length}/200`}>
                <textarea id={msgId} rows={3} maxLength={200} className={input} value={e.whatsapp.message} onChange={(ev) => setWhatsapp({ message: ev.target.value }, "message")} />
              </FieldRow>
            </>
          ) : null}
        </AppCard>

        <AppCard icon={<ArrowUp />} title="Back-to-top button" description="A small button that scrolls long pages back to the top.">
          <Toggle label="Show the button" checked={e.backToTop.enabled} onChange={setBackToTop} />
        </AppCard>

        <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted">Integrations</h3>
        <LinkCard href="/dashboard/settings/analytics" icon={<BarChart3 />} title="Analytics & pixels" description="Google Analytics, Meta Pixel and other tracking." />
        <LinkCard href="/dashboard/settings/seo" icon={<Search />} title="SEO" description="Search titles, descriptions and sharing images." />
      </div>
    </PanelFrame>
  );
}
