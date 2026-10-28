"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { CircleHelp } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import { markTourDone, tourDone, tourForPath, type TourId } from "./routes";
import type { TourLabels } from "./tour-overlay";

// The overlay, the steps and their text are a separate chunk, fetched only when a tour runs.
const TourOverlay = dynamic(() => import("./tour-overlay"), { ssr: false });

/**
 * Topbar "Take the tour" button for pages that have a tour, and the first-visit auto start
 * (remembered per page in localStorage). Renders nothing on pages without a tour.
 */
export function TourLauncher({ locale, labels, takeLabel, autoStart = true }: { locale: Locale; labels: TourLabels; takeLabel: string; autoStart?: boolean }) {
  const pathname = usePathname();
  const tour = tourForPath(pathname);
  const [running, setRunning] = useState<{ id: TourId; auto: boolean; path: string } | null>(null);

  useEffect(() => {
    if (!tour || !autoStart || tourDone(tour)) return;
    // Let the page paint first; the overlay then waits for its targets to stream in.
    const t = setTimeout(() => setRunning((r) => r ?? { id: tour, auto: true, path: pathname }), 700);
    return () => clearTimeout(t);
  }, [tour, autoStart, pathname]);

  const runningId = running?.id;
  const onClose = useCallback(
    (seen: boolean) => {
      if (runningId && seen) markTourDone(runningId);
      setRunning(null);
    },
    [runningId],
  );

  // A tour belongs to the page it started on.
  const active = running && running.path === pathname ? running : null;

  if (!tour) return null;
  return (
    <>
      <button
        type="button"
        data-tour="tour-help"
        onClick={() => setRunning({ id: tour, auto: false, path: pathname })}
        aria-label={takeLabel}
        title={takeLabel}
        className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-secondary hover:text-foreground"
      >
        <CircleHelp aria-hidden className="size-[18px]" strokeWidth={1.75} />
      </button>
      {active ? <TourOverlay key={`${active.id}-${active.auto}`} tour={active.id} locale={locale} labels={labels} auto={active.auto} onClose={onClose} /> : null}
    </>
  );
}
