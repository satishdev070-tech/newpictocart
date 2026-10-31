import { industryName, industryShort, type IndustrySlug } from "@/features/stores/industries";
import { isSubcategory, subcategoryLabel } from "@/features/stores/subcategories";
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
type ProductSeed = {
  title: string;
  categoryIndex: number;
  pricePaise: number;
  compareAtPaise: number | null;
  featured?: boolean;
};

const FASHION_ETHNIC: { categories: CategorySeed[]; products: ProductSeed[] } = {
  categories: [
    { name: "Kurtas & Tunics", description: "Everyday cotton and linen kurtas for work, travel and festivals across India." },
    { name: "Sarees & Ethnic", description: "Handloom sarees, drapes and festive sets with blouse-friendly styling." },
    { name: "Men's Ethnic Wear", description: "Kurtas, nehru jackets and festive sets tailored for Indian occasions." },
    { name: "Dupattas & Stoles", description: "Handloom stoles and dupattas that finish ethnic looks." },
    { name: "Festive Sets", description: "Coordinated ethnic sets ready for weddings and celebrations." },
  ],
  products: [
    { title: "Indigo Block-Print Cotton Kurta", categoryIndex: 0, pricePaise: 149_900, compareAtPaise: 199_900, featured: true },
    { title: "Banarasi Silk Saree — Ruby", categoryIndex: 1, pricePaise: 349_900, compareAtPaise: 429_900, featured: true },
    { title: "Festive Kurta Set with Nehru Jacket", categoryIndex: 2, pricePaise: 279_900, compareAtPaise: 329_900 },
    { title: "Handloom Stole — Ombre", categoryIndex: 3, pricePaise: 79_900, compareAtPaise: 99_900 },
    { title: "Chiffon Party Saree with Blouse Piece", categoryIndex: 1, pricePaise: 219_900, compareAtPaise: null },
  ],
};

const FASHION_ACTIVEWEAR: { categories: CategorySeed[]; products: ProductSeed[] } = {
  categories: [
    { name: "Training Tops", description: "Breathable tees and tanks built for Indian gym and outdoor sessions." },
    { name: "Leggings & Tights", description: "High-support leggings for yoga, runs and studio classes." },
    { name: "Track Pants", description: "Lightweight track pants for warm-ups and everyday movement." },
    { name: "Sports Bras", description: "Supportive sports bras for high- and mid-impact workouts." },
    { name: "Outer Layers", description: "Jackets and hoodies for cool mornings and post-workout cover." },
  ],
  products: [
    { title: "Performance Training Tee", categoryIndex: 0, pricePaise: 99_900, compareAtPaise: 129_900, featured: true },
    { title: "High-Waist Yoga Leggings", categoryIndex: 1, pricePaise: 149_900, compareAtPaise: 189_900, featured: true },
    { title: "Slim Fit Track Pants", categoryIndex: 2, pricePaise: 129_900, compareAtPaise: null },
    { title: "Medium-Support Sports Bra", categoryIndex: 3, pricePaise: 89_900, compareAtPaise: 109_900 },
    { title: "Lightweight Running Jacket", categoryIndex: 4, pricePaise: 179_900, compareAtPaise: null },
  ],
};

const FASHION_WESTERN: { categories: CategorySeed[]; products: ProductSeed[] } = {
  categories: [
    { name: "Tops & Shirts", description: "Everyday shirts and tops for work and weekends." },
    { name: "Bottoms", description: "Jeans, chinos and trousers with easy Indian sizing." },
    { name: "Dresses", description: "Casual and occasion dresses for city life." },
    { name: "Outerwear", description: "Jackets and layers for transitional weather." },
    { name: "Accessories", description: "Belts and finishing pieces for western outfits." },
  ],
  products: [
    { title: "Classic Oxford Cotton Shirt", categoryIndex: 0, pricePaise: 129_900, compareAtPaise: 159_900, featured: true },
    { title: "Slim Fit Stretch Chinos", categoryIndex: 1, pricePaise: 149_900, compareAtPaise: null, featured: true },
    { title: "Midi Wrap Dress", categoryIndex: 2, pricePaise: 189_900, compareAtPaise: 229_900 },
    { title: "Washed Denim Jacket", categoryIndex: 3, pricePaise: 219_900, compareAtPaise: null },
    { title: "Reversible Leather Belt", categoryIndex: 4, pricePaise: 79_900, compareAtPaise: 99_900 },
  ],
};

const FASHION_MENS: { categories: CategorySeed[]; products: ProductSeed[] } = {
  categories: [
    { name: "Shirts", description: "Formal and casual shirts for everyday wear." },
    { name: "Trousers", description: "Chinos and formal trousers with reliable fits." },
    { name: "T-Shirts", description: "Everyday tees in soft cotton." },
    { name: "Ethnic Wear", description: "Kurtas and festive sets for occasions." },
    { name: "Outerwear", description: "Jackets and light layers." },
  ],
  products: [
    { title: "Crisp Formal Cotton Shirt", categoryIndex: 0, pricePaise: 139_900, compareAtPaise: 169_900, featured: true },
    { title: "Tailored Office Chinos", categoryIndex: 1, pricePaise: 159_900, compareAtPaise: null },
    { title: "Everyday Crew-Neck Tee", categoryIndex: 2, pricePaise: 69_900, compareAtPaise: 89_900, featured: true },
    { title: "Classic White Cotton Kurta", categoryIndex: 3, pricePaise: 99_900, compareAtPaise: null },
    { title: "Lightweight Bomber Jacket", categoryIndex: 4, pricePaise: 249_900, compareAtPaise: 299_900 },
  ],
};

const FASHION_WOMENS: { categories: CategorySeed[]; products: ProductSeed[] } = {
  categories: [
    { name: "Tops", description: "Blouses and everyday tops." },
    { name: "Bottoms", description: "Pants, skirts and easy silhouettes." },
    { name: "Dresses", description: "Day-to-evening dresses." },
    { name: "Ethnic Wear", description: "Kurtis and festive ethnic pieces." },
    { name: "Accessories", description: "Scarves and finishing accents." },
  ],
  products: [
    { title: "Flowy Everyday Blouse", categoryIndex: 0, pricePaise: 119_900, compareAtPaise: 149_900, featured: true },
    { title: "Wide-Leg Linen Pants", categoryIndex: 1, pricePaise: 159_900, compareAtPaise: null },
    { title: "A-Line Cotton Dress", categoryIndex: 2, pricePaise: 179_900, compareAtPaise: 219_900, featured: true },
    { title: "Office-Friendly Linen Kurta", categoryIndex: 3, pricePaise: 129_900, compareAtPaise: null },
    { title: "Printed Silk Scarf", categoryIndex: 4, pricePaise: 69_900, compareAtPaise: 89_900 },
  ],
};

const FASHION_KIDS: { categories: CategorySeed[]; products: ProductSeed[] } = {
  categories: [
    { name: "Tops", description: "Soft tees and shirts for kids." },
    { name: "Bottoms", description: "Comfortable pants and shorts." },
    { name: "Ethnic Wear", description: "Festive kids ethnic sets." },
    { name: "Dresses", description: "Playful dresses for little ones." },
    { name: "Sets", description: "Matching co-ords for easy dressing." },
  ],
  products: [
    { title: "Soft Cotton Kids Tee", categoryIndex: 0, pricePaise: 49_900, compareAtPaise: 69_900, featured: true },
    { title: "Easy-Fit Kids Joggers", categoryIndex: 1, pricePaise: 79_900, compareAtPaise: null },
    { title: "Festive Kids Kurta Set", categoryIndex: 2, pricePaise: 129_900, compareAtPaise: 159_900, featured: true },
    { title: "Printed Cotton Frock", categoryIndex: 3, pricePaise: 89_900, compareAtPaise: null },
    { title: "Matching Twin Co-ord Set", categoryIndex: 4, pricePaise: 109_900, compareAtPaise: 139_900 },
  ],
};

const FASHION_FUSION: { categories: CategorySeed[]; products: ProductSeed[] } = {
  categories: [
    { name: "Fusion Tops", description: "Indo-western tops for modern occasions." },
    { name: "Occasion Wear", description: "Dresses and sets that mix tradition with ease." },
    { name: "Bottoms", description: "Palazzos, pants and fusion silhouettes." },
    { name: "Jackets", description: "Nehru and cropped jackets for layering." },
    { name: "Accessories", description: "Potlis and accents for festive looks." },
  ],
  products: [
    { title: "Indo-Western Cape Top", categoryIndex: 0, pricePaise: 169_900, compareAtPaise: 199_900, featured: true },
    { title: "Fusion Anarkali Dress", categoryIndex: 1, pricePaise: 249_900, compareAtPaise: 299_900, featured: true },
    { title: "Printed Palazzo Pants", categoryIndex: 2, pricePaise: 119_900, compareAtPaise: null },
    { title: "Cropped Nehru Jacket", categoryIndex: 3, pricePaise: 189_900, compareAtPaise: 229_900 },
    { title: "Embroidered Potli Bag", categoryIndex: 4, pricePaise: 89_900, compareAtPaise: null },
  ],
};

/** Default fashion clothing pack — no footwear / jutti. */
const FASHION_GENERAL = FASHION_ETHNIC;

const BAGS_CATALOG: { categories: CategorySeed[]; products: ProductSeed[] } = {
  categories: [
    { name: "Handbags", description: "Everyday and occasion handbags with sturdy hardware." },
    { name: "Backpacks", description: "Work and travel backpacks for Indian commutes." },
    { name: "Wallets", description: "Slim wallets and card holders." },
    { name: "Luggage", description: "Cabin and check-in bags built for frequent flyers." },
    { name: "Travel Gear", description: "Organisers and pouches for smoother trips." },
  ],
  products: [
    { title: "Structured Leather Handbag", categoryIndex: 0, pricePaise: 249_900, compareAtPaise: 299_900, featured: true },
    { title: "Everyday Canvas Backpack", categoryIndex: 1, pricePaise: 179_900, compareAtPaise: 219_900, featured: true },
    { title: "Slim Bifold Wallet", categoryIndex: 2, pricePaise: 99_900, compareAtPaise: null },
    { title: "Cabin Soft-Case Trolley", categoryIndex: 3, pricePaise: 449_900, compareAtPaise: 529_900 },
    { title: "Travel Organiser Pouch", categoryIndex: 4, pricePaise: 79_900, compareAtPaise: 99_900 },
  ],
};

const FOOTWEAR_ETHNIC: { categories: CategorySeed[]; products: ProductSeed[] } = {
  categories: [
    { name: "Juttis", description: "Handcrafted juttis for festive and everyday ethnic looks." },
    { name: "Kolhapuris", description: "Classic leather kolhapuris for Indian streets." },
    { name: "Mojaris", description: "Embellished mojaris for weddings and occasions." },
    { name: "Sandals", description: "Ethnic sandals with comfort soles." },
    { name: "Care", description: "Polish and care kits for leather footwear." },
  ],
  products: [
    { title: "Everyday Jutti — Gold Thread", categoryIndex: 0, pricePaise: 109_900, compareAtPaise: null, featured: true },
    { title: "Leather Kolhapuri Sandals", categoryIndex: 1, pricePaise: 119_900, compareAtPaise: 149_900, featured: true },
    { title: "Wedding Mojari — Maroon", categoryIndex: 2, pricePaise: 159_900, compareAtPaise: 189_900 },
    { title: "Braided Ethnic Sandal", categoryIndex: 3, pricePaise: 99_900, compareAtPaise: null },
    { title: "Leather Care Kit", categoryIndex: 4, pricePaise: 49_900, compareAtPaise: 69_900 },
  ],
};

const FOOTWEAR_GENERAL: { categories: CategorySeed[]; products: ProductSeed[] } = {
  categories: [
    { name: "Sneakers", description: "Everyday sneakers for city walks." },
    { name: "Formal Shoes", description: "Office-ready formal footwear." },
    { name: "Sandals", description: "Open sandals for warm weather." },
    { name: "Sports Shoes", description: "Trainers for runs and gym sessions." },
    { name: "Kids Footwear", description: "Durable shoes sized for growing feet." },
  ],
  products: [
    { title: "Everyday Canvas Sneakers", categoryIndex: 0, pricePaise: 199_900, compareAtPaise: 249_900, featured: true },
    { title: "Classic Formal Oxfords", categoryIndex: 1, pricePaise: 299_900, compareAtPaise: null, featured: true },
    { title: "Cushioned Slide Sandals", categoryIndex: 2, pricePaise: 99_900, compareAtPaise: 129_900 },
    { title: "Road Running Trainers", categoryIndex: 3, pricePaise: 349_900, compareAtPaise: 399_900 },
    { title: "Kids Velcro School Shoes", categoryIndex: 4, pricePaise: 129_900, compareAtPaise: null },
  ],
};

function resolveNicheLabel(industry: IndustrySlug, subcategory?: string | null, niche?: string | null): string {
  const sub = subcategory?.trim();
  if (sub) {
    const label = subcategoryLabel(industry, sub);
    if (label) return label;
    if (!isSubcategory(industry, sub)) return sub.slice(0, 60);
  }
  const custom = niche?.trim();
  if (custom) {
    // Quiz extras: `sub:slug2,Custom Niche`
    if (custom.toLowerCase().startsWith("sub:")) {
      const parts = custom
        .slice(4)
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      const free = parts.find((p) => !isSubcategory(industry, p));
      if (free) return free.slice(0, 60);
      const first = parts[0];
      if (first) return subcategoryLabel(industry, first) ?? first.slice(0, 60);
    }
    return custom.slice(0, 60);
  }
  return industryShort(industry);
}

function defaultCategories(industry: IndustrySlug, nicheLabel: string): CategorySeed[] {
  const short = nicheLabel;
  const full = nicheLabel;
  return [
    { name: `${short} Essentials`, description: `Core ${full.toLowerCase()} picks customers reorder every season.` },
    { name: "New Arrivals", description: `Fresh ${short.toLowerCase()} styles added this month with fast dispatch.` },
    { name: "Bestsellers", description: `Top-rated ${short.toLowerCase()} products loved by shoppers across India.` },
    { name: "Premium Picks", description: `Higher-finish ${short.toLowerCase()} with quality checks and gift-ready packaging.` },
    { name: "Everyday Value", description: `Affordable ${short.toLowerCase()} for daily use without compromising on basics.` },
  ];
}

function defaultProducts(nicheLabel: string): ProductSeed[] {
  const titles = [
    `${nicheLabel} Starter Kit`,
    `Signature ${nicheLabel} Pack`,
    `Premium ${nicheLabel} Edition`,
    `Everyday ${nicheLabel} Classic`,
    `Bestselling ${nicheLabel} Pick`,
  ];
  return titles.map((title, i) => ({
    title,
    categoryIndex: i % READY_STORE_COUNTS.categories,
    pricePaise: 79_900 + i * 12_500,
    compareAtPaise: i % 3 === 0 ? 79_900 + i * 12_500 + 40_000 : null,
    featured: i === 0 || i === 2,
  }));
}

function fashionCatalog(subcategory?: string | null): { categories: CategorySeed[]; products: ProductSeed[] } {
  switch (subcategory?.trim()) {
    case "ethnic":
      return FASHION_ETHNIC;
    case "activewear":
      return FASHION_ACTIVEWEAR;
    case "western":
      return FASHION_WESTERN;
    case "mens":
      return FASHION_MENS;
    case "womens":
      return FASHION_WOMENS;
    case "kids-wear":
      return FASHION_KIDS;
    case "fusion":
      return FASHION_FUSION;
    default:
      return FASHION_GENERAL;
  }
}

function footwearCatalog(subcategory?: string | null): { categories: CategorySeed[]; products: ProductSeed[] } {
  if (subcategory?.trim() === "ethnic-footwear") return FOOTWEAR_ETHNIC;
  return FOOTWEAR_GENERAL;
}

/** Niche-aware catalogue seeds used by the deterministic ready-store fallback. */
export function catalogFor(
  industry: IndustrySlug,
  subcategory?: string | null,
): { categories: CategorySeed[]; products: ProductSeed[] } {
  if (industry === "fashion") return fashionCatalog(subcategory);
  if (industry === "bags") return BAGS_CATALOG;
  if (industry === "footwear") return footwearCatalog(subcategory);
  const nicheLabel = resolveNicheLabel(industry, subcategory, null);
  return { categories: defaultCategories(industry, nicheLabel), products: defaultProducts(nicheLabel) };
}

const INDIAN_CITIES = ["Bengaluru", "Mumbai", "Delhi", "Hyderabad", "Chennai", "Pune", "Kolkata"];

/**
 * Deterministic ready-store plan when Sarvam is unavailable or returns invalid JSON.
 * Validates against readyStorePlanSchema before return.
 */
export function buildFallbackReadyStorePlan(args: {
  storeName: string;
  industry: IndustrySlug;
  subcategory?: string | null;
  niche?: string | null;
  brief?: string;
}): ReadyStorePlan {
  const industryLabel = industryName(args.industry);
  const nicheLabel = resolveNicheLabel(args.industry, args.subcategory, args.niche);
  const { categories: catSeeds, products: prodSeeds } = catalogFor(args.industry, args.subcategory);
  // Prefer niche-aware defaults when industry has no specialised pack but a custom niche was given.
  const useNicheDefaults =
    args.industry !== "fashion" &&
    args.industry !== "bags" &&
    args.industry !== "footwear" &&
    Boolean(args.niche?.trim() || args.subcategory?.trim());
  const categoriesSource = useNicheDefaults ? defaultCategories(args.industry, nicheLabel) : catSeeds;
  const productsSource = useNicheDefaults ? defaultProducts(nicheLabel) : prodSeeds;

  const categorySlugs = uniqueSlugs(categoriesSource.map((c) => c.name));

  const categories = categoriesSource.map((c, i) => ({
    name: c.name,
    slug: categorySlugs[i]!,
    description: c.description,
  }));

  const productTitleSlugs = uniqueSlugs(productsSource.map((p) => p.title));
  const products = productsSource.map((p, i) => {
    const catSlug = categorySlugs[p.categoryIndex]!;
    return {
      title: p.title,
      slug: productTitleSlugs[i]!,
      categorySlug: catSlug,
      shortDescription: `${p.title} from ${args.storeName} — curated for ${nicheLabel}.`,
      description: [
        `${args.storeName} brings you ${p.title.toLowerCase()} designed for Indian customers.`,
        `Part of our ${categoriesSource[p.categoryIndex]!.name} range with transparent pricing and reliable dispatch.`,
        args.brief?.trim()
          ? `About the brand: ${args.brief.trim()}`
          : `Shop ${nicheLabel.toLowerCase()} with confidence and easy returns.`,
      ].join(" "),
      pricePaise: p.pricePaise,
      compareAtPaise: p.compareAtPaise,
      featured: p.featured ?? false,
      tags: ["bestseller", args.industry, ...(args.subcategory ? [args.subcategory] : [])],
      seoTitle: `${p.title} | ${args.storeName}`.slice(0, 120),
      seoDescription: `Buy ${p.title} online at ${args.storeName}. ${nicheLabel} with fast delivery across India.`.slice(
        0,
        320,
      ),
      hsnCode: "6109",
      weightGrams: 400 + (i % 3) * 100,
    };
  });

  const collectionLabels = ["Bestsellers", "New Arrivals", "Festive Edit"];
  const collectionSlugs = uniqueSlugs(collectionLabels);
  const collections = collectionLabels.map((title, i) => ({
    title,
    slug: collectionSlugs[i]!,
    description: `${title} from ${args.storeName} — hand-picked ${nicheLabel.toLowerCase()} for your storefront.`,
  }));

  const heroSlides = [
    {
      eyebrow: nicheLabel,
      heading: `Welcome to ${args.storeName}`.slice(0, 120),
      subheading: (
        args.brief?.trim().replace(/\s+/g, " ") || `Discover ${nicheLabel.toLowerCase()} made for modern Indian shoppers.`
      ).slice(0, 240),
      ctaLabel: "Shop now",
      ctaHref: `/categories/${categorySlugs[0]}`,
    },
    {
      eyebrow: "New season",
      heading: `Fresh ${nicheLabel} picks`.slice(0, 120),
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
    excerpt: `${title} for customers shopping ${nicheLabel.toLowerCase()} at ${args.storeName}.`,
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

  const storyBase = `${args.storeName} is a ${nicheLabel.toLowerCase()} brand serving customers across India with curated products and clear policies.`;
  const story = (args.brief?.trim() ? `${storyBase} ${args.brief.trim().replace(/\s+/g, " ")}` : storyBase).slice(0, 1500);

  const plan = {
    tagline: `${args.storeName} — ${nicheLabel} you can trust`.slice(0, 160),
    story: story.slice(0, 2000),
    seo: {
      title: `${args.storeName} | ${nicheLabel} Online`.slice(0, 70),
      description: `Shop ${nicheLabel.toLowerCase()} at ${args.storeName}. Fast delivery, easy returns and secure checkout.`.slice(
        0,
        160,
      ),
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
