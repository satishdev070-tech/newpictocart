"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { Copy, GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { assetUrl } from "@/lib/storage/assets";
import { MediaPicker } from "@/features/media/components/media-picker";
import { IMAGE_STANDARDS } from "@/features/media/image-standards";
import {
  MAX_POPUP_FIELDS,
  POPUP_FIELD_TYPES,
  POPUP_LAYOUTS,
  defaultPopupFormFields,
  popupSchema,
  type Popup,
  type PopupContentType,
  type PopupFormField,
  type PopupFieldType,
} from "@/features/theme/schema/site";
import { useBuilder } from "../../context";
import { newId, removePopup, upsertPopup } from "../../ops";
import { Dialog, FieldRow, input, PanelFrame, Toggle, useReorder } from "../ui";

/**
 * Popup editor (site builder left panel, panel kind "popup"). Edits are applied as typed (so
 * trimming never fights the cursor) and validated with popupSchema; problems show under the
 * field and would block the draft save until fixed.
 *
 * Content is either a newsletter sign-up or a custom form (text / email / phone / textarea /
 * select / radio / checkbox fields with required, submit label and success message).
 */

type Errors = Partial<Record<string, string>>;

function popupErrors(p: Popup): Errors {
  const r = popupSchema.safeParse(p);
  if (r.success) return {};
  const out: Errors = {};
  for (const issue of r.error.issues) {
    const k = issue.path.map(String).join(".") || String(issue.path[0] ?? "");
    if (k && !out[k]) out[k] = issue.message;
  }
  return out;
}

const LAYOUT_LABELS: Record<(typeof POPUP_LAYOUTS)[number], string> = { center: "Centred box", "image-left": "Image on the left", "bottom-bar": "Bar at the bottom" };
const FIELD_TYPE_LABELS: Record<PopupFieldType, string> = {
  text: "Short text",
  email: "Email",
  phone: "Phone",
  textarea: "Long text",
  select: "Dropdown",
  radio: "Radio choices",
  checkbox: "Checkboxes",
};

export function PopupPanel() {
  const { config, apply, panel, setPanel, page, setPageKey } = useBuilder();
  const popupId = panel?.kind === "popup" ? panel.popupId : null;
  const popup = config.popups.find((p) => p.id === popupId) ?? null;
  const errors = useMemo(() => (popup ? popupErrors(popup) : {}), [popup]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!popup) {
    return (
      <PanelFrame title="Popup" onBack={() => setPanel({ kind: "pages" })} onClose={() => setPanel(null)}>
        <p className="text-small text-muted">This popup no longer exists.</p>
      </PanelFrame>
    );
  }

  const set = <K extends keyof Popup>(k: K, v: Popup[K]) =>
    apply((c) => {
      const cur = c.popups.find((p) => p.id === popup.id);
      return cur ? upsertPopup(c, { ...cur, [k]: v }) : c;
    }, `popup.${popup.id}.${String(k)}`);

  const patch = (next: Partial<Popup>) =>
    apply((c) => {
      const cur = c.popups.find((p) => p.id === popup.id);
      return cur ? upsertPopup(c, { ...cur, ...next }) : c;
    }, `popup.${popup.id}.patch`);

  const setContentType = (contentType: PopupContentType) => {
    if (contentType === "form") {
      const fields = popup.form.fields.length ? popup.form.fields : defaultPopupFormFields();
      patch({ contentType, newsletter: false, form: { ...popup.form, fields }, ctaLabel: popup.form.submitLabel || popup.ctaLabel || "Send" });
    } else {
      patch({ contentType, newsletter: true, ctaLabel: popup.ctaLabel || "Subscribe" });
    }
  };

  const setForm = (form: Popup["form"]) => patch({ form, ctaLabel: form.submitLabel || popup.ctaLabel });

  const anchor = `#popup-${popup.id}`;
  const image = assetUrl(popup.imagePath);
  const errorCount = Object.keys(errors).length;
  const isForm = popup.contentType === "form";

  return (
    <PanelFrame
      title="Popup"
      subtitle={popup.name || "Untitled popup"}
      onBack={() => setPanel({ kind: "pages" })}
      onClose={() => setPanel(null)}
      footer={
        <Button variant="ghost" size="sm" className="text-error" onClick={() => setConfirmDelete(true)}>
          <Trash2 /> Delete popup
        </Button>
      }
    >
      <div className="space-y-4">
        {errorCount ? (
          <p role="alert" className="rounded-md bg-error/10 p-2 text-xs text-error">
            Fix {errorCount === 1 ? "1 field" : `${errorCount} fields`} below before saving.
          </p>
        ) : null}

        <Group title="Popup">
          <Text label="Name (only you see it)" value={popup.name} max={60} error={errors.name} onChange={(v) => set("name", v)} />
          <Toggle label="Popup is on" checked={popup.enabled} onChange={(v) => set("enabled", v)} />
        </Group>

        <Group title="When it opens">
          <Choice
            label="Open"
            value={popup.trigger}
            options={[
              ["delay", "After a delay"],
              ["exit", "When the visitor is about to leave (desktop)"],
              ["link", "Only from a link or button"],
            ]}
            onChange={(v) => set("trigger", v)}
          />
          {popup.trigger === "delay" ? (
            <Num label="Delay (seconds)" value={popup.delaySeconds} min={0} max={120} error={errors.delaySeconds} onChange={(v) => set("delaySeconds", v)} />
          ) : null}
          {popup.trigger !== "link" ? (
            <>
              <Choice
                label="Show"
                value={popup.frequency}
                options={[
                  ["session", "Once per visit"],
                  ["always", "Every page view"],
                ]}
                onChange={(v) => set("frequency", v)}
              />
              <Choice
                label="On"
                value={popup.where}
                options={[
                  ["all", "Every page"],
                  ["home", "Home page only"],
                ]}
                onChange={(v) => set("where", v)}
              />
            </>
          ) : null}
          <div className="space-y-1 rounded-md bg-surface-secondary p-2 text-xs">
            <p className="font-medium">Open it from a menu or button</p>
            <p className="text-muted">Pick “Popup” as the link type and choose this popup, or use this link:</p>
            <div className="flex items-center gap-1.5">
              <code className="min-w-0 flex-1 truncate rounded bg-surface px-1.5 py-0.5 font-mono">{anchor}</code>
              <button
                type="button"
                className="flex items-center gap-1 text-accent hover:underline"
                onClick={() => {
                  void navigator.clipboard?.writeText(anchor).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  });
                }}
              >
                <Copy className="size-3.5" /> {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </Group>

        <Group title="Content">
          <Choice label="Layout" value={popup.layout} options={POPUP_LAYOUTS.map((l) => [l, LAYOUT_LABELS[l]] as const)} onChange={(v) => set("layout", v)} />
          <Choice
            label="Content type"
            value={popup.contentType}
            options={[
              ["newsletter", "Newsletter sign-up"],
              ["form", "Custom form"],
            ]}
            onChange={setContentType}
          />
          <Text label="Small text above the heading" value={popup.eyebrow} max={60} error={errors.eyebrow} onChange={(v) => set("eyebrow", v)} />
          <Text label="Heading" value={popup.heading} max={120} error={errors.heading} onChange={(v) => set("heading", v)} />
          <Text label="Text" value={popup.text} max={400} error={errors.text} multiline onChange={(v) => set("text", v)} />
          {popup.layout !== "bottom-bar" ? (
            <FieldRow label="Image">
              <div className="flex items-center gap-2">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- editor thumbnail
                  <img src={image} alt="" className="size-12 rounded-md object-cover ring-1 ring-border" />
                ) : (
                  <div className="size-12 rounded-md bg-surface-secondary ring-1 ring-border" />
                )}
                <MediaPicker folder="theme" standard={IMAGE_STANDARDS.portrait} triggerLabel={image ? "Change" : "Choose image"} onSelect={([m]) => m && set("imagePath", m.path)} />
                {image ? (
                  <button type="button" className="text-xs text-muted hover:underline" onClick={() => set("imagePath", "")}>
                    Remove
                  </button>
                ) : null}
              </div>
              {errors.imagePath ? <p className="text-xs text-error">{errors.imagePath}</p> : null}
            </FieldRow>
          ) : null}
          {image ? <Text label="Image description (alt text)" value={popup.imageAlt} max={200} error={errors.imageAlt} onChange={(v) => set("imageAlt", v)} /> : null}
        </Group>

        {isForm ? (
          <Group title="Form">
            <FormFieldsEditor
              fields={popup.form.fields}
              onChange={(fields) => setForm({ ...popup.form, fields })}
            />
            <Text
              label="Submit button label"
              value={popup.form.submitLabel}
              max={40}
              error={errors["form.submitLabel"]}
              onChange={(v) => setForm({ ...popup.form, submitLabel: v })}
            />
            <Text
              label="Success message"
              value={popup.form.successMessage}
              max={200}
              error={errors["form.successMessage"]}
              multiline
              onChange={(v) => setForm({ ...popup.form, successMessage: v })}
            />
          </Group>
        ) : (
          <Group title="Action">
            <Toggle label="Email sign-up field" checked={popup.newsletter} onChange={(v) => set("newsletter", v)} />
            <Text label={popup.newsletter ? "Sign-up button label" : "Button label"} value={popup.ctaLabel} max={40} error={errors.ctaLabel} onChange={(v) => set("ctaLabel", v)} />
            {!popup.newsletter ? (
              <Text label="Button link" value={popup.ctaHref} max={500} placeholder="/collections/new or https://…" error={errors.ctaHref} onChange={(v) => set("ctaHref", v)} hint="Leave empty for a button that just closes the popup." />
            ) : null}
          </Group>
        )}
      </div>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this popup?"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                apply((c) => removePopup(c, popup.id));
                setConfirmDelete(false);
                if (page.popupId === popup.id) setPageKey("home");
                setPanel({ kind: "pages" });
              }}
            >
              Delete popup
            </Button>
          </>
        }
      >
        <p className="text-small">
          <strong>{popup.name}</strong> will be removed. Links that open it ({anchor}) will do nothing. You can undo this until you leave the builder.
        </p>
      </Dialog>
    </PanelFrame>
  );
}

function FormFieldsEditor({ fields, onChange }: { fields: PopupFormField[]; onChange: (fields: PopupFormField[]) => void }) {
  const reorder = useReorder((from, to) => {
    const next = [...fields];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it!);
    onChange(next);
  });

  const add = () => {
    if (fields.length >= MAX_POPUP_FIELDS) return;
    onChange([...fields, { id: newId("f"), type: "text", label: "New field", required: false, options: [] }]);
  };

  const update = (id: string, patch: Partial<PopupFormField>) => onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const remove = (id: string) => onChange(fields.filter((f) => f.id !== id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted">Fields ({fields.length}/{MAX_POPUP_FIELDS})</p>
        <Button type="button" variant="secondary" size="sm" disabled={fields.length >= MAX_POPUP_FIELDS} onClick={add}>
          <Plus /> Add field
        </Button>
      </div>
      {fields.length === 0 ? <p className="text-xs text-muted">Add at least one field. Include an email field so replies can reach the visitor.</p> : null}
      <ul className="space-y-2">
        {fields.map((f, i) => (
          <li key={f.id} {...reorder.itemProps(i)} className="space-y-2 rounded-lg border border-border bg-surface-secondary/40 p-2">
            <div className="flex items-center gap-1">
              <span {...reorder.handleProps(i)} className="cursor-grab text-muted">
                <GripVertical className="size-4" />
              </span>
              <input className={cn(input, "flex-1")} value={f.label} maxLength={80} onChange={(e) => update(f.id, { label: e.target.value })} aria-label="Field label" />
              <button type="button" className="text-muted hover:text-error" aria-label={`Remove ${f.label}`} onClick={() => remove(f.id)}>
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select className={input} value={f.type} onChange={(e) => update(f.id, { type: e.target.value as PopupFieldType, options: ["select", "radio", "checkbox"].includes(e.target.value) ? f.options.length ? f.options : ["Option 1", "Option 2"] : [] })}>
                {POPUP_FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {FIELD_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={f.required} onChange={(e) => update(f.id, { required: e.target.checked })} />
                Required
              </label>
            </div>
            {f.type === "select" || f.type === "radio" || f.type === "checkbox" ? (
              <textarea
                className={cn(input, "min-h-16 py-2")}
                value={f.options.join("\n")}
                placeholder={"One option per line"}
                onChange={(e) =>
                  update(f.id, {
                    options: e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .slice(0, 20),
                  })
                }
              />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-b border-border pb-4 last:border-b-0">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  );
}

function Text({ label, value, max, error, onChange, multiline, placeholder, hint }: { label: string; value: string; max: number; error?: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string; hint?: string }) {
  const id = useId();
  const props = { id, value, maxLength: max, placeholder, "aria-invalid": error ? true : undefined, "aria-describedby": error ? `${id}-err` : undefined, className: cn(input), onChange: (e: { target: { value: string } }) => onChange(e.target.value) };
  return (
    <FieldRow label={label} htmlFor={id} hint={hint}>
      {multiline ? <textarea rows={3} {...props} /> : <input {...props} />}
      {error ? (
        <p id={`${id}-err`} className="text-xs text-error">
          {error}
        </p>
      ) : null}
    </FieldRow>
  );
}

function Num({ label, value, min, max, error, onChange }: { label: string; value: number; min: number; max: number; error?: string; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <FieldRow label={label} htmlFor={id}>
      <input id={id} type="number" min={min} max={max} className={input} value={value} aria-invalid={error ? true : undefined} onChange={(e) => onChange(Math.max(min, Math.min(max, Math.round(Number(e.target.value) || 0))))} />
      {error ? <p className="text-xs text-error">{error}</p> : null}
    </FieldRow>
  );
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <FieldRow label={label} htmlFor={id}>
      <select id={id} className={input} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </FieldRow>
  );
}
