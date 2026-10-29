"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { assetUrl } from "@/lib/storage/assets";
import { NewsletterForm } from "@/features/storefront/components/islands";
import { submitPopupFormAction } from "@/features/storefront/actions";
import type { Embeds, Popup, PopupFormField } from "@/features/theme/schema/site";
import { FormMessage } from "@/components/ui/form";

/**
 * Site-builder extras on every store page: popups (timed, exit-intent, or opened from a
 * #popup-<id> link) and embedded apps (WhatsApp chat button, back to top). Data comes from the
 * validated theme: text renders as text, links passed safeHref, images are tenant storage paths.
 * The builder canvas opens a popup directly with a `pc:popup` window event ({ id }).
 */

const seenKey = (id: string) => `pc-popup-seen:${id}`;
function seen(id: string): boolean {
  try {
    return sessionStorage.getItem(seenKey(id)) === "1";
  } catch {
    return false;
  }
}
function markSeen(id: string) {
  try {
    sessionStorage.setItem(seenKey(id), "1");
  } catch {
    /* storage blocked */
  }
}

function composePopupMessage(fields: PopupFormField[], values: Record<string, string | string[]>): string {
  return fields
    .map((f) => {
      const raw = values[f.id];
      const v = Array.isArray(raw) ? raw.filter(Boolean).join(", ") : (raw ?? "").trim();
      return v ? `${f.label}: ${v}` : null;
    })
    .filter(Boolean)
    .join("\n");
}

function PopupCustomForm({ popup }: { popup: Popup }) {
  const fields = popup.form.fields;
  const [state, action, pending] = useActionState(submitPopupFormAction, null);
  const [values, setValues] = useState<Record<string, string | string[]>>({});

  if (state?.ok) {
    return <p role="status" className="text-sm">{popup.form.successMessage || "Thanks — we got your message."}</p>;
  }

  const emailField = fields.find((f) => f.type === "email");
  const nameField = fields.find((f) => f.type === "text");
  const phoneField = fields.find((f) => f.type === "phone");
  const email = String((emailField && values[emailField.id]) || "").trim();
  const name = String((nameField && values[nameField.id]) || "").trim();
  const phone = String((phoneField && values[phoneField.id]) || "").trim();
  const message = composePopupMessage(fields, values) || "Popup form submission";

  return (
    <form action={action} className="mx-auto max-w-md space-y-3 text-left" noValidate>
      <input type="hidden" name="popupName" value={popup.name} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="message" value={message} />
      {/* Honeypot */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="absolute left-[-9999px] h-0 w-0 opacity-0" aria-hidden defaultValue="" />
      {fields.map((f) => (
        <PopupFieldInput key={f.id} field={f} value={values[f.id]} onChange={(v) => setValues((cur) => ({ ...cur, [f.id]: v }))} />
      ))}
      <FormMessage state={state} />
      <button type="submit" disabled={pending || !email} className="sf-btn w-full">
        {pending ? "Sending…" : popup.form.submitLabel || "Send"}
      </button>
      {!emailField ? <p className="text-xs opacity-70">Add an email field in the theme editor so visitors can be reached.</p> : null}
    </form>
  );
}

function PopupFieldInput({ field, value, onChange }: { field: PopupFormField; value: string | string[] | undefined; onChange: (v: string | string[]) => void }) {
  const id = `popup-f-${field.id}`;
  const label = (
    <label htmlFor={field.type === "checkbox" || field.type === "radio" ? undefined : id} className="mb-1 block text-sm font-medium">
      {field.label}
      {field.required ? <span className="text-[var(--sf-sale)]"> *</span> : null}
    </label>
  );
  if (field.type === "textarea") {
    return (
      <div>
        {label}
        <textarea id={id} rows={3} required={field.required} className="sf-input w-full" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }
  if (field.type === "select") {
    return (
      <div>
        {label}
        <select id={id} required={field.required} className="sf-input w-full" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose…</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (field.type === "radio") {
    return (
      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-sm font-medium">
          {field.label}
          {field.required ? <span className="text-[var(--sf-sale)]"> *</span> : null}
        </legend>
        {field.options.map((o) => (
          <label key={o} className="flex items-center gap-2 text-sm">
            <input type="radio" name={id} value={o} required={field.required} checked={value === o} onChange={() => onChange(o)} />
            {o}
          </label>
        ))}
      </fieldset>
    );
  }
  if (field.type === "checkbox") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-sm font-medium">
          {field.label}
          {field.required ? <span className="text-[var(--sf-sale)]"> *</span> : null}
        </legend>
        {field.options.map((o) => (
          <label key={o} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              value={o}
              checked={selected.includes(o)}
              onChange={(e) => onChange(e.target.checked ? [...selected, o] : selected.filter((x) => x !== o))}
            />
            {o}
          </label>
        ))}
      </fieldset>
    );
  }
  const inputType = field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text";
  return (
    <div>
      {label}
      <input id={id} type={inputType} required={field.required} autoComplete={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "on"} className="sf-input w-full" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function PopupView({ popup, onClose }: { popup: Popup; onClose: () => void }) {
  const img = assetUrl(popup.imagePath);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const isForm = popup.contentType === "form";
  const body = (
    <div className="space-y-3">
      {popup.eyebrow ? <p className="sf-eyebrow">{popup.eyebrow}</p> : null}
      {popup.heading ? <h2 className="sf-heading text-2xl">{popup.heading}</h2> : null}
      {popup.text ? <p className="sf-muted whitespace-pre-line text-sm">{popup.text}</p> : null}
      {isForm ? <PopupCustomForm popup={popup} /> : null}
      {!isForm && popup.newsletter ? <NewsletterForm buttonLabel={popup.ctaLabel || "Subscribe"} /> : null}
      {!isForm && !popup.newsletter && popup.ctaLabel && popup.ctaHref ? (
        <a href={popup.ctaHref} className="sf-btn" onClick={onClose}>
          {popup.ctaLabel}
        </a>
      ) : null}
      {!isForm && !popup.newsletter && popup.ctaLabel && !popup.ctaHref ? (
        <button type="button" className="sf-btn" onClick={onClose}>
          {popup.ctaLabel}
        </button>
      ) : null}
    </div>
  );
  if (popup.layout === "bottom-bar") {
    return (
      <div role="dialog" aria-label={popup.heading || popup.name} className="fixed inset-x-0 bottom-0 z-[60] border-t border-[var(--sf-border)] bg-[var(--sf-bg)] p-4 text-[var(--sf-text)] shadow-2xl">
        <div className="sf-container flex flex-wrap items-center justify-between gap-4">
          {body}
          <button type="button" onClick={onClose} className="sf-link text-sm">
            Close
          </button>
        </div>
      </div>
    );
  }
  const split = popup.layout === "image-left" && img;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={popup.heading || popup.name} className={`relative grid max-h-[90vh] w-full overflow-auto rounded-[var(--sf-radius-card)] bg-[var(--sf-bg)] text-[var(--sf-text)] shadow-2xl ${split ? "max-w-3xl md:grid-cols-2" : "max-w-md"}`}>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-full bg-[var(--sf-bg)] text-lg leading-none shadow">
          ×
        </button>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element -- tenant storage image, sized by CSS
          <img src={img} alt={popup.imageAlt} className={split ? "h-full min-h-56 w-full object-cover" : "aspect-[16/9] w-full object-cover"} />
        ) : null}
        <div className="p-6 text-center md:p-8">{body}</div>
      </div>
    </div>
  );
}

export function SiteExtras({ popups: initialPopups, embeds: initialEmbeds, whatsapp }: { popups: Popup[]; embeds: Embeds; whatsapp: string | null }) {
  // The builder canvas sends the unsaved embed settings (validated by the bridge).
  const [draftEmbeds, setDraftEmbeds] = useState<Embeds | null>(null);
  const embeds = draftEmbeds ?? initialEmbeds;
  useEffect(() => {
    const on = (e: Event) => setDraftEmbeds((e as CustomEvent<Embeds>).detail);
    window.addEventListener("pc:embeds", on);
    return () => window.removeEventListener("pc:embeds", on);
  }, []);
  const [open, setOpen] = useState<string | null>(null);
  // The builder canvas sends the popup being edited (unsaved) with the open event.
  const [draftPopup, setDraftPopup] = useState<Popup | null>(null);
  const popups = useMemo(() => (draftPopup ? [draftPopup, ...initialPopups.filter((p) => p.id !== draftPopup.id)] : initialPopups), [draftPopup, initialPopups]);
  const [showTop, setShowTop] = useState(false);

  // Automatic triggers (never inside the builder canvas, which opens popups explicitly).
  useEffect(() => {
    if (window.parent !== window) return;
    const isHome = location.pathname === "/";
    const auto = popups.filter((p) => p.enabled && p.trigger !== "link" && (p.where === "all" || isHome) && (p.frequency === "always" || !seen(p.id)));
    if (!auto.length) return;
    const timers = auto.filter((p) => p.trigger === "delay").map((p) => window.setTimeout(() => setOpen((cur) => cur ?? p.id), p.delaySeconds * 1000));
    const exit = auto.find((p) => p.trigger === "exit");
    const onOut = (e: MouseEvent) => {
      if (exit && e.clientY <= 0 && !e.relatedTarget) setOpen((cur) => cur ?? exit.id);
    };
    if (exit) document.addEventListener("mouseout", onOut);
    return () => {
      timers.forEach(clearTimeout);
      document.removeEventListener("mouseout", onOut);
    };
  }, [popups]);

  // #popup-<id> links and the builder canvas.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href^='#popup-']");
      if (!a) return;
      const id = a.getAttribute("href")!.slice("#popup-".length);
      if (!popups.some((p) => p.id === id)) return;
      e.preventDefault();
      setOpen(id);
    };
    const onEvent = (e: Event) => {
      const d = (e as CustomEvent<{ id: string | null; popup?: Popup }>).detail;
      if (d?.popup) setDraftPopup(d.popup);
      setOpen(d?.id ?? null);
    };
    document.addEventListener("click", onClick);
    window.addEventListener("pc:popup", onEvent);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("pc:popup", onEvent);
    };
  }, [popups]);

  useEffect(() => {
    if (!embeds.backToTop.enabled) return;
    const onScroll = () => setShowTop(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [embeds.backToTop.enabled]);

  const popup = popups.find((p) => p.id === open);
  const wa = embeds.whatsapp.enabled && whatsapp ? `${whatsapp}${whatsapp.includes("?") ? "&" : "?"}text=${encodeURIComponent(embeds.whatsapp.message)}` : null;
  const left = embeds.whatsapp.position === "left";
  return (
    <>
      {popup ? (
        <PopupView
          popup={popup}
          onClose={() => {
            markSeen(popup.id);
            setOpen(null);
          }}
        />
      ) : null}
      {wa ? (
        <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp" className={`fixed bottom-20 ${left ? "left-4" : "right-4"} z-40 grid size-12 place-items-center rounded-full bg-[#25d366] text-white shadow-lg md:bottom-6`}>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden>
            <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5.3-.5c.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5 2.5 1 3 .8 3.6.8.6-.1 1.8-.7 2-1.5.2-.7.2-1.4.2-1.5-.1-.1-.3-.2-.6-.3ZM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Z" />
          </svg>
        </a>
      ) : null}
      {showTop ? (
        <button type="button" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className={`fixed bottom-20 ${left ? "right-4" : "left-4"} z-40 grid size-10 place-items-center rounded-full bg-[var(--sf-primary)] text-[var(--sf-primary-fg)] shadow-lg md:bottom-6`}>
          ↑
        </button>
      ) : null}
    </>
  );
}
