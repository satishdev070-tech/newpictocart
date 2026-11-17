"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClassName } from "@/components/ui/field";
import type { PageSection, SectionType } from "../../sections";
import { generateSectionAction } from "../../editor-ai/actions";
import { EDITOR_SECTION_TYPES, SECTION_FIELDS } from "../fields";
import { actionErrorText } from "./util";

/** Native modal <dialog> (focus trap, Escape and backdrop handled by the browser). */
function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={`m-auto max-h-[90dvh] w-[calc(100%-2rem)] overflow-hidden rounded-xl border border-border bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/40 ${wide ? "max-w-3xl" : "max-w-lg"}`}
    >
      {open ? (
        <div className="flex max-h-[90dvh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
            <h2 className="text-body font-semibold">{title}</h2>
            <Button type="button" size="sm" variant="ghost" aria-label="Close" onClick={onClose}>
              <X aria-hidden />
            </Button>
          </div>
          <div className="min-h-0 overflow-y-auto p-5">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}

const bar = (x: number, y: number, w: number, h = 4, o = 1) => <rect key={`${x}-${y}-${w}`} x={x} y={y} width={w} height={h} rx={1.5} opacity={o} />;

/** Small wireframe of each section type for the library. */
function Schematic({ type }: { type: SectionType }) {
  let body: ReactNode;
  switch (type) {
    case "hero":
      body = [bar(8, 14, 44, 7), bar(8, 26, 34, 3, 0.5), bar(8, 36, 16, 6), <rect key="i" x={62} y={8} width={50} height={40} rx={3} opacity={0.35} />];
      break;
    case "about":
      body = [bar(8, 10, 30, 5), bar(8, 20, 46, 3, 0.5), bar(8, 26, 46, 3, 0.5), bar(8, 32, 38, 3, 0.5), <rect key="i" x={66} y={8} width={46} height={40} rx={3} opacity={0.35} />];
      break;
    case "services_grid":
    case "team":
      body = [bar(8, 6, 36, 5), ...[8, 44, 80].map((x) => <rect key={x} x={x} y={16} width={32} height={34} rx={3} opacity={0.35} />)];
      break;
    case "services_list":
    case "pricing":
      body =
        type === "pricing"
          ? [bar(42, 6, 36, 5), ...[8, 44, 80].map((x) => <rect key={x} x={x} y={16} width={32} height={34} rx={3} opacity={x === 44 ? 0.6 : 0.3} />)]
          : [bar(8, 6, 36, 5), ...[18, 28, 38, 48].map((y) => [bar(8, y, 60, 3, 0.6), bar(96, y, 16, 3)]).flat()];
      break;
    case "highlights":
      body = [bar(8, 6, 40, 5), ...[8, 44, 80].map((x) => [<rect key={`c${x}`} x={x} y={16} width={32} height={34} rx={3} opacity={0.2} />, bar(x + 4, 22, 10, 2), bar(x + 4, 30, 22, 3, 0.6)]).flat()];
      break;
    case "stats":
      body = [8, 44, 80].map((x) => [bar(x + 6, 18, 20, 9), bar(x + 4, 32, 24, 3, 0.5)]).flat();
      break;
    case "gallery":
      body = [0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={8 + (i % 3) * 36} y={8 + Math.floor(i / 3) * 22} width={32} height={18} rx={2} opacity={0.35} />);
      break;
    case "testimonials":
      body = [bar(30, 12, 60, 4), bar(22, 20, 76, 4), bar(40, 28, 40, 4), bar(48, 40, 24, 3, 0.5)];
      break;
    case "faq":
      body = [bar(8, 6, 36, 5), ...[16, 26, 36, 46].map((y) => [bar(8, y, 90, 3, 0.6), bar(106, y, 6, 3)]).flat()];
      break;
    case "cta":
      body = [<rect key="b" x={4} y={12} width={112} height={32} rx={4} opacity={0.3} />, bar(12, 20, 44, 5), bar(12, 30, 56, 3, 0.6), bar(86, 23, 24, 9)];
      break;
    case "contact":
      body = [bar(8, 6, 36, 5), ...[8, 36, 64, 92].map((x) => <rect key={x} x={x} y={18} width={24} height={30} rx={3} opacity={0.3} />)];
      break;
    case "enquiry_form":
      body = [bar(8, 6, 40, 5), <rect key="a" x={8} y={16} width={50} height={8} rx={2} opacity={0.3} />, <rect key="b" x={62} y={16} width={50} height={8} rx={2} opacity={0.3} />, <rect key="c" x={8} y={28} width={104} height={12} rx={2} opacity={0.3} />, bar(8, 44, 22, 7)];
      break;
    case "rich_text":
      body = [bar(8, 8, 50, 6), ...[20, 26, 32, 38, 44].map((y, i) => bar(8, y, i === 4 ? 60 : 100, 3, 0.5))];
      break;
  }
  return (
    <svg aria-hidden viewBox="0 0 120 56" className="h-auto w-full rounded-md bg-surface-secondary text-accent" fill="currentColor">
      {body}
    </svg>
  );
}

/** "+ Add section": every section type with a wireframe and a short description. */
export function SectionLibraryDialog({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (type: SectionType) => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Add a section" wide>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {EDITOR_SECTION_TYPES.map((t) => {
          const meta = SECTION_FIELDS[t];
          return (
            <li key={t}>
              <button
                type="button"
                onClick={() => onPick(t)}
                className="flex h-full w-full flex-col gap-2 rounded-lg border border-border p-2.5 text-left transition-colors hover:border-accent hover:bg-accent-soft/30 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <Schematic type={t} />
                <span className="text-small font-semibold">{meta.label}</span>
                <span className="text-caption text-muted">{meta.description}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

/** "✦ Add with AI": the seller describes the section; AI returns one, inserted unsaved. */
export function AddWithAiDialog({ open, onClose, pageId, onSection }: { open: boolean; onClose: () => void; pageId: string; onSection: (s: PageSection) => void }) {
  const [instruction, setInstruction] = useState("");
  const [type, setType] = useState<SectionType | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (instruction.trim().length < 3) {
      setError("Describe the section in a few words.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await generateSectionAction({ pageId, type: type || undefined, instruction: instruction.trim() });
      if (r.ok) {
        onSection(r.data.section);
        setInstruction("");
        setType("");
        onClose();
      } else setError(actionErrorText(r.error));
    } catch {
      setError("Couldn't reach the AI right now. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="Add a section with AI">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div>
          <label htmlFor="ai-add-what" className="mb-1.5 block text-small font-medium">
            What should the section say?
          </label>
          <textarea
            id="ai-add-what"
            rows={4}
            maxLength={600}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g. Why families trust our clinic: 15 years, gentle care, evening slots"
            className={inputClassName}
            aria-describedby="ai-add-hint"
          />
        </div>
        <div>
          <label htmlFor="ai-add-type" className="mb-1.5 block text-small font-medium">
            Section type
          </label>
          <select id="ai-add-type" value={type} onChange={(e) => setType(e.target.value as SectionType | "")} className={inputClassName}>
            <option value="">Let AI choose</option>
            {EDITOR_SECTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {SECTION_FIELDS[t].label}
              </option>
            ))}
          </select>
        </div>
        <p id="ai-add-hint" className="text-caption text-muted" aria-live="polite">
          {error ? <span className="text-error">{error}</span> : "Uses AI credits. The new section is added after the selected one; nothing is saved until you press Save."}
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" pending={busy}>
            <Sparkles aria-hidden /> Create section
          </Button>
        </div>
      </form>
    </Modal>
  );
}
