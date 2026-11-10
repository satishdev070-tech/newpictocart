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
import type { AccentColor, LandingIcon } from "../landing";
import { parseHighlights, type HighlightColor } from "../highlights";

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

/**
 * Dark editorial highlights for "{green:text}" / "{orange:text}" CMS headings: former mint/green
 * (and orange) resolve to Pictocart orange; cool colours stay muted grey so headlines can mix
 * white and grey.
 */
export const HIGHLIGHT_CLASS: Record<HighlightColor, string> = {
  purple: "text-mk-muted",
  green: "text-mk-accent",
  orange: "text-mk-accent",
  indigo: "text-mk-muted",
};

export function Highlighted({ text, underline = false }: { text: string; underline?: boolean }) {
  return (
    <>
      {parseHighlights(text).map((p, i) =>
        p.color ? (
          <span
            key={i}
            className={cn(
              HIGHLIGHT_CLASS[p.color],
              underline && HIGHLIGHT_CLASS[p.color] === "text-mk-accent" && "underline decoration-mk-accent/50 decoration-[0.06em] underline-offset-[0.14em]",
            )}
          >
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

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
  purple: { chip: "bg-brand-soft text-brand-ink", text: "text-brand-ink", solid: "from-neutral-500 to-black", ring: "from-neutral-300 via-neutral-500 to-black", glow: "bg-black/20", swatch: "bg-brand-ink" },
  green: { chip: "bg-brand-mint text-brand-success", text: "text-brand-success", solid: "from-[#34d399] to-[#15803d]", ring: "from-[#a7f3d0] via-[#34d399] to-[#15803d]", glow: "bg-brand-success/25", swatch: "bg-brand-success" },
  orange: { chip: "bg-brand-accent-soft text-brand-orange", text: "text-brand-orange", solid: "from-[#fb923c] to-[#ea580c]", ring: "from-[#fed7aa] via-[#fb923c] to-[#ea580c]", glow: "bg-brand-orange/30", swatch: "bg-brand-orange" },
  indigo: { chip: "bg-brand-soft text-brand-ink", text: "text-brand-ink", solid: "from-neutral-600 to-black", ring: "from-neutral-300 via-neutral-600 to-black", glow: "bg-black/20", swatch: "bg-brand-ink" },
  pink: { chip: "bg-brand-accent-soft text-brand-orange-hover", text: "text-brand-orange-hover", solid: "from-[#fb923c] to-[#c2410c]", ring: "from-[#fed7aa] via-[#fb923c] to-[#c2410c]", glow: "bg-brand-orange/25", swatch: "bg-brand-orange-hover" },
  teal: { chip: "bg-brand-mint text-brand-success-hover", text: "text-brand-success-hover", solid: "from-[#34d399] to-[#166534]", ring: "from-[#a7f3d0] via-[#34d399] to-[#166534]", glow: "bg-brand-success/20", swatch: "bg-brand-success-hover" },
  blue: { chip: "bg-brand-soft text-brand-ink", text: "text-brand-ink", solid: "from-neutral-500 to-[#111111]", ring: "from-neutral-300 via-neutral-500 to-black", glow: "bg-black/15", swatch: "bg-brand-ink" },
  amber: { chip: "bg-brand-accent-soft text-brand-orange-hover", text: "text-brand-orange-hover", solid: "from-[#fb923c] to-[#ea580c]", ring: "from-[#fed7aa] via-[#fb923c] to-[#ea580c]", glow: "bg-brand-orange/25", swatch: "bg-brand-orange" },
  rose: { chip: "bg-brand-accent-soft text-brand-orange", text: "text-brand-orange", solid: "from-[#fb923c] to-[#c2410c]", ring: "from-[#fed7aa] via-[#fb923c] to-[#c2410c]", glow: "bg-brand-orange/25", swatch: "bg-brand-orange-hover" },
};

/** Colour for a feature card's category eyebrow (Source, Sell, Design, Channels, Operate, Grow). */
const TAG_COLORS: Record<string, AccentColor> = { source: "teal", sell: "green", design: "indigo", channels: "orange", operate: "indigo", grow: "orange" };
export function tagColor(tag: string, fallbackIndex = 0): AccentColor {
  const order: AccentColor[] = ["orange", "green", "indigo", "teal", "amber", "orange", "green", "indigo", "teal"];
  return TAG_COLORS[tag.trim().toLowerCase()] ?? order[fallbackIndex % order.length]!;
}
