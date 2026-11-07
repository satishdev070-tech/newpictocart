"use client";

import dynamic from "next/dynamic";
import type { BuilderData } from "../context";

/**
 * Client boundary for the Theme Editor. `ssr: false` is illegal in Server Components (Next 16);
 * putting it here so `/dashboard/theme` actually schedules the SiteBuilder chunk instead of a
 * forever loading stub (blank main under the dashboard shell).
 */
const SiteBuilder = dynamic(() => import("./site-builder").then((m) => m.SiteBuilder), {
  ssr: false,
  loading: () => <div className="fixed inset-0 z-[70] animate-pulse bg-surface-secondary" aria-busy="true" />,
});

export function ThemeBuilderClient({ data }: { data: BuilderData }) {
  return <SiteBuilder data={data} />;
}
