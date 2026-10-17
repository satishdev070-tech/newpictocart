import { getRenderContext } from "@/features/theme/render/load";
import { TemplateFrame } from "@/features/theme/render/slot";

/** Wraps every page under this route in the theme's "cart" template (site builder; empty = unchanged). */
export default async function Layout({ children, params }: LayoutProps<"/store/[host]/cart">) {
  const { host } = await params;
  const ctx = await getRenderContext(host);
  return (
    <TemplateFrame template="cart" ctx={ctx}>
      {children}
    </TemplateFrame>
  );
}
