"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, LayoutList, Search } from "lucide-react";
import { USER_TYPE_LABEL, USER_TYPES } from "./schemas";

const ctl = "h-9 rounded-md border border-border bg-surface px-3 text-small";

type Props = { stores: { id: string; name: string }[] };

/** Live filters for Admin → Users (debounced q; selects push immediately). */
export function UsersDirectoryFilters({ stores }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, start] = useTransition();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const type = sp.get("type") ?? "";
  const store = sp.get("store") ?? "";
  const view = sp.get("view") === "grid" ? "grid" : "list";

  const setParam = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in patch)) next.delete("page");
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

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: sp.get("q") || undefined, type: type || undefined, store: store || undefined, view: view === "grid" ? "grid" : undefined, ...patch })) {
      if (v) p.set(k, v);
    }
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-end" role="search">
      <div className="relative sm:min-w-72 sm:flex-1">
        <label className="sr-only" htmlFor="q">
          Search users
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input id="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, phone, store or theme" className={`${ctl} w-full pl-9`} />
      </div>
      <label className="sr-only" htmlFor="type">
        Type
      </label>
      <select id="type" value={type} onChange={(e) => setParam({ type: e.target.value })} className={ctl}>
        <option value="">All types</option>
        {USER_TYPES.map((t) => (
          <option key={t} value={t}>
            {USER_TYPE_LABEL[t]}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="store">
        Store
      </label>
      <select id="store" value={store} onChange={(e) => setParam({ store: e.target.value })} className={`${ctl} max-w-60`}>
        <option value="">All stores</option>
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <div className="ml-auto flex gap-1" aria-label="View">
        <Link href={qs({ view: undefined })} aria-label="List view" aria-current={view === "list" ? "true" : undefined} className="rounded-md p-2 text-muted hover:bg-surface-secondary aria-[current]:bg-surface-secondary aria-[current]:text-foreground">
          <LayoutList className="size-4" aria-hidden />
        </Link>
        <Link href={qs({ view: "grid" })} aria-label="Grid view" aria-current={view === "grid" ? "true" : undefined} className="rounded-md p-2 text-muted hover:bg-surface-secondary aria-[current]:bg-surface-secondary aria-[current]:text-foreground">
          <LayoutGrid className="size-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
