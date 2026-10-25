import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePlatform } from "@/lib/platform/access";
import { Badge, Card, PageHeader, Table, td, th } from "@/components/ui/layout";
import { formatDate, formatDateTime } from "@/features/analytics/dates";
import { formatMoney } from "@/lib/money";
import { USER_TYPE_LABEL, userTypes } from "@/features/platform-users/schemas";
import { getUserDetail } from "@/features/platform-users/server";
import { AccountActions } from "@/features/platform-users/components";

export const metadata: Metadata = { title: "User details" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 py-1.5 text-small">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export default async function UserDetailPage({ params }: PageProps<"/admin/users/[id]">) {
  const ctx = await requirePlatform("platform.users.manage");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const u = await getUserDetail(id);
  if (!u) notFound();
  const types = userTypes({ platformRole: u.platform?.role ?? null, stores: u.stores, customerStores: u.customerOf.length });
  const disabled = u.profileStatus === "disabled" || u.banned;
  return (
    <div className="space-y-6">
      <PageHeader
        title={u.displayName ?? u.email ?? "User"}
        description={u.email ?? undefined}
        back={
          <Link href="/admin/users" className="text-small text-muted hover:text-foreground">
            ← Users
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Account" actions={<span className="flex flex-wrap gap-1">{types.map((t) => <Badge key={t} tone={t === "platform" ? "accent" : t === "seller" ? "success" : t === "customer" ? "info" : "neutral"}>{USER_TYPE_LABEL[t]}</Badge>)}</span>}>
          <dl>
            <Row label="User ID">
              <span className="font-mono text-caption">{u.userId}</span>
            </Row>
            <Row label="Email">
              {u.email ?? "—"} {u.emailConfirmedAt ? <Badge tone="success">confirmed</Badge> : <Badge tone="warning">not confirmed</Badge>}
            </Row>
            <Row label="Phone">{u.phone ?? "—"}</Row>
            <Row label="Sign-in methods">{u.providers.length ? u.providers.join(", ") : "—"}</Row>
            <Row label="Status">{disabled ? <Badge tone="error">disabled</Badge> : <Badge tone="success">active</Badge>}</Row>
            <Row label="Joined">{formatDateTime(u.createdAt)}</Row>
            <Row label="Last sign-in">{u.lastSignInAt ? formatDateTime(u.lastSignInAt) : "Never"}</Row>
            {u.platform ? (
              <Row label="Platform role">
                {u.platform.role.replace("_", " ")} · {u.platform.status} since {formatDate(u.platform.since)}
              </Row>
            ) : null}
          </dl>
          <div className="mt-4 border-t border-border pt-4">
            <AccountActions userId={u.userId} email={u.email} disabled={disabled} manageable={!u.platform && u.userId !== ctx.user.id} />
          </div>
        </Card>
        <Card title="Sign-ins" description="From Supabase Auth's audit log when available.">
          {u.signIns.length ? (
            <ul className="divide-y divide-border text-small">
              {u.signIns.map((s, i) => (
                <li key={`${s.at}-${i}`} className="flex justify-between gap-2 py-2">
                  <span className="capitalize">{s.action.replaceAll("_", " ")}</span>
                  <span className="text-muted">
                    {formatDateTime(s.at)}
                    {s.ip ? ` · ${s.ip}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-small text-muted">{u.lastSignInAt ? `No sign-in history recorded. Last sign-in ${formatDateTime(u.lastSignInAt)}.` : "No sign-ins yet."}</p>
          )}
        </Card>
      </div>
      <Card title={`Stores (${u.stores.length})`} description="Store memberships: the stores this person runs or works in.">
        {u.stores.length ? (
          <Table>
            <thead>
              <tr>
                <th className={th}>Store</th>
                <th className={th}>Role</th>
                <th className={th}>Plan</th>
                <th className={th}>Theme</th>
                <th className={th}>Since</th>
              </tr>
            </thead>
            <tbody>
              {u.stores.map((s) => (
                <tr key={s.tenantId}>
                  <td className={td}>
                    <Link href={`/admin/tenants/${s.tenantId}`} className="font-medium hover:underline">
                      {s.name}
                    </Link>
                    <p className="text-caption text-muted">
                      {s.slug} · {s.tenantStatus}
                    </p>
                  </td>
                  <td className={td}>
                    {s.role}
                    {s.status !== "active" ? <Badge tone="neutral">{s.status}</Badge> : null}
                  </td>
                  <td className={td}>{s.plan ?? "—"}</td>
                  <td className={td}>{s.theme ?? "—"}</td>
                  <td className={td}>{formatDate(s.since)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="text-small text-muted">Not a member of any store.</p>
        )}
      </Card>
      {u.customerOf.length ? (
        <Card title={`Shopper at (${u.customerOf.length})`}>
          <ul className="divide-y divide-border text-small">
            {u.customerOf.map((c) => (
              <li key={c.tenantId} className="flex flex-wrap justify-between gap-2 py-2">
                <Link href={`/admin/tenants/${c.tenantId}`} className="font-medium hover:underline">
                  {c.name}
                </Link>
                <span className="text-muted">
                  {c.orders} order{c.orders === 1 ? "" : "s"} · {formatMoney(c.spentMinor)}
                  {c.lastOrderAt ? ` · last ${formatDate(c.lastOrderAt)}` : ""}
                  {c.status !== "active" ? ` · ${c.status}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Card title="Activity log" description="Audit entries where this person acted or was the subject (latest 50)." actions={<Link href={`/admin/audit?actor=${u.userId}`} className="text-small text-primary hover:underline">Open in audit log</Link>}>
        {u.audit.length ? (
          <ul className="divide-y divide-border text-small">
            {u.audit.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  <span className="font-mono text-caption">{a.action}</span>
                  <span className="text-muted"> · {a.asActor ? `by them (${a.actorType})` : "about them"}</span>
                  {a.tenantId ? (
                    <Link href={`/admin/tenants/${a.tenantId}`} className="ml-1 text-caption text-primary hover:underline">
                      store
                    </Link>
                  ) : null}
                </span>
                <span className="text-muted">{formatDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-small text-muted">No audit entries yet.</p>
        )}
      </Card>
    </div>
  );
}
