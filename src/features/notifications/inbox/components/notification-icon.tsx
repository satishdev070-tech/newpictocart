import {
  BadgeCheck,
  BadgeIndianRupee,
  Banknote,
  Bell,
  CircleAlert,
  CircleX,
  CreditCard,
  Globe,
  Hourglass,
  Lock,
  PackageMinus,
  PackageX,
  Receipt,
  Rocket,
  Scale,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Star,
  Store,
  Undo2,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { typeInfo, type NotificationTone } from "../catalog";

const ICONS: Record<string, LucideIcon> = {
  "order.new": ShoppingBag,
  "order.cancelled": CircleX,
  "order.returned": Undo2,
  "order.return_requested": Undo2,
  "cart.recovered": ShoppingCart,
  "payment.received": BadgeIndianRupee,
  "payment.failed": CreditCard,
  "stock.low": PackageMinus,
  "stock.out": PackageX,
  "review.new": Star,
  "customer.new": UserPlus,
  "plan.trial_expiring": Hourglass,
  "plan.request_decided": BadgeCheck,
  "ai.credits_low": Sparkles,
  "ai.credits_exhausted": Sparkles,
  "domain.status": Globe,
  "domain.ssl": Lock,
  "platform.signup": UserPlus,
  "platform.store_created": Store,
  "platform.store_published": Rocket,
  "platform.plan_request": Receipt,
  "platform.apk_request": Smartphone,
  "platform.dispute": Scale,
  "platform.payment_failed": CircleAlert,
  "platform.payout_failed": Banknote,
};

const TONES: Record<NotificationTone, string> = {
  accent: "bg-accent-soft text-accent ring-accent/20",
  success: "bg-success/10 text-success ring-success/20",
  warning: "bg-warning/15 text-warning ring-warning/25",
  error: "bg-error/10 text-error ring-error/20",
  info: "bg-info/10 text-info ring-info/20",
};

/** Round tinted icon per notification type (orange accent for the headline events). */
export function NotificationIcon({ type, className }: { type: string; className?: string }) {
  const Icon = ICONS[type] ?? Bell;
  const tone = typeInfo(type)?.tone ?? "accent";
  return (
    <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-full ring-1 ring-inset", TONES[tone], className)}>
      <Icon className="size-4" strokeWidth={2} />
    </span>
  );
}
