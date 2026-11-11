"use client";

import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Copy, ExternalLink, FileCode2, Globe, Upload } from "lucide-react";
import { ActionDialog, ActionForm, InlineAction } from "@/features/settings/ui/action-controls";
import { Badge, Card } from "@/components/ui/layout";
import { Button, buttonClass } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/features/analytics/dates";
import { checkGscDeliveryAction, checkGscDnsAction, removeGscDnsAction, removeGscFileAction, saveGscDnsAction, uploadGscFileAction } from "../actions";
import { CLOUDFLARE_DNS_URL, GSC_DOMAIN_INFO, GSC_DOMAINS, GSC_FILENAME_RE, GSC_MAX_FILE_BYTES, SEARCH_CONSOLE_URL, gscFileStatus, gscPublicUrl, type GscDomain, type GscFileStatus } from "../verification";

/** Row fields the card needs (a subset of the table; passed from the server page). */
export type GscRowView = {
  filename: string | null;
  content: string | null;
  dns_value: string | null;
  active: boolean;
  updated_at: string;
  last_delivery_check_at: string | null;
  last_delivery_status: string | null;
  last_delivery_error: string | null;
  last_dns_check_at: string | null;
  last_dns_status: string | null;
};
export type GscCardState = { ready: false } | { ready: true; domains: Record<GscDomain, { html: GscRowView | null; dns: GscRowView | null }> };

const FILE_STATUS: Record<GscFileStatus, { label: string; tone: "neutral" | "info" | "success" | "error" }> = {
  not_configured: { label: "Not configured", tone: "neutral" },
  uploaded: { label: "Uploaded", tone: "info" },
  accessible: { label: "Publicly accessible", tone: "success" },
  failed: { label: "Delivery failed", tone: "error" },
};

const DNS_STATUS: Record<string, { label: string; tone: "success" | "warning" | "error" }> = {
  found: { label: "Found", tone: "success" },
  not_found: { label: "Not found", tone: "warning" },
  failed: { label: "Lookup failed", tone: "error" },
};

const linkClass = buttonClass({ variant: "secondary", size: "sm" });

function ExternalButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
      <ExternalLink aria-hidden />
      {children}
    </a>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const { show } = useToast();
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          show({ tone: "success", message: "Copied." });
        } catch {
          show({ tone: "error", message: "Couldn't copy. Select the text and copy it manually." });
        }
      }}
    >
      <Copy aria-hidden />
      {label}
    </Button>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-border bg-surface-secondary p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-small font-medium transition-colors ${value === o.value ? "bg-surface text-foreground shadow-xs" : "text-muted hover:text-foreground"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FileUpload({ domain, replacing }: { domain: GscDomain; replacing: boolean }) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<{ name: string; warning: string | null } | null>(null);
  const [dragging, setDragging] = useState(false);
  // The form resets after a successful upload; clear the picked name with it.
  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const onReset = () => setPicked(null);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  const pick = (file: File | undefined) => {
    if (!file) return setPicked(null);
    // Quick client hint only; the server validates name, size and exact content.
    const warning = !GSC_FILENAME_RE.test(file.name) ? "This doesn't look like Google's googleXXXXXXXXXXXXXXXX.html file." : file.size > GSC_MAX_FILE_BYTES ? "This file is larger than 10 KB." : null;
    setPicked({ name: file.name, warning });
  };
  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    const files = e.dataTransfer.files;
    if (!files.length || !input.current) return;
    input.current.files = files;
    pick(files[0]);
  };

  return (
    <ActionForm action={uploadGscFileAction} fields={{ domain }} submitLabel={replacing ? "Upload & replace" : "Upload"} submitVariant={replacing ? "secondary" : "primary"} encType="multipart/form-data" resetOnSuccess success="Verification file saved." className="space-y-3">
      {(e) => (
        <div className="space-y-1.5">
          <label
            htmlFor={inputId}
            onDragOver={(ev) => {
              ev.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-5 text-center text-small transition-colors focus-within:outline-2 focus-within:outline-accent ${dragging ? "border-accent bg-accent-soft" : "border-border-strong hover:bg-surface-secondary"}`}
          >
            <Upload aria-hidden className="size-5 text-muted" />
            <span className="font-medium">{picked ? picked.name : "Drop the .html file here, or choose it"}</span>
            <span className="text-caption text-muted">Only Google&apos;s one-line verification file is accepted (max 10 KB).</span>
            <input
              ref={input}
              id={inputId}
              type="file"
              name="file"
              accept=".html,text/html"
              required
              className="sr-only"
              onChange={(ev) => pick(ev.target.files?.[0])}
            />
          </label>
          {picked?.warning ? <p className="text-caption text-warning">{picked.warning}</p> : null}
          {e.file?.map((m) => (
            <p key={m} role="alert" className="text-caption text-error">
              {m}
            </p>
          ))}
        </div>
      )}
    </ActionForm>
  );
}

function HtmlFileTab({ domain, row }: { domain: GscDomain; row: GscRowView | null }) {
  const status = gscFileStatus(row);
  const active = row && row.active && row.filename ? row : null;
  const url = active?.filename ? gscPublicUrl(domain, active.filename) : null;
  const s = FILE_STATUS[status];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-small text-muted">Status</span>
        <Badge tone={s.tone}>{s.label}</Badge>
        {active?.last_delivery_check_at ? <span className="text-caption text-muted">Last checked {formatDateTime(active.last_delivery_check_at)}</span> : null}
      </div>

      {status === "accessible" ? (
        <p role="status" className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-small">
          Verification file is accessible. Complete ownership verification in Google Search Console.
        </p>
      ) : null}
      {status === "failed" && active?.last_delivery_error ? (
        <p role="alert" className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-small">
          {active.last_delivery_error}
        </p>
      ) : null}

      {active && url ? (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex items-start gap-2">
            <FileCode2 aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
            <div className="min-w-0">
              <p className="font-mono text-small break-all">{active.filename}</p>
              <p className="text-caption text-muted break-all">{url}</p>
              <p className="text-caption text-muted">Uploaded {formatDateTime(active.updated_at)}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <CopyButton value={url} label="Copy URL" />
            <ExternalButton href={url}>Test URL</ExternalButton>
            <InlineAction action={checkGscDeliveryAction} fields={{ domain }} label="Check public delivery" success="Check finished." />
            <ActionDialog action={removeGscFileAction} fields={{ domain }} title="Remove verification file?" description={<>The file will stop being served at {url}. If Google still relies on it, the property can lose its verified status.</>} triggerLabel="Remove" confirmLabel="Remove file" variant="danger" success="Verification file removed." />
          </div>
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-small font-medium">{active ? "Replace file" : "Upload file"}</p>
        <FileUpload domain={domain} replacing={!!active} />
      </div>
    </div>
  );
}

function DnsTab({ domain, row }: { domain: GscDomain; row: GscRowView | null }) {
  const valueId = useId();
  const active = row && row.active && row.dns_value ? row : null;
  const dns = active?.last_dns_status ? DNS_STATUS[active.last_dns_status] : null;
  return (
    <div className="space-y-4">
      <ActionForm action={saveGscDnsAction} fields={{ domain }} submitLabel={active ? "Update value" : "Save value"} submitVariant="secondary" success="TXT value saved." className="space-y-2">
        {(e) => (
          <div className="space-y-1.5">
            <label htmlFor={valueId} className="text-small font-medium">
              TXT value from Search Console
            </label>
            <input id={valueId} name="value" required maxLength={200} defaultValue={active?.dns_value ?? ""} placeholder="google-site-verification=…" spellCheck={false} autoComplete="off" className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-small" />
            {e.value?.map((m) => (
              <p key={m} role="alert" className="text-caption text-error">
                {m}
              </p>
            ))}
          </div>
        )}
      </ActionForm>

      {active?.dns_value ? (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-small">
              <thead className="bg-surface-secondary text-left text-caption text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2 font-mono">TXT</td>
                  <td className="px-3 py-2 font-mono">@</td>
                  <td className="px-3 py-2 font-mono break-all">{active.dns_value}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <CopyButton value={active.dns_value} label="Copy value" />
            <ExternalButton href={CLOUDFLARE_DNS_URL}>Open Cloudflare DNS</ExternalButton>
            <InlineAction action={checkGscDnsAction} fields={{ domain }} label="Check DNS" success="Lookup finished." />
            <ActionDialog action={removeGscDnsAction} fields={{ domain }} title="Remove saved TXT value?" description="This only removes the value saved here. It does not touch your DNS records in Cloudflare." triggerLabel="Remove" confirmLabel="Remove value" variant="danger" success="TXT value removed." />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-small text-muted">DNS</span>
            {dns ? <Badge tone={dns.tone}>{dns.label}</Badge> : <Badge>Not checked</Badge>}
            {active.last_dns_check_at ? <span className="text-caption text-muted">Last checked {formatDateTime(active.last_dns_check_at)}</span> : null}
          </div>
          {active.last_dns_status === "found" ? <p className="text-small">The TXT record is published. Complete ownership verification in Google Search Console.</p> : null}
        </>
      ) : null}
      <p className="text-caption text-muted">
        Add the record in Cloudflare → {GSC_DOMAIN_INFO[domain].apex} → DNS → Records → Add record (Type TXT, Name @). Pictocart never edits DNS for you. DNS changes can take a few minutes to an hour to appear.
      </p>
    </div>
  );
}

/** Super Admin → Branding & analytics: Google Search Console ownership verification. */
export function SearchConsoleCard({ state }: { state: GscCardState }) {
  const [domain, setDomain] = useState<GscDomain>("production");
  const [method, setMethod] = useState<"html" | "dns">("html");
  const info = GSC_DOMAIN_INFO[domain];
  return (
    <Card
      title="Google Search Console"
      description="Prove ownership of the Pictocart website to Google with an HTML file or a DNS TXT record. Checks run only when you press a button."
      actions={<ExternalButton href={SEARCH_CONSOLE_URL}>Open Search Console</ExternalButton>}
    >
      {!state.ready ? (
        <div role="alert" className="space-y-1 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-small">
          <p className="font-semibold">Not set up on this database yet</p>
          <p>
            Apply <code>supabase/migrations/20261111007200_search_console_verification.sql</code> to this Supabase project, then reload. Until then, the fastest route is a DNS TXT record: add Google&apos;s <code>google-site-verification=…</code> value in Cloudflare DNS (Type TXT, Name @) and press Verify in Search Console.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Segmented label="Domain" value={domain} onChange={setDomain} options={GSC_DOMAINS.map((d) => ({ value: d, label: GSC_DOMAIN_INFO[d].label }))} />
            <span className="inline-flex items-center gap-1 text-caption text-muted">
              <Globe aria-hidden className="size-3.5" />
              {info.hosts.join(" · ")}
            </span>
          </div>
          <Segmented
            label="Verification method"
            value={method}
            onChange={setMethod}
            options={[
              { value: "html", label: "HTML file" },
              { value: "dns", label: "DNS TXT record" },
            ]}
          />
          {/* key: remount per domain so forms and pickers never leak between Production and Staging. */}
          {method === "html" ? <HtmlFileTab key={`html-${domain}`} domain={domain} row={state.domains[domain].html} /> : <DnsTab key={`dns-${domain}`} domain={domain} row={state.domains[domain].dns} />}
        </div>
      )}
    </Card>
  );
}
