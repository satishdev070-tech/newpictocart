import type { ReactNode } from "react";
import { isSectionHidden, type TemplateKey } from "@/features/theme/schema/config";
import type { SectionInstance } from "@/features/theme/sections/types";
import { CanvasSlot } from "@/features/theme/site-builder/canvas/canvas-slot";
import { EmptySlotInsert } from "@/features/theme/site-builder/canvas/empty-slot";
import { getList, listKeyOf } from "@/features/theme/site-builder/slots";
import { pageChromeClass, pageContentSettings } from "./page-content";
import { SectionList } from "./sections";
import { splitAtPageContent } from "./split";
import type { RenderContext } from "./context";

/**
 * Theme section runs as rendered by pages. On the live store these are plain SectionLists; in the
 * theme preview (signed preview cookie) each run is wrapped in a CanvasSlot so the site builder can
 * re-render it from an unsaved theme and outline its sections.
 */

export function ThemeSlot({ slot, sections, ctx, list }: { slot: string; sections: SectionInstance[]; ctx: RenderContext; list?: string }) {
  if (!ctx.sf.preview) return <SectionList sections={sections} ctx={ctx} />;
  return (
    <CanvasSlot slot={slot}>
      <SlotSections sections={sections} ctx={ctx} slot={list ?? slot} />
    </CanvasSlot>
  );
}

/**
 * Preview rendering of one slot's sections (also used by renderCanvasAction). `slot` is the value
 * the canvas reports for selections: the slot key, or the list it edits (e.g. pages.<id> for the
 * homepage). When the slot's whole LIST is empty, an "Add a section" placeholder keeps the canvas
 * editable (the part before a PageContent marker never shows it; header/footer never do).
 */
export function SlotSections({ sections, ctx, slot }: { sections: SectionInstance[]; ctx: RenderContext; slot: string }) {
  const key = listKeyOf(slot);
  const showEmpty = !!key && !key.startsWith("layout.") && !slot.endsWith(".before") && (getList(ctx.sf.theme, key)?.length ?? sections.length) === 0;
  if (showEmpty) {
    const label = key.startsWith("pages.") || key === "templates.home" ? "This page has no sections yet." : "No sections around this page's content yet.";
    return <EmptySlotInsert slot={key} label={label} />;
  }
  return <SectionList sections={sections} ctx={ctx} slot={slot} />;
}

/**
 * A page's own content placed inside a template: sections before the PageContent marker, the
 * content, then the sections after it (no marker = all after). Used by every store page that has a
 * site-builder template (collection, product, cart, search, account, blog, content pages…).
 *
 * The marker's `chrome` setting becomes CSS class hooks on the body wrapper (`sf-page-chrome-*`).
 */
export function TemplateFrame({ template, ctx, children }: { template: TemplateKey; ctx: RenderContext; children: ReactNode }) {
  const list = ctx.sf.theme.templates[template];
  const [before, after] = splitAtPageContent(list);
  const marker = list.find((s) => s.type === "PageContent");
  const { chrome, proseSize } = pageContentSettings(marker);
  // PageContent is a marker, not a rendered section — hide the page body the same way SectionList
  // skips fully-hidden sections.
  const body = (
    <div className={pageChromeClass(chrome, proseSize)} data-pc-chrome={chrome} data-pc-prose={proseSize}>
      {marker && isSectionHidden(marker) ? null : children}
    </div>
  );
  return (
    <>
      <ThemeSlot slot={`templates.${template}.before`} sections={before} ctx={ctx} />
      {ctx.sf.preview && marker ? (
        // Tag as `.chrome` (not `.before`) so section re-render busy shimmer never whites out the
        // live page body (login/cart/PDP) when only the before-slot sections refresh.
        <div className="contents" data-section-id={marker.id} data-builder-slot-item={`templates.${template}.chrome`} data-builder-page-content>
          {body}
        </div>
      ) : (
        body
      )}
      <ThemeSlot slot={`templates.${template}.after`} sections={after} ctx={ctx} />
    </>
  );
}

/** Wrap a manually-split template body (collection / product pages) with the same chrome hooks. */
export function PageChrome({ list, children }: { list: readonly SectionInstance[]; children: ReactNode }) {
  const { chrome, proseSize } = pageContentSettings(list.find((s) => s.type === "PageContent"));
  return (
    <div className={pageChromeClass(chrome, proseSize)} data-pc-chrome={chrome} data-pc-prose={proseSize}>
      {children}
    </div>
  );
}
