import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { informativeRoute, routePath, STORE_ONLY_SEGMENTS } from "@/features/informative/public/paths";
import { RESERVED_PAGE_SLUGS } from "@/features/informative/slug";
import { INTERNAL_PATH_HEADER, INTERNAL_REQUEST_HEADERS } from "@/lib/tenant/routing";

describe("public routes", () => {
  it("maps the plan's routes and nothing else", () => {
    expect(informativeRoute("/")).toEqual({ kind: "home" });
    expect(informativeRoute("/about/")).toEqual({ kind: "about" });
    expect(informativeRoute("/services")).toEqual({ kind: "services" });
    expect(informativeRoute("/services/hair-cut")).toEqual({ kind: "service", slug: "hair-cut" });
    expect(informativeRoute("/gallery")).toEqual({ kind: "gallery" });
    expect(informativeRoute("/contact?x=1")).toEqual({ kind: "contact" });
    expect(informativeRoute("/careers")).toEqual({ kind: "custom", slug: "careers" });
    for (const p of ["/cart", "/checkout", "/products/x", "/account/orders", "/blog", "/a/b", "/services/x/y", "/Bad_Slug", "/%E0%A4"]) expect(informativeRoute(p), p).toBeNull();
    expect(routePath({ kind: "service", slug: "a" })).toBe("/services/a");
  });

  it("every storefront route folder is either an informative route or blocked", () => {
    const base = "src/app/store/[host]";
    const dirs = readdirSync(base).filter((f) => statSync(join(base, f)).isDirectory());
    const informative = new Set(["about", "services", "gallery", "contact", "[...rest]", "robots.txt", "sitemap.xml"]);
    for (const d of dirs) if (!informative.has(d)) expect(STORE_ONLY_SEGMENTS.has(d), `${d} must be in STORE_ONLY_SEGMENTS`).toBe(true);
    for (const s of STORE_ONLY_SEGMENTS) expect(RESERVED_PAGE_SLUGS.has(s), `${s} must be a reserved custom-page slug`).toBe(true);
  });

  it("the path header can't be injected by a client", () => {
    expect(INTERNAL_REQUEST_HEADERS).toContain(INTERNAL_PATH_HEADER);
  });
});

// ---- Rendering with a mocked loader ------------------------------------------------------------

const TENANT = { tenantId: "t1", slug: "calm", name: "Calm Clinic", status: "active" as const, host: "calm.pictocart.in", primaryHost: "calm.pictocart.in", websiteType: "INFORMATIVE" as const };
const site = {
  tenantId: "t1", themeId: "zenith-prime", businessName: "Calm Clinic", tagline: "Gentle care", category: "clinic_healthcare" as const, about: "We care.",
  logoPath: null, faviconPath: null, heroImagePath: null, primaryColor: null, secondaryColor: null, fontPair: null,
  contact: { phone: "+919876543210", whatsapp: "+919876543210", email: "hi@calm.test", city: "Pune", address: "MG Road", mapUrl: null },
  hours: [{ day: 1, open: "09:00", close: "18:00", closed: false }], socialLinks: {}, seo: { title: null, description: null, ogImagePath: null },
  options: { enquirySuccessMessage: null, showPreferredDateTime: null, privacyText: null }, status: "PUBLISHED" as const, publishedAt: null, updatedAt: "2026-11-11T00:00:00Z",
};
const page = (type: string, slug: string, title: string) => ({ id: slug, type, title, slug, sections: [{ id: "faq-0", type: "faq" as const, props: {}, order: 0, visible: true }], isPublished: true, sortOrder: 0, seo: { title: null, description: null } });
let bundle: unknown = null;
let flag = "all";
let pathHeader: string | null = "/";

vi.mock("@/features/informative/server/public", () => ({ getPublishedSite: async () => bundle, getDraftSite: async () => bundle }));
vi.mock("@/app/informative-fonts", () => ({ informativeFontVariables: "fonts" }));
vi.mock("@/lib/storage/assets", () => ({ assetUrl: (p: string | null) => (p ? `https://cdn/${p}` : null) }));
vi.mock("next/headers", () => ({ headers: async () => ({ get: () => pathHeader }) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw Object.assign(new Error("NEXT_NOT_FOUND"), { notFound: true }); } }));
vi.mock("@/features/informative/public/enquiry-actions", () => ({ submitInformativeEnquiryAction: async () => ({ ok: true, data: undefined }) }));

beforeEach(() => {
  flag = "all";
  process.env.FEATURE_INFORMATIVE_WEBSITE = flag;
  pathHeader = "/";
  bundle = {
    site,
    services: [{ id: "s1", name: "Consultation", slug: "consultation", shortDescription: "Talk to a doctor", description: "Full check.", imagePath: null, priceType: "FIXED", pricePaise: 50000, durationMinutes: 15, category: null, isFeatured: false, isActive: true, isSample: false, sortOrder: 0, seo: { title: null, description: null } }],
    pages: [page("HOME", "home", "Home"), page("ABOUT", "about", "About"), page("SERVICES", "services", "Services"), page("CONTACT", "contact", "Contact"), page("CUSTOM", "careers", "Careers")],
    gallery: [],
    team: [],
    testimonials: [],
    faqs: [{ id: "f", question: "Open Sunday?", answer: "No.", isVisible: true, sortOrder: 0 }],
  };
});

async function html(el: Promise<ReactElement> | ReactElement) {
  return renderToStaticMarkup(await el);
}

describe("InformativeRoutePage", () => {
  it("home: LocalBusiness JSON-LD, one h1, nav hides empty sections (no gallery)", async () => {
    const { InformativeRoutePage } = await import("@/features/informative/public/render");
    const out = await html(InformativeRoutePage({ tenant: TENANT, route: { kind: "home" } }));
    expect(out).toContain('"@type":"LocalBusiness"');
    expect(out).toContain('"telephone":"+919876543210"');
    expect(out.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(out).not.toContain('href="/gallery"');
    expect(out).toContain('href="/careers"');
  });

  it("service detail: Service JSON-LD with INR offer, WhatsApp CTA", async () => {
    const { InformativeRoutePage } = await import("@/features/informative/public/render");
    const out = await html(InformativeRoutePage({ tenant: TENANT, route: { kind: "service", slug: "consultation" } }));
    expect(out).toContain('"@type":"Service"');
    expect(out).toContain('"price":"500.00"');
    expect(out).toContain("https://wa.me/919876543210");
    expect(out).toMatch(/<h1[^>]*>Consultation<\/h1>/);
    // Live enquiry form on the service page: service preselected, source SERVICE_PAGE, consent + honeypot.
    expect(out).toContain('value="SERVICE_PAGE"');
    expect(out).toMatch(/<option value="s1" selected="">Consultation<\/option>/);
    expect(out).toContain('name="consent"');
    expect(out).toContain('name="website"');
    expect(out).toContain('href="/privacy"');
    expect(out).not.toMatch(/<fieldset disabled/);
  });

  it("missing content is a 404 (unknown custom page, unknown service, empty gallery, draft)", async () => {
    const { InformativeRoutePage } = await import("@/features/informative/public/render");
    await expect(InformativeRoutePage({ tenant: TENANT, route: { kind: "custom", slug: "nope" } })).rejects.toMatchObject({ notFound: true });
    await expect(InformativeRoutePage({ tenant: TENANT, route: { kind: "service", slug: "nope" } })).rejects.toMatchObject({ notFound: true });
    await expect(InformativeRoutePage({ tenant: TENANT, route: { kind: "gallery" } })).rejects.toMatchObject({ notFound: true });
    bundle = null;
    await expect(InformativeRoutePage({ tenant: TENANT, route: { kind: "home" } })).rejects.toMatchObject({ notFound: true });
  });

  it("owner preview links stay inside the preview and carry a notice", async () => {
    const { InformativeRoutePage } = await import("@/features/informative/public/render");
    const out = await html(InformativeRoutePage({ tenant: TENANT, route: { kind: "home" }, mode: { kind: "preview", base: "/informative/site-preview" } }));
    expect(out).toContain('href="/informative/site-preview/about"');
    expect(out).toContain("Preview of your website");
    const svc = await html(InformativeRoutePage({ tenant: TENANT, route: { kind: "service", slug: "consultation" }, mode: { kind: "preview", base: "/informative/site-preview" } }));
    expect(svc).toMatch(/<fieldset disabled/); // the owner's preview never sends enquiries
  });
});

describe("InformativeStoreGate (storefront layout branch)", () => {
  const child = createElement("p", null, "CHILD");
  it("published + informative path → the page", async () => {
    const { InformativeStoreGate } = await import("@/features/informative/public/render");
    expect(await html(InformativeStoreGate({ tenant: TENANT, children: child }))).toContain("CHILD");
  });
  it("store-only paths 404", async () => {
    const { InformativeStoreGate } = await import("@/features/informative/public/render");
    for (const p of ["/cart", "/checkout", "/products/x", "/account"]) {
      pathHeader = p;
      await expect(InformativeStoreGate({ tenant: TENANT, children: child })).rejects.toMatchObject({ notFound: true });
    }
  });
  it("draft → coming soon; flag off → maintenance (never the store UI)", async () => {
    const { InformativeStoreGate } = await import("@/features/informative/public/render");
    bundle = null;
    const draft = await html(InformativeStoreGate({ tenant: TENANT, children: child }));
    expect(draft).toContain("Coming soon");
    expect(draft).not.toContain("CHILD");
    process.env.FEATURE_INFORMATIVE_WEBSITE = "off";
    const off = await html(InformativeStoreGate({ tenant: TENANT, children: child }));
    expect(off).toContain("being updated");
    expect(off).not.toContain("CHILD");
  });
  it("robots/sitemap: indexable only when published", async () => {
    const { informativeRobots, informativeSitemap } = await import("@/features/informative/public/seo-routes");
    expect(await (await informativeRobots(TENANT)).text()).toContain("Allow: /");
    const xml = await (await informativeSitemap(TENANT)).text();
    expect(xml).toContain("https://calm.pictocart.in/services/consultation");
    expect(xml).toContain("https://calm.pictocart.in/careers");
    expect(xml).not.toContain("/gallery");
    bundle = null;
    expect(await (await informativeRobots(TENANT)).text()).toContain("Disallow: /");
    expect((await informativeSitemap(TENANT)).status).toBe(404);
  });
});

describe("route handlers never load next/font (regression: sitemap.xml crashed)", () => {
  it("sitemap/robots use the font-free seo-routes module", async () => {
    const { readFileSync } = await import("node:fs");
    const seo = readFileSync("src/features/informative/public/seo-routes.ts", "utf8");
    expect(seo).not.toMatch(/informative-fonts|\.\/render|site\/renderer/);
    for (const f of ["src/app/store/[host]/sitemap.xml/route.ts", "src/app/store/[host]/robots.txt/route.ts", "src/app/api/informative/whatsapp-click/route.ts"]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/informative\/public\/render|informative-fonts/);
    }
  });
});

describe("metadata", () => {
  it("falls back to a generated meta description when the seller wrote none", async () => {
    const { informativeRouteMetadata } = await import("@/features/informative/public/render");
    (bundle as { site: { tagline: string | null; about: string | null } }).site = { ...site, tagline: null, about: null };
    const meta = await informativeRouteMetadata(TENANT, { kind: "home" });
    expect(meta.description).toMatch(/^Calm Clinic: clinic \/ healthcare in Pune\. Consultation\./);
  });
});
