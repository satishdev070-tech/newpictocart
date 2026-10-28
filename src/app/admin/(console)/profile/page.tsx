import type { Metadata } from "next";
import { Activity, CalendarDays, Lock, Mail, Package, Shield, ShoppingCart, Store, User, Users } from "lucide-react";
import { requirePlatform } from "@/lib/platform/access";
import { Badge, Card, PageHeader, StatCard } from "@/components/ui/layout";
import { formatDateTime } from "@/features/analytics/dates";
import { getPlatformOverview } from "@/features/platform/server/queries";
import { getUserStats } from "@/features/platform-users/server";
import { getOwnProfile, getPlatformTotals, getSessionInfo } from "@/features/account/server";
import { avatarInitial } from "@/features/account/schemas";
import { ChangePasswordForm, ProfileForm } from "@/features/account/components";

export const metadata: Metadata = { title: "Admin Profile" };

const ROLE_LABEL = { super_admin: "Super Admin", support: "Support", finance: "Finance" } as const;
const monthFmt = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2 [&_svg]:size-4 [&_svg]:text-muted">
      {icon}
      {children}
    </span>
  );
}

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toLocaleString("en-IN"));

export default async function AdminProfilePage() {
  const ctx = await requirePlatform();
  const canRead = ctx.permissions.has("platform.tenants.read");
  const [profile, session, stats, overview, totals] = await Promise.all([
    getOwnProfile(ctx.user.id),
    getSessionInfo(),
    ctx.permissions.has("platform.users.manage") ? getUserStats().catch(() => null) : Promise.resolve(null),
    canRead ? getPlatformOverview().catch(() => null) : Promise.resolve(null),
    canRead ? getPlatformTotals(ctx).catch(() => null) : Promise.resolve(null),
  ]);
  const name = profile.displayName ?? ctx.user.displayName ?? "";
  const email = ctx.user.email ?? "";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Admin Profile" description="Manage your admin account and platform overview" />

      <Card>
        <div className="flex flex-wrap items-center gap-5">
          <span aria-hidden className="grid size-20 shrink-0 place-items-center rounded-full bg-error text-h1 font-bold text-white shadow-md">
            {avatarInitial(name, email)}
          </span>
          <div className="min-w-0 space-y-1.5">
            <p className="truncate text-h3 font-semibold">{name || email}</p>
            <p className="flex items-center gap-1.5 truncate text-small text-muted">
              <Mail aria-hidden className="size-3.5" /> {email}
            </p>
            <p className="flex flex-wrap items-center gap-2 text-caption text-muted">
              <span className="inline-flex items-center gap-1 rounded-full bg-error px-2.5 py-0.5 font-semibold text-white">
                <Shield aria-hidden className="size-3" /> {ROLE_LABEL[ctx.role]}
              </span>
              {profile.createdAt ? (
                <span className="flex items-center gap-1">
                  <CalendarDays aria-hidden className="size-3.5" /> Member since {monthFmt.format(new Date(profile.createdAt))}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </Card>

      {canRead ? (
        <section aria-label="Platform totals" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard tone="sky" icon={<Users aria-hidden strokeWidth={1.75} />} label="Total Users" value={fmt(stats?.total)} />
          <StatCard tone="mint" icon={<Store aria-hidden strokeWidth={1.75} />} label="Total Stores" value={fmt(overview?.totalTenants)} />
          <StatCard tone="peach" icon={<ShoppingCart aria-hidden strokeWidth={1.75} />} label="Total Orders" value={fmt(totals?.orders)} />
          <StatCard tone="lavender" icon={<Package aria-hidden strokeWidth={1.75} />} label="Total Products" value={fmt(totals?.products)} />
        </section>
      ) : null}

      <Card title={<SectionTitle icon={<User aria-hidden />}>Personal Information</SectionTitle>} description="Update your admin profile details">
        <ProfileForm
          displayName={name}
          phone={profile.phone ?? ""}
          email={email}
          labels={{ fullName: "Full Name", phone: "Phone Number", email: "Email Address", emailLocked: "Email cannot be changed from here.", save: "Save Changes", saved: "Profile updated." }}
        />
      </Card>

      <Card title={<SectionTitle icon={<Lock aria-hidden />}>Security</SectionTitle>} description="Keep your admin account secure">
        <ChangePasswordForm labels={{ newPassword: "New Password", confirmPassword: "Confirm Password", update: "Update Password", updated: "Password updated." }} />
      </Card>

      <Card title={<SectionTitle icon={<Activity aria-hidden />}>Session Information</SectionTitle>}>
        {session ? (
          <dl className="grid gap-4 text-small sm:grid-cols-2">
            <div>
              <dt className="text-caption text-muted">User ID</dt>
              <dd className="mt-1 break-all font-mono text-caption">{session.userId}</dd>
            </div>
            <div>
              <dt className="text-caption text-muted">Last Sign In</dt>
              <dd className="mt-1">{session.lastSignInAt ? formatDateTime(session.lastSignInAt) : "—"}</dd>
            </div>
            <div>
              <dt className="text-caption text-muted">Auth Provider</dt>
              <dd className="mt-1 capitalize">{session.providers.length ? session.providers.join(", ") : "email"}</dd>
            </div>
            <div>
              <dt className="text-caption text-muted">Email Verified</dt>
              <dd className="mt-1">{session.emailVerified ? <Badge tone="success">Verified</Badge> : <Badge tone="warning">Not verified</Badge>}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-small text-muted">Session details are unavailable right now.</p>
        )}
      </Card>
    </div>
  );
}
