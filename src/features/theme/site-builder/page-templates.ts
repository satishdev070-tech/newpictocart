import { defaultSettings } from "@/features/theme/sections/definitions";
import type { SectionInstance, SectionType } from "@/features/theme/sections/types";

/**
 * Starter layouts for "Add page" in the site builder (pure). Each template is a list of existing
 * home-page section types with defaulted settings plus starter copy; ops.addPage() gives every
 * section its id. Content is placeholder text the seller edits; no images are referenced, so
 * every section renders its own empty-image state until the seller uploads one.
 */

export type PageTemplate = {
  key: string;
  label: string;
  description: string;
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

export const BLANK_TEMPLATE: PageTemplate = { key: "blank", label: "Blank page", description: "Start from an empty page and add sections yourself.", sections: [] };

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    key: "about",
    label: "About",
    description: "Tell your story: a banner, who you are with key numbers, your values and kind words from customers.",
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
      sec("EditorialImageText", {
        heading: "What we believe in",
        body: "Honest materials, fair work and designs you will want to keep for years. Every product is checked by hand before it reaches you.",
        imagePosition: "right",
        ctaLabel: "Shop the collection",
        ctaHref: "/collections",
      }),
      sec("Testimonials", {
        heading: "What our customers say",
        items: [
          { quote: "Beautifully made and arrived quicker than expected.", author: "Ananya", location: "Pune", rating: 5 },
          { quote: "You can feel the care that goes into every piece.", author: "Rahul", location: "Delhi", rating: 5 },
          { quote: "My go-to store for gifts now.", author: "Meera", location: "Bengaluru", rating: 5 },
        ],
      }),
      sec("Newsletter", { heading: "Stay in touch" }),
    ],
  },
  {
    key: "blogs",
    label: "Blogs",
    description: "A journal landing page: a banner, featured stories that link to your blog and a sign-up.",
    sections: [
      hero("The journal", "Stories, guides and behind-the-scenes notes from our studio.", "Read the blog", "/blog"),
      sec("EditorialImageText", {
        eyebrow: "Featured",
        heading: "Behind the making",
        body: "A look at the people and the process behind our latest collection.",
        ctaLabel: "Read more",
        ctaHref: "/blog",
      }),
      sec("EditorialImageText", {
        eyebrow: "Guide",
        heading: "How to care for your pieces",
        body: "Simple tips to keep your favourites looking new for longer.",
        imagePosition: "right",
        ctaLabel: "Read more",
        ctaHref: "/blog",
      }),
      sec("Newsletter", { heading: "Get new stories in your inbox" }),
    ],
  },
  {
    key: "collection",
    label: "Collection",
    description: "Showcase a range: a banner, your collections, the newest products and trust badges.",
    sections: [
      hero("The new collection", "Fresh designs, made in small batches.", "Shop now", "/collections"),
      sec("CollectionGrid", { heading: "Shop by collection" }),
      sec("ProductGrid", { heading: "New in", source: "newest", viewAllHref: "/collections" }),
      sec("TrustBadges"),
    ],
  },
  {
    key: "contact",
    label: "Contact",
    description: "Help customers reach you: a banner, how to get in touch and common questions.",
    sections: [
      hero("Get in touch", "We usually reply within one working day."),
      sec("EditorialImageText", {
        heading: "Write to us or visit",
        body: "Questions about an order, sizes or bulk gifting? Send us a message and our team will help you out.",
        ctaLabel: "Contact us",
        ctaHref: "/contact",
      }),
      sec("FAQ", { heading: "Before you write", source: "store", limit: 4 }),
      sec("TrustBadges"),
    ],
  },
  {
    key: "faq",
    label: "FAQ",
    description: "Answer common questions about orders, shipping and returns, with a link to contact you.",
    sections: [
      sec("FAQ", {
        heading: "Frequently asked questions",
        source: "manual",
        items: [
          { question: "How long does delivery take?", answer: "Most orders are delivered within 3–7 working days." },
          { question: "Do you offer cash on delivery?", answer: "Yes, cash on delivery is available on most PIN codes." },
          { question: "Can I return a product?", answer: "You can request a return within 7 days of delivery." },
          { question: "How do I track my order?", answer: "We send a tracking link by email and SMS once your order ships." },
        ],
      }),
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
    key: "gallery",
    label: "Gallery",
    description: "An image gallery of your looks, an Instagram-style feed and a scrolling strip.",
    sections: [
      sec("Lookbook", { heading: "Gallery", subheading: "Moments from our studio and our customers.", layout: "masonry" }),
      sec("SocialProof", { heading: "Seen on Instagram" }),
      sec("Marquee", { items: [{ text: "Tag us to be featured" }, { text: "New looks every week" }] }),
    ],
  },
  {
    key: "privacy",
    label: "Privacy Policy",
    description: "A plain policy page with an introduction and one section per topic. Review the wording before you publish.",
    sections: [
      sec("BrandStory", {
        heading: "Privacy policy",
        body: "This page explains what information we collect when you shop with us, how we use it and the choices you have. Please replace this text with your own policy.",
        variant: "centered",
      }),
      sec("FAQ", {
        heading: "",
        source: "manual",
        items: [
          { question: "Information we collect", answer: "Your name, contact details and delivery address when you place an order, and basic usage data when you browse the store." },
          { question: "How we use it", answer: "To process and deliver your orders, provide support and, if you agree, send you updates about our products." },
          { question: "Sharing", answer: "We share details only with the partners needed to complete your order, such as payment and delivery providers." },
          { question: "Your choices", answer: "You can ask us to update or delete your information, or unsubscribe from emails at any time." },
          { question: "Contact", answer: "Write to us using the contact page with any question about this policy." },
        ],
      }),
    ],
  },
  {
    key: "shop",
    label: "Shop",
    description: "A shopping page: promo tiles, categories, best sellers, a featured band and trust badges.",
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
    description: "Introduce the people behind the brand with photos, names and a few numbers.",
    sections: [
      hero("Meet the team", "The people who design, make and pack every order."),
      sec("Lookbook", {
        heading: "Our people",
        layout: "arches",
        looks: [
          { imagePath: "", alt: "Team member", caption: "Founder", productId: "" },
          { imagePath: "", alt: "Team member", caption: "Head of design", productId: "" },
          { imagePath: "", alt: "Team member", caption: "Customer care", productId: "" },
        ],
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
    ],
  },
  {
    key: "why-us",
    label: "Why Us",
    description: "Make the case for your store: promises, numbers, reviews and a sign-up.",
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

export function pageTemplate(key: string): PageTemplate | null {
  return key === BLANK_TEMPLATE.key ? BLANK_TEMPLATE : (PAGE_TEMPLATES.find((t) => t.key === key) ?? null);
}
