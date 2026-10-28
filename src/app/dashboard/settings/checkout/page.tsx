import type { Metadata } from "next";
import { can, requireTenantPermission } from "@/lib/tenant/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui/layout";
import { CheckoutOptionsForm } from "@/features/dashboard-ui/forms";
import { parseCheckoutOptions, parseThankYouNote } from "@/features/checkout/options";
import { DEFAULT_THANK_YOU } from "@/features/orders-admin/print/documents";
import { getPublicPlatformConfig } from "@/features/platform/server/public-config";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutSettingsPage() {
  const ctx = await requireTenantPermission("store.read");
  const { t } = await getI18n();
  const [{ data: store, error }, platform] = await Promise.all([
    (await createSupabaseServerClient()).from("stores").select("checkout_settings").eq("tenant_id", ctx.tenantId).maybeSingle(),
    getPublicPlatformConfig(),
  ]);
  // A missing column (migration 2500 not applied yet) reads as the defaults.
  const options = parseCheckoutOptions(error ? null : store?.checkout_settings);
  return (
    <div className="space-y-6">
      <PageHeader title={t("pages.settings.checkout.title")} description={t("pages.settings.checkout.description")} />
      <Card tour="checkout-options" title="Checkout options">
        {can(ctx, "settings.write") ? (
          <CheckoutOptionsForm v={options} locationAvailable={platform.locationAutofill} thankYouNote={error ? "" : (parseThankYouNote(store?.checkout_settings) ?? "")} defaultThankYou={DEFAULT_THANK_YOU} />
        ) : (
          <ul className="space-y-1 text-small">
            <li>Guest checkout: {options.guestCheckout ? "allowed" : "sign-in required"}</li>
            <li>Location autofill: {options.locationAutofill && platform.locationAutofill ? "on" : "off"}</li>
          </ul>
        )}
      </Card>
      <Card tour="checkout-signin" title="Faster sign-in for customers" description="When the platform has Google sign-in enabled, shoppers see “Continue with Google” on your sign-in page and at checkout. One-time email codes (OTP) are always available.">
        <p className="text-small text-muted">Nothing to set up on your side.</p>
      </Card>
    </div>
  );
}
