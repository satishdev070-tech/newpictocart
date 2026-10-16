import type { CSSProperties, ReactNode } from "react";
import { FONT_STACKS, type FontKey } from "../schema/tokens";
import { layoutSummary } from "../layouts/apply-layout";
import { toUnsplashCategory } from "@/lib/unsplash-categories";
import { curatedStock, sizedStockUrl, stockIndex } from "@/lib/unsplash-stock";
import type { ThemePreset } from "./catalog";

/**
 * Live, token-driven preview of a theme (no screenshots to go stale): header, hero, a product block
 * and footer drawn with the theme's own colours, fonts, button shape, card style AND layout (hero
 * variant, product layout, header style, footer layout), with the category's Unsplash photos.
 * Decorative only; plain <img>s at small widths, lazy-loaded.
 */
const RADIUS: Record<string, string> = { none: "0", sm: "4px", md: "8px", lg: "14px" };
const BTN: Record<string, string> = { square: "0", rounded: "6px", pill: "999px" };

function Photo({ src, style, radius = "0" }: { src: string; style?: CSSProperties; radius?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- tiny decorative thumbnail, pre-sized by Unsplash
  return <img src={src} alt="" loading="lazy" decoding="async" style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", borderRadius: radius, ...style }} />;
}

export function ThemeMockup({ preset, name, size = "card" }: { preset: ThemePreset; name: string; size?: "card" | "large" | "phone" }) {
  const t = preset.tokens as Record<string, unknown> & { colors: Record<string, string> };
  const c = t.colors;
  const heading = FONT_STACKS[(t.headingFont as FontKey) ?? "editorial-serif"]?.stack;
  const body = FONT_STACKS[(t.bodyFont as FontKey) ?? "modern-sans"]?.stack;
  const upper = t.headingCase === "uppercase";
  const radius = RADIUS[String(t.cardRadius)] ?? "0";
  const btnRadius = BTN[String(t.buttonShape)] ?? "0";
  const outline = t.buttonVariant === "outline";
  const phone = size === "phone";
  const large = size === "large";
  const layout = layoutSummary(preset);
  const center = phone || preset.headerLayout === "logo-center" || layout.headerStyle === "editorial";
  const cat = toUnsplashCategory(preset.family ?? "general");
  const w = large ? 640 : 360;
  // Rotate the category's photos by theme name, so cards of one category don't all share a photo.
  const shift = stockIndex(name);
  const rotate = <T,>(list: T[]) => list.map((_, i) => list[(i + shift) % list.length]!);
  const hero = rotate(curatedStock(cat, "hero").map((i) => sizedStockUrl(i.url, w)));
  const prod = rotate(curatedStock(cat, "products").map((i) => sizedStockUrl(i.url, large ? 320 : 200)));
  const ratio = String(preset.productCard.imageRatio) === "tall" ? "3/4.4" : String(preset.productCard.imageRatio) === "square" ? "1/1" : "3/4";
  const footerBg = preset.footerTone === "dark" ? c.primary : preset.footerTone === "muted" ? c.border : c.background;
  const heroH = large ? 210 : phone ? 150 : 104;
  const pad = large ? 20 : 12;
  const hType: CSSProperties = { fontFamily: heading, textTransform: upper ? "uppercase" : "none", lineHeight: 1.02 };

  const button = (light: boolean) => (
    <span style={{ display: "inline-block", marginTop: 6, padding: "3px 10px", borderRadius: btnRadius, background: outline ? "transparent" : light ? "#fff" : c.primary, color: outline ? "inherit" : light ? c.primary : "#fff", border: `1px solid ${light ? "#fff" : c.primary}`, fontSize: "0.8em" }}>Shop now</span>
  );
  const text = (light: boolean, big = false, align: "left" | "center" = "left") => (
    <div style={{ textAlign: align, color: light ? "#fff" : c.text }}>
      <div style={{ fontSize: "0.7em", letterSpacing: "0.18em", opacity: 0.8 }}>NEW SEASON</div>
      <div style={{ ...hType, fontSize: big ? (large ? "3em" : "2.2em") : large ? "2.3em" : "1.7em", margin: "3px 0 2px" }}>Made by hand</div>
      {button(light)}
    </div>
  );
  const panel = c.border;

  let heroNode: ReactNode;
  switch (layout.hero) {
    case "split":
      heroNode = (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", height: heroH, background: panel }}>
          <Photo src={hero[0]!} />
          <div style={{ display: "flex", alignItems: "center", padding: pad }}>{text(false)}</div>
        </div>
      );
      break;
    case "collage":
      heroNode = (
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 8, alignItems: "center", height: heroH, padding: `0 ${pad}px`, background: c.background }}>
          {text(false, true)}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(2, 1fr)", gap: 4, height: heroH - 16 }}>
            <div style={{ gridColumn: "1 / 3", gridRow: "1 / 3" }}><Photo src={hero[0]!} radius={radius} /></div>
            <Photo src={hero[1]!} radius={radius} />
            <Photo src={hero[2]!} radius={radius} />
          </div>
        </div>
      );
      break;
    case "minimal":
      heroNode = (
        <div style={{ background: c.background, padding: `${pad * 0.6}px ${pad}px 0`, height: heroH }}>
          {text(false, true, "center")}
          <div style={{ height: heroH * 0.32, marginTop: 6 }}><Photo src={hero[0]!} radius={radius} /></div>
        </div>
      );
      break;
    case "band":
      heroNode = (
        <div style={{ height: heroH, background: panel }}>
          <div style={{ height: heroH * 0.48 }}><Photo src={hero[0]!} /></div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", padding: `6px ${pad}px` }}>
            <div style={{ ...hType, fontSize: large ? "2.4em" : "1.6em", color: c.text }}>Made by hand</div>
            {button(false)}
          </div>
        </div>
      );
      break;
    case "cards":
      heroNode = (
        <div style={{ display: "flex", gap: 6, height: heroH, padding: "8px 0", background: panel, overflow: "hidden" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ position: "relative", flex: "0 0 76%", marginLeft: i === 0 ? 10 : 0, borderRadius: 10, overflow: "hidden" }}>
              <Photo src={hero[i]!} />
              {i === 0 ? <div style={{ position: "absolute", left: 10, bottom: 8 }}>{text(true)}</div> : null}
            </div>
          ))}
        </div>
      );
      break;
    case "framed":
      heroNode = (
        <div style={{ position: "relative", height: heroH, padding: 8, background: c.background }}>
          <Photo src={hero[0]!} radius="10px" />
          <div style={{ position: "absolute", left: 18, bottom: 14, padding: "8px 12px", background: c.background, borderRadius: 8, boxShadow: "0 6px 16px rgb(0 0 0 / 0.2)" }}>{text(false)}</div>
        </div>
      );
      break;
    default:
      heroNode = (
        <div style={{ position: "relative", height: heroH }}>
          <Photo src={hero[0]!} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgb(0 0 0 / 0.55), rgb(0 0 0 / 0.1))" }} />
          <div style={{ position: "absolute", left: pad, right: pad, bottom: pad, ...(preset.hero.align === "center" ? { textAlign: "center" } : {}) }}>{text(true, false, preset.hero.align === "center" ? "center" : "left")}</div>
        </div>
      );
  }

  const n = large ? 4 : phone ? 2 : 3;
  const card = (i: number, ar = ratio) => (
    <div key={i} style={{ textAlign: preset.productCard.textAlign === "center" ? "center" : "left" }}>
      <div style={{ aspectRatio: ar, position: "relative", overflow: "hidden", borderRadius: radius }}>
        <Photo src={prod[i % prod.length]!} />
        {i === 1 ? <span style={{ position: "absolute", top: 4, left: 4, background: c.sale, color: "#fff", padding: "1px 4px", fontSize: "0.7em", borderRadius: preset.productCard.badgeStyle === "filled" ? 3 : 0 }}>SALE</span> : null}
      </div>
      <div style={{ marginTop: 4, height: 4, width: "70%", background: c.text, opacity: 0.25, marginInline: preset.productCard.textAlign === "center" ? "auto" : 0 }} />
      <div style={{ marginTop: 3, fontWeight: 600, color: c.primary }}>₹{[2490, 1890, 3450, 1290][i % 4]}</div>
    </div>
  );
  let products: ReactNode;
  switch (layout.products) {
    case "masonry":
      products = (
        <div style={{ columns: n, columnGap: 8 }}>
          {Array.from({ length: n * 2 }, (_, i) => (
            <div key={i} style={{ breakInside: "avoid", marginBottom: 8 }}>{card(i, ["3/4.4", "1/1", "3/4"][i % 3])}</div>
          ))}
        </div>
      );
      break;
    case "lookbook":
      products = (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={{ borderRadius: radius, overflow: "hidden" }}><Photo src={prod[0]!} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>{[1, 2, 3, 0].map((i) => card(i, "1/1"))}</div>
        </div>
      );
      break;
    case "rail":
      products = <div style={{ display: "flex", gap: 8, marginRight: -pad }}>{Array.from({ length: n + 1 }, (_, i) => <div key={i} style={{ flex: `0 0 ${phone ? 44 : 30}%` }}>{card(i)}</div>)}</div>;
      break;
    case "bigtile":
      products = (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[0, 1].map((i) => (
            <div key={i} style={{ position: "relative", aspectRatio: "4/5", borderRadius: radius, overflow: "hidden" }}>
              <Photo src={prod[i]!} />
              <div style={{ position: "absolute", left: 6, bottom: 6, color: "#fff", ...hType, fontSize: "1.2em", textShadow: "0 1px 3px rgb(0 0 0 / 0.6)" }}>Signature piece</div>
            </div>
          ))}
        </div>
      );
      break;
    case "list":
      products = (
        <div style={{ display: "grid", gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${c.border}`, paddingBottom: 6 }}>
              <div style={{ width: large ? 48 : 30, height: large ? 48 : 30, flex: "none", borderRadius: radius, overflow: "hidden" }}><Photo src={prod[i]!} /></div>
              <div style={{ flex: 1, ...hType, fontSize: "1.1em" }}>House favourite</div>
              <div style={{ fontWeight: 600, color: c.primary }}>₹{[490, 890, 1290][i]}</div>
            </div>
          ))}
        </div>
      );
      break;
    default:
      products = <div style={{ display: "grid", gridTemplateColumns: `repeat(${n}, 1fr)`, gap: 8 }}>{Array.from({ length: n }, (_, i) => card(i))}</div>;
  }

  const hs = layout.headerStyle;
  const headerStyle: CSSProperties =
    hs === "inverted"
      ? { background: c.primary, color: "#fff" }
      : hs === "floating"
        ? { margin: "6px 8px 0", border: `1px solid ${c.border}`, borderRadius: 999, background: c.background }
        : hs === "bordered"
          ? { borderBottom: `3px double ${c.text}`, paddingBlock: 10 }
          : hs === "minimal"
            ? {}
            : hs === "editorial"
              ? { paddingBlock: 12, borderBottom: `1px solid ${c.border}` }
              : { borderBottom: `1px solid ${c.border}` };

  return (
    <div aria-hidden className="overflow-hidden select-none" style={{ background: c.background, color: c.text, fontFamily: body, fontSize: large ? 12 : 9 }}>
      <div style={{ background: preset.announcementTone === "accent" ? c.accent : preset.announcementTone === "light" ? c.background : c.primary, color: preset.announcementTone === "light" ? c.text : "#fff", textAlign: "center", padding: "3px 0", fontSize: "0.8em", letterSpacing: "0.08em" }}>
        FREE SHIPPING ACROSS INDIA
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: center ? "center" : "space-between", gap: 12, padding: "8px 12px", ...headerStyle }}>
        <span style={{ ...hType, fontSize: hs === "editorial" ? "2em" : "1.5em", letterSpacing: upper ? "0.08em" : 0, color: hs === "inverted" ? "#fff" : c.primary }}>{name}</span>
        {!center ? (
          <span style={{ display: "flex", gap: 10, opacity: 0.75 }}>
            <span>New</span>
            <span>Shop</span>
            <span>Sale</span>
          </span>
        ) : null}
      </div>
      {heroNode}
      <div style={{ padding: pad }}>{products}</div>
      {layout.footerLayout === "statement" ? (
        <div style={{ background: footerBg, color: preset.footerTone === "dark" ? "#fff" : c.text, ...hType, fontSize: large ? "4em" : "2.6em", textAlign: "center", lineHeight: 1, padding: "4px 0", overflow: "hidden", whiteSpace: "nowrap" }}>{name}</div>
      ) : (
        <div style={{ background: footerBg, height: large ? 24 : 14 }} />
      )}
    </div>
  );
}
