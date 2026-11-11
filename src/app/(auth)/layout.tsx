import type { Metadata } from "next";
import { platformIconMetadata } from "@/features/platform/server/public-config";
import { PlatformTrackingTags } from "@/features/platform-analytics/components/platform-tracking-tags";

export function generateMetadata(): Promise<Metadata> {
  return platformIconMetadata();
}

/** Auth pages render their own split layout (components/auth/auth-split). Platform analytics tags ride along. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PlatformTrackingTags />
    </>
  );
}
