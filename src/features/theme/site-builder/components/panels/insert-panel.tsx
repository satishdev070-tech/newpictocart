"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { LayoutGrid, Search, SearchX, Sparkles, Wand2 } from "lucide-react";
import { SECTION_DEFINITIONS } from "@/features/theme/sections/definitions";
import type { EditorField, SectionDefinition, SectionType } from "@/features/theme/sections/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { generateSectionAction } from "../../ai-actions";
import { useBuilder } from "../../context";
import { addableTypes, insertSection } from "../../ops";
import { DIAGRAMS, VariantDiagram } from "../fields";
import { DIAGRAMS_A } from "../../variant-diagrams-a";
import { DIAGRAMS_B } from "../../variant-diagrams-b";
import { DIAGRAMS_PAGES } from "../../variant-diagrams-pages";
import { EmptyState, PanelFrame, input } from "../ui";

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
  // New variant values have their wireframes in the variant-diagrams-* files.
  return (first ? (DIAGRAMS[first] ?? DIAGRAMS_A[first] ?? DIAGRAMS_B[first] ?? DIAGRAMS_PAGES[first]) : undefined) ?? DIAGRAMS.default;
}

const AI_EXAMPLE = "e.g. a testimonials section with 3 reviews about handmade sarees";
/** One-click prompt ideas for the AI tab. */
const AI_IDEAS = ["Festive sale banner for Diwali", "FAQ about shipping and returns", "Why shop with us: 3 trust points", "Customer reviews for handmade jewellery"];

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
      try {
        const r = await generateSectionAction({ prompt, list, storeContext: { pageTitle: latest.current.page.label } });
        if (!r.ok) {
          setError(r.error.fieldErrors?._form?.[0] ?? r.error.fieldErrors?.prompt?.[0] ?? r.error.message);
          return;
        }
        if (!insert(r.data.type, r.data.settings)) setError(`A ${SECTION_DEFINITIONS[r.data.type].label.toLowerCase()} section can't be added here (the page may be full, or it allows only one). Try another description.`);
      } catch {
        setError("Could not generate a section. Check your connection and try again.");
      }
    });
  };

  return (
    <PanelFrame title="Add section" subtitle={!anchorId ? (where === "before" ? "Added at the top" : "Added at the end") : where === "before" ? "Added above the selected section" : "Added below the selected section"} onClose={() => b.setPanel(null)}>
      <div className="sticky -top-3 z-10 -mx-3 -mt-3 mb-4 border-b border-border bg-surface/95 px-3 py-2 backdrop-blur">
        <div role="tablist" aria-label="Add section" className="flex gap-0.5 rounded-xl bg-surface-secondary p-1">
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
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                ai === v ? "bg-surface text-accent shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-muted hover:text-foreground",
              )}
            >
              {v ? <Sparkles className="size-3.5" aria-hidden /> : <LayoutGrid className="size-3.5" aria-hidden />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {!ai ? (
        <div role="tabpanel" className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input type="search" aria-label="Search sections" placeholder="Search sections" value={q} onChange={(e) => setQ(e.target.value)} className={cn(input, "pl-8")} />
          </div>
          {!types.length ? (
            <EmptyState icon={<LayoutGrid />} title="This area is full">No more sections can be added here. Remove one, or add sections to another part of the page.</EmptyState>
          ) : shown.length ? (
            <ul className="grid grid-cols-2 gap-2">
              {shown.map((d) => (
                <li key={d.type}>
                  <button
                    type="button"
                    onClick={() => insert(d.type)}
                    className="group flex h-full w-full flex-col rounded-xl border border-border bg-surface p-2 text-left transition-[border-color,box-shadow,background-color] hover:border-accent/60 hover:bg-accent-soft/60 hover:shadow-[0_4px_14px_-6px_rgba(249,115,22,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    <span className="block overflow-hidden rounded-lg bg-surface-secondary p-1 transition-colors group-hover:bg-surface">
                      <VariantDiagram boxes={diagramFor(d)} className="h-12" />
                    </span>
                    <span className="mt-2 text-xs font-semibold group-hover:text-accent">{d.label}</span>
                    <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted">{d.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<SearchX />}
              title={`No sections match “${q}”`}
              action={
                <button type="button" onClick={() => setQ("")} className="text-xs font-semibold text-accent hover:underline">
                  Clear search
                </button>
              }
            />
          )}
        </div>
      ) : (
        <div role="tabpanel" className="space-y-4">
          {/* Gradient header card */}
          <div className="relative overflow-hidden rounded-xl border border-accent/20 bg-gradient-to-br from-accent-soft via-surface to-surface p-3.5">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#f97316] via-[#ec4899] to-[#8b5cf6] text-white shadow-[0_4px_12px_-4px_rgba(236,72,153,0.6)] [&_svg]:size-4">
                <Wand2 aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-small font-semibold">Add a section with AI</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">Describe what you want. AI picks the best section and writes its text for your store; add your own photos afterwards.</p>
              </div>
            </div>
          </div>

          {b.aiEnabled ? (
            <>
              <div className="space-y-1.5">
                <label htmlFor="sb-ai-prompt" className="block text-xs font-medium">
                  What should it show?
                </label>
                {/* Gradient ring around the prompt */}
                <div className="rounded-xl bg-gradient-to-r from-[#f97316] via-[#ec4899] to-[#8b5cf6] p-[1.5px] shadow-[0_4px_14px_-8px_rgba(236,72,153,0.55)]">
                  <textarea
                    id="sb-ai-prompt"
                    rows={4}
                    maxLength={500}
                    className={cn(input, "resize-none rounded-[10px] border-0 shadow-none focus:ring-0")}
                    placeholder={AI_EXAMPLE}
                    value={prompt}
                    disabled={generating}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && prompt.trim().length >= 3) generate();
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span>Ctrl / ⌘ + Enter to generate</span>
                  <span>{prompt.length}/500</span>
                </div>
              </div>
              {!prompt.trim() ? (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Try an idea</p>
                  <div className="flex flex-wrap gap-1.5">
                    {AI_IDEAS.map((idea) => (
                      <button
                        key={idea}
                        type="button"
                        onClick={() => setPrompt(idea)}
                        className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-accent/50 hover:bg-accent-soft hover:text-accent"
                      >
                        {idea}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <Button variant="accent" size="lg" className="w-full" onClick={generate} pending={generating} disabled={prompt.trim().length < 3}>
                {generating ? null : <Sparkles aria-hidden />} {generating ? "Writing your section…" : "Generate section"}
              </Button>
              {error ? (
                <p role="alert" className="rounded-lg border border-error/30 bg-error/5 p-2.5 text-xs text-error">
                  {error}
                </p>
              ) : null}
            </>
          ) : (
            <EmptyState
              icon={<Sparkles />}
              title="Coming soon"
              action={
                <button type="button" onClick={() => setTab(false)} className="text-xs font-semibold text-accent hover:underline">
                  Browse sections instead
                </button>
              }
            >
              AI section writing isn&apos;t switched on for your store yet. Meanwhile, pick a ready-made section from the Sections tab.
            </EmptyState>
          )}
        </div>
      )}
    </PanelFrame>
  );
}
