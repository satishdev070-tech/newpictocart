"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { STORE_SORTS, STORE_TYPE_LABEL, STORE_TYPES } from "../schemas";

const ctl = "h-9 rounded-md border border-border bg-surface px-3 text-small";
const TONE_KEYS = ["trial", "active", "suspended", "cancelled"] as const;
const SORT_LABEL: Record<(typeof STORE_SORTS)[number], string> = {
  newest: "Newest",
  oldest: "Oldest",
  revenue: "Revenue",
  orders: "Orders",
  products: "Products",
  activity: "Last activity",
};

type Props = {
  plans: { id: string; name: string }[];
  categories: { id: string; name: string }[] | null;
};

/** Live filters for Admin → Stores (debounced q; selects/dates push immediately). */
export function StoresListFilters({ plans, categories }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, start] = useTransition();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const typed = categories !== null;

  const setParam = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in patch)) next.delete("page");
    // Default sort omitted from the URL (same as server schema default).
    if (next.get("sort") === "newest") next.delete("sort");
    const qs = next.toString();
    start(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if ((sp.get("q") ?? "") !== q) setParam({ q });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on the search box only
  }, [q]);

  const filtered = Boolean(sp.get("q") || sp.get("status") || sp.get("plan") || sp.get("from") || sp.get("to") || (typed && (sp.get("type") || sp.get("category"))));

  return (
    <div className="mb-4 grid gap-2 sm:flex sm:flex-wrap sm:items-end" role="search">
      <div className="relative sm:min-w-72 sm:flex-1">
        <label className="sr-only" htmlFor="q">
          Search stores
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input id="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Store, owner email, domain or tenant ID" className={`${ctl} w-full pl-9`} />
      </div>
      <label className="sr-only" htmlFor="status">
        Status
      </label>
      <select id="status" value={sp.get("status") ?? ""} onChange={(e) => setParam({ status: e.target.value })} className={ctl}>
        <option value="">All statuses</option>
        {TONE_KEYS.map((s) => (
          <option key={s} value={s}>
            {s[0]!.toUpperCase() + s.slice(1)}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="plan">
        Plan
      </label>
      <select id="plan" value={sp.get("plan") ?? ""} onChange={(e) => setParam({ plan: e.target.value })} className={ctl}>
        <option value="">All plans</option>
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {typed ? (
        <>
          <label className="sr-only" htmlFor="type">
            Store type
          </label>
          <select id="type" value={sp.get("type") ?? ""} onChange={(e) => setParam({ type: e.target.value })} className={ctl}>
            <option value="">All types</option>
            {STORE_TYPES.map((s) => (
              <option key={s} value={s}>
                {STORE_TYPE_LABEL[s]}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="category">
            Category
          </label>
          <select id="category" value={sp.get("category") ?? ""} onChange={(e) => setParam({ category: e.target.value })} className={ctl}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </>
      ) : null}
      <label className="flex items-center gap-1 text-caption text-muted">
        From <input type="date" value={sp.get("from") ?? ""} onChange={(e) => setParam({ from: e.target.value })} className={ctl} />
      </label>
      <label className="flex items-center gap-1 text-caption text-muted">
        To <input type="date" value={sp.get("to") ?? ""} onChange={(e) => setParam({ to: e.target.value })} className={ctl} />
      </label>
      <label className="sr-only" htmlFor="sort">
        Sort
      </label>
      <select id="sort" value={sp.get("sort") ?? "newest"} onChange={(e) => setParam({ sort: e.target.value })} className={ctl}>
        {STORE_SORTS.map((s) => (
          <option key={s} value={s}>
            Sort: {SORT_LABEL[s]}
          </option>
        ))}
      </select>
      {filtered ? (
        <Link href="/admin/stores" className="text-small text-accent hover:underline">
          Clear
        </Link>
      ) : null}
    </div>
  );
}
