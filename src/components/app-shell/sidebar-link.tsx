import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A row in the sidebar footer (My Profile, Admin Panel ⇄ Seller Dashboard switch). */
export function SidebarLink({ href, icon, children, tone = "default" }: { href: string; icon: ReactNode; children: ReactNode; tone?: "default" | "admin" }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-small transition-colors [&_svg]:size-[18px]",
        tone === "admin" ? "font-medium text-error hover:bg-error/10" : "text-foreground hover:bg-surface-secondary",
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
