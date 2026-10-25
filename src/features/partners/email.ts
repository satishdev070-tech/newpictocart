import { escapeHtml } from "@/features/notifications/templates";
import { renderLayout, renderLayoutText, type EmailBrand, type RenderedEmail } from "@/features/notifications/email/layout";

/** Partner invite email. PURE: every value is escaped by the shared layout. */
export function renderPartnerInviteEmail(d: { brand: EmailBrand; partnerName: string; partnerCode: string; acceptUrl: string; expiresInDays: number }): RenderedEmail {
  const subject = `You're invited to the ${d.brand.storeName} partner programme`;
  const bodyText = `Hi ${d.partnerName},\n\nYou've been invited to join the ${d.brand.storeName} partner programme (partner ID ${d.partnerCode}).\n\nSign in or create an account with this email address, then accept the invitation with the button below. The link expires in ${d.expiresInDays} days and works only once.`;
  const layout = {
    brand: d.brand,
    heading: "Join the partner programme",
    preheader: `Partner ID ${d.partnerCode}`,
    cta: { label: "Accept invitation", url: d.acceptUrl },
    footnote: "If you weren't expecting this, you can ignore this email.",
  };
  const bodyHtml = bodyText
    .split("\n\n")
    .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p)}</p>`)
    .join("");
  return { subject, html: renderLayout({ ...layout, bodyHtml }), text: renderLayoutText({ ...layout, bodyText }) };
}
