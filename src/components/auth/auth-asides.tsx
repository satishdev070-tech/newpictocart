import { Boxes, Flag, Globe2, LayoutDashboard, LineChart, LockKeyhole, Palette, ShieldCheck, Store } from "lucide-react";
import { BrandLogo } from "@/features/marketing-site/components/brand-logo";
import { ThemeMockup } from "@/features/theme/marketplace/mockup";
import { MARKETPLACE_THEMES } from "@/features/theme/marketplace/catalog";

const MERCHANT_POINTS = [
  { icon: Palette, title: "Themes for your kind of business", body: "Pick a design, change colours and sections, and preview before you publish." },
  { icon: Boxes, title: "Products, orders and stock", body: "Variants, inventory, orders, returns and GST invoices in one dashboard." },
  { icon: LineChart, title: "Payments and shipping", body: "Your own Razorpay, Cashfree or PayU account, cash on delivery, and shipping rules." },
  { icon: Globe2, title: "Your own web address", body: "A free store address from day one; connect your own domain on eligible plans." },
];

const ASIDE_THEME = MARKETPLACE_THEMES.find((t) => t.key === "contemporary-ethnic") ?? MARKETPLACE_THEMES[0];

/** Left panel for merchant sign-in / sign-up (Pictocart brand). Value statements only, no invented numbers. */
export function MerchantAside({ mode }: { mode: "login" | "register" }) {
  return (
    <>
      <BrandLogo />
      <div className="max-w-xl">
        <p className="mb-5 inline-flex rounded-full border border-brand/15 bg-white/75 px-3 py-1 text-caption font-semibold tracking-wide text-brand-ink shadow-xs">
          Built for independent businesses
        </p>
        <h2 className="font-brand text-[2.5rem] font-extrabold leading-[1.08] tracking-tight text-brand-ink xl:text-5xl">
          {mode === "register" ? "Your brand. Your store. Your next big beginning." : "Welcome back to your store."}
        </h2>
        <ul className="mt-8 grid gap-5 xl:grid-cols-2 xl:gap-x-8">
          {MERCHANT_POINTS.map((p) => (
            <li key={p.title} className="flex gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-brand-md bg-white text-brand shadow-brand-card">
                <p.icon aria-hidden className="size-5" strokeWidth={1.75} />
              </span>
              <span>
                <span className="block font-semibold text-brand-ink">{p.title}</span>
                <span className="block text-small text-muted">{p.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      {ASIDE_THEME ? (
        <div className="mt-auto hidden w-full max-w-xl self-start overflow-hidden rounded-brand-lg border border-white/80 bg-white p-1.5 shadow-brand-float [@media(min-height:1024px)]:block" aria-hidden>
          <ThemeMockup preset={ASIDE_THEME.preset} name={ASIDE_THEME.name.split(" ")[0]!} />
        </div>
      ) : null}
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
      <BrandLogo />
      <div className="max-w-xl">
        <p className="mb-5 inline-flex rounded-full border border-brand/15 bg-white/75 px-3 py-1 text-caption font-semibold tracking-wide text-brand-ink shadow-xs">
          Full command center
        </p>
        <h2 className="font-brand text-[2.5rem] font-extrabold leading-[1.08] tracking-tight text-brand-ink xl:text-5xl">
          Every store. One control plane.
        </h2>
        <ul className="mt-8 grid gap-5 xl:grid-cols-2 xl:gap-x-8">
          {CONSOLE_POINTS.map((p) => (
            <li key={p.title} className="flex gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-brand-md bg-white text-brand shadow-brand-card">
                <p.icon aria-hidden className="size-5" strokeWidth={1.75} />
              </span>
              <span>
                <span className="block font-semibold text-brand-ink">{p.title}</span>
                <span className="block text-small text-muted">{p.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-auto flex items-center gap-2 text-caption uppercase tracking-[0.14em] text-muted">
        <LockKeyhole aria-hidden className="size-3.5 shrink-0 text-brand-orange" />
        Restricted system · Authorised staff only
      </p>
    </>
  );
}
