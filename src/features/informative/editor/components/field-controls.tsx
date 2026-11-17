"use client";

import { useId } from "react";
import { ArrowDown, ArrowUp, List, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClassName } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { ImagePicker } from "../../media/image-picker";
import { isSafeHref, readLink, readList, type FieldDef, type ScalarField, type SelectOption } from "../fields";

/**
 * One control per field kind (fields.ts). Controlled: `value` is the prop as stored, `onChange`
 * gets the next value (undefined removes the prop). Text edits pass `typing` so the reducer
 * coalesces keystrokes into one undo step.
 */

export type FieldChange = (value: unknown, typing?: boolean) => void;
export type FieldEnv = { services: SelectOption[]; problems: Record<string, string>; problemKey: string };

const labelCls = "mb-1.5 block text-small font-medium";
const hintCls = "mt-1 text-caption text-muted";

function Hint({ field, id, problem }: { field: FieldDef; id: string; problem?: string }) {
  if (problem)
    return (
      <p id={id} className="mt-1 text-caption text-error" role="alert">
        {problem}
      </p>
    );
  return field.hint ? (
    <p id={id} className={hintCls}>
      {field.hint}
    </p>
  ) : null;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Simple rich text: paragraphs and bullet lines (the site keeps line breaks). */
function RichText({ id, value, onChange, field, describedBy }: { id: string; value: string; onChange: FieldChange; field: Extract<ScalarField, { kind: "textarea" | "richtext" }>; describedBy?: string }) {
  const bullet = () => {
    const el = document.getElementById(id) as HTMLTextAreaElement | null;
    if (!el) return;
    const a = el.selectionStart;
    const lineStart = value.lastIndexOf("\n", a - 1) + 1;
    onChange(`${value.slice(0, lineStart)}• ${value.slice(lineStart)}`.slice(0, field.maxLength ?? 2000));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + 2, a + 2);
    });
  };
  return (
    <div className="rounded-md border border-border bg-surface focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15">
      <div role="toolbar" aria-label={`${field.label} formatting`} className="flex gap-1 border-b border-border px-1.5 py-1">
        <Button type="button" size="sm" variant="ghost" onClick={bullet}>
          <List aria-hidden /> Bullet
        </Button>
        <span className="ml-auto self-center pr-1 text-caption text-subtle">Blank line = new paragraph</span>
      </div>
      <textarea
        id={id}
        value={value}
        rows={field.rows ?? 6}
        maxLength={field.maxLength ?? 2000}
        placeholder={field.placeholder}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value, true)}
        className="block w-full resize-y rounded-b-md bg-transparent px-3 py-2 text-small focus:outline-none"
      />
    </div>
  );
}

export function ScalarControl({ field, value, onChange, env, idPrefix }: { field: ScalarField; value: unknown; onChange: FieldChange; env: FieldEnv; idPrefix: string }) {
  const id = `${idPrefix}-${field.key}`;
  const hintId = `${id}-hint`;
  const problem = env.problems[env.problemKey];
  const describedBy = field.hint || problem ? hintId : undefined;
  switch (field.kind) {
    case "text":
      return (
        <div>
          <label htmlFor={id} className={labelCls}>{field.label}</label>
          <input id={id} value={str(value)} maxLength={field.maxLength ?? 200} placeholder={field.placeholder} aria-describedby={describedBy} onChange={(e) => onChange(e.target.value, true)} className={inputClassName} />
          <Hint field={field} id={hintId} problem={problem} />
        </div>
      );
    case "textarea":
      return (
        <div>
          <label htmlFor={id} className={labelCls}>{field.label}</label>
          <textarea id={id} value={str(value)} rows={field.rows ?? 3} maxLength={field.maxLength ?? 1000} placeholder={field.placeholder} aria-describedby={describedBy} onChange={(e) => onChange(e.target.value, true)} className={cn(inputClassName, "h-auto py-2")} />
          <Hint field={field} id={hintId} problem={problem} />
        </div>
      );
    case "richtext":
      return (
        <div>
          <label htmlFor={id} className={labelCls}>{field.label}</label>
          <RichText id={id} value={str(value)} onChange={onChange} field={field} describedBy={describedBy} />
          <Hint field={field} id={hintId} problem={problem} />
        </div>
      );
    case "number":
      return (
        <div>
          <label htmlFor={id} className={labelCls}>{field.label}</label>
          <input
            id={id}
            type="number"
            inputMode="numeric"
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            value={typeof value === "number" ? value : ""}
            placeholder="All"
            aria-describedby={describedBy}
            onChange={(e) => {
              const n = e.target.valueAsNumber;
              onChange(Number.isFinite(n) ? Math.max(field.min, Math.min(field.max, Math.round(n))) : undefined, true);
            }}
            className={cn(inputClassName, "w-32")}
          />
          <Hint field={field} id={hintId} problem={problem} />
        </div>
      );
    case "select": {
      const options = field.options === "services" ? env.services : field.options;
      return (
        <div>
          <label htmlFor={id} className={labelCls}>{field.label}</label>
          <select id={id} value={str(value)} aria-describedby={describedBy} onChange={(e) => onChange(e.target.value || undefined)} className={inputClassName}>
            {field.options === "services" || !options.some((o) => o.value === "") ? <option value="">{field.emptyLabel ?? "None"}</option> : null}
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <Hint field={field} id={hintId} problem={problem} />
        </div>
      );
    }
    case "toggle":
      return (
        <div>
          <label className="flex min-h-9 items-center gap-2 text-small font-medium">
            <input type="checkbox" checked={value === true} aria-describedby={describedBy} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--accent)]" />
            {field.label}
          </label>
          <Hint field={field} id={hintId} problem={problem} />
        </div>
      );
    case "color": {
      const v = typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "";
      return (
        <div>
          <label htmlFor={id} className={labelCls}>{field.label}</label>
          <div className="flex items-center gap-2">
            <input id={id} type="color" value={v || "#000000"} aria-describedby={describedBy} onChange={(e) => onChange(e.target.value.toLowerCase(), true)} className="h-9 w-12 cursor-pointer rounded-md border border-border bg-surface" />
            <span className="font-mono text-small text-muted">{v || "Default"}</span>
            {v ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange(undefined)}>
                Reset
              </Button>
            ) : null}
          </div>
          <Hint field={field} id={hintId} problem={problem} />
        </div>
      );
    }
    case "link": {
      const link = readLink(value);
      const bad = !isSafeHref(link.href);
      return (
        <fieldset>
          <legend className={labelCls}>{field.label}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <input aria-label={`${field.label} text`} placeholder="Button text" value={link.label} maxLength={40} onChange={(e) => onChange({ ...link, label: e.target.value }, true)} className={inputClassName} />
            <input
              aria-label={`${field.label} link`}
              placeholder="/contact or https://…"
              value={link.href}
              maxLength={500}
              aria-invalid={bad || undefined}
              aria-describedby={describedBy ?? (bad ? hintId : undefined)}
              onChange={(e) => onChange({ ...link, href: e.target.value }, true)}
              className={cn(inputClassName, bad && "border-error")}
            />
          </div>
          <Hint field={field} id={hintId} problem={problem ?? (bad ? "Use a page address like /contact, a full https:// link, tel: or mailto:." : undefined)} />
        </fieldset>
      );
    }
    case "lines": {
      const lines = Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];
      return (
        <div>
          <label htmlFor={id} className={labelCls}>{field.label}</label>
          <textarea
            id={id}
            rows={Math.min(field.max, Math.max(3, lines.length + 1))}
            value={lines.join("\n")}
            placeholder={field.placeholder}
            aria-describedby={describedBy}
            onChange={(e) => {
              const next = e.target.value.split("\n").slice(0, field.max).map((l) => l.slice(0, field.maxLength ?? 120));
              onChange(next.some((l) => l.trim()) ? next : undefined, true);
            }}
            className={cn(inputClassName, "h-auto py-2")}
          />
          <Hint field={field} id={hintId} problem={problem} />
        </div>
      );
    }
    case "image":
      return (
        <div>
          <ImagePicker label={field.label} value={typeof value === "string" && value ? value : null} query={field.query} onChange={(path) => onChange(path ?? undefined)} />
          <Hint field={field} id={hintId} problem={problem} />
        </div>
      );
  }
}

/** Repeatable items (add / remove / reorder), each a set of scalar sub-fields. */
export function ListControl({ field, value, onChange, env, idPrefix }: { field: Extract<FieldDef, { kind: "list" }>; value: unknown; onChange: FieldChange; env: FieldEnv; idPrefix: string }) {
  const items = readList(value);
  const headingId = useId();
  const set = (next: Record<string, unknown>[], typing?: boolean) => onChange(next.length ? next : undefined, typing);
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j]!, next[i]!];
    set(next);
  };
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 id={headingId} className="text-small font-medium">
          {field.label} <span className="font-normal text-muted">({items.length}/{field.max})</span>
        </h4>
        <Button type="button" size="sm" variant="secondary" disabled={items.length >= field.max} onClick={() => set([...items, {}])}>
          <Plus aria-hidden /> Add {field.itemLabel.toLowerCase()}
        </Button>
      </div>
      {field.hint ? <p className={hintCls}>{field.hint}</p> : null}
      {items.length === 0 ? <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-caption text-muted">No {field.itemLabel.toLowerCase()}s yet.</p> : null}
      <ol className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="rounded-lg border border-border bg-surface-secondary/40 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-caption font-semibold text-muted">
                {field.itemLabel} {i + 1}
              </span>
              <span className="flex gap-0.5">
                <Button type="button" size="sm" variant="ghost" aria-label={`Move ${field.itemLabel} ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp aria-hidden />
                </Button>
                <Button type="button" size="sm" variant="ghost" aria-label={`Move ${field.itemLabel} ${i + 1} down`} disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown aria-hidden />
                </Button>
                <Button type="button" size="sm" variant="ghost" aria-label={`Remove ${field.itemLabel} ${i + 1}`} onClick={() => set(items.filter((_, j) => j !== i))}>
                  <Trash2 aria-hidden />
                </Button>
              </span>
            </div>
            <div className="space-y-3">
              {field.fields.map((sub) => (
                <ScalarControl
                  key={sub.key}
                  field={sub}
                  value={item[sub.key]}
                  idPrefix={`${idPrefix}-${field.key}-${i}`}
                  env={{ ...env, problemKey: `${env.problemKey}.${i}.${sub.key}` }}
                  onChange={(v, typing) => {
                    const nextItem = { ...item };
                    if (v === undefined) delete nextItem[sub.key];
                    else nextItem[sub.key] = v;
                    set(items.map((x, j) => (j === i ? nextItem : x)), typing);
                  }}
                />
              ))}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function FieldControl(props: { field: FieldDef; value: unknown; onChange: FieldChange; env: FieldEnv; idPrefix: string }) {
  return props.field.kind === "list" ? <ListControl {...props} field={props.field} /> : <ScalarControl {...props} field={props.field} />;
}
