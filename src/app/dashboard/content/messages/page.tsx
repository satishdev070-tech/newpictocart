import type { Metadata } from "next";
import { requireTenantPermission } from "@/lib/tenant/membership";
import { PageHeader } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { formatDateTime } from "@/features/analytics/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import { ContactReplyAi } from "@/features/seller-ai/components/contact-reply-ai";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const ctx = await requireTenantPermission("content.write");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("contact_messages")
    .select("id, name, email, phone, subject, message, created_at")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw mapDbError(error);
  const rows = data ?? [];
  return (
    <div>
      <PageHeader title="Messages" description="The latest notes from your store contact form." />
      {rows.length === 0 ? (
        <EmptyState title="No messages yet" description="When a visitor writes from your contact page, the message shows up here." />
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{row.name}</p>
                <time dateTime={row.created_at} className="text-xs text-muted">
                  {formatDateTime(row.created_at)}
                </time>
              </div>
              <p className="mt-1 text-sm">{row.subject?.trim() || "No subject"}</p>
              <p className="mt-1 text-sm text-muted">
                <a href={`mailto:${row.email}`} className="hover:underline">
                  {row.email}
                </a>
                {row.phone ? <span> · {row.phone}</span> : null}
              </p>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm">{row.message}</p>
              <ContactReplyAi messageId={row.id} name={row.name} email={row.email} subject={row.subject} message={row.message} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
