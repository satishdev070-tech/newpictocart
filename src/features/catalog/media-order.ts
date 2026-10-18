/**
 * Product image ordering (pure). The image with the lowest position is the MAIN image: the
 * product-card thumbnail, the first gallery image and the og:image. Ties (rows inserted by two
 * concurrent requests) are broken by storage path, which every surface selects, so the dashboard,
 * product cards and the product page agree on which image is main.
 */

export type Positioned = { position: number; storage_path?: string; storagePath?: string; id?: string };

const pathOf = (m: Positioned) => m.storage_path ?? m.storagePath ?? m.id ?? "";

export function sortByPosition<T extends Positioned>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.position - b.position || pathOf(a).localeCompare(pathOf(b)));
}

export function mainImage<T extends Positioned>(items: readonly T[]): T | undefined {
  return sortByPosition(items)[0];
}

/** Moves `id` to the front (makes it the main image). Unknown ids leave the order unchanged. */
export function moveToFront(ids: readonly string[], id: string): string[] {
  const i = ids.indexOf(id);
  if (i <= 0) return [...ids];
  return [id, ...ids.slice(0, i), ...ids.slice(i + 1)];
}

/** Swaps the item at `index` with its neighbour (`dir` -1 = earlier, 1 = later). */
export function moveBy(ids: readonly string[], index: number, dir: -1 | 1): string[] {
  const j = index + dir;
  const next = [...ids];
  if (index < 0 || index >= ids.length || j < 0 || j >= ids.length) return next;
  [next[index], next[j]] = [next[j]!, next[index]!];
  return next;
}
