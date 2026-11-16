/**
 * Compact facts about ONE informative website for "Ask Pictocart AI" (pure, unit tested). Built
 * from data the server read with the member's own session. Prices stay as display text; no ids.
 */
export const INFORMATIVE_SNAPSHOT_MAX_CHARS = 6000;

export type InformativeSnapshotInput = {
  businessName: string;
  serviceType: string | null;
  category: string;
  status: "DRAFT" | "PUBLISHED";
  siteUrl: string;
  tagline: string | null;
  about: string | null;
  hasLogo: boolean;
  hasHeroImage: boolean;
  contact: { phone: string | null; whatsapp: string | null; email: string | null; city: string | null; address: string | null };
  hoursSet: boolean;
  socialLinks: number;
  seo: { title: string | null; description: string | null };
  services: { name: string; priceText: string | null; hasDescription: boolean; isActive: boolean }[];
  pages: { title: string; isPublished: boolean }[];
  faqs: number;
  gallery: number;
  testimonials: number;
  team: number;
  /** null when the member may not see enquiries. */
  enquiries: { new: number; contacted: number; converted: number; closed: number } | null;
  creditBalance: number | null;
};

/** What's missing or weak, most important first (shown to the model and testable on its own). */
export function informativeMissingItems(s: InformativeSnapshotInput): string[] {
  const out: string[] = [];
  const activeServices = s.services.filter((x) => x.isActive);
  if (s.status !== "PUBLISHED") out.push("Website is not published yet (Settings)");
  if (!s.contact.phone && !s.contact.whatsapp) out.push("No phone or WhatsApp number (Business details)");
  if (!activeServices.length) out.push("No services listed (Services)");
  else if (activeServices.length < 3) out.push(`Only ${activeServices.length} service(s) listed (Services)`);
  const noDesc = activeServices.filter((x) => !x.hasDescription).map((x) => x.name);
  if (noDesc.length) out.push(`Services without a description: ${noDesc.slice(0, 6).join(", ")} (Services)`);
  if (!s.about || s.about.trim().length < 120) out.push("About text is missing or very short (Business details)");
  if (!s.tagline) out.push("No tagline (Business details)");
  if (!s.contact.city && !s.contact.address) out.push("No city or address (Business details)");
  if (!s.hoursSet) out.push("Opening hours not set (Business details)");
  if (!s.hasLogo) out.push("No logo (Appearance)");
  if (!s.hasHeroImage) out.push("No main photo on the home page (Appearance)");
  if (s.faqs < 3) out.push(`Only ${s.faqs} FAQ(s) (FAQs)`);
  if (!s.seo.title || !s.seo.description) out.push("Google title or description missing (SEO)");
  if (!s.gallery) out.push("No gallery photos (Gallery)");
  if (!s.testimonials) out.push("No customer testimonials (Testimonials)");
  if (!s.socialLinks) out.push("No social media links (Business details)");
  return out;
}

const line = (label: string, value: string | number | null | undefined) => (value === null || value === undefined || value === "" ? null : `${label}: ${value}`);
const short = (v: string | null, max: number) => (v ? v.replace(/\s+/g, " ").trim().slice(0, max) : null);

export function buildInformativeSnapshot(s: InformativeSnapshotInput): string {
  const missing = informativeMissingItems(s);
  const out: (string | null)[] = [
    line("Business", s.businessName),
    line("Service type", s.serviceType ?? s.category.replace(/[-_]+/g, " ")),
    line("Website", `${s.siteUrl} (${s.status === "PUBLISHED" ? "published" : "draft, not public yet"})`),
    line("City", s.contact.city),
    line("Tagline", short(s.tagline, 120) ?? "none"),
    line("About", short(s.about, 1200) ?? "none"),
    line("SEO title", s.seo.title ?? "none"),
    line("SEO description", s.seo.description ?? "none"),
    s.services.length
      ? `Services (${s.services.length}):\n- ${s.services
          .slice(0, 20)
          .map((x) => `${x.name}${x.priceText ? ` (${x.priceText})` : ""}${x.isActive ? "" : " [hidden]"}${x.hasDescription ? "" : " [no description]"}`)
          .join("\n- ")}`
      : "Services: none",
    s.pages.length ? `Pages: ${s.pages.map((p) => `${p.title}${p.isPublished ? "" : " [hidden]"}`).join("; ")}` : "Pages: none",
    `Content: ${s.faqs} FAQs, ${s.gallery} gallery photos, ${s.testimonials} testimonials, ${s.team} team members`,
    s.enquiries
      ? `Enquiries: ${s.enquiries.new} new (not yet contacted), ${s.enquiries.contacted} contacted, ${s.enquiries.converted} converted, ${s.enquiries.closed} closed`
      : "Enquiries: not visible to this team member",
    line("AI credits left", s.creditBalance),
    `Missing:\n- ${missing.length ? missing.join("\n- ") : "nothing important"}`,
  ];
  return out.filter(Boolean).join("\n").slice(0, INFORMATIVE_SNAPSHOT_MAX_CHARS);
}
