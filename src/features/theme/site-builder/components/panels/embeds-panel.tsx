"use client";

import { useId, type ReactNode } from "react";
import { ArrowUp, BarChart3, ExternalLink, MessageCircle, Search, TriangleAlert } from "lucide-react";
import type { Embeds } from "@/features/theme/schema/site";
import { useBuilder } from "../../context";
import { FieldRow, input, PanelFrame, Toggle } from "../ui";

/**
 * Embed apps (site builder left panel): built-in storefront widgets stored in config.embeds
 * (WhatsApp chat button, back-to-top) plus links to the integrations configured elsewhere.
 */

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
          {store.whatsapp ? (
            <p className="text-xs text-muted">
              Chats go to <span className="font-medium text-foreground">{store.whatsapp}</span>. Change it in{" "}
              <a href="/dashboard/settings" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                Settings → Store details
              </a>
              .
            </p>
          ) : (
            <p className="flex items-start gap-1.5 rounded-md bg-warning/10 p-2 text-xs text-warning">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Add your WhatsApp number in{" "}
                <a href="/dashboard/settings" target="_blank" rel="noopener noreferrer" className="font-medium underline">
                  Settings → Store details
                </a>{" "}
                — the button stays hidden until you do.
              </span>
            </p>
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
