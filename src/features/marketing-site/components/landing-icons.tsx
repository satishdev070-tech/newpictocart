import {
  BarChart3,
  BookOpen,
  Camera,
  Clock,
  CreditCard,
  FileText,
  Globe,
  Heart,
  Image,
  LayoutTemplate,
  Link,
  Mail,
  Megaphone,
  MessageCircle,
  Package,
  Palette,
  Receipt,
  Rocket,
  Search,
  Shield,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Star,
  Store,
  Tag,
  Ticket,
  Truck,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Baby, Brush, CakeSlice, Coffee, Dumbbell, Flower2, Gem, Gift, Hammer, HandHeart, Headphones, Laptop, Leaf, PawPrint, Pencil, PenTool, Scissors, Shirt, ShoppingBag, Sofa, Sprout, ToyBrick, Watch, Wrench } from "lucide-react";
import type { SVGProps } from "react";
import { cn } from "@/lib/cn";
import type { AccentColor, HighlightColor, LandingIcon } from "../landing";
import { parseHighlights } from "../landing";

export const LANDING_ICON_COMPONENTS: Record<LandingIcon, LucideIcon> = {
  sparkles: Sparkles,
  camera: Camera,
  globe: Globe,
  palette: Palette,
  "message-circle": MessageCircle,
  link: Link,
  "credit-card": CreditCard,
  truck: Truck,
  "file-text": FileText,
  ticket: Ticket,
  star: Star,
  "book-open": BookOpen,
  "bar-chart": BarChart3,
  "shopping-cart": ShoppingCart,
  search: Search,
  smartphone: Smartphone,
  users: Users,
  store: Store,
  tag: Tag,
  rocket: Rocket,
  package: Package,
  shield: Shield,
  zap: Zap,
  megaphone: Megaphone,
  image: Image,
  mail: Mail,
  receipt: Receipt,
  layout: LayoutTemplate,
  heart: Heart,
  clock: Clock,
  shirt: Shirt,
  cake: CakeSlice,
  laptop: Laptop,
  flower: Flower2,
  scissors: Scissors,
  dumbbell: Dumbbell,
  sofa: Sofa,
  gem: Gem,
  wrench: Wrench,
  "paw-print": PawPrint,
  "pen-tool": PenTool,
  leaf: Leaf,
  "toy-brick": ToyBrick,
  pencil: Pencil,
  gift: Gift,
  coffee: Coffee,
  headphones: Headphones,
  watch: Watch,
  "shopping-bag": ShoppingBag,
  brush: Brush,
  baby: Baby,
  hammer: Hammer,
  sprout: Sprout,
  "hand-heart": HandHeart,
};

export function LandingIconView({ name, className }: { name: LandingIcon; className?: string }) {
  const Icon = LANDING_ICON_COMPONENTS[name] ?? Sparkles;
  return <Icon aria-hidden className={className} />;
}

export const HIGHLIGHT_CLASS: Record<HighlightColor, string> = {
  purple: "text-brand-purple",
  green: "text-brand-cta",
  orange: "text-brand-accent",
  indigo: "text-brand",
};

/** Renders "{green:text}" highlights from CMS headings. `onDark` uses lighter tints. */
export function Highlighted({ text, onDark = false }: { text: string; onDark?: boolean }) {
  return (
    <>
      {parseHighlights(text).map((p, i) =>
        p.color ? (
          <span key={i} className={onDark ? DARK_HIGHLIGHT[p.color] : HIGHLIGHT_CLASS[p.color]}>
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

const DARK_HIGHLIGHT: Record<HighlightColor, string> = {
  purple: "text-[#c4b5fd]",
  green: "text-[#34d399]",
  orange: "text-[#fdba74]",
  indigo: "text-[#a5b4fc]",
};

// ---- Brand marks (lucide v1 ships no brand icons) -------------------------------------

type IconProps = SVGProps<SVGSVGElement>;
const svg = (props: IconProps) => ({ viewBox: "0 0 24 24", "aria-hidden": true, fill: "currentColor", ...props, className: cn("size-5", props.className) });

export const SocialIcons = {
  instagram: (p: IconProps) => (
    <svg {...svg(p)}>
      <path d="M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1.1.4 2.2.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1.1.4-2.2.4-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1.1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1.1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2Zm0 1.8c-3.1 0-3.5 0-4.7.1-1.1.1-1.7.2-2.1.4-.5.2-.9.4-1.3.8-.4.4-.6.8-.8 1.3-.2.4-.3 1-.4 2.1C2.6 9.9 2.6 10.3 2.6 12s0 2.1.1 3.3c.1 1.1.2 1.7.4 2.1.2.5.4.9.8 1.3.4.4.8.6 1.3.8.4.2 1 .3 2.1.4 1.2.1 1.6.1 4.7.1s3.5 0 4.7-.1c1.1-.1 1.7-.2 2.1-.4.5-.2.9-.4 1.3-.8.4-.4.6-.8.8-1.3.2-.4.3-1 .4-2.1.1-1.2.1-1.6.1-3.3s0-2.1-.1-3.3c-.1-1.1-.2-1.7-.4-2.1-.2-.5-.4-.9-.8-1.3-.4-.4-.8-.6-1.3-.8-.4-.2-1-.3-2.1-.4C15.5 4 15.1 4 12 4Zm0 3.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8Zm0 8a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2Zm6.2-8.2a1.1 1.1 0 1 1-2.3 0 1.1 1.1 0 0 1 2.3 0Z" />
    </svg>
  ),
  x: (p: IconProps) => (
    <svg {...svg(p)}>
      <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.3L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.5l11.2 14.5Z" />
    </svg>
  ),
  facebook: (p: IconProps) => (
    <svg {...svg(p)}>
      <path d="M13.5 21v-7.5H16l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3Z" />
    </svg>
  ),
  youtube: (p: IconProps) => (
    <svg {...svg(p)}>
      <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.3 5 12 5 12 5s-6.3 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8c1.5.4 7.8.4 7.8.4s6.3 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8ZM10 15V9l5.2 3L10 15Z" />
    </svg>
  ),
  linkedin: (p: IconProps) => (
    <svg {...svg(p)}>
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.5h4V21H3V9.5Zm6.5 0h3.8v1.6h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V21h-4v-5.2c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V21h-4V9.5Z" />
    </svg>
  ),
  whatsapp: (p: IconProps) => (
    <svg {...svg(p)}>
      <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2.1-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3ZM12 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8Zm8.4-18.2A11.8 11.8 0 0 0 1.8 17.8L.2 23.8l6.1-1.6a11.8 11.8 0 0 0 5.7 1.4c6.5 0 11.8-5.3 11.8-11.8 0-3.2-1.2-6.1-3.4-8.2Z" />
    </svg>
  ),
} as const;

// ---- Accent palette (ACCENT_COLORS) ----------------------------------------------------

/**
 * Literal class strings per accent colour (Tailwind only sees whole class names).
 * chip: tinted icon tile · text: eyebrow/link colour · solid: filled icon · ring: gradient border on
 * hover · glow: soft blurred halo · swatch: editor colour picker.
 */
export const ACCENT: Record<AccentColor, { chip: string; text: string; solid: string; ring: string; glow: string; swatch: string }> = {
  purple: { chip: "bg-[#f3eefe] text-[#7c3aed]", text: "text-[#7c3aed]", solid: "from-[#a78bfa] to-[#7c3aed]", ring: "from-[#c4b5fd] via-[#a78bfa] to-[#7c3aed]", glow: "bg-[#a78bfa]/30", swatch: "bg-[#7c3aed]" },
  green: { chip: "bg-[#e7f8ef] text-[#059669]", text: "text-[#059669]", solid: "from-[#34d399] to-[#059669]", ring: "from-[#a7f3d0] via-[#34d399] to-[#059669]", glow: "bg-[#34d399]/30", swatch: "bg-[#059669]" },
  orange: { chip: "bg-[#fff1e6] text-[#ea580c]", text: "text-[#ea580c]", solid: "from-[#fb923c] to-[#ea580c]", ring: "from-[#fed7aa] via-[#fb923c] to-[#ea580c]", glow: "bg-[#fb923c]/30", swatch: "bg-[#ea580c]" },
  indigo: { chip: "bg-[#eef0ff] text-[#4f46e5]", text: "text-[#4f46e5]", solid: "from-[#818cf8] to-[#4f46e5]", ring: "from-[#c7d2fe] via-[#818cf8] to-[#4f46e5]", glow: "bg-[#818cf8]/30", swatch: "bg-[#4f46e5]" },
  pink: { chip: "bg-[#fdeef8] text-[#db2777]", text: "text-[#db2777]", solid: "from-[#f472b6] to-[#db2777]", ring: "from-[#fbcfe8] via-[#f472b6] to-[#db2777]", glow: "bg-[#f472b6]/30", swatch: "bg-[#db2777]" },
  teal: { chip: "bg-[#e6f8f7] text-[#0d9488]", text: "text-[#0d9488]", solid: "from-[#2dd4bf] to-[#0d9488]", ring: "from-[#99f6e4] via-[#2dd4bf] to-[#0d9488]", glow: "bg-[#2dd4bf]/30", swatch: "bg-[#0d9488]" },
  blue: { chip: "bg-[#e8f1fe] text-[#2563eb]", text: "text-[#2563eb]", solid: "from-[#60a5fa] to-[#2563eb]", ring: "from-[#bfdbfe] via-[#60a5fa] to-[#2563eb]", glow: "bg-[#60a5fa]/30", swatch: "bg-[#2563eb]" },
  amber: { chip: "bg-[#fef5e2] text-[#b45309]", text: "text-[#b45309]", solid: "from-[#fbbf24] to-[#d97706]", ring: "from-[#fde68a] via-[#fbbf24] to-[#d97706]", glow: "bg-[#fbbf24]/30", swatch: "bg-[#d97706]" },
  rose: { chip: "bg-[#ffeef0] text-[#e11d48]", text: "text-[#e11d48]", solid: "from-[#fb7185] to-[#e11d48]", ring: "from-[#fecdd3] via-[#fb7185] to-[#e11d48]", glow: "bg-[#fb7185]/30", swatch: "bg-[#e11d48]" },
};

/** Colour for a feature card's category eyebrow (Source, Sell, Design, Channels, Operate, Grow). */
const TAG_COLORS: Record<string, AccentColor> = { source: "teal", sell: "green", design: "purple", channels: "pink", operate: "indigo", grow: "orange" };
export function tagColor(tag: string, fallbackIndex = 0): AccentColor {
  const order: AccentColor[] = ["indigo", "purple", "teal", "pink", "orange", "blue", "green", "amber", "rose"];
  return TAG_COLORS[tag.trim().toLowerCase()] ?? order[fallbackIndex % order.length]!;
}
