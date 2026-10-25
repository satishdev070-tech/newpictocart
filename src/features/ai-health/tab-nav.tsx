import Link from "next/link";

/** Link tabs driven by ?tab= (server-rendered; shared by AI health and Credits economy). */
export function TabNav<T extends string>({ base, tabs, active, label }: { base: string; tabs: readonly { key: T; label: string }[]; active: T; label: string }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2 text-small">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={`${base}?tab=${t.key}`}
          aria-current={t.key === active ? "page" : undefined}
          className={`rounded-md border px-3 py-1 ${t.key === active ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-foreground"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
