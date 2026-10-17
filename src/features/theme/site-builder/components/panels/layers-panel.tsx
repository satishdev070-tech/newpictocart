"use client";

import { Eye, EyeOff, GripVertical, MessageSquare, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { isSectionHidden } from "@/features/theme/schema/config";
import { SECTION_DEFINITIONS } from "@/features/theme/sections/definitions";
import type { SectionInstance } from "@/features/theme/sections/types";
import { useBuilder } from "../../context";
import { duplicateSection, moveSectionTo, removeSection, toggleHidden } from "../../ops";
import { getList, type ListKey } from "../../slots";
import { IconButton, MoreMenu, PanelFrame, Row, useReorder } from "../ui";

/**
 * Layers (site builder left panel): the current page's sections as a tree — Header, the page's
 * own list, Footer. Click to edit, eye to hide, drag to reorder within a group, ⋮ for duplicate /
 * delete. Popup pages show their popup instead.
 */

const SUMMARY_KEYS = ["heading", "title", "eyebrow", "text", "label", "message"] as const;

/** A short label for a section row: the first non-empty heading-like setting (or first slide's). */
export function sectionSummary(s: SectionInstance): string {
  const settings = s.settings as Record<string, unknown>;
  const pick = (o: Record<string, unknown>) => {
    for (const k of SUMMARY_KEYS) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
  };
  let out = pick(settings);
  if (!out) {
    for (const v of Object.values(settings)) {
      if (Array.isArray(v) && v[0] && typeof v[0] === "object") {
        out = pick(v[0] as Record<string, unknown>);
        if (out) break;
      }
    }
  }
  const plain = out.replace(/<[^>]*>/g, "").replace(/\s+/g, " ");
  return plain.length > 40 ? `${plain.slice(0, 39)}…` : plain;
}

export function LayersPanel() {
  const { config, page, setPanel } = useBuilder();

  if (page.popupId) {
    const popup = config.popups.find((p) => p.id === page.popupId);
    return (
      <PanelFrame title="Layers" subtitle={page.label} onClose={() => setPanel(null)}>
        {popup ? (
          <Row className="cursor-pointer" onClick={() => setPanel({ kind: "popup", popupId: popup.id })}>
            <MessageSquare className="size-4 text-muted" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{popup.name}</span>
              <span className="block truncate text-xs text-muted">{popup.enabled ? "Popup · on" : "Popup · off"}</span>
            </span>
            <span className="text-xs text-accent">Edit</span>
          </Row>
        ) : (
          <p className="text-small text-muted">This popup no longer exists.</p>
        )}
      </PanelFrame>
    );
  }

  const shared = page.list && page.list.startsWith("templates.") && page.list !== "templates.home";
  return (
    <PanelFrame title="Layers" subtitle={page.label} onClose={() => setPanel(null)}>
      <div className="space-y-4">
        <LayerGroup title="Header" list="layout.header" />
        {page.list ? <LayerGroup title={page.label} list={page.list} note={shared ? "This layout is shared by every page of this kind." : undefined} contentPlaceholder={!!shared} /> : null}
        <LayerGroup title="Footer" list="layout.footer" />
      </div>
    </PanelFrame>
  );
}

function LayerGroup({ title, list, note, contentPlaceholder }: { title: string; list: ListKey; note?: string; contentPlaceholder?: boolean }) {
  const { config, apply, selected, select, setPanel } = useBuilder();
  const sections = getList(config, list) ?? [];
  const reorder = useReorder((from, to) => {
    const s = sections[from];
    if (s) apply((c) => moveSectionTo(c, list, s.id, to));
  });
  const hasMarker = sections.some((s) => s.type === "PageContent");

  return (
    <section aria-label={title}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="truncate text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
        <button
          type="button"
          onClick={() => setPanel({ kind: "insert", list, anchorId: null, where: "after", ai: false })}
          className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-accent hover:bg-accent-soft"
        >
          <Plus className="size-3.5" /> Add section
        </button>
      </div>
      {note ? <p className="mb-1.5 text-xs text-muted">{note}</p> : null}
      <ul className="space-y-1">
        {contentPlaceholder && !hasMarker ? (
          <li>
            <Row className="border-dashed bg-transparent text-muted">
              <span className="flex-1 truncate text-xs">Page content (shown above these sections)</span>
            </Row>
          </li>
        ) : null}
        {sections.map((s, i) => {
          const def = SECTION_DEFINITIONS[s.type];
          const hidden = isSectionHidden(s);
          const marker = s.type === "PageContent";
          const active = selected?.list === list && selected.sectionId === s.id;
          const summary = marker ? "" : sectionSummary(s);
          const open = () => {
            const ref = { list, sectionId: s.id };
            select(ref);
            setPanel({ kind: "section", ref, tab: "edit" });
          };
          return (
            <li key={s.id} {...reorder.itemProps(i)}>
              <Row active={active} className={cn(hidden && "opacity-50", marker && "border-dashed")}>
                <span {...reorder.handleProps(i)}>
                  <GripVertical className="size-4" />
                </span>
                <button type="button" onClick={open} className="min-w-0 flex-1 text-left" aria-current={active || undefined}>
                  <span className={cn("block truncate font-medium", hidden && "line-through")}>{def?.label ?? s.type}</span>
                  {summary ? <span className="block truncate text-xs text-muted">{summary}</span> : null}
                </button>
                {marker ? null : (
                  <>
                    <IconButton label={hidden ? "Show section" : "Hide section"} onClick={() => apply((c) => toggleHidden(c, list, s.id))}>
                      {hidden ? <EyeOff /> : <Eye />}
                    </IconButton>
                    <MoreMenu
                      items={[
                        {
                          label: "Duplicate",
                          disabled: !!(def as { singleton?: boolean } | undefined)?.singleton,
                          onSelect: () => {
                            const r = duplicateSection(config, list, s.id);
                            if (!r.newId) return;
                            apply(r.config);
                            const ref = { list, sectionId: r.newId };
                            select(ref);
                          },
                        },
                        {
                          label: "Delete",
                          danger: true,
                          onSelect: () => {
                            apply((c) => removeSection(c, list, s.id));
                            if (active) {
                              select(null);
                              setPanel({ kind: "layers" });
                            }
                          },
                        },
                      ]}
                    />
                  </>
                )}
              </Row>
            </li>
          );
        })}
        {!sections.length && !contentPlaceholder ? <li className="rounded-lg border border-dashed border-border px-2.5 py-2 text-xs text-muted">No sections yet.</li> : null}
      </ul>
    </section>
  );
}
