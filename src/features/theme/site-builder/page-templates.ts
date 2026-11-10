import { defaultSettings } from "@/features/theme/sections/definitions";
import type { SectionInstance, SectionType } from "@/features/theme/sections/types";

/**
 * Starter layouts for "Add page" in the site builder (pure). Each template is a list of home-page
 * section types (including the page sections: ContactInfo, RichText, BlogPosts, Gallery, Team,
 * CallToAction) with defaulted settings plus starter copy; ops.addPage() gives every
 * section its id. Content is placeholder text the seller edits; no images are referenced, so
 * every section renders its own empty-image state until the seller uploads one.
 *
 * Phase E: four layouts each for About, Contact, FAQ, Blog index and Blog detail (plus other
 * starters). The Add-page picker groups by `family`.
 */

export type PageTemplateFamily = "home" | "about" | "contact" | "faq" | "blogs" | "blog-detail" | "other";

export const PAGE_TEMPLATE_FAMILY_LABELS: Record<PageTemplateFamily, string> = {
  home: "Home",
  about: "About",
  contact: "Contact",
  faq: "FAQ",
  blogs: "Blog index",
  "blog-detail": "Blog detail",
  other: "More layouts",
};

export type PageTemplate = {
  key: string;
  label: string;
  description: string;
  family: PageTemplateFamily;
  sections: Omit<SectionInstance, "id">[];
};

function sec(type: SectionType, settings: Record<string, unknown> = {}): Omit<SectionInstance, "id"> {
  return { type, settings: { ...defaultSettings(type), ...settings }, visibility: { desktop: true, mobile: true } };
}

/** A Hero with one slide (the default slide with new copy). */
function hero(heading: string, subheading: string, ctaLabel = "", ctaHref = "", extra: Record<string, unknown> = {}) {
  const base = defaultSettings("Hero") as { slides: Record<string, unknown>[] };
  return sec("Hero", { height: "medium", ...extra, slides: [{ ...base.slides[0], heading, subheading, ctaLabel, ctaHref }] });
}

const faqItems = [
  { question: "How long does delivery take?", answer: "Most orders are delivered within 3–7 working days." },
  { question: "Do you offer cash on delivery?", answer: "Yes, cash on delivery is available on most PIN codes." },
  { question: "Can I return a product?", answer: "You can request a return within 7 days of delivery." },
  { question: "How do I track my order?", answer: "We send a tracking link by email and SMS once your order ships." },
];

export const BLANK_TEMPLATE: PageTemplate = {
  key: "blank",
  label: "Blank page",
  description: "Start from an empty page and add sections yourself.",
  family: "other",
  sections: [],
};

/**
 * Curated Home packs for Change layout on the built-in Home row (`templates.home`).
 * Same wireframe shape as Add-page templates; not listed in the Add-page picker.
 */
export const HOME_LAYOUT_PACKS: PageTemplate[] = [
  {
    key: "home-classic",
    label: "Home · Classic",
    description: "Hero, categories, featured products, a story band, bestsellers and trust.",
    family: "home",
    sections: [
      hero("Welcome", "Fresh designs, made in small batches.", "Shop now", "/collections"),
      sec("CategoryGrid", { eyebrow: "Shop by category", heading: "Find your silhouette" }),
      sec("ProductGrid", { eyebrow: "Featured", heading: "The edit", source: "featured", limit: 8 }),
      sec("EditorialImageText", {
        eyebrow: "The craft",
        heading: "Made with care",
        body: "Every piece is checked by hand before it reaches you.",
        ctaLabel: "Our story",
        ctaHref: "/pages/about",
      }),
      sec("ProductGrid", { eyebrow: "Most loved", heading: "Bestsellers", source: "bestselling", limit: 8 }),
      sec("TrustBadges"),
      sec("Newsletter"),
    ],
  },
  {
    key: "home-editorial",
    label: "Home · Editorial",
    description: "A quieter homepage: hero, lookbook, brand story, testimonials and a soft CTA.",
    family: "home",
    sections: [
      hero("The new season", "Quiet pieces for everyday wear."),
      sec("Lookbook", { heading: "From the lookbook" }),
      sec("BrandStory", {
        heading: "Who we are",
        body: "A small studio making things meant to last — honest materials, fair work, careful packing.",
        stats: [
          { value: "2015", label: "founded" },
          { value: "40+", label: "makers" },
          { value: "10k+", label: "happy customers" },
        ],
      }),
      sec("Testimonials", {
        heading: "Kind words",
        items: [
          { quote: "Beautifully made and arrived quicker than expected.", author: "Ananya", location: "Pune", rating: 5 },
          { quote: "You can feel the care that goes into every piece.", author: "Rahul", location: "Delhi", rating: 5 },
        ],
      }),
      sec("CallToAction", { heading: "Shop the collection", text: "Browse new arrivals or write to us for help choosing.", ctaLabel: "Shop now", ctaHref: "/collections" }),
    ],
  },
  {
    key: "home-shop",
    label: "Home · Shop first",
    description: "Promo tiles, categories, best sellers, a featured band and trust badges.",
    family: "home",
    sections: [
      sec("PromoBanner"),
      sec("CategoryGrid", { heading: "Shop by category" }),
      sec("ProductGrid", { heading: "Best sellers", source: "bestselling", viewAllHref: "/collections" }),
      sec("FeatureBand", { heading: "Just landed", featureHeading: "New this week" }),
      sec("TrustBadges"),
      sec("Newsletter"),
    ],
  },
  {
    key: "home-minimal",
    label: "Home · Minimal",
    description: "A short homepage: hero, product grid and a newsletter invite.",
    family: "home",
    sections: [
      hero("Hello", "A smaller collection, updated often.", "Shop", "/collections"),
      sec("ProductGrid", { heading: "New in", source: "newest", limit: 8, viewAllHref: "/collections" }),
      sec("TrustBadges"),
      sec("Newsletter", { heading: "Stay in the loop" }),
    ],
  },
];

export const PAGE_TEMPLATES: PageTemplate[] = [
  // ---------------------------------------------------------------------------
  // About (4)
  // ---------------------------------------------------------------------------
  {
    key: "about",
    label: "About · Story",
    description: "Tell your story: a banner, who you are with key numbers, your values, the team and kind words from customers.",
    family: "about",
    sections: [
      hero("Our story", "How a small idea became the brand you know today."),
      sec("BrandStory", {
        heading: "Who we are",
        body: "We started with a simple belief: everyday things should be made well and made to last. Today we work with a small team of makers to bring that belief to every piece we sell.",
        stats: [
          { value: "2015", label: "founded" },
          { value: "40+", label: "makers" },
          { value: "10k+", label: "happy customers" },
        ],
      }),
      sec("RichText", {
        variant: "richtext-columns",
        heading: "What we believe in",
        body: "Honest materials. We choose fabrics, woods and metals that age well and are kind to the people who work with them.\n\nFair work. Every maker we partner with is paid fairly and on time, and many have been with us since the start.\n\nMade to last. Each product is checked by hand before it reaches you, and we are here to help long after you order.",
      }),
      sec("Team", { heading: "The people behind the brand", variant: "team-circles" }),
      sec("Testimonials", {
        heading: "What our customers say",
        items: [
          { quote: "Beautifully made and arrived quicker than expected.", author: "Ananya", location: "Pune", rating: 5 },
          { quote: "You can feel the care that goes into every piece.", author: "Rahul", location: "Delhi", rating: 5 },
          { quote: "My go-to store for gifts now.", author: "Meera", location: "Bengaluru", rating: 5 },
        ],
      }),
      sec("CallToAction", { heading: "Find something you'll keep for years", text: "Browse the collection or write to us for help choosing.", ctaLabel: "Shop the collection", ctaHref: "/collections", secondaryLabel: "Contact us", secondaryHref: "/contact" }),
    ],
  },
  {
    key: "about-mission",
    label: "About · Mission",
    description: "A centred mission statement, trust badges, values in columns and a clear call to act.",
    family: "about",
    sections: [
      sec("BrandStory", {
        variant: "centered",
        heading: "Made with care, meant to last",
        body: "We exist to put better materials in more homes — without the rush, the waste or the guesswork.",
        stats: [
          { value: "100%", label: "checked by hand" },
          { value: "7 days", label: "easy returns" },
          { value: "48h", label: "dispatch" },
        ],
      }),
      sec("TrustBadges"),
      sec("RichText", {
        variant: "richtext-columns",
        heading: "How we work",
        body: "Design in small batches so nothing sits unused.\n\nSource from makers we know by name.\n\nShip with packaging you can reuse or recycle.",
      }),
      sec("CallToAction", { variant: "cta-card", heading: "See the collection", text: "Every piece tells part of this story.", ctaLabel: "Shop now", ctaHref: "/collections" }),
    ],
  },
  {
    key: "about-studio",
    label: "About · Studio",
    description: "A gallery-led look at your studio, the team in a list, and a short brand story.",
    family: "about",
    sections: [
      hero("Inside the studio", "Where sketches become samples and samples become the pieces you wear."),
      sec("Gallery", { heading: "From the workbench", variant: "gallery-masonry", subheading: "A few frames from an ordinary week." }),
      sec("Team", {
        heading: "Who you'll hear from",
        variant: "team-list",
        members: [
          { name: "Asha", role: "Founder", bio: "Started the brand from her kitchen table.", imagePath: "", href: "" },
          { name: "Vikram", role: "Design", bio: "Turns sketches and old textiles into collections.", imagePath: "", href: "" },
          { name: "Neha", role: "Care", bio: "Answers every message, usually within the hour.", imagePath: "", href: "" },
        ],
      }),
      sec("BrandStory", {
        heading: "Small team, shared table",
        variant: "band",
        body: "We sit within arm's reach of the packing bench — so questions never wait in a queue.",
      }),
    ],
  },
  {
    key: "about-timeline",
    label: "About · Timeline",
    description: "A quiet intro, milestones as rich text, testimonials and a newsletter invite.",
    family: "about",
    sections: [
      sec("RichText", {
        variant: "richtext-centered",
        eyebrow: "Since the beginning",
        heading: "A short history",
        body: "A few markers on the way from a kitchen table to the brand you know today.",
      }),
      sec("RichText", {
        variant: "richtext-boxed",
        heading: "Milestones",
        body: "2015 — First collection of twelve scarves, sold to friends.\n\n2018 — Opened a shared studio with three makers.\n\n2022 — Started shipping across India with the same packing care.\n\nToday — Still checking every piece by hand before it leaves.",
      }),
      sec("Testimonials", {
        heading: "Along the way",
        variant: "cards",
        items: [
          { quote: "I've been ordering since the early days — quality never slipped.", author: "Priya", location: "Mumbai", rating: 5 },
          { quote: "You can tell they still care about the small things.", author: "Karan", location: "Jaipur", rating: 5 },
        ],
      }),
      sec("Newsletter", { heading: "Follow the next chapter" }),
    ],
  },

  // ---------------------------------------------------------------------------
  // Contact (4)
  // ---------------------------------------------------------------------------
  {
    key: "contact",
    label: "Contact · Cards",
    description: "Help customers reach you: phone, email, address and map, quick answers and a WhatsApp button.",
    family: "contact",
    sections: [
      sec("ContactInfo", { variant: "contact-cards", heading: "Get in touch", subheading: "Questions about an order, sizes or bulk gifting? We usually reply within one working day." }),
      sec("FAQ", { heading: "Before you write", source: "store", limit: 4 }),
      sec("CallToAction", { variant: "cta-card", heading: "Prefer to chat?", text: "Message us on WhatsApp and we'll get back to you quickly.", ctaLabel: "Read our FAQ", ctaHref: "/faq", tone: "muted" }),
    ],
  },
  {
    key: "contact-split",
    label: "Contact · Map",
    description: "Details beside a map, store hours in text, and a soft call to visit or write.",
    family: "contact",
    sections: [
      sec("ContactInfo", {
        variant: "contact-split",
        heading: "Visit or write",
        subheading: "Come by the studio, or send a note — whichever is easier.",
        hours: "Mon–Sat, 10am–7pm",
      }),
      sec("RichText", {
        variant: "richtext-narrow",
        heading: "What to expect",
        body: "Walk-ins are welcome. For fittings or bulk orders, a quick message helps us prepare samples.",
      }),
      sec("CallToAction", { variant: "cta-band", heading: "Still deciding?", text: "Browse the FAQ or start a WhatsApp chat.", ctaLabel: "FAQ", ctaHref: "/faq" }),
    ],
  },
  {
    key: "contact-visit",
    label: "Contact · Visit",
    description: "A hero invite to the studio, minimal contact list, and trust badges.",
    family: "contact",
    sections: [
      hero("Come say hello", "The studio door is open most weekdays — bring questions, returns or just curiosity.", "Get directions", "/contact"),
      sec("ContactInfo", { variant: "contact-minimal", heading: "Studio details", hours: "Tue–Sat, 11am–6pm" }),
      sec("TrustBadges"),
      sec("CallToAction", { variant: "cta-split", heading: "Can't visit?", text: "Write to us and we'll reply within one working day.", ctaLabel: "Email us", ctaHref: "/contact" }),
    ],
  },
  {
    key: "contact-chat",
    label: "Contact · Chat first",
    description: "Lead with WhatsApp and quick answers, then full contact details.",
    family: "contact",
    sections: [
      sec("CallToAction", {
        variant: "cta-band",
        heading: "Chat with us on WhatsApp",
        text: "Order questions, sizes and gifting — we usually reply within the hour during open times.",
        ctaLabel: "Open FAQ",
        ctaHref: "/faq",
      }),
      sec("FAQ", { heading: "Quick answers", source: "manual", items: faqItems.slice(0, 3), variant: "faq-chat" }),
      sec("ContactInfo", { variant: "contact-cards", heading: "Or reach us here" }),
    ],
  },

  // ---------------------------------------------------------------------------
  // FAQ (4)
  // ---------------------------------------------------------------------------
  {
    key: "faq",
    label: "FAQ · Classic",
    description: "Answer common questions about orders, shipping and returns, with a link to contact you.",
    family: "faq",
    sections: [
      sec("FAQ", { heading: "Frequently asked questions", source: "manual", items: faqItems }),
      sec("BrandStory", {
        heading: "Still have a question?",
        body: "Our team is happy to help with anything not covered here.",
        variant: "centered",
        ctaLabel: "Contact us",
        ctaHref: "/contact",
      }),
    ],
  },
  {
    key: "faq-shipping",
    label: "FAQ · Shipping focus",
    description: "Shipping and returns first, then a broader accordion and a contact band.",
    family: "faq",
    sections: [
      sec("RichText", {
        variant: "richtext-centered",
        eyebrow: "Orders & delivery",
        heading: "Shipping and returns",
        body: "Clear answers before you place an order — and after it ships.",
      }),
      sec("FAQ", {
        variant: "faq-cards",
        heading: "Delivery",
        source: "manual",
        items: faqItems.slice(0, 2),
      }),
      sec("FAQ", {
        variant: "accordion",
        heading: "Returns & tracking",
        source: "manual",
        items: faqItems.slice(2),
      }),
      sec("CallToAction", { variant: "cta-card", heading: "Need a hand?", text: "Write to us with your order number.", ctaLabel: "Contact", ctaHref: "/contact" }),
    ],
  },
  {
    key: "faq-accordion",
    label: "FAQ · Split accordion",
    description: "A split layout with heading and accordion, plus trust badges and contact.",
    family: "faq",
    sections: [
      sec("FAQ", { variant: "faq-split", heading: "Questions we hear most", source: "manual", items: faqItems }),
      sec("TrustBadges"),
      sec("CallToAction", { heading: "Something else?", text: "We're one message away.", ctaLabel: "Get in touch", ctaHref: "/contact" }),
    ],
  },
  {
    key: "faq-help-desk",
    label: "FAQ · Help desk",
    description: "Numbered answers, a chatty FAQ variant and a newsletter for updates.",
    family: "faq",
    sections: [
      sec("FAQ", { variant: "faq-numbered", heading: "Help desk", source: "manual", items: faqItems }),
      sec("FAQ", { variant: "faq-chat", heading: "As a conversation", source: "store", limit: 4 }),
      sec("Newsletter", { heading: "Get shipping tips in your inbox" }),
    ],
  },

  // ---------------------------------------------------------------------------
  // Blog index (4)
  // ---------------------------------------------------------------------------
  {
    key: "blogs",
    label: "Blog · Featured",
    description: "A journal landing page: a short intro, your latest stories from the blog and a sign-up.",
    family: "blogs",
    sections: [
      sec("RichText", {
        variant: "richtext-centered",
        eyebrow: "The journal",
        heading: "Stories from our studio",
        body: "Guides, behind-the-scenes notes and the people who make our products.",
      }),
      sec("BlogPosts", { heading: "Latest stories", variant: "blog-featured", limit: 4 }),
      sec("BlogPosts", { heading: "More to read", variant: "blog-grid", limit: 6, viewAllLabel: "All stories" }),
      sec("Newsletter", { heading: "Get new stories in your inbox" }),
    ],
  },
  {
    key: "blogs-magazine",
    label: "Blog · Magazine",
    description: "Hero intro, a dense grid of posts and a soft CTA to subscribe.",
    family: "blogs",
    sections: [
      hero("The magazine", "Long reads, short notes and seasonal edits from the studio."),
      sec("BlogPosts", { heading: "This month", variant: "blog-grid", limit: 9, showExcerpt: true }),
      sec("CallToAction", { variant: "cta-band", heading: "Never miss a story", text: "Join the list for new posts.", ctaLabel: "Browse the shop", ctaHref: "/collections" }),
      sec("Newsletter"),
    ],
  },
  {
    key: "blogs-digest",
    label: "Blog · Digest",
    description: "A list-style digest of posts with a short editorial intro.",
    family: "blogs",
    sections: [
      sec("RichText", {
        variant: "richtext-narrow",
        eyebrow: "Digest",
        heading: "Read next",
        body: "A quieter list of recent notes — skim the titles, open what you need.",
      }),
      sec("BlogPosts", { heading: "Recent", variant: "blog-list", limit: 8, showDate: true }),
      sec("TrustBadges"),
    ],
  },
  {
    key: "blogs-topics",
    label: "Blog · Topics",
    description: "Topic teasers as rich text, featured posts and related stories.",
    family: "blogs",
    sections: [
      sec("RichText", {
        variant: "richtext-columns",
        heading: "Browse by mood",
        body: "Care guides — how we wash, fold and store.\n\nStudio notes — what we're making this week.\n\nPeople — the makers behind the pieces.",
      }),
      sec("BlogPosts", { heading: "Featured", variant: "blog-featured", limit: 3 }),
      sec("BlogPosts", { heading: "Keep reading", variant: "blog-grid", limit: 6 }),
      sec("CallToAction", { variant: "cta-card", heading: "Have a topic idea?", text: "Tell us what you'd like us to write next.", ctaLabel: "Contact", ctaHref: "/contact" }),
    ],
  },

  // ---------------------------------------------------------------------------
  // Blog detail (4) — article-shaped custom pages (not the /blog/[slug] route)
  // ---------------------------------------------------------------------------
  {
    key: "blog-detail",
    label: "Article · Classic",
    description: "A single-article layout: narrow reading column, related posts and a sign-up.",
    family: "blog-detail",
    sections: [
      sec("RichText", {
        variant: "richtext-narrow",
        eyebrow: "Journal",
        heading: "How we pack every order",
        body: "A few notes on the paper, tape and care card that leave with every parcel.\n\nWe start with recycled tissue, add a reusable cloth bag when we can, and slip in a card with wash tips for the piece you ordered.\n\nIf something arrives looking rushed, write to us — packing is part of the product.",
      }),
      sec("BlogPosts", { heading: "Related stories", variant: "blog-list", limit: 3, viewAllLabel: "All stories" }),
      sec("Newsletter", { heading: "More notes like this" }),
    ],
  },
  {
    key: "blog-detail-feature",
    label: "Article · Feature",
    description: "Hero title, long read, gallery break and a closing CTA.",
    family: "blog-detail",
    sections: [
      hero("The indigo season", "Why this year's blues look the way they do — and how we dye in small vats."),
      sec("RichText", {
        variant: "richtext-narrow",
        heading: "From leaf to cloth",
        body: "Indigo asks for patience. We ferment in small batches, dip cloth by hand and hang it where the morning light is kindest.\n\nNo two vats read the same blue — that variation is the point.",
      }),
      sec("Gallery", { heading: "In the dye yard", variant: "gallery-carousel", captions: "overlay" }),
      sec("CallToAction", { variant: "cta-split", heading: "Shop the indigo edit", text: "Pieces from this season's vat.", ctaLabel: "View collection", ctaHref: "/collections" }),
    ],
  },
  {
    key: "blog-detail-notes",
    label: "Article · Notes",
    description: "Boxed notes style with a centred opener and a short related grid.",
    family: "blog-detail",
    sections: [
      sec("RichText", {
        variant: "richtext-centered",
        eyebrow: "Field notes",
        heading: "Three things we learned this week",
        body: "Quick observations from the studio floor.",
      }),
      sec("RichText", {
        variant: "richtext-boxed",
        heading: "The notes",
        body: "1. Natural dyes deepen after the first wash — tell customers gently.\n\n2. A second press after packing removes courier creases.\n\n3. Handwritten order numbers on the outer wrap save five minutes at returns.",
      }),
      sec("BlogPosts", { heading: "More notes", variant: "blog-grid", limit: 3 }),
    ],
  },
  {
    key: "blog-detail-longread",
    label: "Article · Long read",
    description: "Columns intro, deep article body, team byline and testimonials.",
    family: "blog-detail",
    sections: [
      sec("RichText", {
        variant: "richtext-columns",
        eyebrow: "Long read",
        heading: "Why we still cut by hand",
        body: "Machines are faster. Hands still see the grain of the cloth — and that changes every piece that leaves the table.",
      }),
      sec("RichText", {
        variant: "richtext-narrow",
        heading: "The cutting table",
        body: "Each morning we roll fabric the length of the table, weight the corners and mark with chalk that brushes away clean.\n\nPatterns are pinned, not printed. When the cloth shifts, we shift with it — a centimetre here saves a seam there.\n\nIt takes longer. Customers notice in the way a shoulder sits.",
      }),
      sec("Team", { heading: "Written with", variant: "team-circles", columns: 2 }),
      sec("Testimonials", {
        heading: "From readers",
        items: [{ quote: "I didn't expect a packing note to make me tear up.", author: "Sana", location: "Hyderabad", rating: 5 }],
      }),
    ],
  },

  // ---------------------------------------------------------------------------
  // Other layouts
  // ---------------------------------------------------------------------------
  {
    key: "collection",
    label: "Collection",
    description: "Showcase a range: a banner, your collections, the newest products and trust badges.",
    family: "other",
    sections: [
      hero("The new collection", "Fresh designs, made in small batches.", "Shop now", "/collections"),
      sec("CollectionGrid", { heading: "Shop by collection" }),
      sec("ProductGrid", { heading: "New in", source: "newest", viewAllHref: "/collections" }),
      sec("TrustBadges"),
    ],
  },
  {
    key: "gallery",
    label: "Gallery",
    description: "A photo gallery of your looks with captions, an Instagram-style feed and a scrolling strip.",
    family: "other",
    sections: [
      sec("Gallery", { heading: "Gallery", subheading: "Moments from our studio and our customers.", variant: "gallery-masonry" }),
      sec("Gallery", { heading: "Behind the scenes", variant: "gallery-carousel", columns: 4, captions: "overlay" }),
      sec("SocialProof", { heading: "Seen on Instagram" }),
      sec("Marquee", { items: [{ text: "Tag us to be featured" }, { text: "New looks every week" }] }),
    ],
  },
  {
    key: "privacy",
    label: "Privacy Policy",
    description: "A plain policy page with an introduction and one section per topic. Review the wording before you publish.",
    family: "other",
    sections: [
      sec("RichText", {
        heading: "Privacy policy",
        subheading: "Please replace this text with your own policy.",
        body: "This page explains what information we collect when you shop with us, how we use it and the choices you have.",
      }),
      sec("RichText", {
        heading: "Information we collect",
        body: "Your name, contact details and delivery address when you place an order, and basic usage data when you browse the store.",
      }),
      sec("RichText", {
        heading: "How we use it",
        body: "To process and deliver your orders, provide support and, if you agree, send you updates about our products.\n\nWe share details only with the partners needed to complete your order, such as payment and delivery providers.",
      }),
      sec("RichText", {
        heading: "Your choices",
        body: "You can ask us to update or delete your information, or unsubscribe from emails at any time. Write to us using the contact page with any question about this policy.",
        ctaLabel: "Contact us",
        ctaHref: "/contact",
      }),
    ],
  },
  {
    key: "shop",
    label: "Shop",
    description: "A shopping page: promo tiles, categories, best sellers, a featured band and trust badges.",
    family: "other",
    sections: [
      sec("PromoBanner"),
      sec("CategoryGrid", { heading: "Shop by category" }),
      sec("ProductGrid", { heading: "Best sellers", source: "bestselling", viewAllHref: "/collections" }),
      sec("FeatureBand", { heading: "Just landed", featureHeading: "New this week" }),
      sec("TrustBadges"),
    ],
  },
  {
    key: "team",
    label: "Team",
    description: "Introduce the people behind the brand with photos, names, roles and a few numbers.",
    family: "other",
    sections: [
      hero("Meet the team", "The people who design, make and pack every order."),
      sec("Team", {
        heading: "Our people",
        variant: "team-cards",
        members: [
          { name: "Asha", role: "Founder", bio: "Started the brand from her kitchen table in 2015.", imagePath: "", href: "" },
          { name: "Vikram", role: "Head of design", bio: "Turns sketches and old textiles into new collections.", imagePath: "", href: "" },
          { name: "Neha", role: "Customer care", bio: "Answers every message, usually within the hour.", imagePath: "", href: "" },
          { name: "Imran", role: "Packing and dispatch", bio: "Makes sure every parcel leaves on time.", imagePath: "", href: "" },
        ],
        columns: 4,
      }),
      sec("BrandStory", {
        heading: "Small team, big care",
        variant: "band",
        stats: [
          { value: "12", label: "people" },
          { value: "3", label: "cities" },
          { value: "1", label: "shared studio" },
        ],
      }),
      sec("CallToAction", { heading: "Want to work with us?", text: "We're always happy to hear from makers and designers.", ctaLabel: "Get in touch", ctaHref: "/contact" }),
    ],
  },
  {
    key: "why-us",
    label: "Why Us",
    description: "Make the case for your store: promises, numbers, reviews and a sign-up.",
    family: "other",
    sections: [
      sec("TrustBadges"),
      sec("BrandStory", {
        heading: "Why shop with us",
        body: "Quality you can feel, prices that stay fair and a team that answers when you need help.",
        variant: "centered",
        stats: [
          { value: "4.8★", label: "average rating" },
          { value: "48h", label: "dispatch" },
          { value: "7 days", label: "easy returns" },
        ],
      }),
      sec("Testimonials", {
        heading: "Don't just take our word for it",
        variant: "cards",
        items: [
          { quote: "Great quality and the packaging was lovely.", author: "Priya", location: "Mumbai", rating: 5 },
          { quote: "Customer care sorted my exchange in a day.", author: "Karan", location: "Jaipur", rating: 5 },
        ],
      }),
      sec("Marquee", { items: [{ text: "Free shipping on prepaid orders" }, { text: "Cash on delivery" }, { text: "Easy returns" }] }),
      sec("Newsletter"),
    ],
  },
];

/** Families shown first in the Add-page picker (Phase E starters). Home packs are Change-layout only. */
export const PAGE_TEMPLATE_FAMILY_ORDER: PageTemplateFamily[] = ["about", "contact", "faq", "blogs", "blog-detail", "other"];

/** Families shown when changing layout on a built-in template (Contact/FAQ share `page`). */
export const BUILTIN_LAYOUT_FAMILIES: Record<"home" | "page" | "blog", readonly PageTemplateFamily[]> = {
  home: ["home"],
  page: ["about", "contact", "faq", "other"],
  blog: ["blogs"],
};

export function pageTemplate(key: string): PageTemplate | null {
  if (key === BLANK_TEMPLATE.key) return BLANK_TEMPLATE;
  return HOME_LAYOUT_PACKS.find((t) => t.key === key) ?? PAGE_TEMPLATES.find((t) => t.key === key) ?? null;
}

export function pageTemplatesByFamily(family: PageTemplateFamily): PageTemplate[] {
  if (family === "home") return HOME_LAYOUT_PACKS;
  return PAGE_TEMPLATES.filter((t) => t.family === family);
}
