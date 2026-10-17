import { FONT_KEYS, type FontKey } from "../schema/tokens";

/**
 * Design summary of a reference web page (pure, unit tested): colours, fonts, header/nav shape and
 * the order of page sections. It deliberately keeps NO text content, logos or image URLs from the
 * page: only measurements and names of structures, so the AI can recreate the look, not the content.
 */

export type ReferenceSummary = {
  host: string;
  colors: { hex: string; count: number }[];
  themeColor: string | null;
  fonts: string[];
  fontKeys: FontKey[];
  header: { navLinks: number; logoPosition: "left" | "center" | "unknown"; sticky: boolean; hasSearch: boolean; hasAnnouncement: boolean; drawerMenu: boolean };
  sections: string[];
  counts: { images: number; buttons: number; forms: number; videos: number };
  hints: { roundedButtons: boolean; pillButtons: boolean; uppercaseHeadings: boolean; darkBackground: boolean };
};

/** Stylesheet hrefs worth fetching (same site, max `limit`), resolved against the page URL. */
export function stylesheetLinks(html: string, pageUrl: string, limit = 3): string[] {
  const out: string[] = [];
  const base = new URL(pageUrl);
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/rel=["']?[^"'>]*stylesheet/i.test(tag)) continue;
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    try {
      const u = new URL(href.replace(/&amp;/g, "&"), base);
      if (u.protocol !== "https:") continue;
      // Same registrable-ish site (shop.example.com + cdn.example.com) or a font CDN we only read names from.
      const same = u.hostname === base.hostname || u.hostname.split(".").slice(-2).join(".") === base.hostname.split(".").slice(-2).join(".");
      if (!same) continue;
      if (!out.includes(u.toString())) out.push(u.toString());
    } catch {
      /* ignore bad hrefs */
    }
    if (out.length >= limit) break;
  }
  return out;
}

function normHex(raw: string): string | null {
  let h = raw.toLowerCase().replace("#", "");
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split("").map((c) => c + c).join("");
  else if (h.length === 8) h = h.slice(0, 6);
  return /^[0-9a-f]{6}$/.test(h) ? `#${h}` : null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

/** Colours used in CSS text, most frequent first (hex and rgb()). Near-duplicates are merged. */
export function extractColors(css: string, limit = 12): { hex: string; count: number }[] {
  const counts = new Map<string, number>();
  const add = (hex: string | null) => hex && counts.set(hex, (counts.get(hex) ?? 0) + 1);
  for (const m of css.matchAll(/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g)) add(normHex(m[0]));
  for (const m of css.matchAll(/rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,/]+([\d.]+%?))?\s*\)/gi)) {
    const alpha = m[4] ? (m[4].endsWith("%") ? Number(m[4].slice(0, -1)) / 100 : Number(m[4])) : 1;
    if (alpha < 0.5) continue;
    add(rgbToHex(Number(m[1]), Number(m[2]), Number(m[3])));
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const out: { hex: string; count: number }[] = [];
  const dist = (a: string, b: string) => {
    const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [x, y] = [p(a), p(b)];
    return Math.abs(x[0]! - y[0]!) + Math.abs(x[1]! - y[1]!) + Math.abs(x[2]! - y[2]!);
  };
  for (const [hex, count] of sorted) {
    const near = out.find((o) => dist(o.hex, hex) < 24);
    if (near) near.count += count;
    else out.push({ hex, count });
    if (out.length >= limit) break;
  }
  return out;
}

const GENERIC = new Set(["serif", "sans-serif", "monospace", "system-ui", "cursive", "fantasy", "inherit", "initial", "unset", "ui-sans-serif", "ui-serif", "ui-monospace", "-apple-system", "blinkmacsystemfont", "segoe ui", "helvetica", "arial", "helvetica neue", "roboto", "apple color emoji", "segoe ui emoji", "noto color emoji", "segoe ui symbol", "var"]);

/** Emoji, symbol and OS fallback fonts say nothing about a brand's typography. */
const SYSTEM_FONT = /emoji|symbol|sfmono|sf mono|menlo|monaco|consolas|courier new|liberation|dejavu|ubuntu mono|lucida|tahoma|verdana|icon|fontawesome|font awesome|glyph|swiper|slick/i;

/** First non-generic family of every font-family declaration plus Google Fonts link families. */
export function extractFonts(html: string, css: string, limit = 6): string[] {
  const counts = new Map<string, number>();
  const add = (name: string, w = 1) => {
    const n = name.trim().replace(/^["'\s]+|["')\s!]+$/g, "").replace(/\s*!important$/i, "").trim();
    if (!n || n.length > 40 || GENERIC.has(n.toLowerCase()) || SYSTEM_FONT.test(n) || n.startsWith("var(") || n.startsWith("--")) return;
    counts.set(n, (counts.get(n) ?? 0) + w);
  };
  for (const m of css.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) {
    const first = m[1]!.split(",").map((s) => s.trim()).find((s) => s && !GENERIC.has(s.replace(/["']/g, "").toLowerCase()) && !s.startsWith("var("));
    if (first) add(first);
  }
  for (const m of html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'\s>]+)/gi)) {
    for (const fam of m[1]!.replace(/&amp;/g, "&").matchAll(/family=([^&:]+)/g)) add(decodeURIComponent(fam[1]!.replace(/\+/g, " ")), 3);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([n]) => n);
}

/** Nearest font stack we ship (ADR-019: no third-party font downloads). */
export function mapFontToKey(family: string): FontKey | null {
  const f = family.toLowerCase();
  const rules: [RegExp, FontKey][] = [
    [/cormorant|garamond|eb garamond|cardo|crimson|libre caslon|caslon/, "editorial-serif"],
    [/fraunces|recoleta|lora|merriweather|source serif|noto serif|pt serif|dm serif|young serif/, "classic-serif"],
    [/bodoni|didot|didone|abril|gfs/, "didone"],
    [/playfair|prata|cinzel decorative|gloock/, "playfair"],
    [/marcellus|cinzel|trajan/, "marcellus"],
    [/jost|futura|montserrat|poppins|avenir|century gothic|outfit|urbanist|lexend|josefin/, "geometric-sans"],
    [/manrope|nunito|open sans|lato|source sans|work sans|mulish|raleway|figtree|plus jakarta/, "humanist-sans"],
    [/space grotesk|grotesk|archivo|syne|clash|neue haas|helvetica now|satoshi|general sans/, "grotesk"],
    [/dm sans|karla|rubik|instrument sans|albert sans/, "dm-sans"],
    [/condensed|oswald|bebas|anton|barlow|league gothic|teko|fjalla/, "condensed"],
    [/mono|courier|ibm plex mono|jetbrains/, "mono"],
    [/inter|sf pro|system|segoe|roboto|graphik|aktiv|proxima/, "modern-sans"],
    [/serif|times|georgia|baskerville|tiempos|canela|freight/, "classic-serif"],
  ];
  for (const [re, key] of rules) if (re.test(f)) return key;
  return null;
}

function strip(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, "<svg></svg>");
}

/** Section kinds recognised from class names, ids, data attributes and landmarks, in page order. */
const SECTION_PATTERNS: [RegExp, string][] = [
  [/announcement|promo-bar|topbar|top-bar|notice-bar|ticker/, "announcement"],
  [/marquee|scrolling-text|ticker-tape/, "marquee"],
  [/hero|slideshow|banner-main|main-banner|carousel-hero|masthead|jumbotron/, "hero"],
  [/collection-list|categor(y|ies)|shop-by|department/, "category tiles"],
  [/featured-collection|product-grid|products-grid|product-list|best-?sell|trending|new-arrivals|product-carousel|product-slider/, "product grid"],
  [/image-with-text|image-text|media-text|split|feature-row|story|about/, "image + text story"],
  [/testimonial|review|quote/, "testimonials"],
  [/newsletter|subscribe|signup|email-signup/, "newsletter"],
  [/logo-list|brands|press|as-seen/, "brand logos strip"],
  [/video/, "video"],
  [/faq|accordion/, "faq"],
  [/usp|benefit|trust|features|icon-list|value-prop/, "trust / USP icons"],
  [/instagram|ugc|social/, "social / UGC strip"],
  [/countdown|sale|offer|deal/, "sale / offer banner"],
  [/lookbook|gallery|mosaic/, "lookbook gallery"],
];

function sectionKinds(body: string): string[] {
  const out: string[] = [];
  const re = /<(section|div|aside)\b([^>]*)>/gi;
  for (const m of body.matchAll(re)) {
    const attrs = m[2]!.toLowerCase();
    const names = [...attrs.matchAll(/(?:class|id|data-section-type|data-section-id)=["']([^"']+)["']/g)].map((x) => x[1]).join(" ");
    if (!names) continue;
    // Only section-level wrappers: Shopify-style "shopify-section", <section>, or explicit section/block names.
    if (m[1]!.toLowerCase() !== "section" && !/section|shopify-section|block|module|banner|hero|slideshow|announcement/.test(names)) continue;
    for (const [pat, kind] of SECTION_PATTERNS) {
      if (pat.test(names)) {
        if (out[out.length - 1] !== kind) out.push(kind);
        break;
      }
    }
    if (out.length >= 24) break;
  }
  return out;
}

export function summarizeReference(html: string, css: string, pageUrl: string): ReferenceSummary {
  const clean = strip(html);
  const inlineCss = [...clean.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n") + "\n" + [...clean.matchAll(/style=["']([^"']+)["']/gi)].map((m) => m[1]).join(";\n");
  const allCss = `${inlineCss}\n${css}`;
  const headerHtml = clean.match(/<header\b[\s\S]*?<\/header>/i)?.[0] ?? clean.match(/<(?:div|section)\b[^>]*(?:class|id)=["'][^"']*header[^"']*["'][\s\S]{0,20000}?<\/nav>/i)?.[0] ?? "";
  const navHtml = headerHtml.match(/<nav\b[\s\S]*?<\/nav>/i)?.[0] ?? headerHtml;
  const navLinks = Math.min((navHtml.match(/<a\b/gi) ?? []).length, 60);
  const headerLower = headerHtml.toLowerCase();
  const logoCenter = /logo[^"']*(center|centre|middle)|(center|centre|middle)[^"']*logo|header--center|header__heading--center|logo-center/.test(headerLower);
  const fonts = extractFonts(clean, allCss);
  const fontKeys = [...new Set(fonts.map(mapFontToKey).filter((k): k is FontKey => !!k && (FONT_KEYS as string[]).includes(k)))];
  const colors = extractColors(allCss);
  const themeColor = normHex(clean.match(/<meta\b[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)["']/i)?.[1] ?? "") ?? null;
  const bodyBg = allCss.match(/(?:^|[}\s;])(?:body|html)\s*\{[^}]*background(?:-color)?\s*:\s*(#[0-9a-f]{3,8})/i)?.[1];
  const bg = bodyBg ? normHex(bodyBg) : null;
  const lum = (h: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const bodyHtml = clean.match(/<body\b[\s\S]*$/i)?.[0] ?? clean;
  return {
    host: new URL(pageUrl).hostname,
    colors,
    themeColor,
    fonts,
    fontKeys,
    header: {
      navLinks,
      logoPosition: logoCenter ? "center" : headerHtml ? "left" : "unknown",
      sticky: /sticky|fixed-header|header--fixed|is-fixed/.test(headerLower) || /header[^{]*\{[^}]*position\s*:\s*(sticky|fixed)/i.test(allCss),
      hasSearch: /search/.test(headerLower),
      hasAnnouncement: /announcement|promo-bar|topbar|top-bar/.test(bodyHtml.slice(0, 40_000).toLowerCase()),
      drawerMenu: /drawer|hamburger|menu-toggle|burger|offcanvas/.test(headerLower) && navLinks < 4,
    },
    sections: sectionKinds(bodyHtml),
    counts: {
      images: Math.min((bodyHtml.match(/<img\b/gi) ?? []).length, 500),
      buttons: Math.min((bodyHtml.match(/<button\b|class=["'][^"']*\bbtn|class=["'][^"']*button/gi) ?? []).length, 500),
      forms: Math.min((bodyHtml.match(/<form\b/gi) ?? []).length, 50),
      videos: Math.min((bodyHtml.match(/<video\b|youtube\.com\/embed|player\.vimeo/gi) ?? []).length, 50),
    },
    hints: {
      roundedButtons: /(?:button|btn)[^{]*\{[^}]*border-radius\s*:\s*(?:[4-9]|1\d)px/i.test(allCss),
      pillButtons: /(?:button|btn)[^{]*\{[^}]*border-radius\s*:\s*(?:\d{2,}px|9999|50%|100px|999)/i.test(allCss),
      uppercaseHeadings: /h[1-3][^{]*\{[^}]*text-transform\s*:\s*uppercase/i.test(allCss),
      darkBackground: bg ? lum(bg) < 0.25 : false,
    },
  };
}

/** Plain-text rendering of the summary for the prompt (data only, no page text). */
export function summaryForPrompt(s: ReferenceSummary | null): string {
  if (!s) return "No website was fetched; use the screenshot(s) only.";
  return [
    `Reference host: ${s.host}`,
    `Most used colours (hex, uses): ${s.colors.map((c) => `${c.hex} ${c.count}`).join(", ") || "none found"}`,
    s.themeColor ? `Meta theme colour: ${s.themeColor}` : null,
    `Fonts named in CSS: ${s.fonts.join(", ") || "none found"}; nearest allowed font keys: ${s.fontKeys.join(", ") || "none"}`,
    `Header: ${s.header.navLinks} links, logo ${s.header.logoPosition}, ${s.header.sticky ? "sticky" : "not sticky"}, search ${s.header.hasSearch ? "yes" : "no"}, announcement bar ${s.header.hasAnnouncement ? "yes" : "no"}, ${s.header.drawerMenu ? "hamburger/drawer menu" : "visible menu"}`,
    `Section order detected: ${s.sections.join(" → ") || "unknown"}`,
    `Counts: ${s.counts.images} images, ${s.counts.buttons} buttons, ${s.counts.videos} videos`,
    `Hints: ${[s.hints.pillButtons && "pill buttons", s.hints.roundedButtons && "rounded buttons", s.hints.uppercaseHeadings && "uppercase headings", s.hints.darkBackground && "dark background"].filter(Boolean).join(", ") || "none"}`,
  ]
    .filter(Boolean)
    .join("\n");
}
