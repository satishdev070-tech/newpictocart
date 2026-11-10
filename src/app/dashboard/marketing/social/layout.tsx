import { PageHeader } from "@/components/ui/layout";
import { SocialTabs } from "@/features/social/components/social-tabs";
import { getI18n } from "@/lib/i18n/server";

export default async function SocialLayout({ children }: LayoutProps<"/dashboard/marketing/social">) {
  const { t } = await getI18n();
  return (
    <div>
      <PageHeader title={t("pages.social.title")} description={t("pages.social.description")} />
      <SocialTabs />
      {children}
    </div>
  );
}
