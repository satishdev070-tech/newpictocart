import { z } from "zod";

/**
 * Per-feature marketing pages (mega-menu items). Stored in platform_settings under
 * FEATURE_PAGES_KEY; public read via public. prefix RLS. Pure module — no I/O.
 */

export const FEATURE_PAGES_KEY = "public.marketing.feature_pages";

export const FEATURE_GROUPS = ["sell", "source", "design", "channels", "operate", "grow"] as const;
export type FeatureGroup = (typeof FEATURE_GROUPS)[number];

export const FEATURE_GROUP_LABELS: Record<FeatureGroup, string> = {
  sell: "Sell",
  source: "Source",
  design: "Design",
  channels: "Channels",
  operate: "Operate",
  grow: "Grow",
};

const str = (max: number) => z.string().trim().max(max);
const href = str(300).refine((v) => v === "" || (v.startsWith("/") && !v.startsWith("//")) || /^https:\/\//i.test(v), "Use a path or https URL");
const imageUrl = str(500).refine((v) => v === "" || (v.startsWith("/") && !v.startsWith("//")) || /^https:\/\//i.test(v), "Use https or /path");

export const featurePageSchema = z.object({
  slug: str(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase-kebab"),
  group: z.enum(FEATURE_GROUPS),
  title: str(80),
  eyebrow: str(60),
  summary: str(280),
  bullets: z.array(str(160)).max(8).default([]),
  body: str(4000),
  infographicUrl: imageUrl.default(""),
  infographicAlt: str(160).default(""),
  seoTitle: str(80).default(""),
  seoDescription: str(200).default(""),
  ctaLabel: str(60).default("Start free"),
  ctaHref: href.default("/start"),
  order: z.number().int().min(0).max(99).default(0),
  published: z.boolean().default(true),
});

export type FeaturePage = z.infer<typeof featurePageSchema>;

export const featurePagesDocumentSchema = z.object({
  pages: z.array(featurePageSchema).max(40),
});

export type FeaturePagesDocument = z.infer<typeof featurePagesDocumentSchema>;

export function slugifyFeatureTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

type Seed = Omit<FeaturePage, "seoTitle" | "seoDescription" | "ctaLabel" | "ctaHref" | "published" | "infographicUrl" | "infographicAlt"> & {
  seoTitle?: string;
  seoDescription?: string;
};

function page(s: Seed): FeaturePage {
  return {
    ...s,
    infographicUrl: "",
    infographicAlt: "",
    seoTitle: s.seoTitle ?? `${s.title} · Pictocart`,
    seoDescription: s.seoDescription ?? s.summary,
    ctaLabel: "Start free",
    ctaHref: "/start",
    published: true,
  };
}

/** Full EN seed for all 28 mega-menu features. */
export const DEFAULT_FEATURE_PAGES: FeaturePagesDocument = {
  pages: [
    page({
      slug: "snap-to-product-ai",
      group: "sell",
      order: 1,
      title: "Snap-to-Product AI",
      eyebrow: "Sell · Catalogue",
      summary: "Turn a product photo into a ready listing — title, description, price suggestion and tags — so you spend minutes, not hours.",
      bullets: ["Works from phone camera or gallery uploads", "Suggests category and searchable tags", "Edit any field before you publish", "Fits fashion, food, beauty and handmade niches"],
      body: "Snap-to-Product AI is built for Indian merchants who photograph stock on the go. Upload a clear photo; Pictocart drafts a customer-facing title, a short description, a sensible price band, and tags that match how shoppers search. You stay in control — tweak copy, set the final price, then publish to your storefront. Pair it with variants and collections for a complete catalogue without spreadsheets.",
    }),
    page({
      slug: "product-variants",
      group: "sell",
      order: 2,
      title: "Product Variants",
      eyebrow: "Sell · Inventory",
      summary: "Sizes, colours, packs and custom options become auto-combined SKUs with their own stock and prices.",
      bullets: ["Multi-option matrices without messy SKUs by hand", "Per-variant price and stock", "Storefront pickers that stay in sync", "Works with low-stock alerts"],
      body: "Define options once — Size, Colour, Pack — and Pictocart builds the combination grid for you. Each variant can carry its own price and inventory count. Shoppers choose options on the product page; orders deduct the right SKU. No more duplicate product pages for every colour.",
    }),
    page({
      slug: "categories-and-collections",
      group: "sell",
      order: 3,
      title: "Categories & Collections",
      eyebrow: "Sell · Browse",
      summary: "Build taxonomies your customers understand and curated collections for campaigns, seasons and bestsellers.",
      bullets: ["Nested categories for deep catalogues", "Curated collections for merchandising", "SEO-friendly collection pages", "Filter-ready structure for search"],
      body: "Organise products the way your buyers think — by type, occasion or price band. Collections let you feature “Festive picks” or “Under ₹999” without changing your master categories. Both surface cleanly in navigation and search.",
    }),
    page({
      slug: "inventory-and-low-stock",
      group: "sell",
      order: 4,
      title: "Inventory & Low-Stock",
      eyebrow: "Sell · Stock",
      summary: "Stock deducts when orders confirm. Get alerts before you sell what you do not have.",
      bullets: ["Auto-deduct on paid / confirmed orders", "Low-stock thresholds per product or variant", "Dashboard visibility for what’s running out", "Fewer oversells and refunds"],
      body: "Every confirmed order reduces inventory automatically. Set thresholds so you restock before bestsellers go grey. Inventory is visible in the seller dashboard alongside orders, so ops and buying stay aligned.",
    }),
    page({
      slug: "digital-products",
      group: "sell",
      order: 5,
      title: "Digital Products",
      eyebrow: "Sell · Instant delivery",
      summary: "Sell PDFs, courses and templates with secure delivery the moment payment succeeds.",
      bullets: ["No shipping for digital SKUs", "Delivery after successful payment", "Works alongside physical goods", "Ideal for creators and tutors"],
      body: "List digital goods next to physical products. After checkout, buyers get access without courier delays. Use it for lookbooks, patterns, worksheets or course packs while you still run a full merchandise store.",
    }),
    page({
      slug: "source-india",
      group: "source",
      order: 1,
      title: "Source India",
      eyebrow: "Source · Supply",
      summary: "Discover verified manufacturers and wholesalers when you need new lines to list.",
      bullets: ["India-focused supplier discovery", "Shortlist makers before you commit stock", "Complement your own brand catalogue", "Reduce cold outreach guesswork"],
      body: "When your shelves need fresh product, Source India helps you find manufacturers and wholesalers suited to your niche. Use it as a starting point for sampling and negotiation, then import or list finished goods in Pictocart.",
    }),
    page({
      slug: "bulk-csv-import",
      group: "source",
      order: 2,
      title: "Bulk CSV Import",
      eyebrow: "Source · Migration",
      summary: "Bring hundreds of products from a spreadsheet into your store in one pass.",
      bullets: ["Map columns to catalogue fields", "Ideal for marketplace migrations", "Validate before publish", "Save days of manual entry"],
      body: "Export from your old system or supplier sheet, map fields, and import. Pictocart checks rows so broken prices or missing titles do not silently land on the storefront. Iterate on the sheet until the catalogue is clean.",
    }),
    page({
      slug: "supplier-khata",
      group: "source",
      order: 3,
      title: "Supplier Khata",
      eyebrow: "Source · Payables",
      summary: "Track supplier dues like a paper khata — who you owe, what’s paid, what’s pending.",
      bullets: ["Simple ledger mental model", "Built for Indian wholesale habits", "See outstanding at a glance", "Fewer WhatsApp-only payment notes"],
      body: "Supplier Khata keeps purchase dues visible inside the platform you already use for selling. Record what you owe each supplier and mark payments so cash flow stays honest without a separate accounting app for day-to-day ops.",
    }),
    page({
      slug: "theme-marketplace",
      group: "design",
      order: 1,
      title: "Theme Marketplace",
      eyebrow: "Design · Themes",
      summary: "Fifty-plus AI-crafted, multi-page themes tuned for Indian categories — fashion, food, beauty and more.",
      bullets: ["Category-aware starters", "Desktop and mobile layouts", "Preview before you apply", "Edit colours and sections after"],
      body: "Browse the marketplace, preview on device frames, and apply a theme that already looks like your niche. Then customise — you are never locked into a generic template. Open the full gallery anytime from Themes.",
    }),
    page({
      slug: "drag-and-drop-builder",
      group: "design",
      order: 2,
      title: "Drag-and-Drop Builder",
      eyebrow: "Design · Site builder",
      summary: "Rearrange sections, swap blocks and tune layouts without writing code.",
      bullets: ["Section-level editing", "Live preview as you change", "Safe publish when you are ready", "Works with marketplace themes"],
      body: "The builder treats your storefront as composable sections. Reorder hero, products, testimonials and more; adjust content in place; publish when the preview looks right. Designers optional — not required.",
    }),
    page({
      slug: "logo-and-banner-upload",
      group: "design",
      order: 3,
      title: "Logo & Banner Upload",
      eyebrow: "Design · Brand assets",
      summary: "Upload logos and banners with a 1:1 cropper that keeps original filenames for your records.",
      bullets: ["Cropping built for square marks", "Banners for hero and campaigns", "Original filenames preserved", "Shows consistently across theme"],
      body: "Brand assets should look sharp on mobile and desktop. Upload, crop, and place logos and banners without fighting theme CSS. Your files stay identifiable in storage for future swaps.",
    }),
    page({
      slug: "google-fonts",
      group: "design",
      order: 4,
      title: "Google Fonts",
      eyebrow: "Design · Typography",
      summary: "Choose from 1,000+ Google Fonts and apply them site-wide in a few clicks.",
      bullets: ["Huge catalogue without self-hosting hassle", "Consistent type across pages", "Pair headings and body easily", "Preview before publish"],
      body: "Typography carries brand tone as much as colour. Pick a display face and a readable body font; Pictocart applies them across the storefront so every page feels intentional.",
    }),
    page({
      slug: "custom-domain-ssl",
      group: "design",
      order: 5,
      title: "Custom Domain + SSL",
      eyebrow: "Design · Domains",
      summary: "Connect yourbrand.in with automatically issued SSL so shoppers trust the lock icon.",
      bullets: ["Use your own domain", "HTTPS without manual cert chores", "Works with platform subdomains too", "Verified before going live"],
      body: "A custom domain is table stakes for serious brands. Point DNS, verify, and serve HTTPS automatically. Keep your free pictocart.in subdomain as a backup or staging style address while you migrate.",
    }),
    page({
      slug: "storefront-pwa",
      group: "channels",
      order: 1,
      title: "Storefront PWA",
      eyebrow: "Channels · App-like",
      summary: "Customers can install your store as an app on their phone home screen.",
      bullets: ["Add to Home Screen experience", "Fast repeat visits", "Works alongside the mobile site", "No App Store review for the PWA itself"],
      body: "Progressive Web App support means loyal buyers open your store like an app. It’s ideal for neighbourhood brands and repeat grocery or fashion orders where convenience wins.",
    }),
    page({
      slug: "whatsapp-and-instagram-share",
      group: "channels",
      order: 2,
      title: "WhatsApp & Instagram Share",
      eyebrow: "Channels · Social",
      summary: "One-tap share cards with Open Graph previews that look sharp in chats and stories.",
      bullets: ["Share products and offers fast", "OG previews for link unfurls", "Built for Indian chat commerce", "Reduce copy-paste friction"],
      body: "Most discovery still happens in WhatsApp and Instagram. Generate shareable links that unfurl with the right image and title so friends and followers land on the product, not a blank preview.",
    }),
    page({
      slug: "qr-codes",
      group: "channels",
      order: 3,
      title: "QR Codes",
      eyebrow: "Channels · Offline",
      summary: "Print-ready QR codes for your store, products and offers — booths, packaging and posters.",
      bullets: ["Store-wide and product-level codes", "Print-friendly output", "Bridge offline footfall to online cart", "Great for markets and pop-ups"],
      body: "Print a QR on packaging or a stall placard; scanners land on the right page. QR codes close the loop between physical presence and your Pictocart checkout.",
    }),
    page({
      slug: "blog-and-seo",
      group: "channels",
      order: 4,
      title: "Blog & SEO",
      eyebrow: "Channels · Content",
      summary: "Publish AI-assisted posts with sitemap and meta tags so Google can find you.",
      bullets: ["Blog for stories and guides", "Meta titles and descriptions", "Sitemap included", "AI help when you want a draft"],
      body: "Own your narrative with a store blog — styling tips, recipes, founder stories. Pictocart handles technical SEO basics so content can rank while you focus on writing.",
    }),
    page({
      slug: "email-newsletter",
      group: "channels",
      order: 5,
      title: "Email Newsletter",
      eyebrow: "Channels · Retention",
      summary: "Capture subscribers and send campaigns so buyers come back without relying only on ads.",
      bullets: ["Signup capture on the storefront", "Campaign sends to your list", "Announce drops and offers", "Own the relationship vs rental platforms"],
      body: "Email remains one of the highest-ROI channels. Collect consent on site, then message launches, restocks and festival offers directly — not only through marketplace algorithms.",
    }),
    page({
      slug: "razorpay-upi-cod",
      group: "operate",
      order: 1,
      title: "Razorpay / UPI / COD",
      eyebrow: "Operate · Payments",
      summary: "Accept UPI, cards and cash on delivery with settlement flowing to your bank.",
      bullets: ["Razorpay integration", "UPI for everyday India checkout", "COD where your ops allow it", "Money to your account — not stuck in a marketplace"],
      body: "Checkout supports the payment modes your customers already use. Configure Razorpay and COD policies that match your shipping reality; funds settle to you instead of waiting on marketplace payouts.",
    }),
    page({
      slug: "shiprocket-shipping",
      group: "operate",
      order: 2,
      title: "Shiprocket Shipping",
      eyebrow: "Operate · Fulfilment",
      summary: "Ship across 29,000+ pincodes with 17+ courier partners through Shiprocket.",
      bullets: ["Wide pincode coverage", "Multiple courier options", "Rates surfaced at checkout", "Less manual booking"],
      body: "Connect Shiprocket to quote and book shipments without juggling courier portals. Buyers see realistic options; you fulfil with partners that already cover India at scale.",
    }),
    page({
      slug: "gst-ready-invoices",
      group: "operate",
      order: 3,
      title: "GST-Ready Invoices",
      eyebrow: "Operate · Compliance",
      summary: "Generate invoices with HSN-aware fields and exports your CA can actually use.",
      bullets: ["GST-friendly invoice layout", "HSN support", "Bulk export for accounts", "Fewer spreadsheet rebuilds"],
      body: "Invoices should not be a weekend project. Pictocart generates GST-ready documents and exports so your accountant gets clean data while you keep selling.",
    }),
    page({
      slug: "coupons-and-discounts",
      group: "operate",
      order: 4,
      title: "Coupons & Discounts",
      eyebrow: "Operate · Promotions",
      summary: "Run codes with usage caps, minimum order values and expiry — without rogue forever discounts.",
      bullets: ["Usage limits per code", "Min-order rules", "Expiry dates", "Safe for flash sales"],
      body: "Promotions drive conversion when they are controlled. Create coupon rules that match your margin, expire them cleanly, and avoid codes that leak across campaigns.",
    }),
    page({
      slug: "reviews-and-ratings",
      group: "operate",
      order: 5,
      title: "Reviews & Ratings",
      eyebrow: "Operate · Trust",
      summary: "Collect 1–5 star reviews with optional photos from verified buyers.",
      bullets: ["Star ratings on products", "Photo reviews for social proof", "Verified purchase context", "Builds trust on PDP"],
      body: "Shoppers believe other shoppers. Reviews and ratings on the product page reduce hesitation — especially for first-time brands without a long marketplace history.",
    }),
    page({
      slug: "ai-engagement-report",
      group: "grow",
      order: 1,
      title: "AI Engagement Report",
      eyebrow: "Grow · Insights",
      summary: "A 0–100 store score with concrete tips so you know what to fix next.",
      bullets: ["Single engagement score", "Prioritised improvement tips", "Built for non-analysts", "Revisit as you improve"],
      body: "Instead of drowning in charts, get a plain-language score and actions — improve photos, fill gaps, tighten shipping copy. The report turns “we should do better” into a checklist.",
    }),
    page({
      slug: "analytics-dashboard",
      group: "grow",
      order: 2,
      title: "Analytics Dashboard",
      eyebrow: "Grow · Metrics",
      summary: "Orders, revenue, visitors and funnels in one seller dashboard.",
      bullets: ["Revenue and order trends", "Traffic awareness", "Funnel intuition", "Decide what to stock next"],
      body: "See how the store is performing without exporting CSVs every Monday. Use analytics to spot bestsellers, quiet days and drop-offs that need a coupon or better photos.",
    }),
    page({
      slug: "abandoned-cart-recovery",
      group: "grow",
      order: 3,
      title: "Abandoned Cart Recovery",
      eyebrow: "Grow · Recovery",
      summary: "Automatically nudge visitors who added items but did not checkout.",
      bullets: ["Recover intent that almost converted", "Automated nudges", "Fewer lost baskets", "Pairs with WhatsApp habits"],
      body: "Many carts die of distraction, not rejection. Abandoned cart recovery follows up so you reclaim revenue that would otherwise vanish into unread browser tabs.",
    }),
    page({
      slug: "weekly-digest",
      group: "grow",
      order: 4,
      title: "Weekly Digest",
      eyebrow: "Grow · Cadence",
      summary: "A Monday morning summary email so you start the week knowing what moved.",
      bullets: ["Weekly cadence without logging in", "Highlights that matter", "Owner-friendly language", "Stay close without dashboard fatigue"],
      body: "The digest brings the store to your inbox. Skim what sold, what stalled, and what needs attention — then open the dashboard only when something needs a decision.",
    }),
    page({
      slug: "pica2-ai-assistant",
      group: "grow",
      order: 5,
      title: "Pica2 AI Assistant",
      eyebrow: "Grow · Copilot",
      summary: "An in-dashboard helper for product copy, FAQs and day-to-day seller questions.",
      bullets: ["Ask in plain language", "Helps with catalogue and content tasks", "Lives where you already work", "Speeds repetitive writing"],
      body: "Pica2 sits inside the seller experience so you do not context-switch to a separate chatbot. Use it to draft answers, refine listings and unblock “how do I…” moments faster.",
    }),
  ],
};

export function parseFeaturePages(raw: unknown): FeaturePagesDocument {
  const parsed = featurePagesDocumentSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return DEFAULT_FEATURE_PAGES;
}

export function featurePageBySlug(doc: FeaturePagesDocument, slug: string): FeaturePage | null {
  return doc.pages.find((p) => p.slug === slug && p.published) ?? null;
}

export function featurePagesByGroup(doc: FeaturePagesDocument): Record<FeatureGroup, FeaturePage[]> {
  const out = Object.fromEntries(FEATURE_GROUPS.map((g) => [g, [] as FeaturePage[]])) as Record<FeatureGroup, FeaturePage[]>;
  for (const p of doc.pages) {
    if (!p.published) continue;
    out[p.group].push(p);
  }
  for (const g of FEATURE_GROUPS) out[g].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  return out;
}

/** Map menu title → default /features/{slug} (Theme Marketplace stays /themes). */
export function defaultFeatureHref(title: string): string {
  if (/theme marketplace/i.test(title)) return "/themes";
  return `/features/${slugifyFeatureTitle(title)}`;
}
