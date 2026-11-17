"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClassName } from "@/components/ui/field";
import type { PageSection } from "../../sections";
import { rewriteSectionAction } from "../../editor-ai/actions";
import { SECTION_FIELDS, type FieldDef, type SelectOption } from "../fields";
import { FieldControl } from "./field-controls";
import { actionErrorText } from "./util";

/** Settings of the selected section: its fields (fields.ts) plus "Rewrite with AI". */
export function SettingsPanel({
  pageId,
  section,
  services,
  problems,
  canWrite,
  onBack,
  onProp,
  onReplaceProps,
  onConfirmLeave,
}: {
  pageId: string;
  section: PageSection;
  services: SelectOption[];
  problems: Record<string, string>;
  canWrite: boolean;
  onBack: () => void;
  onProp: (key: string, value: unknown, typing?: boolean) => void;
  onReplaceProps: (props: Record<string, unknown>) => void;
  onConfirmLeave: () => boolean;
}) {
  const meta = SECTION_FIELDS[section.type];
  const [aiOpen, setAiOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiDone, setAiDone] = useState(false);

  const control = (f: FieldDef) => (
    <FieldControl
      key={f.key}
      field={f}
      value={section.props[f.key]}
      idPrefix={`f-${section.id}`}
      env={{ services, problems, problemKey: `${section.id}.${f.key}` }}
      onChange={(v, typing) => onProp(f.key, v, typing)}
    />
  );

  async function rewrite() {
    setBusy(true);
    setAiError(null);
    setAiDone(false);
    try {
      const r = await rewriteSectionAction({ pageId, section, instruction: instruction.trim() || undefined });
      if (r.ok) {
        onReplaceProps(r.data.section.props);
        setAiDone(true);
        setAiOpen(false);
        setInstruction("");
      } else setAiError(actionErrorText(r.error));
    } catch {
      setAiError("Couldn't reach the AI right now. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Button type="button" size="sm" variant="ghost" onClick={onBack} aria-label="Back to sections">
          <ArrowLeft aria-hidden />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-small font-semibold">{meta.label}</h2>
          <p className="truncate text-caption text-muted">{meta.description}</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {!section.visible ? <p className="rounded-md bg-warning/10 px-3 py-2 text-caption text-warning">This section is hidden on your site. Use the eye in the list to show it.</p> : null}
        {canWrite ? (
          <div className="rounded-lg border border-accent/25 bg-accent-soft/40 p-3">
            {aiOpen ? (
              <div className="space-y-2">
                <label htmlFor="ai-rewrite" className="block text-small font-medium">
                  How should AI rewrite it? <span className="font-normal text-muted">(optional)</span>
                </label>
                <textarea id="ai-rewrite" rows={2} maxLength={500} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="e.g. friendlier, shorter, mention free parking" className={inputClassName} />
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="accent" pending={busy} onClick={rewrite}>
                    <Sparkles aria-hidden /> Rewrite
                  </Button>
                  <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setAiOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="button" size="sm" variant="secondary" onClick={() => { setAiOpen(true); setAiDone(false); }}>
                <Sparkles aria-hidden /> Rewrite with AI
              </Button>
            )}
            <p className="mt-2 text-caption text-muted" aria-live="polite">
              {aiError ? <span className="text-error">{aiError}</span> : aiDone ? "Rewritten. Undo brings back the old text." : "Uses AI credits. Nothing is saved until you press Save."}
            </p>
          </div>
        ) : null}
        <fieldset disabled={!canWrite} className="space-y-5">
          <legend className="sr-only">{meta.label} settings</legend>
          {meta.fields.filter((f) => f.group !== "style").map(control)}
          <details className="group rounded-lg border border-border">
            <summary className="cursor-pointer list-none px-3 py-2.5 text-small font-semibold select-none [&::-webkit-details-marker]:hidden">Background, spacing &amp; alignment</summary>
            <div className="space-y-5 border-t border-border px-3 py-4">{meta.fields.filter((f) => f.group === "style").map(control)}</div>
          </details>
        </fieldset>
        {meta.manage ? (
          <Link
            href={meta.manage.href}
            onClick={(e) => {
              if (!onConfirmLeave()) e.preventDefault();
            }}
            className="inline-flex items-center gap-1.5 text-small font-medium text-accent hover:underline"
          >
            {meta.manage.label} <ExternalLink aria-hidden className="size-3.5" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
