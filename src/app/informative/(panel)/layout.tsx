import { requireInformativeTenant } from "@/features/informative/server/context";

/**
 * InformativeRouteGuard for every /informative/* panel page. M1 stub chrome; the shared app
 * shell with the Informative sidebar arrives in M5.
 */
export default async function InformativePanelLayout({ children }: LayoutProps<"/informative">) {
  const ctx = await requireInformativeTenant();
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold">{ctx.tenantName}</p>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
