import Link from "next/link";
import type { ReactNode } from "react";
import { IndianRupee, Package, Receipt, ShoppingBag, Users } from "lucide-react";
import { Card, StatCard, type StatTone } from "@/components/ui/layout";
import { formatMoney } from "@/lib/money";
import type { HomeKpis, SetupStep } from "@/features/analytics/home";

const KPI_ICON = { strokeWidth: 1.75, "aria-hidden": true } as const;

function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted">No prior data</span>;
  const tone = value > 0 ? "bg-success/10 text-success" : value < 0 ? "bg-error/10 text-error" : "bg-surface-secondary text-muted";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 tabular-nums ${tone}`}>
      {value > 0 ? "▲ " : value < 0 ? "▼ " : ""}
      {Math.abs(value)}%<span className="sr-only"> vs previous 30 days</span>
    </span>
  );
}

export function HomeKpiStrip({ kpis, customers, products, allProducts }: { kpis: HomeKpis | null; customers: number | null; products: number; allProducts: number }) {
  const items: { label: string; value: string; tone: StatTone; icon: ReactNode; hint?: ReactNode; trend?: ReactNode }[] = [];
  if (kpis) {
    items.push({ label: "Revenue", value: formatMoney(kpis.revenueMinor), tone: "mint", icon: <IndianRupee {...KPI_ICON} />, trend: <Change value={kpis.revenueChange} />, hint: "Last 30 days" });
    items.push({ label: "Orders", value: String(kpis.orders), tone: "lavender", icon: <ShoppingBag {...KPI_ICON} />, trend: <Change value={kpis.ordersChange} />, hint: "Last 30 days" });
    items.push({ label: "Average order", value: kpis.orders ? formatMoney(kpis.aovMinor) : "—", tone: "peach", icon: <Receipt {...KPI_ICON} />, hint: "Per order, last 30 days" });
  }
  if (customers !== null) items.push({ label: "Customers", value: String(customers), tone: "sky", icon: <Users {...KPI_ICON} />, hint: "All time" });
  items.push({
    label: "Products",
    value: String(allProducts),
    tone: "rose",
    icon: <Package {...KPI_ICON} />,
    hint: (
      <Link href="/dashboard/products" className="hover:text-foreground hover:underline">
        {products} live{allProducts > products ? ` · ${allProducts - products} draft` : ""} · View all
      </Link>
    ),
  });
  return (
    <section aria-label="Key numbers" data-tour="kpis" className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {items.map((i) => (
        <StatCard key={i.label} tone={i.tone} icon={i.icon} label={i.label} value={i.value} hint={i.hint} trend={i.trend} />
      ))}
    </section>
  );
}

export function HomeSetupChecklist({ steps }: { steps: SetupStep[] }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  return (
    <Card tour="setup" title="Get your store ready" description={`${done} of ${steps.length} done`}>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-border/60" aria-hidden>
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="divide-y divide-border">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <span className="flex items-center gap-3">
              <span aria-hidden className={`grid size-5 place-items-center rounded-full border text-[11px] ${s.done ? "border-success bg-success text-background" : "border-border"}`}>
                {s.done ? "✓" : ""}
              </span>
              <span className={s.done ? "text-muted line-through" : ""}>{s.label}</span>
              <span className="sr-only">{s.done ? "(done)" : "(to do)"}</span>
            </span>
            {s.done ? null : (
              <Link href={s.href} className="shrink-0 font-medium text-accent hover:underline">
                Start
              </Link>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}
