import type { ReactNode } from "react";
import { cookies } from "next/headers";
import type { NavGroup } from "@/components/dashboard/nav";
import { AppShellClient, type ShellText } from "./app-shell-client";
import { SIDEBAR_COOKIE, parseSidebarCollapsed, type SidebarPanel } from "./sidebar-cookie";

type Props = {
  groups: NavGroup[];
  /** Root of this console ("/dashboard" or "/admin"): only active on itself. */
  homeHref: string;
  brand: ReactNode;
  /** Square mark shown in the collapsed (icon-only) sidebar. */
  brandMark?: ReactNode;
  sidebarFooter: ReactNode;
  /** Shown at the start of the topbar after the menu button (e.g. an "Admin mode" label). */
  topbarStart?: ReactNode;
  topbarEnd: ReactNode;
  banner?: ReactNode;
  /** Namespaces the remembered submenu state (localStorage). */
  storageKey: string;
  /** Translated chrome labels and the panel's `lang` (seller panel); English when omitted. */
  text?: ShellText;
  lang?: string;
  children: ReactNode;
};

/**
 * Seller dashboard / super admin shell. Reads the sidebar preference cookie on the server so the
 * first paint already has the member's chosen width (expanded or icon rail).
 */
export async function AppShell(props: Props) {
  const panel: SidebarPanel = props.homeHref.startsWith("/admin") ? "admin" : "seller";
  const collapsed = parseSidebarCollapsed((await cookies()).get(SIDEBAR_COOKIE[panel])?.value);
  return <AppShellClient {...props} panel={panel} initialCollapsed={collapsed} />;
}
