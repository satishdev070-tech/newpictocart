import { PlatformTrackingTags } from "@/features/platform-analytics/components/platform-tracking-tags";

/** Seller start journey: platform analytics tags (GA / Meta Pixel / first-party views) only. */
export default function StartLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PlatformTrackingTags />
    </>
  );
}
