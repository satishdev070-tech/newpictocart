/**
 * Per-industry subcategories for /start onboarding (Phase 1 five-screen flow).
 * Pure config — keep in sync with IndustrySlug in industries.ts.
 */
import { INDUSTRY_SLUGS, type IndustrySlug } from "./industries";

export type Subcategory = { slug: string; label: string };

const SUBCATEGORIES: Record<IndustrySlug, readonly Subcategory[]> = {
  fashion: [
    { slug: "ethnic", label: "Ethnic wear" },
    { slug: "western", label: "Western wear" },
    { slug: "kids-wear", label: "Kids wear" },
    { slug: "mens", label: "Men's clothing" },
    { slug: "womens", label: "Women's clothing" },
    { slug: "fusion", label: "Fusion & occasion" },
    { slug: "activewear", label: "Activewear" },
  ],
  electronics: [
    { slug: "mobiles", label: "Mobiles & tablets" },
    { slug: "laptops", label: "Laptops & computers" },
    { slug: "audio", label: "Audio & headphones" },
    { slug: "tv-av", label: "TV & home AV" },
    { slug: "cameras", label: "Cameras" },
    { slug: "gadgets", label: "Gadgets & wearables" },
  ],
  beauty: [
    { slug: "skincare", label: "Skincare" },
    { slug: "makeup", label: "Makeup" },
    { slug: "haircare", label: "Haircare" },
    { slug: "bath-body", label: "Bath & body" },
    { slug: "nails", label: "Nails" },
    { slug: "tools", label: "Beauty tools" },
  ],
  jewellery: [
    { slug: "gold", label: "Gold" },
    { slug: "silver", label: "Silver" },
    { slug: "imitation", label: "Fashion jewellery" },
    { slug: "bridal", label: "Bridal sets" },
    { slug: "gemstones", label: "Gemstones" },
    { slug: "mens-jewellery", label: "Men's jewellery" },
  ],
  furniture: [
    { slug: "living", label: "Living room" },
    { slug: "bedroom", label: "Bedroom" },
    { slug: "office", label: "Office & study" },
    { slug: "dining", label: "Dining" },
    { slug: "storage", label: "Storage" },
    { slug: "outdoor", label: "Outdoor" },
  ],
  grocery: [
    { slug: "staples", label: "Staples & grains" },
    { slug: "snacks", label: "Snacks" },
    { slug: "dairy", label: "Dairy & eggs" },
    { slug: "spices", label: "Spices & masalas" },
    { slug: "oils", label: "Oils & ghee" },
    { slug: "ready-to-eat", label: "Ready to eat" },
    { slug: "organic-grocery", label: "Organic grocery" },
  ],
  health: [
    { slug: "supplements", label: "Supplements" },
    { slug: "wellness", label: "Wellness" },
    { slug: "personal-care", label: "Personal care" },
    { slug: "medical-devices", label: "Medical devices" },
    { slug: "fitness-nutrition", label: "Fitness nutrition" },
  ],
  sports: [
    { slug: "gym", label: "Gym & strength" },
    { slug: "yoga", label: "Yoga" },
    { slug: "outdoor-sports", label: "Outdoor sports" },
    { slug: "team-sports", label: "Team sports" },
    { slug: "cycling", label: "Cycling" },
    { slug: "sportswear", label: "Sportswear" },
  ],
  footwear: [
    { slug: "sneakers", label: "Sneakers" },
    { slug: "formal", label: "Formal shoes" },
    { slug: "sandals", label: "Sandals & slippers" },
    { slug: "ethnic-footwear", label: "Ethnic footwear" },
    { slug: "sports-shoes", label: "Sports shoes" },
    { slug: "kids-footwear", label: "Kids footwear" },
  ],
  kids: [
    { slug: "baby-care", label: "Baby care" },
    { slug: "clothing", label: "Kids clothing" },
    { slug: "toys-games", label: "Toys & games" },
    { slug: "school", label: "School & learning" },
    { slug: "feeding", label: "Feeding & nursing" },
    { slug: "gear", label: "Strollers & gear" },
  ],
  books: [
    { slug: "fiction", label: "Fiction" },
    { slug: "non-fiction", label: "Non-fiction" },
    { slug: "academic", label: "Academic & exam" },
    { slug: "children-books", label: "Children's books" },
    { slug: "stationery", label: "Stationery" },
    { slug: "comics", label: "Comics & manga" },
  ],
  pets: [
    { slug: "dog", label: "Dogs" },
    { slug: "cat", label: "Cats" },
    { slug: "food", label: "Pet food" },
    { slug: "accessories", label: "Accessories" },
    { slug: "grooming", label: "Grooming" },
    { slug: "health-pets", label: "Pet health" },
  ],
  automotive: [
    { slug: "car-accessories", label: "Car accessories" },
    { slug: "bike-accessories", label: "Bike accessories" },
    { slug: "care", label: "Car care" },
    { slug: "electronics-auto", label: "Auto electronics" },
    { slug: "parts", label: "Spare parts" },
  ],
  "smart-home": [
    { slug: "lighting", label: "Smart lighting" },
    { slug: "security", label: "Security & cameras" },
    { slug: "speakers", label: "Smart speakers" },
    { slug: "appliances", label: "Smart appliances" },
    { slug: "plugs", label: "Plugs & switches" },
  ],
  handicrafts: [
    { slug: "handloom", label: "Handloom" },
    { slug: "pottery", label: "Pottery" },
    { slug: "woodwork", label: "Woodwork" },
    { slug: "metal-craft", label: "Metal craft" },
    { slug: "folk-art", label: "Folk art" },
    { slug: "home-accents", label: "Home accents" },
  ],
  bags: [
    { slug: "handbags", label: "Handbags" },
    { slug: "backpacks", label: "Backpacks" },
    { slug: "luggage", label: "Luggage" },
    { slug: "wallets", label: "Wallets" },
    { slug: "travel-gear", label: "Travel gear" },
  ],
  watches: [
    { slug: "analog", label: "Analog" },
    { slug: "smartwatches", label: "Smartwatches" },
    { slug: "luxury", label: "Luxury" },
    { slug: "fashion-watches", label: "Fashion watches" },
    { slug: "straps", label: "Straps & bands" },
  ],
  organic: [
    { slug: "organic-food", label: "Organic food" },
    { slug: "natural-care", label: "Natural personal care" },
    { slug: "herbal", label: "Herbal products" },
    { slug: "eco-home", label: "Eco home" },
    { slug: "organic-beauty", label: "Organic beauty" },
  ],
  gourmet: [
    { slug: "bakery", label: "Bakery" },
    { slug: "chocolates", label: "Chocolates" },
    { slug: "gourmet-snacks", label: "Gourmet snacks" },
    { slug: "preserves", label: "Jams & preserves" },
    { slug: "cheese", label: "Cheese & deli" },
    { slug: "gift-hampers", label: "Gift hampers" },
  ],
  eyewear: [
    { slug: "eyeglasses", label: "Eyeglasses" },
    { slug: "sunglasses", label: "Sunglasses" },
    { slug: "contact-lenses", label: "Contact lenses" },
    { slug: "kids-eyewear", label: "Kids eyewear" },
    { slug: "blue-light", label: "Blue-light glasses" },
  ],
  fragrances: [
    { slug: "perfume", label: "Perfumes" },
    { slug: "deodorant", label: "Deodorants" },
    { slug: "attar", label: "Attar & oud" },
    { slug: "body-mist", label: "Body mists" },
    { slug: "home-fragrance", label: "Home fragrance" },
  ],
  "home-decor": [
    { slug: "wall-art", label: "Wall art" },
    { slug: "lighting-decor", label: "Lighting" },
    { slug: "vases", label: "Vases & vessels" },
    { slug: "cushions", label: "Cushions & throws" },
    { slug: "mirrors", label: "Mirrors" },
    { slug: "festival-decor", label: "Festival décor" },
  ],
  kitchen: [
    { slug: "cookware", label: "Cookware" },
    { slug: "dinnerware", label: "Dinnerware" },
    { slug: "appliances-kitchen", label: "Kitchen appliances" },
    { slug: "storage-kitchen", label: "Storage & organisers" },
    { slug: "tools-kitchen", label: "Tools & gadgets" },
  ],
  "home-textiles": [
    { slug: "bedsheets", label: "Bedsheets" },
    { slug: "curtains", label: "Curtains" },
    { slug: "towels", label: "Towels" },
    { slug: "cushions-textiles", label: "Cushions" },
    { slug: "rugs", label: "Rugs & carpets" },
  ],
  toys: [
    { slug: "educational", label: "Educational" },
    { slug: "soft-toys", label: "Soft toys" },
    { slug: "board-games", label: "Board games" },
    { slug: "outdoor-toys", label: "Outdoor toys" },
    { slug: "rc-toys", label: "RC & electronic" },
    { slug: "puzzles", label: "Puzzles" },
  ],
  gifts: [
    { slug: "personalised", label: "Personalised" },
    { slug: "corporate", label: "Corporate gifts" },
    { slug: "festival-gifts", label: "Festival gifts" },
    { slug: "hampers", label: "Hampers" },
    { slug: "occasion", label: "Occasion gifts" },
  ],
  plants: [
    { slug: "indoor", label: "Indoor plants" },
    { slug: "outdoor-plants", label: "Outdoor plants" },
    { slug: "succulents", label: "Succulents" },
    { slug: "seeds", label: "Seeds & bulbs" },
    { slug: "planters", label: "Planters & pots" },
    { slug: "gardening-tools", label: "Gardening tools" },
  ],
  pooja: [
    { slug: "idols", label: "Idols & murti" },
    { slug: "pooja-items", label: "Pooja items" },
    { slug: "incense", label: "Incense & dhoop" },
    { slug: "diyas", label: "Diyas & lamps" },
    { slug: "spiritual-books", label: "Spiritual books" },
  ],
  tools: [
    { slug: "hand-tools", label: "Hand tools" },
    { slug: "power-tools", label: "Power tools" },
    { slug: "hardware", label: "Hardware" },
    { slug: "electrical", label: "Electrical" },
    { slug: "safety", label: "Safety gear" },
  ],
  music: [
    { slug: "string", label: "String instruments" },
    { slug: "percussion", label: "Percussion" },
    { slug: "wind", label: "Wind instruments" },
    { slug: "keyboards", label: "Keyboards" },
    { slug: "accessories-music", label: "Accessories" },
  ],
  art: [
    { slug: "paintings", label: "Paintings" },
    { slug: "prints", label: "Prints" },
    { slug: "sculptures", label: "Sculptures" },
    { slug: "collectibles", label: "Collectibles" },
    { slug: "craft-supplies", label: "Craft supplies" },
  ],
  beverages: [
    { slug: "tea", label: "Tea" },
    { slug: "coffee", label: "Coffee" },
    { slug: "health-drinks", label: "Health drinks" },
    { slug: "soft-drinks", label: "Soft drinks" },
    { slug: "juices", label: "Juices" },
  ],
  sweets: [
    { slug: "mithai", label: "Mithai" },
    { slug: "namkeen", label: "Namkeen & snacks" },
    { slug: "chocolates-sweets", label: "Chocolates" },
    { slug: "dry-fruits", label: "Dry fruits" },
    { slug: "festival-sweets", label: "Festival sweets" },
    { slug: "baked-sweets", label: "Baked sweets" },
  ],
  "mobile-accessories": [
    { slug: "cases", label: "Cases & covers" },
    { slug: "chargers", label: "Chargers & cables" },
    { slug: "earphones", label: "Earphones" },
    { slug: "screen-guards", label: "Screen guards" },
    { slug: "power-banks", label: "Power banks" },
    { slug: "laptop-accessories", label: "Laptop accessories" },
  ],
  ayurveda: [
    { slug: "herbal-remedies", label: "Herbal remedies" },
    { slug: "oils-ayurveda", label: "Ayurvedic oils" },
    { slug: "skincare-ayurveda", label: "Ayurvedic skincare" },
    { slug: "supplements-ayurveda", label: "Supplements" },
    { slug: "personal-care-ayurveda", label: "Personal care" },
  ],
  general: [
    { slug: "multi-category", label: "Multi-category" },
    { slug: "everyday", label: "Everyday essentials" },
    { slug: "seasonal", label: "Seasonal" },
    { slug: "local-specials", label: "Local specials" },
    { slug: "other", label: "Other" },
  ],
};

/** Compile-time guard: every IndustrySlug has a subcategory list. */
const _exhaustiveness: Record<IndustrySlug, readonly Subcategory[]> = SUBCATEGORIES;
void _exhaustiveness;
void INDUSTRY_SLUGS;

export function subcategoriesFor(industry: IndustrySlug): readonly Subcategory[] {
  return SUBCATEGORIES[industry];
}

export function isSubcategory(industry: IndustrySlug, slug: string): boolean {
  return SUBCATEGORIES[industry].some((s) => s.slug === slug);
}

export function subcategoryLabel(industry: IndustrySlug, slug: string): string | null {
  return SUBCATEGORIES[industry].find((s) => s.slug === slug)?.label ?? null;
}
