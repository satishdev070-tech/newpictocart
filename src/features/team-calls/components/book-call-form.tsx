"use client";

import { useActionState, useMemo, useState } from "react";
import { CalendarCheck, CalendarClock, Phone } from "lucide-react";
import { cn } from "@/lib/cn";
import { TextAreaField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/form";
import type { ActionResult } from "@/lib/actions/result";
import { bookTeamCallAction, bookTeamCallPublicAction, type BookResult } from "../actions";
import { formatCallWhen, formatCallTime, groupSlotsByDay, type TeamCallSlot } from "../schemas";

type Props = {
  slots: TeamCallSlot[];
  /** dashboard = signed-in merchant; public = marketing site visitor (email required). */
  mode: "dashboard" | "public";
  defaults?: { name?: string | null; phone?: string | null };
};

const errorsOf = (s: ActionResult<BookResult> | null) => (s && !s.ok ? (s.error.fieldErrors ?? {}) : {});

/**
 * Pick a day → a time → leave a phone number. Times are IST; each time button is ≥ 44 px.
 * Works at 375 px: days and times wrap (no sideways scrolling) and the submit is full width.
 */
export function BookCallForm({ slots, mode, defaults }: Props) {
  const [state, action] = useActionState(mode === "dashboard" ? bookTeamCallAction : bookTeamCallPublicAction, null);
  const days = useMemo(() => groupSlotsByDay(slots), [slots]);
  const [day, setDay] = useState(days[0]?.day ?? "");
  const [slotId, setSlotId] = useState<string | null>(null);
  const current = days.find((d) => d.day === day) ?? days[0];
  const chosen = slots.find((s) => s.id === slotId) ?? null;
  const e = errorsOf(state);

  if (state?.ok) {
    return (
      <div role="status" className="rounded-xl border border-success/30 bg-success/10 p-5 text-center">
        <CalendarCheck aria-hidden className="mx-auto size-8 text-success" />
        <p className="mt-2 text-h3">Your call is booked</p>
        <p className="mt-1 text-small text-muted">
          {chosen ? `${formatCallWhen(chosen.startsAt)}. ` : ""}Our team will call you on the number you gave{mode === "public" ? " and email you a confirmation" : ""}.
        </p>
      </div>
    );
  }

  if (!days.length) {
    return (
      <div className="rounded-xl border border-border bg-surface-secondary/50 p-5 text-center text-small text-muted">
        <CalendarClock aria-hidden className="mx-auto mb-2 size-6" />
        No free times right now. New times are added every week — please check back soon.
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      {state && !state.ok ? (
        <p role="alert" className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-small text-error">
          {e._form?.[0] ?? state.error.message}
        </p>
      ) : null}
      <fieldset>
        <legend className="mb-2 text-label font-medium">1. Pick a day</legend>
        <div className="flex flex-wrap gap-2">
          {days.map((d) => (
            <button
              key={d.day}
              type="button"
              aria-pressed={d.day === current?.day}
              onClick={() => {
                setDay(d.day);
                setSlotId(null);
              }}
              className={cn(
                "min-h-11 rounded-lg border px-3 text-small font-medium transition-colors",
                d.day === current?.day ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface hover:border-border-strong",
              )}
            >
              {d.label}
              <span className="ml-1.5 text-caption text-muted">{d.slots.length}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-label font-medium">2. Pick a time (IST)</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {current?.slots.map((s) => (
            <label
              key={s.id}
              className={cn(
                "flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-2 text-small font-medium tabular-nums transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
                slotId === s.id ? "border-accent bg-accent text-white" : "border-border bg-surface hover:border-border-strong",
              )}
            >
              <input type="radio" name="slotId" value={s.id} className="sr-only" checked={slotId === s.id} onChange={() => setSlotId(s.id)} required />
              {formatCallTime(s.startsAt)}
            </label>
          ))}
        </div>
        {e.slotId ? <p className="mt-1 text-small text-error">{e.slotId[0]}</p> : null}
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-label font-medium">3. Your details</legend>
        <TextField label="Your name" name="name" autoComplete="name" required defaultValue={defaults?.name ?? ""} errors={e.name} />
        <TextField label="Phone (WhatsApp preferred)" name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="98765 43210" defaultValue={defaults?.phone ?? ""} errors={e.phone} />
        {mode === "public" ? <TextField label="Email" name="email" type="email" autoComplete="email" required errors={e.email} className="sm:col-span-2" /> : null}
        <TextAreaField label="What would you like help with?" name="topic" rows={3} optional maxLength={500} className="sm:col-span-2" placeholder="e.g. setting up payments, adding products, getting my first orders" errors={e.topic} />
        {mode === "public" ? (
          // Honeypot for bots; hidden from people and assistive tech.
          <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label>
              Website
              <input type="text" name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
        ) : null}
      </fieldset>
      <div className="sticky bottom-[calc(var(--bottom-nav-h,0px)+0.5rem)] z-10 rounded-xl border border-border bg-surface/95 p-2 shadow-lg backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
        <SubmitButton className="min-h-11 w-full sm:w-auto" disabled={!slotId}>
          <Phone aria-hidden />
          {chosen ? `Book ${formatCallWhen(chosen.startsAt)}` : "Pick a time to book"}
        </SubmitButton>
      </div>
      <p className="text-caption text-muted">Free and no obligation. We only use your number to call you about this booking.</p>
    </form>
  );
}
