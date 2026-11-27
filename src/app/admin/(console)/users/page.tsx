import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { requirePlatform } from "@/lib/platform/access";
import { Badge, PageHeader, StatCard, Table, td, th } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { formatDate, formatDateTime } from "@/features/analytics/dates";
import { SITE_TYPE_LABEL, USER_PAGE_SIZE, USER_TYPE_LABEL, userDirectoryFilterSchema, type DirectoryUser, type SiteType, type UserType } from "@/features/platform-users/schemas";
import { getUserStats, listStoreOptions, listUserDirectory } from "@/features/platform-users/server";
import { AddUserButton, UserRowMenu } from "@/features/platform-users/components";
import { UsersDirectoryFilters } from "@/features/platform-users/directory-filters";

export const metadata: Metadata = { title: "Users" };

const TYPE_TONE: Record<UserType, "accent" | "success" | "info" | "neutral"> = { platform: "accent", seller: "success", customer: "info", account: "neutral" };

function TypeBadges({ types }: { types: UserType[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {types.map((t) => (
        <Badge key={t} tone={TYPE_TONE[t]}>
          {USER_TYPE_LABEL[t]}
        </Badge>
      ))}
    </span>
  );
}

const SITE_TONE: Record<SiteType, "success" | "info"> = { ONLINE_STORE: "success", INFORMATIVE: "info" };

function SiteBadges({ sites }: { sites: SiteType[] }) {
  return sites.map((t) => (
    <Badge key={t} tone={SITE_TONE[t]}>
      {SITE_TYPE_LABEL[t]}
    </Badge>
  ));
}

function Phone({ u }: { u: DirectoryUser }) {
  if (!u.phone) return null;
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 text-caption text-muted">
      <span className="tabular-nums">{u.phone}</span>
      {u.phoneVerified ? (
        <span className="inline-flex items-center gap-0.5 text-success">
          <BadgeCheck className="size-3.5" aria-hidden />
          WhatsApp verified
        </span>
      ) : null}
    </span>
  );
}

function StoreCell({ u }: { u: DirectoryUser }) {
  const s = u.stores[0];
  if (!s) return <span className="text-muted">{u.customerStores ? `Shopper at ${u.customerStores} store${u.customerStores === 1 ? "" : "s"}` : "—"}</span>;
  return (
    <span>
      <Link href={`/admin/tenants/${s.tenantId}`} className="font-medium hover:underline">
        {s.name}
      </Link>
      <span className="block text-caption text-muted">
        {s.slug} · {s.role}
        {u.stores.length > 1 ? ` · +${u.stores.length - 1} more` : ""}
      </span>
      <span className="mt-1 flex">
        <Badge tone={SITE_TONE[s.websiteType]}>{SITE_TYPE_LABEL[s.websiteType]}</Badge>
      </span>
    </span>
  );
}

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const ctx = await requirePlatform("platform.users.manage");
  const raw = await searchParams;
  const f = userDirectoryFilterSchema.parse(raw);
  const [dir, stats, stores] = await Promise.all([listUserDirectory(f), getUserStats(), listStoreOptions()]);
  const filtered = Boolean(f.q || f.type || f.site || f.store);
  const actorIsSuperAdmin = ctx.role === "super_admin";
  const rowMenu = (u: DirectoryUser) => (
    <UserRowMenu
      userId={u.userId}
      email={u.email}
      platformRole={u.platformRole}
      actorIsSuperAdmin={actorIsSuperAdmin}
      self={u.userId === ctx.user.id}
      storeOptions={stores}
      stores={u.stores}
      ownedStores={u.stores.filter((s) => s.role === "owner").map((s) => s.name)}
    />
  );
  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Every account on the platform: staff, sellers and shoppers. Open a user for their stores, sign-ins and audit trail." actions={<AddUserButton />} />
      {!dir.available ? (
        <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-small text-warning">The user directory needs migration 20261025003700_platform_finance.sql. Platform staff are still on Platform staff.</p>
      ) : null}
      {dir.available && !dir.siteFilter ? (
        <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-small text-warning">Site-type filter needs migration 20261127009300{f.site ? "; showing all site types." : "."}</p>
      ) : null}
      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total users" value={stats.total} tone="mint" />
          <StatCard label="Platform staff" value={stats.platform} tone="lavender" />
          <StatCard label="Sellers" value={stats.sellers} tone="peach" hint="People with a store membership" />
          <StatCard label="Customers" value={stats.customers} tone="sky" hint="Shoppers with an account" />
        </div>
      ) : null}
      <UsersDirectoryFilters stores={stores} />
      <p className="text-small text-muted">
        {dir.total} user{dir.total === 1 ? "" : "s"}
        {filtered ? " match your filters" : ""}
      </p>
      {dir.rows.length === 0 ? (
        <EmptyState title={filtered ? "No users match" : "No users yet"} description={filtered ? "Try a different search or filter." : "Accounts appear here as people sign up."} />
      ) : f.view === "grid" ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {dir.rows.map((u) => (
            <li key={u.userId} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/admin/users/${u.userId}`} className="font-medium hover:underline">
                    {u.displayName ?? u.email ?? u.userId}
                  </Link>
                  <p className="truncate text-caption text-muted">{u.email}</p>
                  <Phone u={u} />
                </div>
                {rowMenu(u)}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <TypeBadges types={u.types} />
                <SiteBadges sites={u.siteTypes} />
              </div>
              <div className="mt-3 text-small">
                <StoreCell u={u} />
              </div>
              <p className="mt-2 text-caption text-muted">Joined {formatDate(u.createdAt)}</p>
            </li>
          ))}
        </ul>
      ) : (
        <>
          {/* Phones: one card per user; the table starts at md. */}
          <ul className="space-y-2 md:hidden" aria-label="Users">
            {dir.rows.map((u) => (
              <li key={u.userId} className="rounded-xl border border-border bg-surface p-3 shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/admin/users/${u.userId}`} className="block truncate font-medium hover:underline">
                      {u.displayName ?? u.email ?? u.userId}
                    </Link>
                    {u.email ? <p className="truncate text-caption text-muted">{u.email}</p> : null}
                    {!u.emailConfirmed ? <p className="text-caption text-warning">Not confirmed</p> : null}
                    <Phone u={u} />
                  </div>
                  {rowMenu(u)}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <TypeBadges types={u.types} />
                  <SiteBadges sites={u.siteTypes} />
                </div>
                <div className="mt-2 text-small">
                  <StoreCell u={u} />
                </div>
                <p className="mt-2 text-caption text-muted">
                  Joined {formatDate(u.createdAt)}
                  {u.lastSignInAt ? ` · Last sign-in ${formatDateTime(u.lastSignInAt)}` : ""}
                </p>
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <Table>
              <thead>
                <tr>
                  <th className={th}>User</th>
                  <th className={th}>Email</th>
                  <th className={th}>Store & slug</th>
                  <th className={th}>Theme</th>
                  <th className={th}>Type</th>
                  <th className={th}>Joined</th>
                  <th className={th}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {dir.rows.map((u) => (
                  <tr key={u.userId}>
                    <td className={td}>
                      <Link href={`/admin/users/${u.userId}`} className="font-medium hover:underline">
                        {u.displayName ?? "—"}
                      </Link>
                      <Phone u={u} />
                    </td>
                    <td className={td}>
                      {u.email ?? "—"}
                      {!u.emailConfirmed ? <p className="text-caption text-warning">Not confirmed</p> : null}
                    </td>
                    <td className={td}>
                      <StoreCell u={u} />
                    </td>
                    <td className={td}>{u.stores[0]?.theme ?? "—"}</td>
                    <td className={td}>
                      <span className="flex flex-wrap gap-1">
                        <TypeBadges types={u.types} />
                        <SiteBadges sites={u.siteTypes} />
                      </span>
                    </td>
                    <td className={td}>
                      {formatDate(u.createdAt)}
                      {u.lastSignInAt ? <p className="text-caption text-muted">Last sign-in {formatDateTime(u.lastSignInAt)}</p> : null}
                    </td>
                    <td className={td}>{rowMenu(u)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </>
      )}
      <Pagination page={f.page} pageSize={USER_PAGE_SIZE} total={dir.total} basePath="/admin/users" params={{ q: f.q, type: f.type, site: f.site, store: f.store, view: f.view === "grid" ? "grid" : undefined }} />
    </div>
  );
}
