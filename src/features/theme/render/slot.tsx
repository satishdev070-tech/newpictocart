import type { ReactNode } from "react";
import type { TemplateKey } from "@/features/theme/schema/config";
import type { SectionInstance } from "@/features/theme/sections/types";
import { CanvasSlot } from "@/features/theme/site-builder/canvas/canvas-slot";
import { SectionList } from "./sections";
import { splitAtPageContent } from "./split";
import type { RenderContext } from "./context";

/**
 * Theme section runs as rendered by pages. On the live store these are plain SectionLists; in the
 * theme preview (signed preview cookie) each run is wrapped in a CanvasSlot so the site builder can
 * re-render it from an unsaved theme and outline its sections.
 */

export function ThemeSlot({ slot, sections, ctx }: { slot: string; sections: SectionInstance[]; ctx: RenderContext }) {
  if (!ctx.sf.preview) return <SectionList sections={sections} ctx={ctx} />;
  return (
    <CanvasSlot slot={slot}>
      <SectionList sections={sections} ctx={ctx} slot={slot} />
    </CanvasSlot>
  );
}

/**
 * A page's own content placed inside a template: sections before the PageContent marker, the
 * content, then the sections after it (no marker = all after). Used by every store page that has a
 * site-builder template (collection, product, cart, search, account, blog, content pages…).
 */
export function TemplateFrame({ template, ctx, children }: { template: TemplateKey; ctx: RenderContext; children: ReactNode }) {
  const list = ctx.sf.theme.templates[template];
  const [before, after] = splitAtPageContent(list);
  const marker = list.find((s) => s.type === "PageContent");
  return (
    <>
      <ThemeSlot slot={`templates.${template}.before`} sections={before} ctx={ctx} />
      {ctx.sf.preview && marker ? (
        <div className="contents" data-section-id={marker.id} data-builder-slot-item={`templates.${template}.before`} data-builder-page-content>
          {children}
        </div>
      ) : (
        children
      )}
      <ThemeSlot slot={`templates.${template}.after`} sections={after} ctx={ctx} />
    </>
  );
}
