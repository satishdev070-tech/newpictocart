/**
 * Idle nav prefetch for the seller/admin shell. Warm only a small allowlist so slow networks
 * are not flooded with concurrent RSC flights (which previously caused ERR_TIMED_OUT storms).
 * Hover/focus of a submenu still warms that group's hrefs separately.
 */

export const HEAVY_SELLER_HREFS = [
  "/dashboard/products",
  "/dashboard/media",
  "/dashboard/marketing/neural-pulse",
  "/dashboard/orders",
] as const;

export const HEAVY_ADMIN_HREFS = [
  "/admin",
  "/admin/stores",
  "/admin/tenants",
  "/admin/users",
  "/admin/themes",
] as const;

export type PrefetchPanel = "seller" | "admin";

/** Href list for idle warm — allowlisted heavy routes only (deduped, stable order). */
export function idlePrefetchHrefs(panel: PrefetchPanel): string[] {
  const list = panel === "admin" ? HEAVY_ADMIN_HREFS : HEAVY_SELLER_HREFS;
  return [...new Set(list)];
}

/** True when the browser should skip background prefetch (hidden tab, data saver, or offline). */
export function shouldSkipIdlePrefetch(env: {
  hidden?: boolean;
  saveData?: boolean;
  onLine?: boolean;
}): boolean {
  if (env.hidden) return true;
  if (env.saveData) return true;
  if (env.onLine === false) return true;
  return false;
}

/**
 * Run `prefetch` over hrefs with limited concurrency so we don't open dozens of RSC
 * requests at once. Stops early when `isCancelled` returns true.
 */
export async function runPrefetchQueue(
  hrefs: readonly string[],
  prefetch: (href: string) => void | Promise<void>,
  opts: { concurrency?: number; isCancelled?: () => boolean } = {},
): Promise<void> {
  const concurrency = Math.max(1, opts.concurrency ?? 2);
  const queue = [...hrefs];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (;;) {
      if (opts.isCancelled?.()) return;
      const href = queue.shift();
      if (!href) return;
      await prefetch(href);
    }
  });
  await Promise.all(workers);
}
