"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitInformativeEnquiryAction } from "../public/enquiry-actions";
import { HONEYPOT_FIELD } from "../public/enquiry-schema";

const field = "mt-1 block min-h-11 w-full rounded-(--if-radius) border border-(--if-border) bg-(--if-bg) px-3 py-2 text-(--if-text)";
const btn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-(--if-radius) bg-(--if-primary) px-5 py-2.5 text-sm font-semibold text-(--if-on-primary) hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--if-link)";

/** Live enquiry form (island). Errors are announced; on success the form is replaced by a message. */
export function EnquiryFormIsland({
  id,
  services,
  showDateTime,
  defaultServiceId,
  source,
  businessName,
  successMessage,
  privacyHref,
}: {
  id: string;
  services: { id: string; name: string }[];
  showDateTime: boolean;
  defaultServiceId?: string;
  source: "CONTACT_FORM" | "SERVICE_PAGE";
  businessName: string;
  successMessage: string | null;
  privacyHref: string;
}) {
  const [state, action, pending] = useActionState(submitInformativeEnquiryAction, null);
  const done = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state?.ok) done.current?.focus();
  }, [state]);
  if (state?.ok) {
    return (
      <p ref={done} tabIndex={-1} role="status" className="max-w-2xl rounded-(--if-radius) border border-(--if-border) bg-(--if-bg) p-5 text-(--if-text)">
        {successMessage || "Thank you! We've received your enquiry and will get back to you soon."}
      </p>
    );
  }
  const errs = state && !state.ok ? (state.error.fieldErrors ?? {}) : {};
  const err = (k: string) => (errs[k]?.[0] ? <span id={`${id}-${k}-err`} className="mt-1 block text-sm font-medium text-(--if-text) underline decoration-(--if-primary)">{errs[k][0]}</span> : null);
  const desc = (k: string) => (errs[k]?.[0] ? { "aria-invalid": true, "aria-describedby": `${id}-${k}-err` } : {});
  return (
    <form action={action} className="max-w-2xl" noValidate>
      <input type="hidden" name="source" value={source} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-name`} className="text-sm font-medium">Name<span aria-hidden> *</span></label>
          <input id={`${id}-name`} name="name" required autoComplete="name" maxLength={100} className={field} {...desc("name")} />
          {err("name")}
        </div>
        <div>
          <label htmlFor={`${id}-phone`} className="text-sm font-medium">Phone<span aria-hidden> *</span></label>
          <input id={`${id}-phone`} name="phone" required type="tel" autoComplete="tel" inputMode="tel" maxLength={20} className={field} {...desc("phone")} />
          {err("phone")}
        </div>
        <div>
          <label htmlFor={`${id}-email`} className="text-sm font-medium">Email</label>
          <input id={`${id}-email`} name="email" type="email" autoComplete="email" maxLength={254} className={field} {...desc("email")} />
          {err("email")}
        </div>
        <div>
          <label htmlFor={`${id}-service`} className="text-sm font-medium">Service</label>
          <select id={`${id}-service`} name="serviceId" className={field} defaultValue={defaultServiceId ?? ""}>
            <option value="">Not sure yet</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        {showDateTime ? (
          <>
            <div>
              <label htmlFor={`${id}-date`} className="text-sm font-medium">Preferred date</label>
              <input id={`${id}-date`} name="preferredDate" type="date" className={field} {...desc("preferredDate")} />
              {err("preferredDate")}
            </div>
            <div>
              <label htmlFor={`${id}-time`} className="text-sm font-medium">Preferred time</label>
              <input id={`${id}-time`} name="preferredTime" type="time" className={field} {...desc("preferredTime")} />
              {err("preferredTime")}
            </div>
          </>
        ) : null}
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-message`} className="text-sm font-medium">Message</label>
          <textarea id={`${id}-message`} name="message" rows={4} maxLength={5000} className={`${field} min-h-28`} />
        </div>
        {/* Honeypot: hidden from people and assistive tech; bots fill it. */}
        <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>
            Leave this empty
            <input name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-start gap-2 text-sm text-(--if-muted)">
            <input type="checkbox" name="consent" required className="mt-1 size-4 accent-(--if-primary)" {...desc("consent")} />
            <span>
              I agree that {businessName} may contact me about this enquiry. <a href={privacyHref} className="underline text-(--if-link)">Privacy</a>
            </span>
          </label>
          {err("consent")}
        </div>
        {state && !state.ok && !Object.keys(errs).some((k) => k !== "_form") ? (
          <p role="alert" className="text-sm font-medium sm:col-span-2">
            {state.error.code === "RATE_LIMITED" ? "Too many enquiries from this device. Please try again in a few minutes." : (errs._form?.[0] ?? state.error.message)}
          </p>
        ) : null}
        <div className="sm:col-span-2">
          <button type="submit" disabled={pending} aria-busy={pending} className={btn}>
            {pending ? "Sending…" : "Send enquiry"}
          </button>
        </div>
      </div>
    </form>
  );
}
