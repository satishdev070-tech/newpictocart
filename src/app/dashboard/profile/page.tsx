import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Check, CheckCircle2, Clock, Download, ExternalLink, Handshake, Lock, Mail, ShieldCheck, Store, User } from "lucide-react";
import { can, requireTenant } from "@/lib/tenant/membership";
import { Badge, Card, PageHeader } from "@/components/ui/layout";
import { buttonClass } from "@/components/ui/button";
import { getI18n } from "@/lib/i18n/server";
import { roleLabel } from "@/lib/permissions/labels";
import { formatMoney, toMinor } from "@/lib/money";
import { storeOrigin, storeSubdomain } from "@/lib/platform/urls";
import { getLaunchStatusForMember } from "@/features/stores/launch";
import { featureLabels, getStorePlanOverview } from "@/features/billing/server";
import { getOwnProfile, getStorePartnerLink, getStoreOverview } from "@/features/account/server";
import { avatarInitial } from "@/features/account/schemas";
import { ChangePasswordForm, PlanCountdown, ProfileForm, RequestDeletionButton } from "@/features/account/components";

export const metadata: Metadata = { title: "My Profile" };

const STATUS_TONE = { trial: "accent", active: "success", suspended: "error", cancelled: "neutral" } as const;

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2 [&_svg]:size-4 [&_svg]:text-muted">
      {icon}
      {children}
    </span>
  );
}

export default async function SellerProfilePage() {
  const ctx = await requireTenant();
  const [{ t, m, locale }, profile, store, launch, plan, labels, partner] = await Promise.all([
    getI18n(),
    getOwnProfile(ctx.user.id),
    getStoreOverview(ctx),
    getLaunchStatusForMember(ctx.tenantId),
    getStorePlanOverview(ctx),
    featureLabels(),
    getStorePartnerLink(ctx),
  ]);
  const dateFmt = new Intl.DateTimeFormat(`${locale}-IN`, { dateStyle: "medium", timeZone: "Asia/Kolkata" });
  const monthFmt = new Intl.DateTimeFormat(`${locale}-IN`, { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  const name = profile.displayName ?? ctx.user.displayName ?? "";
  const email = ctx.user.email ?? "";
  const storeUrl = storeOrigin(storeSubdomain(store.slug));
  const endsAt = plan.status === "trial" ? plan.trialEndsAt : null;
  const p = (key: keyof typeof m.profile) => m.profile[key];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title={p("title")} description={p("description")} />

      <Card>
        <div className="flex flex-wrap items-center gap-5">
          <span aria-hidden className="grid size-20 shrink-0 place-items-center rounded-full bg-accent text-h1 font-bold text-white shadow-md">
            {avatarInitial(name, email)}
          </span>
          <div className="min-w-0 space-y-1.5">
            <p className="truncate text-h3 font-semibold">{name || email}</p>
            <p className="flex items-center gap-1.5 truncate text-small text-muted">
              <Mail aria-hidden className="size-3.5" /> {email}
            </p>
            <p className="flex flex-wrap items-center gap-2 text-caption text-muted">
              <Badge tone="neutral">
                <Store aria-hidden className="mr-1 inline size-3" />
                {ctx.role === "owner" ? p("seller") : roleLabel(ctx.role, ctx.customRoleName)}
              </Badge>
              <Badge tone={launch === "draft" ? "warning" : "success"}>
                <CheckCircle2 aria-hidden className="mr-1 inline size-3" />
                {launch === "draft" ? p("storeDraft") : p("storeLive")}
              </Badge>
              {profile.createdAt ? (
                <span className="flex items-center gap-1">
                  <CalendarDays aria-hidden className="size-3.5" />
                  {t("profile.memberSince", { date: monthFmt.format(new Date(profile.createdAt)) })}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </Card>

      <Card title={<SectionTitle icon={<User aria-hidden />}>{p("personalTitle")}</SectionTitle>} description={p("personalDescription")}>
        <ProfileForm
          displayName={name}
          phone={profile.phone ?? ""}
          email={email}
          labels={{ fullName: p("fullName"), phone: p("phone"), email: p("email"), emailLocked: p("emailLocked"), save: p("save"), saved: p("saved") }}
        />
      </Card>

      <Card
        title={<SectionTitle icon={<Store aria-hidden />}>{p("storeTitle")}</SectionTitle>}
        description={p("storeDescription")}
        actions={can(ctx, "settings.write") ? <Link href="/dashboard/settings" className="text-small font-medium text-accent hover:underline">{p("editStore")}</Link> : null}
      >
        <dl className="grid gap-4 text-small sm:grid-cols-2">
          <div>
            <dt className="text-caption text-muted">{p("storeName")}</dt>
            <dd className="mt-1 font-medium">{store.name}</dd>
          </div>
          <div>
            <dt className="text-caption text-muted">{p("category")}</dt>
            <dd className="mt-1">{store.category ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-caption text-muted">{p("storeUrl")}</dt>
            <dd className="mt-1">
              <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                {storeUrl.replace(/^https?:\/\//, "")} <ExternalLink aria-hidden className="size-3.5" />
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-caption text-muted">{p("created")}</dt>
            <dd className="mt-1">{store.createdAt ? dateFmt.format(new Date(store.createdAt)) : "—"}</dd>
          </div>
        </dl>
      </Card>

      <Card title={<SectionTitle icon={<ShieldCheck aria-hidden />}>{p("planTitle")}</SectionTitle>} description={p("planDescription")}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-secondary p-4">
            <div>
              <p className="text-overline text-subtle">{p("activePlan")}</p>
              <p className="mt-1 text-h3 font-semibold">{plan.current?.name ?? p("noPlan")}</p>
            </div>
            <p className="text-small">
              {p("status")}: <Badge tone={STATUS_TONE[plan.status as keyof typeof STATUS_TONE] ?? "neutral"}>{plan.status}</Badge>
            </p>
          </div>
          {endsAt ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/30 bg-accent-soft p-4">
              <p className="flex items-center gap-2 text-small">
                <Clock aria-hidden className="size-4 text-accent" />
                <span>
                  <span className="block text-overline text-accent">{p("expiryTitle")}</span>
                  {t("profile.trialEnds", { date: dateFmt.format(new Date(endsAt)) })}
                </span>
              </p>
              <PlanCountdown endsAt={endsAt} expiredLabel={p("expired")} />
            </div>
          ) : null}
          {plan.plans.length ? (
            <ul className="grid gap-4 md:grid-cols-3">
              {plan.plans.map((pl) => {
                const current = pl.id === plan.current?.id;
                return (
                  <li key={pl.id} className={`relative flex flex-col rounded-lg border p-4 ${current ? "border-success ring-1 ring-success/40" : "border-border"}`}>
                    {current ? <span className="absolute -top-2.5 left-4 rounded-full bg-success px-2 py-0.5 text-[10px] font-bold uppercase text-white">{p("currentPlan")}</span> : null}
                    <p className="font-semibold">{pl.name}</p>
                    <p className="mt-1 text-h2 font-bold tabular-nums">
                      {formatMoney(toMinor(pl.priceMonthly))}
                      <span className="text-caption font-normal text-muted"> {p("perMonth")}</span>
                    </p>
                    <ul className="mt-3 space-y-1.5 border-t border-border pt-3 text-caption">
                      {Object.entries(pl.limits).map(([k, v]) => (
                        <li key={k} className="flex gap-1.5">
                          <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-success" />
                          <span className="capitalize">{k.replaceAll("_", " ")}</span>: <strong>{v === null ? "∞" : v}</strong>
                        </li>
                      ))}
                      {pl.features.slice(0, 8).map((f) => (
                        <li key={f} className="flex gap-1.5">
                          <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-success" />
                          {labels[f] ?? f}
                        </li>
                      ))}
                    </ul>
                    {!current && can(ctx, "billing.manage") ? (
                      <Link href="/dashboard/settings/plan" className={buttonClass({ size: "sm", className: "mt-4 w-full" })}>
                        {p("upgrade")}
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </Card>

      <Card title={<SectionTitle icon={<Handshake aria-hidden />}>{p("partnerTitle")}</SectionTitle>} description={p("partnerDescription")}>
        {partner ? (
          <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 p-4 text-small">
            <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-success" />
            <div>
              <p className="font-semibold text-success">{p("linkedPartner")}</p>
              <p className="text-muted">{t("profile.linkedTo", { name: `${partner.name} · ${partner.email}`, code: partner.code })}</p>
            </div>
          </div>
        ) : (
          <p className="text-small text-muted">{p("noPartner")}</p>
        )}
      </Card>

      <Card title={<SectionTitle icon={<Lock aria-hidden />}>{p("securityTitle")}</SectionTitle>} description={p("securityDescription")}>
        <ChangePasswordForm labels={{ newPassword: p("newPassword"), confirmPassword: p("confirmPassword"), update: p("updatePassword"), updated: p("passwordUpdated") }} />
      </Card>

      <Card title={<SectionTitle icon={<ShieldCheck aria-hidden />}>{p("privacyTitle")}</SectionTitle>} description={p("privacyDescription")}>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
            <div>
              <p className="text-small font-medium">{p("exportTitle")}</p>
              <p className="text-caption text-muted">{p("exportDescription")}</p>
            </div>
            <a href="/dashboard/profile/export" download className={buttonClass({ variant: "secondary", size: "sm" })}>
              <Download aria-hidden className="size-4" /> {p("download")}
            </a>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error/30 p-4">
            <div>
              <p className="text-small font-medium text-error">{p("deleteTitle")}</p>
              <p className="text-caption text-muted">{p("deleteDescription")}</p>
            </div>
            <RequestDeletionButton labels={{ button: p("deleteButton"), title: p("deleteConfirmTitle"), body: p("deleteConfirmBody"), reason: p("deleteReason"), sent: p("deleteSent") }} />
          </div>
        </div>
      </Card>
    </div>
  );
}
