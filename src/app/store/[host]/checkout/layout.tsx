import { notFound } from "next/navigation";
import { getRenderContext } from "@/features/theme/render/load";
import { siteRouteAllowed } from "@/features/stores/site-mode";

/** Checkout and its payment child are not exposed from an informative website. */
export default async function CheckoutLayout({ children, params }: LayoutProps<"/store/[host]/checkout">) {
  const { host } = await params;
  const ctx = await getRenderContext(host);
  if (!siteRouteAllowed(ctx.sf.siteMode, "checkout", false)) notFound();
  return children;
}
