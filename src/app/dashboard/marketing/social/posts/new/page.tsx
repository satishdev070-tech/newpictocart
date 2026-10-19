import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/layout";
import { assetUrl } from "@/lib/storage/assets";
import { listCampaigns, listHashtagSets } from "@/features/social/server/planner";
import { PostComposer } from "@/features/social/components/composer";
import { PlanNotice, listProductOptions, loadSocialBase } from "../../_lib/data";

export const metadata: Metadata = { title: "New social post" };

export default async function NewSocialPostPage({ searchParams }: PageProps<"/dashboard/marketing/social/posts/new">) {
  const { ctx, enabled, write, connected } = await loadSocialBase();
  if (!enabled) return <PlanNotice enabled={enabled} />;
  if (!write) return <p className="text-small text-muted">You can view posts but not create them. Ask the store owner for marketing access.</p>;
  const sp = await searchParams;
  const at = typeof sp.at === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(sp.at) ? sp.at : "";
  // Creative Studio passes only a tenant-owned PNG path. Re-check the tenant prefix before it
  // reaches the composer; the save action performs the same authoritative check on submission.
  const rawAsset = typeof sp.asset === "string" ? sp.asset : "";
  const creativeAsset = rawAsset.startsWith(`tenant/${ctx.tenantId}/creative/`) && rawAsset.endsWith(".png") ? rawAsset : "";
  const [campaigns, hashtagSets, products] = await Promise.all([listCampaigns(ctx.tenantId), listHashtagSets(ctx.tenantId), listProductOptions(ctx.tenantId)]);
  const value = {
    ...(at ? { scheduledAt: at } : {}),
    ...(creativeAsset ? { mediaPath: creativeAsset, mediaUrl: assetUrl(creativeAsset) } : {}),
  };
  return (
    <Card title="New post" description={creativeAsset ? "Your Creative Studio design is attached. Choose the product, channels and a posting time below." : at ? "Prefilled for the day you picked. Use Plan for date to put it on the calendar." : undefined} actions={<Link href="/dashboard/marketing/social/calendar" className="text-small text-accent hover:underline">Back to calendar</Link>}>
      <PostComposer key={`${at}:${creativeAsset}`} connected={connected} campaigns={campaigns} hashtagSets={hashtagSets} products={products} value={Object.keys(value).length ? value : undefined} />
    </Card>
  );
}
