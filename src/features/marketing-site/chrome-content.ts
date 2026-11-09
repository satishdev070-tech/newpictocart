/**
 * Header mega menu and footer content for the landing CMS (see landing.ts → headerSchema /
 * footerSchema). PURE (no I/O, no imports from landing.ts, so landing.ts can import this).
 */

import { marketplaceThemeCount } from "./themes";

/** Default mega-menu / hub card href for a feature title (Theme Marketplace → /themes). */
export function featureMenuHref(title: string): string {
  if (/theme marketplace/i.test(title)) return "/themes";
  const slug = title
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `/features/${slug}`;
}

/** True for hub-only Features URLs (relative or absolute), not `/features/{slug}`. */
export function isFeaturesHubHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed || trimmed === "/features" || trimmed === "/features/") return true;
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const path = new URL(trimmed).pathname.replace(/\/+$/, "") || "/";
      return path === "/features";
    }
  } catch {
    /* ignore invalid absolute URLs */
  }
  return false;
}

/** Rewrite stale hub-only `/features` item links to per-feature routes without clobbering custom URLs. */
export function normalizeMegaMenuItemHref(title: string, href: string): string {
  if (isFeaturesHubHref(href)) return featureMenuHref(title);
  return href.trim();
}

/**
 * Home Solutions card titles → feature detail (or themes). Unmapped titles keep their href
 * (usually the Features hub) so we never invent a 404 slug.
 */
export const SOLUTIONS_FEATURE_HREFS: Readonly<Record<string, string>> = {
  "Theme Marketplace": "/themes",
  "WhatsApp & Social": "/features/whatsapp-and-instagram-share",
  "Custom Domain + SSL": "/features/custom-domain-ssl",
  "Razorpay / UPI / COD": "/features/razorpay-upi-cod",
  Shipping: "/features/shiprocket-shipping",
  "GST-Ready Invoices": "/features/gst-ready-invoices",
  "Coupons & Discounts": "/features/coupons-and-discounts",
  "Reviews & Ratings": "/features/reviews-and-ratings",
  "SEO Tools": "/features/blog-and-seo",
  Analytics: "/features/analytics-dashboard",
};

/** Prefer the known Solutions → feature map; otherwise leave custom URLs alone. */
export function normalizeSolutionsItemHref(title: string, href: string): string {
  const mapped = SOLUTIONS_FEATURE_HREFS[title];
  if (mapped) return mapped;
  return href.trim() || "/features";
}

/** Icons offered for mega menu items (lucide names, mapped in components/chrome-icons). */
export const MENU_ICONS = [
  "sparkles",
  "camera",
  "globe",
  "palette",
  "message-circle",
  "link",
  "credit-card",
  "truck",
  "file-text",
  "ticket",
  "star",
  "book-open",
  "bar-chart",
  "shopping-cart",
  "search",
  "smartphone",
  "users",
  "store",
  "tag",
  "rocket",
  "package",
  "shield",
  "zap",
  "megaphone",
  "image",
  "mail",
  "receipt",
  "layout",
  "heart",
  "clock",
  "layers",
  "download",
  "database",
  "notebook",
  "pointer",
  "type",
  "qr-code",
  "alarm-clock",
  "calendar",
  "bot",
] as const;
export type MenuIcon = (typeof MENU_ICONS)[number];

/** Colour of a mega menu column: eyebrow title and the tinted icon chips. */
export const MENU_TONES = ["indigo", "sky", "violet", "emerald", "amber", "rose"] as const;
export type MenuTone = (typeof MENU_TONES)[number];

/** Social profiles shown in the footer (empty URL = hidden), in display order. */
export const SOCIAL_KEYS = ["instagram", "x", "facebook", "youtube", "linkedin", "whatsapp", "pinterest", "telegram", "threads"] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];
export const SOCIAL_LABELS: Record<SocialKey, string> = {
  instagram: "Instagram",
  x: "X (Twitter)",
  facebook: "Facebook",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
  pinterest: "Pinterest",
  telegram: "Telegram",
  threads: "Threads",
};

/** Where visitors can share the site from the footer. */
export const SHARE_NETWORKS = ["whatsapp", "facebook", "x", "linkedin", "telegram", "pinterest", "email", "copy"] as const;
export type ShareNetwork = (typeof SHARE_NETWORKS)[number];
export const SHARE_LABELS: Record<ShareNetwork, string> = {
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  x: "X",
  linkedin: "LinkedIn",
  telegram: "Telegram",
  pinterest: "Pinterest",
  email: "Email",
  copy: "Copy link",
};

/** Share link for a network, or null for "copy" (handled in the browser). */
export function shareUrl(network: ShareNetwork, url: string, text: string): string | null {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  switch (network) {
    case "whatsapp":
      return `https://wa.me/?text=${encodeURIComponent(text ? `${text} ${url}` : url)}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case "x":
      return `https://twitter.com/intent/tweet?url=${u}${text ? `&text=${t}` : ""}`;
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    case "telegram":
      return `https://t.me/share/url?url=${u}${text ? `&text=${t}` : ""}`;
    case "pinterest":
      return `https://pinterest.com/pin/create/button/?url=${u}${text ? `&description=${t}` : ""}`;
    case "email":
      return `mailto:?subject=${t}&body=${encodeURIComponent(text ? `${text}\n\n${url}` : url)}`;
    case "copy":
      return null;
  }
}

// ---- Defaults ---------------------------------------------------------------------------

export type MegaMenuItem = { icon: MenuIcon; title: string; body: string; href: string };
export type MegaMenuColumn = { title: string; subtitle: string; tone: MenuTone; items: MegaMenuItem[] };
export type MegaMenu = {
  enabled: boolean;
  /** Label of the header nav item that opens the menu (e.g. "Features"). */
  trigger: string;
  columns: MegaMenuColumn[];
  footerLead: string;
  footerText: string;
  footerLink: { label: string; href: string };
};

const item = (icon: MenuIcon, title: string, body: string, href = featureMenuHref(title)): MegaMenuItem => ({ icon, title, body, href });

export const DEFAULT_MEGA_MENU: MegaMenu = {
  enabled: true,
  trigger: "Features",
  columns: [
    {
      title: "Sell",
      subtitle: "List products & take orders",
      tone: "indigo",
      items: [
        item("camera", "Snap-to-Product AI", "Photo → title, description, price and tags"),
        item("layers", "Product Variants", "Sizes, colours, packs — auto-combined SKUs"),
        item("tag", "Categories & Collections", "Custom taxonomies & curated collections"),
        item("package", "Inventory & Low-Stock", "Auto-deduct on order, alert before you run out"),
        item("download", "Digital Products", "PDFs, courses, templates — instant delivery"),
      ],
    },
    {
      title: "Source",
      subtitle: "Find what to sell",
      tone: "sky",
      items: [
        item("globe", "Source India", "Find verified manufacturers & wholesalers"),
        item("database", "Bulk CSV Import", "Bring 100s of products from a spreadsheet"),
        item("notebook", "Supplier Khata", "Track supplier dues like a paper khata"),
      ],
    },
    {
      title: "Design",
      subtitle: "Make it your brand",
      tone: "violet",
      items: [
        item("palette", "Theme Marketplace", `${marketplaceThemeCount()} AI-crafted, 5-page premium themes`, "/themes"),
        item("pointer", "Drag-and-Drop Builder", "Rearrange sections, swap blocks, no code"),
        item("image", "Logo & Banner Upload", "1:1 cropper, original filenames kept"),
        item("type", "Google Fonts", "Pick from 1,000+ fonts, applied site-wide"),
        item("link", "Custom Domain + SSL", "yourbrand.in with auto-issued SSL"),
      ],
    },
    {
      title: "Channels",
      subtitle: "Reach customers everywhere",
      tone: "emerald",
      items: [
        item("smartphone", "Storefront PWA", "Customers install your store as an app"),
        item("message-circle", "WhatsApp & Instagram Share", "One-tap share cards with OG previews"),
        item("qr-code", "QR Codes", "Print-ready QR for store, products and offers"),
        item("book-open", "Blog & SEO", "AI-assisted posts, sitemap and meta tags"),
        item("mail", "Email Newsletter", "Capture subscribers, send campaigns"),
      ],
    },
    {
      title: "Operate",
      subtitle: "Payments, shipping, taxes",
      tone: "amber",
      items: [
        item("credit-card", "Razorpay / UPI / COD", "All payment modes, direct to your bank"),
        item("truck", "Shiprocket Shipping", "29,000+ pincodes, 17+ couriers"),
        item("file-text", "GST-Ready Invoices", "Auto HSN, bulk export for your CA"),
        item("ticket", "Coupons & Discounts", "Usage caps, min-order, expiry rules"),
        item("star", "Reviews & Ratings", "1-5 stars, photo reviews, verified buyers"),
      ],
    },
    {
      title: "Grow",
      subtitle: "Analytics & AI insights",
      tone: "rose",
      items: [
        item("sparkles", "AI Engagement Report", "0-100 store score + improvement tips"),
        item("bar-chart", "Analytics Dashboard", "Orders, revenue, visitors, funnels"),
        item("alarm-clock", "Abandoned Cart Recovery", "Auto-nudge visitors who left items behind"),
        item("calendar", "Weekly Digest", "A summary email every Monday morning"),
        item("bot", "Pica2 AI Assistant", "In-dashboard helper for any question"),
      ],
    },
  ],
  footerLead: "Every solution",
  footerText: "for what to sell, where to sell — and how to grow.",
  footerLink: { label: "Browse the theme marketplace", href: "/themes" },
};

export type FooterShare = { enabled: boolean; label: string; text: string; networks: ShareNetwork[] };

export const DEFAULT_FOOTER_SHARE: FooterShare = {
  enabled: true,
  label: "Share",
  text: "Launch your online store in 5 minutes with Pictocart — free to start.",
  networks: [...SHARE_NETWORKS],
};
