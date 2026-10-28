import type { Messages } from "@/lib/i18n/messages/en";
import type { NavGroup } from "./nav";

/**
 * Nav groups in the seller's language. Each group keeps its English label as `id` (stable DOM ids
 * and remembered open state) and each item keeps it as `alt`, so search still finds "Orders" in Hindi.
 * Item translations are keyed by English label (not href) so Sales aliases can share a page.
 */
export function localizeNav<G extends NavGroup>(groups: G[], nav: Messages["nav"]): (G & { id: string })[] {
  const groupLabels: Record<string, string> = nav.groups;
  const itemLabels: Record<string, string> = nav.items;
  return groups.map((g) => ({
    ...g,
    id: g.id ?? g.label,
    label: groupLabels[g.label] ?? g.label,
    items: g.items.map((i) => ({ ...i, alt: i.label, label: itemLabels[i.label] ?? i.label })),
  }));
}
