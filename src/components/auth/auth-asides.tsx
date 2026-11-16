import { Boxes, Flag, Globe2, LayoutDashboard, LineChart, LockKeyhole, Palette, ShieldCheck, Store } from "lucide-react";
import { BrandLogo } from "@/features/marketing-site/components/brand-logo";

const MERCHANT_POINTS = [
  { icon: Palette, title: "Themes for your kind of business", body: "Pick a design, change colours and sections, and preview before you publish." },
  { icon: Boxes, title: "Products, orders and stock", body: "Variants, inventory, orders, returns and GST invoices in one dashboard." },
  { icon: LineChart, title: "Payments and shipping", body: "Your own Razorpay, Cashfree or PayU account, cash on delivery, and shipping rules." },
  { icon: Globe2, title: "Your own web address", body: "A free store address from day one; connect your own domain on eligible plans." },
];

/**
 * Left panel for merchant sign-in / sign-up (Pictocart brand, dark marketing look). Value statements only — no
 * marketplace catalogue or live theme preview (those packages are heavy on cold /login).
 */
export function MerchantAside({ mode }: { mode: "login" | "register" }) {
  return (
    <>
      <BrandLogo tone="light" />
      <div className="max-w-xl">
        <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-mk-line-strong bg-white/[0.03] px-3 py-1 font-mk-mono text-[11px] font-medium uppercase tracking-[0.16em] text-mk-muted">
          <span aria-hidden className="size-1.5 rounded-full bg-mk-accent" />
          Built for independent businesses
        </p>
        <h2 className="font-brand text-[clamp(2.25rem,3.4vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.025em] text-mk-text">
          {mode === "register" ? (
            <>
              Your brand. Your store. <span className="text-mk-accent">Your next big beginning.</span>
            </>
          ) : (
            <>
              Welcome back to <span className="text-mk-accent">your store.</span>
            </>
          )}
        </h2>
        <ul className="mt-10 grid gap-6 xl:grid-cols-2 xl:gap-x-8">
          {MERCHANT_POINTS.map((p) => (
            <li key={p.title} className="flex gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-[var(--r-sm)] border border-mk-line-strong bg-mk-elev-2 text-mk-accent">
                <p.icon aria-hidden className="size-5" strokeWidth={1.75} />
              </span>
              <span>
                <span className="block font-semibold text-mk-text">{p.title}</span>
                <span className="mt-0.5 block text-sm leading-relaxed text-mk-muted">{p.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-auto max-w-xl border-t border-mk-line pt-6 text-sm text-mk-dim">
        One sign-in for your store dashboard. Themes, products and payments stay ready when you are.
      </p>
    </>
  );
}

const CONSOLE_POINTS = [
  { icon: Store, title: "Stores and status", body: "Open any merchant store, change plan or status, and spot trials and domains that need attention." },
  { icon: LayoutDashboard, title: "Plans and domains", body: "Manage plans, plan requests, custom domains and platform health from one place." },
  { icon: Flag, title: "Branding, flags and apps", body: "Set platform logos, feature flags, email, notifications and connected social apps." },
  { icon: ShieldCheck, title: "Audit and support access", body: "Every privileged change is logged; store support sign-in is read-only and time-boxed." },
];

/** Left panel for the platform console sign-in. Command-center value props; no live business data pre-login. */
export function ConsoleAside() {
  return (
    <>
      <BrandLogo tone="light" />
      <div className="max-w-xl">
        <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-mk-line-strong bg-white/[0.03] px-3 py-1 font-mk-mono text-[11px] font-medium uppercase tracking-[0.16em] text-mk-muted">
          <span aria-hidden className="size-1.5 rounded-full bg-mk-accent" />
          Full command center
        </p>
        <h2 className="font-brand text-[clamp(2.25rem,3.4vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.025em] text-mk-text">
          Every store. <span className="text-mk-accent">One control plane.</span>
        </h2>
        <ul className="mt-10 grid gap-6 xl:grid-cols-2 xl:gap-x-8">
          {CONSOLE_POINTS.map((p) => (
            <li key={p.title} className="flex gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-[var(--r-sm)] border border-mk-line-strong bg-mk-elev-2 text-mk-accent">
                <p.icon aria-hidden className="size-5" strokeWidth={1.75} />
              </span>
              <span>
                <span className="block font-semibold text-mk-text">{p.title}</span>
                <span className="mt-0.5 block text-sm leading-relaxed text-mk-muted">{p.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-auto flex items-center gap-2 border-t border-mk-line pt-6 font-mk-mono text-[11px] uppercase tracking-[0.16em] text-mk-dim">
        <LockKeyhole aria-hidden className="size-3.5 shrink-0 text-mk-accent" />
        Restricted system · Authorised staff only
      </p>
    </>
  );
}
