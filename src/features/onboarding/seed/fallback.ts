import { industryName, industryShort, type IndustrySlug } from "@/features/stores/industries";
import { READY_STORE_COUNTS } from "./counts";
import { readyStorePlanSchema, type ReadyStorePlan } from "./schemas";

function toSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function uniqueSlugs(labels: string[]): string[] {
  const used = new Set<string>();
  return labels.map((label, i) => {
    let s = toSlug(label) || `item-${i + 1}`;
    let n = 2;
    while (used.has(s)) {
      s = `${toSlug(label) || `item-${i + 1}`}-${n}`;
      n += 1;
    }
    used.add(s);
    return s;
  });
}

type CategorySeed = { name: string; description: string };
type ProductSeed = { title: string; categoryIndex: number; pricePaise: number; compareAtPaise: number | null; featured?: boolean };

const FASHION_CATEGORIES: CategorySeed[] = [
  { name: "Kurtas & Tunics", description: "Everyday cotton and linen kurtas for work, travel and festivals across India." },
  { name: "Sarees & Ethnic", description: "Handloom sarees, drapes and festive sets with blouse-friendly styling." },
  { name: "Men's Ethnic Wear", description: "Kurtas, nehru jackets and festive sets tailored for Indian occasions." },
  { name: "Accessories", description: "Stoles, bags and jewellery that finish your look without the markup." },
  { name: "Footwear", description: "Juttis, kolhapuris and everyday sandals built for Indian streets." },
];

const FASHION_PRODUCTS: ProductSeed[] = [
  { title: "Indigo Block-Print Cotton Kurta", categoryIndex: 0, pricePaise: 149_900, compareAtPaise: 199_900, featured: true },
  { title: "Office-Friendly Linen Kurta", categoryIndex: 0, pricePaise: 129_900, compareAtPaise: null },
  { title: "Banarasi Silk Saree — Ruby", categoryIndex: 1, pricePaise: 349_900, compareAtPaise: 429_900, featured: true },
  { title: "Chiffon Party Saree with Blouse Piece", categoryIndex: 1, pricePaise: 219_900, compareAtPaise: null },
  { title: "Festive Kurta Set with Nehru Jacket", categoryIndex: 2, pricePaise: 279_900, compareAtPaise: 329_900 },
  { title: "Classic White Cotton Kurta", categoryIndex: 2, pricePaise: 99_900, compareAtPaise: null },
  { title: "Handloom Stole — Ombre", categoryIndex: 3, pricePaise: 79_900, compareAtPaise: 99_900 },
  { title: "Embroidered Potli Bag", categoryIndex: 3, pricePaise: 89_900, compareAtPaise: null },
  { title: "Leather Kolhapuri Sandals", categoryIndex: 4, pricePaise: 119_900, compareAtPaise: 149_900, featured: true },
  { title: "Everyday Jutti — Gold Thread", categoryIndex: 4, pricePaise: 109_900, compareAtPaise: null },
];

function defaultCategories(industry: IndustrySlug): CategorySeed[] {
  const short = industryShort(industry);
  const full = industryName(industry);
  return [
    { name: `${short} Essentials`, description: `Core ${full.toLowerCase()} picks customers reorder every season.` },
    { name: "New Arrivals", description: `Fresh ${short.toLowerCase()} styles added this month with fast dispatch.` },
    { name: "Bestsellers", description: `Top-rated ${short.toLowerCase()} products loved by shoppers across India.` },
    { name: "Premium Picks", description: `Higher-finish ${short.toLowerCase()} with quality checks and gift-ready packaging.` },
    { name: "Everyday Value", description: `Affordable ${short.toLowerCase()} for daily use without compromising on basics.` },
  ];
}

function defaultProducts(industry: IndustrySlug): ProductSeed[] {
  const short = industryShort(industry);
  const titles = [
    `${short} Starter Kit`,
    `Signature ${short} Pack`,
    `Premium ${short} Edition`,
    `Compact ${short} Set`,
    `Family ${short} Bundle`,
    `Travel ${short} Kit`,
    `Festive ${short} Special`,
    `Everyday ${short} Classic`,
    `Limited ${short} Drop`,
    `Bestselling ${short} Pick`,
  ];
  return titles.map((title, i) => ({
    title,
    categoryIndex: i % READY_STORE_COUNTS.categories,
    pricePaise: 79_900 + i * 12_500,
    compareAtPaise: i % 3 === 0 ? 79_900 + i * 12_500 + 40_000 : null,
    featured: i === 0 || i === 2,
  }));
}

function catalogFor(industry: IndustrySlug): { categories: CategorySeed[]; products: ProductSeed[] } {
  if (industry === "fashion") {
    return { categories: FASHION_CATEGORIES, products: FASHION_PRODUCTS };
  }
  return { categories: defaultCategories(industry), products: defaultProducts(industry) };
}

const INDIAN_CITIES = ["Bengaluru", "Mumbai", "Delhi", "Hyderabad", "Chennai", "Pune", "Kolkata"];

/**
 * Deterministic ready-store plan when Sarvam is unavailable or returns invalid JSON.
 * Validates against readyStorePlanSchema before return.
 */
export function buildFallbackReadyStorePlan(args: {
  storeName: string;
  industry: IndustrySlug;
  brief?: string;
}): ReadyStorePlan {
  const industryLabel = industryName(args.industry);
  const { categories: catSeeds, products: prodSeeds } = catalogFor(args.industry);
  const categorySlugs = uniqueSlugs(catSeeds.map((c) => c.name));

  const categories = catSeeds.map((c, i) => ({
    name: c.name,
    slug: categorySlugs[i]!,
    description: c.description,
  }));

  const productTitleSlugs = uniqueSlugs(prodSeeds.map((p) => p.title));
  const products = prodSeeds.map((p, i) => {
    const catSlug = categorySlugs[p.categoryIndex]!;
    return {
      title: p.title,
      slug: productTitleSlugs[i]!,
      categorySlug: catSlug,
      shortDescription: `${p.title} from ${args.storeName} — curated for ${industryLabel}.`,
      description: [
        `${args.storeName} brings you ${p.title.toLowerCase()} designed for Indian customers.`,
        `Part of our ${catSeeds[p.categoryIndex]!.name} range with transparent pricing and reliable dispatch.`,
        args.brief?.trim() ? `About the brand: ${args.brief.trim()}` : `Shop ${industryLabel} with confidence and easy returns.`,
      ].join(" "),
      pricePaise: p.pricePaise,
      compareAtPaise: p.compareAtPaise,
      featured: p.featured ?? false,
      tags: ["bestseller", args.industry],
      seoTitle: `${p.title} | ${args.storeName}`.slice(0, 120),
      seoDescription: `Buy ${p.title} online at ${args.storeName}. ${industryLabel} with fast delivery across India.`.slice(0, 320),
      hsnCode: "6109",
      weightGrams: 400 + (i % 3) * 100,
    };
  });

  const collectionLabels = ["Bestsellers", "New Arrivals", "Festive Edit"];
  const collectionSlugs = uniqueSlugs(collectionLabels);
  const collections = collectionLabels.map((title, i) => ({
    title,
    slug: collectionSlugs[i]!,
    description: `${title} from ${args.storeName} — hand-picked ${industryLabel.toLowerCase()} for your storefront.`,
  }));

  const heroSlides = [
    {
      eyebrow: industryLabel,
      heading: `Welcome to ${args.storeName}`.slice(0, 120),
      subheading: (args.brief?.trim().replace(/\s+/g, " ") || `Discover ${industryLabel.toLowerCase()} made for modern Indian shoppers.`).slice(0, 240),
      ctaLabel: "Shop now",
      ctaHref: `/categories/${categorySlugs[0]}`,
    },
    {
      eyebrow: "New season",
      heading: `Fresh ${industryShort(args.industry)} picks`,
      subheading: "Curated styles with transparent pricing and dispatch you can trust.",
      ctaLabel: "View collection",
      ctaHref: `/collections/${collectionSlugs[0]}`,
    },
  ];

  const blogTopics = [
    "How to choose the right size online",
    "Care tips to make products last longer",
    "Festive gifting ideas from our catalogue",
    "Behind the brand story",
    "Shipping, returns and COD explained",
    "Styling ideas for everyday wear",
  ];
  const blogSlugs = uniqueSlugs(blogTopics);
  const blogs = blogTopics.map((title, i) => ({
    title: `${title} — ${args.storeName}`.slice(0, 200),
    slug: blogSlugs[i]!,
    excerpt: `${title} for customers shopping ${industryLabel.toLowerCase()} at ${args.storeName}.`,
    paragraphs: [
      `${args.storeName} is built for sellers in ${industryLabel}. ${args.brief?.trim() ?? "We focus on quality, honest descriptions and reliable fulfilment."}`,
      `This guide covers ${title.toLowerCase()} so your customers feel confident before they checkout.`,
      "Questions? Reach out on WhatsApp or email — we reply quickly during business hours.",
    ],
    seoTitle: title.slice(0, 120),
    seoDescription: `${title} at ${args.storeName}. Tips for Indian online shoppers.`.slice(0, 320),
    tags: [args.industry, "guide"],
  }));

  const testimonialQuotes = [
    `Quality matches the photos — my order from ${args.storeName} arrived in three days.`,
    "Easy returns and clear sizing notes. Will shop again for festive gifting.",
    "Packaging was neat and the product felt premium for the price.",
    "COD worked smoothly and support answered my WhatsApp query the same day.",
    "Finally a storefront that feels trustworthy for Indian delivery timelines.",
  ];
  const testimonialAuthors = ["Ananya R.", "Rahul K.", "Priya M.", "Vikram S.", "Neha T."];
  const testimonials = testimonialQuotes.map((quote, i) => ({
    quote: quote.slice(0, 400),
    author: testimonialAuthors[i]!,
    location: INDIAN_CITIES[i % INDIAN_CITIES.length]!,
    rating: 5 as const,
  }));

  const storyBase = `${args.storeName} is a ${industryLabel.toLowerCase()} brand serving customers across India with curated products and clear policies.`;
  const story = (args.brief?.trim() ? `${storyBase} ${args.brief.trim().replace(/\s+/g, " ")}` : storyBase).slice(0, 1500);

  const plan = {
    tagline: `${args.storeName} — ${industryShort(args.industry)} you can trust`.slice(0, 160),
    story: story.slice(0, 2000),
    seo: {
      title: `${args.storeName} | ${industryLabel} Online`.slice(0, 70),
      description: `Shop ${industryLabel.toLowerCase()} at ${args.storeName}. Fast delivery, easy returns and secure checkout.`.slice(0, 160),
    },
    categories,
    products,
    collections,
    hero: { slides: heroSlides },
    blogs,
    testimonials,
  };

  return readyStorePlanSchema.parse(plan);
}
