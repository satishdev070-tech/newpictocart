import type { ThemeConfig } from "@/features/theme/schema/config";

/**
 * Resolve the Footer section for Theme settings → Footer.
 * Prefers `type === "Footer"` in `layout.footer`; falls back to the first item.
 * Same list path Layers / canvas use (`layout.footer`).
 */
export type FooterSectionRef = { list: "layout.footer"; sectionId: string };

export function resolveFooterSectionRef(config: Pick<ThemeConfig, "layout">): FooterSectionRef | null {
  const list = config.layout.footer;
  if (!list.length) return null;
  const section = list.find((s) => s.type === "Footer") ?? list[0];
  if (!section) return null;
  return { list: "layout.footer", sectionId: section.id };
}
