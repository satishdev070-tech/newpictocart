import { getRenderContext } from "@/features/theme/render/load";
import { TemplateFrame } from "@/features/theme/render/slot";

/** Wraps every page under this route in the theme's "page" template (site builder; empty = unchanged). */
export default async function Layout({ children, params }: LayoutProps<"/store/[host]/faq">) {
  const { host } = await params;
  const ctx = await getRenderContext(host);
  return (
    <TemplateFrame template="page" ctx={ctx}>
      {children}
    </TemplateFrame>
  );
}
