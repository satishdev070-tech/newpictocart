import type { Metadata } from "next";

/**
 * Informative Website seller panel (docs/informative/PLAN.md). Platform host only: the proxy
 * 404s /informative on store hosts (PLATFORM_ONLY_PREFIXES). Guards live in the (panel) layout.
 */
export const metadata: Metadata = {
  title: { default: "Website", template: "%s · Website" },
  robots: { index: false, follow: false },
};

export default function InformativeRootLayout({ children }: LayoutProps<"/informative">) {
  return children;
}
