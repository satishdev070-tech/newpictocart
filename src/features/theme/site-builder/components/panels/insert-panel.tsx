"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Search, Sparkles } from "lucide-react";
import { SECTION_DEFINITIONS } from "@/features/theme/sections/definitions";
import type { EditorField, SectionDefinition, SectionType } from "@/features/theme/sections/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { generateSectionAction } from "../../ai-actions";
import { useBuilder } from "../../context";
import { addableTypes, insertSection } from "../../ops";
import { DIAGRAMS, VariantDiagram } from "../fields";
import { PanelFrame, input } from "../ui";

/**
 * "+" picker: add a section to a list before/after an anchor. Two tabs: a searchable grid of the
 * sections allowed here, and "Add with AI" (a prompt → generateSectionAction → inserted section).
 * After inserting, the new section is selected and its section panel opens.
 */

type Box = [number, number, number, number, ("img" | "t")?];

/** Wireframes for sections without layout variants (decorative). */
const TYPE_DIAGRAMS: Partial<Record<SectionType, Box[]>> = {
  AnnouncementBar: [[0, 9, 40, 6], [12, 11, 16, 2, "t"]],
  MegaMenu: [[0, 2, 40, 4], [2, 3, 6, 2, "t"], [10, 3, 6, 2, "t"], [3, 8, 34, 14]],
  PromoBanner: [[1, 3, 12, 18], [14, 3, 12, 18], [27, 3, 12, 18]],
  ProductCarousel: DIAGRAMS.rail,
  SaleBanner: [[0, 2, 40, 20], [10, 8, 20, 3, "t"], [14, 14, 12, 3, "t"]],
  VideoBanner: [[0, 0, 40, 24], [17, 9, 6, 6], [8, 18, 24, 2, "t"]],
  Lookbook: DIAGRAMS.lookbook,
  Reviews: DIAGRAMS.cards,
  SocialProof: [[1, 6, 7, 7], [9, 6, 7, 7], [17, 6, 7, 7], [25, 6, 7, 7], [33, 6, 7, 7], [12, 2, 16, 2, "t"]],
  FAQ: [[4, 3, 32, 3, "t"], [4, 9, 32, 3, "t"], [4, 15, 32, 3, "t"]],
  Marquee: [[-2, 10, 12, 4, "t"], [12, 10, 12, 4, "t"], [26, 10, 14, 4, "t"]],
  BrandStrip: [[2, 9, 6, 6], [11, 9, 6, 6], [20, 9, 6, 6], [29, 9, 6, 6]],
  VideoShop: [[2, 3, 8, 18], [12, 3, 8, 18], [22, 3, 8, 18], [32, 3, 8, 18]],
  ProductSpotlight: [[1, 2, 20, 20], [24, 6, 14, 3, "t"], [24, 12, 10, 2, "t"], [24, 17, 12, 4]],
  CompactProducts: DIAGRAMS.list,
  FeatureBand: [[1, 2, 16, 20], [19, 4, 9, 9], [30, 4, 9, 9], [19, 15, 9, 2, "t"], [30, 15, 9, 2, "t"]],
  DecorDivider: [[2, 11, 14, 1], [18, 9, 4, 5], [24, 11, 14, 1]],
};

function diagramFor(def: SectionDefinition): Box[] | undefined {
  const own = TYPE_DIAGRAMS[def.type];
  if (own) return own;
  const variant = def.fields.find((f): f is Extract<EditorField, { kind: "select" }> => f.kind === "select" && f.display === "variants");
  const first = variant?.options[0]?.value;
  return first ? DIAGRAMS[first] : DIAGRAMS.default;
}

const AI_EXAMPLE = "e.g. a testimonials section with 3 reviews about handmade sarees";

export function InsertPanel() {
  const b = useBuilder();
  const latest = useRef(b);
  useEffect(() => {
    latest.current = b;
  });
  const [q, setQ] = useState("");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [generating, startGenerate] = useTransition();

  const panel = b.panel;
  if (panel?.kind !== "insert") return null;
  const { list, anchorId, where, ai } = panel;

  const types = addableTypes(b.config, list);
  const needle = q.trim().toLowerCase();
  const shown = types
    .map((t) => SECTION_DEFINITIONS[t] as SectionDefinition)
    .filter((d) => !needle || d.label.toLowerCase().includes(needle) || d.description.toLowerCase().includes(needle) || d.type.toLowerCase().includes(needle));

  /** Insert into the LATEST document (the AI call is async) and open the new section. */
  const insert = (type: SectionType, settings?: Record<string, unknown>): boolean => {
    const api = latest.current;
    const r = insertSection(api.config, list, type, anchorId, where, settings);
    if (!r.newId) return false;
    api.apply(r.config);
    const ref = { list, sectionId: r.newId };
    api.select(ref);
    api.setPanel({ kind: "section", ref, tab: "edit" });
    return true;
  };

  const setTab = (aiTab: boolean) => b.setPanel({ kind: "insert", list, anchorId, where, ai: aiTab });

  const generate = () => {
    setError(null);
    startGenerate(async () => {
      const r = await generateSectionAction({ prompt, list, storeContext: { pageTitle: latest.current.page.label } });
      if (!r.ok) {
        setError(r.error.fieldErrors?._form?.[0] ?? r.error.fieldErrors?.prompt?.[0] ?? r.error.message);
        return;
      }
      if (!insert(r.data.type, r.data.settings)) setError(`A ${SECTION_DEFINITIONS[r.data.type].label.toLowerCase()} section can't be added here (the page may be full, or it allows only one). Try another description.`);
    });
  };

  return (
    <PanelFrame title="Add section" subtitle={!anchorId ? (where === "before" ? "Added at the top" : "Added at the end") : where === "before" ? "Added above the selected section" : "Added below the selected section"} onClose={() => b.setPanel(null)}>
      <div role="tablist" aria-label="Add section" className="sticky -top-3 z-10 -mx-3 -mt-3 mb-3 flex gap-1 border-b border-border bg-surface px-2 pt-1.5">
        {(
          [
            [false, "Sections"],
            [true, "Add with AI"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={ai === v}
            onClick={() => setTab(v)}
            className={cn("inline-flex items-center gap-1 border-b-2 px-2 py-1.5 text-xs font-medium transition", ai === v ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground")}
          >
            {v ? <Sparkles className="size-3.5" aria-hidden /> : null}
            {label}
          </button>
        ))}
      </div>

      {!ai ? (
        <div role="tabpanel" className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input type="search" aria-label="Search sections" placeholder="Search sections" value={q} onChange={(e) => setQ(e.target.value)} className={cn(input, "pl-8")} />
          </div>
          {!types.length ? (
            <p className="text-small text-muted">No more sections can be added here.</p>
          ) : shown.length ? (
            <ul className="grid grid-cols-2 gap-2">
              {shown.map((d) => (
                <li key={d.type}>
                  <button type="button" onClick={() => insert(d.type)} className="flex h-full w-full flex-col rounded-lg border border-border bg-surface p-2 text-left transition hover:border-accent hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
                    <VariantDiagram boxes={diagramFor(d)} className="h-12" />
                    <span className="mt-1.5 text-xs font-semibold">{d.label}</span>
                    <span className="line-clamp-2 text-[11px] leading-snug text-muted">{d.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-small text-muted">No sections match “{q}”.</p>
          )}
        </div>
      ) : (
        <div role="tabpanel" className="space-y-3">
          <p className="text-small text-muted">Describe the section you want. AI picks the best section and writes its text for your store; add your own photos afterwards.</p>
          <label htmlFor="sb-ai-prompt" className="block text-xs font-medium">
            What should it show?
          </label>
          <textarea
            id="sb-ai-prompt"
            rows={4}
            maxLength={500}
            className={input}
            placeholder={AI_EXAMPLE}
            value={prompt}
            disabled={!b.aiEnabled || generating}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && prompt.trim().length >= 3) generate();
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted">{prompt.length}/500</span>
            <Button size="sm" variant="accent" onClick={generate} pending={generating} disabled={!b.aiEnabled || prompt.trim().length < 3}>
              <Sparkles aria-hidden /> {generating ? "Writing…" : "Generate section"}
            </Button>
          </div>
          {!b.aiEnabled ? <p className="rounded-lg bg-surface-secondary p-2.5 text-xs text-muted">AI isn&apos;t set up yet. A platform admin needs to add a Gemini, Groq or Anthropic API key. You can still add sections from the Sections tab.</p> : null}
          {error ? (
            <p role="alert" className="text-xs text-error">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </PanelFrame>
  );
}
