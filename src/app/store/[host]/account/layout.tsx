import { getRenderContext } from "@/features/theme/render/load";
import { TemplateFrame } from "@/features/theme/render/slot";
import { notFound } from "next/navigation";
import { siteRouteAllowed } from "@/features/stores/site-mode";

/** Wraps every page under this route in the theme's "account" template (site builder; empty = unchanged). */
export default async function Layout({ children, params }: LayoutProps<"/store/[host]/account">) {
  const { host } = await params;
  const ctx = await getRenderContext(host);
  if (!siteRouteAllowed(ctx.sf.siteMode, "account", false)) notFound();
  return (
    <TemplateFrame template="account" ctx={ctx}>
      {children}
    </TemplateFrame>
  );
}
