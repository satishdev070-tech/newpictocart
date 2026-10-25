import type { Metadata } from "next";
import Link from "next/link";
import { LayoutGrid, LayoutList, Search } from "lucide-react";
import { requirePlatform } from "@/lib/platform/access";
import { Badge, PageHeader, StatCard, Table, td, th } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { formatDate, formatDateTime } from "@/features/analytics/dates";
import { USER_PAGE_SIZE, USER_TYPE_LABEL, USER_TYPES, userDirectoryFilterSchema, type DirectoryUser, type UserType } from "@/features/platform-users/schemas";
import { getUserStats, listStoreOptions, listUserDirectory } from "@/features/platform-users/server";
import { AddUserButton, UserRowMenu } from "@/features/platform-users/components";

export const metadata: Metadata = { title: "Users" };

const ctl = "h-9 rounded-md border border-border bg-surface px-3 text-small";
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
    </span>
  );
}

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  await requirePlatform("platform.users.manage");
  const raw = await searchParams;
  const f = userDirectoryFilterSchema.parse(raw);
  const [dir, stats, stores] = await Promise.all([listUserDirectory(f), getUserStats(), listStoreOptions()]);
  const filtered = Boolean(f.q || f.type || f.store);
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: f.q, type: f.type, store: f.store, view: f.view === "grid" ? "grid" : undefined, ...patch })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Every account on the platform: staff, sellers and shoppers. Open a user for their stores, sign-ins and audit trail." actions={<AddUserButton />} />
      {!dir.available ? (
        <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-small text-warning">The user directory needs migration 20261025003700_platform_finance.sql. Platform staff are still on Platform staff.</p>
      ) : null}
      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total users" value={stats.total} tone="mint" />
          <StatCard label="Platform staff" value={stats.platform} tone="lavender" />
          <StatCard label="Sellers" value={stats.sellers} tone="peach" hint="People with a store membership" />
          <StatCard label="Customers" value={stats.customers} tone="sky" hint="Shoppers with an account" />
        </div>
      ) : null}
      <form className="grid gap-2 sm:flex sm:flex-wrap sm:items-end" role="search">
        <div className="relative sm:min-w-72 sm:flex-1">
          <label className="sr-only" htmlFor="q">
            Search users
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input id="q" name="q" defaultValue={f.q ?? ""} placeholder="Name, email, phone, store or theme" className={`${ctl} w-full pl-9`} />
        </div>
        <label className="sr-only" htmlFor="type">
          Type
        </label>
        <select id="type" name="type" defaultValue={f.type ?? ""} className={ctl}>
          <option value="">All types</option>
          {USER_TYPES.map((t) => (
            <option key={t} value={t}>
              {USER_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="store">
          Store
        </label>
        <select id="store" name="store" defaultValue={f.store ?? ""} className={`${ctl} max-w-60`}>
          <option value="">All stores</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {f.view === "grid" ? <input type="hidden" name="view" value="grid" /> : null}
        <button className="h-9 rounded-md bg-primary px-4 text-small font-medium text-primary-foreground">Filter</button>
        <div className="ml-auto flex gap-1" aria-label="View">
          <Link href={qs({ view: undefined })} aria-label="List view" aria-current={f.view === "list" ? "true" : undefined} className="rounded-md p-2 text-muted hover:bg-surface-secondary aria-[current]:bg-surface-secondary aria-[current]:text-foreground">
            <LayoutList className="size-4" aria-hidden />
          </Link>
          <Link href={qs({ view: "grid" })} aria-label="Grid view" aria-current={f.view === "grid" ? "true" : undefined} className="rounded-md p-2 text-muted hover:bg-surface-secondary aria-[current]:bg-surface-secondary aria-[current]:text-foreground">
            <LayoutGrid className="size-4" aria-hidden />
          </Link>
        </div>
      </form>
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
                </div>
                <UserRowMenu userId={u.userId} stores={u.stores} />
              </div>
              <div className="mt-2">
                <TypeBadges types={u.types} />
              </div>
              <div className="mt-3 text-small">
                <StoreCell u={u} />
              </div>
              <p className="mt-2 text-caption text-muted">Joined {formatDate(u.createdAt)}</p>
            </li>
          ))}
        </ul>
      ) : (
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
                  {u.phone ? <p className="text-caption text-muted">{u.phone}</p> : null}
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
                  <TypeBadges types={u.types} />
                </td>
                <td className={td}>
                  {formatDate(u.createdAt)}
                  {u.lastSignInAt ? <p className="text-caption text-muted">Last sign-in {formatDateTime(u.lastSignInAt)}</p> : null}
                </td>
                <td className={td}>
                  <UserRowMenu userId={u.userId} stores={u.stores} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={f.page} pageSize={USER_PAGE_SIZE} total={dir.total} basePath="/admin/users" params={{ q: f.q, type: f.type, store: f.store, view: f.view === "grid" ? "grid" : undefined }} />
    </div>
  );
}
