import type { Metadata } from "next";
import { Badge, Card } from "@/components/ui/layout";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAutomation } from "@/features/social/server/automation";
import { AnnounceLaunchButton, AutoPostLink, AutomationForm } from "@/features/social/components/desk-ui";
import { STATUS_LABEL, STATUS_TONE } from "@/features/social/components/channels";
import { SOURCE_LABELS, type PostSource, type PostStatus } from "@/features/social/compose";
import { PlanNotice, loadSocialBase } from "../_lib/data";

export const metadata: Metadata = { title: "Social automation" };

const AI_LABEL: Record<string, string> = { pending: "AI writing…", running: "AI writing…", done: "Written by AI", failed: "AI failed (template used)", skipped: "Template text" };

export default async function SocialAutomationPage() {
  const { ctx, enabled, write, connected } = await loadSocialBase();
  const supabase = await createSupabaseServerClient();
  const [settings, { data: autoPosts }] = await Promise.all([
    getAutomation(ctx.tenantId),
    supabase.from("social_posts").select("id, title, status, source, ai_state, ai_note, created_at").eq("tenant_id", ctx.tenantId).in("source", ["auto_launch", "auto_product"]).order("created_at", { ascending: false }).limit(20),
  ]);
  const launchPost = (autoPosts ?? []).find((p) => p.source === "auto_launch");

  return (
    <div className="space-y-6">
      <PlanNotice enabled={enabled} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title="Your marketing desk" description="Posts that create themselves when something happens in your store, for your own connected accounts.">
          <AutomationForm settings={settings} connected={connected} canWrite={write} />
        </Card>
        <div className="space-y-6">
          <Card title="Store launch post" description="Tell your followers your store is open.">
            {launchPost ? (
              <p className="text-small">
                Your launch post: <AutoPostLink id={launchPost.id} title={launchPost.title ?? "Store launch"} /> <Badge tone={STATUS_TONE[launchPost.status as PostStatus] ?? "neutral"}>{STATUS_LABEL[launchPost.status as PostStatus] ?? launchPost.status}</Badge>
              </p>
            ) : write ? (
              <div className="space-y-2">
                <p className="text-caption text-muted">Creates one post using the settings on the left (draft or scheduled, AI if switched on).</p>
                <AnnounceLaunchButton />
              </div>
            ) : (
              <p className="text-caption text-muted">No launch post yet.</p>
            )}
          </Card>
          <Card title="About WhatsApp" description="What we can and can't do automatically.">
            <ul className="list-disc space-y-1 pl-5 text-caption text-muted">
              <li>WhatsApp doesn&apos;t let apps post to Status or Channels.</li>
              <li>Messaging customers needs WhatsApp-approved templates and their marketing consent. Shoppers who ticked “order updates” at checkout haven&apos;t agreed to marketing messages, so we never broadcast to them.</li>
              <li>Instead, each post gets a WhatsApp-sized message and a “Share on WhatsApp” button for your Status, Channel or groups.</li>
            </ul>
          </Card>
        </div>
      </div>
      <Card title="Recent automatic posts">
        {autoPosts?.length ? (
          <ul className="divide-y divide-border">
            {autoPosts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-small">
                <AutoPostLink id={p.id} title={p.title ?? "Post"} />
                <Badge tone={STATUS_TONE[p.status as PostStatus] ?? "neutral"}>{STATUS_LABEL[p.status as PostStatus] ?? p.status}</Badge>
                <span className="text-caption text-muted">{SOURCE_LABELS[p.source as PostSource] ?? p.source}</span>
                {p.ai_state ? <span className="text-caption text-muted">· {AI_LABEL[p.ai_state] ?? p.ai_state}</span> : null}
                {p.ai_note ? <span className="w-full text-caption text-muted">{p.ai_note}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-caption text-muted">None yet. Switch on a trigger above, then publish your store or a product.</p>
        )}
      </Card>
    </div>
  );
}
