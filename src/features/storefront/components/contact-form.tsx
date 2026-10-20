"use client";

import { useActionState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import { FormMessage, fieldErrors } from "@/components/ui/form";
import { submitContactFormAction } from "@/features/notifications/email/contact-action";
import { formatAddress, type StoreAddress } from "@/features/storefront/store-profile";

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  const message = messages?.[0];
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-sm text-[var(--sf-sale)]">
      {message}
    </p>
  );
}

function TextInput({ label, name, errors, optional, ...rest }: { label: string; name: string; errors?: string[]; optional?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  const id = `contact-${name}`;
  const errId = `${id}-error`;
  const invalid = Boolean(errors?.length);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
        {optional ? <span className="sf-muted font-normal"> (optional)</span> : null}
      </label>
      <input id={id} name={name} aria-invalid={invalid || undefined} aria-describedby={invalid ? errId : undefined} className="sf-input w-full" {...rest} />
      <FieldError id={errId} messages={errors} />
    </div>
  );
}

function MessageInput({ errors, ...rest }: { errors?: string[] } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const invalid = Boolean(errors?.length);
  return (
    <div>
      <label htmlFor="contact-message" className="mb-1.5 block text-sm font-medium">
        Message
      </label>
      <textarea id="contact-message" name="message" rows={5} aria-invalid={invalid || undefined} aria-describedby={invalid ? "contact-message-error" : undefined} className="sf-input w-full" {...rest} />
      <FieldError id="contact-message-error" messages={errors} />
    </div>
  );
}

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="sf-btn">
      {pending ? "Sending…" : "Send message"}
    </button>
  );
}

/** Visitor message form. The honeypot stays out of the tab order; bots that fill it are rejected. */
export function ContactForm() {
  const [state, action] = useActionState(submitContactFormAction, null);
  const errors = fieldErrors(state);
  return (
    <form action={action} className="relative space-y-4" noValidate>
      <h2 className="sf-heading text-2xl">Send a message</h2>
      <FormMessage state={state} success="Message sent. We'll get back to you." />
      <TextInput label="Name" name="name" autoComplete="name" required maxLength={100} errors={errors.name} />
      <TextInput label="Email" name="email" type="email" autoComplete="email" required maxLength={254} errors={errors.email} />
      <TextInput label="Phone" name="phone" type="tel" autoComplete="tel" optional maxLength={20} errors={errors.phone} />
      <TextInput label="Subject" name="subject" optional maxLength={150} errors={errors.subject} />
      <MessageInput required minLength={10} maxLength={5000} errors={errors.message} />
      <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      <SendButton />
    </form>
  );
}

/** Embedded map (no API key) plus the contact form. */
export function ContactPanel({ storeName, address, intro }: { storeName: string; address: StoreAddress; intro?: ReactNode }) {
  const place = formatAddress(address).join(", ") || address.city || storeName;
  const src = `https://maps.google.com/maps?q=${encodeURIComponent(place)}&z=14&output=embed`;
  return (
    <div className="space-y-6">
      {intro}
      <iframe title={`Map of ${place}`} src={src} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-64 w-full rounded-[var(--sf-radius-card)] border-0" />
      <ContactForm />
    </div>
  );
}
