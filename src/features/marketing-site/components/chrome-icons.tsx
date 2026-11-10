import { AlarmClock, Bot, CalendarDays, Database, Download, Layers, MousePointer2, NotebookTabs, QrCode, Sparkles, Type, type LucideIcon } from "lucide-react";
import type { SVGProps } from "react";
import { cn } from "@/lib/cn";
import type { MenuIcon, MenuTone, SocialKey } from "../chrome-content";
import { LANDING_ICON_COMPONENTS, SocialIcons } from "./landing-icons";

/** Icons and colours for the header mega menu and the footer's social / share buttons. */

export const MENU_ICON_COMPONENTS: Record<MenuIcon, LucideIcon> = {
  ...LANDING_ICON_COMPONENTS,
  layers: Layers,
  download: Download,
  database: Database,
  notebook: NotebookTabs,
  pointer: MousePointer2,
  type: Type,
  "qr-code": QrCode,
  "alarm-clock": AlarmClock,
  calendar: CalendarDays,
  bot: Bot,
};

export function MenuIconView({ name, className }: { name: MenuIcon; className?: string }) {
  const Icon = MENU_ICON_COMPONENTS[name] ?? Sparkles;
  return <Icon aria-hidden className={className} />;
}

/** Per column: eyebrow text, icon chip (tint + glyph) and the chip on hover. */
export const MENU_TONE_CLASS: Record<MenuTone, { title: string; chip: string }> = {
  indigo: { title: "text-brand-ink", chip: "bg-brand-soft text-brand-ink ring-border group-hover:bg-brand-ink group-hover:text-white" },
  sky: { title: "text-brand-ink", chip: "bg-brand-soft text-brand-ink ring-border group-hover:bg-brand group-hover:text-white" },
  violet: { title: "text-brand-ink", chip: "bg-brand-soft text-brand-ink ring-border group-hover:bg-brand-ink group-hover:text-white" },
  emerald: { title: "text-brand-success", chip: "bg-brand-mint text-brand-success ring-brand-mint group-hover:bg-brand-success group-hover:text-white" },
  amber: { title: "text-brand-orange", chip: "bg-brand-accent-soft text-brand-orange ring-brand-accent-soft group-hover:bg-brand-orange group-hover:text-white" },
  rose: { title: "text-brand-orange-hover", chip: "bg-brand-accent-soft text-brand-orange-hover ring-brand-accent-soft group-hover:bg-brand-orange-hover group-hover:text-white" },
};

// ---- Brand marks not in landing-icons ---------------------------------------------------

type IconProps = SVGProps<SVGSVGElement>;
const svg = (props: IconProps) => ({ viewBox: "0 0 24 24", "aria-hidden": true, fill: "currentColor", ...props, className: cn("size-5", props.className) });

export const BrandIcons: Record<SocialKey, (p: IconProps) => React.JSX.Element> = {
  ...SocialIcons,
  pinterest: (p) => (
    <svg {...svg(p)}>
      <path d="M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9l1.2-5s-.3-.6-.3-1.5c0-1.4.8-2.5 1.8-2.5.9 0 1.3.6 1.3 1.4 0 .9-.5 2.1-.8 3.3-.2 1 .5 1.8 1.5 1.8 1.8 0 3.1-1.9 3.1-4.6 0-2.4-1.7-4.1-4.2-4.1-2.9 0-4.5 2.1-4.5 4.4 0 .9.3 1.8.8 2.3.1.1.1.2.1.3l-.3 1.2c0 .2-.2.2-.4.1-1.3-.6-2.1-2.5-2.1-4 0-3.3 2.4-6.3 6.9-6.3 3.6 0 6.4 2.6 6.4 6 0 3.6-2.3 6.5-5.4 6.5-1.1 0-2.1-.6-2.4-1.2l-.7 2.5c-.2.9-.9 2.1-1.3 2.8A10 10 0 1 0 12 2Z" />
    </svg>
  ),
  telegram: (p) => (
    <svg {...svg(p)}>
      <path d="M21.9 4.3 18.7 19.4c-.2 1.1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.2 13.1l-4.8-1.5c-1-.3-1.1-1 .2-1.5L20.5 2.8c.9-.3 1.7.2 1.4 1.5Z" />
    </svg>
  ),
  threads: (p) => (
    <svg {...svg(p)}>
      <path d="M17.3 11.1a6 6 0 0 0-.2-.1c-.1-2.6-1.6-4.1-4-4.1h-.1c-1.5 0-2.7.6-3.4 1.7l1.3.9c.5-.8 1.4-1 2.1-1 .8 0 1.4.2 1.8.7.3.3.5.8.6 1.4a10 10 0 0 0-2.5-.1c-2.5.1-4.1 1.6-4 3.6.1 1 .6 1.9 1.4 2.4.7.5 1.6.7 2.6.6 1.3-.1 2.3-.5 3-1.4.5-.6.9-1.5 1-2.6.6.4 1.1.8 1.3 1.4.4 1 .5 2.6-.8 3.9-1.1 1.1-2.5 1.6-4.6 1.6-2.3 0-4.1-.8-5.2-2.2-1.1-1.4-1.6-3.3-1.7-5.8 0-2.5.6-4.4 1.7-5.8 1.1-1.4 2.9-2.2 5.2-2.2 2.4 0 4.2.8 5.4 2.2.6.7 1 1.6 1.3 2.6l1.6-.4c-.3-1.3-.9-2.4-1.6-3.3C17.9 2.9 15.6 2 12.7 2h-.1c-2.9 0-5.1 1-6.6 2.8C4.7 6.5 4 8.8 4 11.7v.1c0 2.9.7 5.2 2 6.9 1.5 1.9 3.7 2.8 6.6 2.8h.1c2.6 0 4.4-.7 5.9-2.2 2-2 1.9-4.4 1.3-5.9-.5-1-1.4-1.9-2.6-2.3Zm-4.4 4.2c-1.1.1-2.2-.4-2.2-1.4 0-.8.6-1.6 2.4-1.7h.6c.6 0 1.2.1 1.8.2-.2 2.5-1.4 2.9-2.6 2.9Z" />
    </svg>
  ),
};

/** Brand colours for the round social buttons on the dark footer. */
export const BRAND_CHIP: Record<SocialKey, string> = {
  instagram: "bg-[radial-gradient(circle_at_30%_107%,#fdf497_0%,#fdf497_5%,#fd5949_45%,#d6249f_60%,#285aeb_90%)] text-white",
  x: "bg-white text-black",
  facebook: "bg-[#1877f2] text-white",
  youtube: "bg-[#ff0000] text-white",
  linkedin: "bg-[#0a66c2] text-white",
  whatsapp: "bg-[#25d366] text-white",
  pinterest: "bg-[#e60023] text-white",
  telegram: "bg-[#229ed9] text-white",
  threads: "bg-white text-black",
};
