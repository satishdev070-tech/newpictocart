/**
 * Seller AI Phase 1 — Product Generate.
 * Body: { imageUrls?: string[]; images?: { mimeType, data }[]; hints?: { title?, category?, brand?, notes? } }
 * Returns structured product fields for the dashboard editor (no DB writes).
 */
import { assertServerInvoke, json, readJson } from "../_shared/auth.ts";
import { extractJson, generateJsonText, type EdgeImage } from "../_shared/llm.ts";

type Hints = { title?: string; category?: string; brand?: string; notes?: string };
type Body = {
  imageUrls?: string[];
  images?: { mimeType?: string; data?: string }[];
  hints?: Hints;
};

const SYSTEM = `You are a product copywriter for Indian D2C / marketplace sellers (The Paliya / Pictocart).
Look at the product image(s) and optional seller hints. Reply with ONLY a JSON object (no markdown) in this shape:
{
  "title": string (max 120 chars, shop-ready),
  "shortDescription": string (max 280 chars),
  "description": string (plain text; short paragraphs separated by blank lines; bullets as "- item"),
  "categorySuggestions": string[] (1–5 category names),
  "tags": string[] (up to 12 short tags),
  "attributes": {
    "fabric": string,
    "style": string,
    "length": string,
    "work": string,
    "pattern": string,
    "occasion": string[],
    "specs": { "label": string, "value": string }[]
  },
  "seoTitle": string (max 70 chars),
  "seoDescription": string (max 160 chars),
  "brand": string,
  "careInstructions": string,
  "productTypeHint": string (short type label e.g. "kurta", "sneakers", "candle"),
  "priceHintPaise": number | null
}
Rules:
- Use empty string / [] when unknown; do not invent brand certifications.
- priceHintPaise is integer Indian paise (₹1 = 100) only when a reasonable India retail guess is clear; else null.
- Prefer India English spelling (colour, organise) only in prose if natural; keep JSON keys exactly as above.
- Never include HTML.`;

function clampStr(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function clampStrArr(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    const s = clampStr(x, maxLen);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

function normalizeProduct(raw: unknown) {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const attrs = o.attributes && typeof o.attributes === "object" ? (o.attributes as Record<string, unknown>) : {};
  const specsRaw = Array.isArray(attrs.specs) ? attrs.specs : [];
  const specs: { label: string; value: string }[] = [];
  for (const row of specsRaw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const label = clampStr(r.label, 40);
    const value = clampStr(r.value, 200);
    if (label || value) specs.push({ label, value });
    if (specs.length >= 20) break;
  }
  let priceHintPaise: number | null = null;
  if (typeof o.priceHintPaise === "number" && Number.isFinite(o.priceHintPaise)) {
    const n = Math.round(o.priceHintPaise);
    if (n >= 100 && n <= 10_000_000_00) priceHintPaise = n;
  }
  return {
    title: clampStr(o.title, 200),
    shortDescription: clampStr(o.shortDescription, 500),
    description: clampStr(o.description, 20_000),
    categorySuggestions: clampStrArr(o.categorySuggestions, 5, 80),
    tags: clampStrArr(o.tags, 12, 40),
    attributes: {
      fabric: clampStr(attrs.fabric, 80),
      style: clampStr(attrs.style, 80),
      length: clampStr(attrs.length, 80),
      work: clampStr(attrs.work, 80),
      pattern: clampStr(attrs.pattern, 80),
      occasion: clampStrArr(attrs.occasion, 8, 40),
      specs,
    },
    seoTitle: clampStr(o.seoTitle, 120),
    seoDescription: clampStr(o.seoDescription, 320),
    brand: clampStr(o.brand, 80),
    careInstructions: clampStr(o.careInstructions, 2000),
    productTypeHint: clampStr(o.productTypeHint, 60),
    priceHintPaise,
  };
}

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const denied = assertServerInvoke(req);
  if (denied) return denied;

  let body: Body;
  try {
    body = await readJson<Body>(req);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const imageUrls = (body.imageUrls ?? []).filter((u): u is string => typeof u === "string" && isHttpUrl(u)).slice(0, 4);
  const images: EdgeImage[] = [];
  for (const u of imageUrls) images.push({ type: "url", url: u });
  for (const img of body.images ?? []) {
    if (images.length >= 4) break;
    const mimeType = typeof img.mimeType === "string" ? img.mimeType : "";
    const data = typeof img.data === "string" ? img.data : "";
    if (!/^image\/(jpeg|jpg|png|webp|gif)$/i.test(mimeType)) continue;
    if (!data || data.length > 5_500_000) continue;
    images.push({ type: "base64", mimeType: mimeType.toLowerCase().replace("image/jpg", "image/jpeg"), data });
  }
  if (!images.length) return json({ error: "image_required", message: "Provide at least one image URL or base64 image." }, 400);

  const hints = body.hints ?? {};
  const hintLines = [
    hints.title ? `Working title: ${clampStr(hints.title, 120)}` : "",
    hints.category ? `Category hint: ${clampStr(hints.category, 80)}` : "",
    hints.brand ? `Brand: ${clampStr(hints.brand, 80)}` : "",
    hints.notes ? `Seller notes: ${clampStr(hints.notes, 500)}` : "",
  ].filter(Boolean);

  const user = [
    "Generate product listing fields from the attached image(s).",
    hintLines.length ? `Seller hints:\n${hintLines.join("\n")}` : "No seller hints.",
    "Return only the JSON object.",
  ].join("\n\n");

  try {
    const raw = await generateJsonText(SYSTEM, user, images);
    const parsed = normalizeProduct(extractJson(raw.text));
    if (!parsed.title && !parsed.description) {
      return json({ error: "empty_product", message: "Model returned empty product fields." }, 502);
    }
    return json({
      ok: true,
      product: parsed,
      meta: { provider: raw.provider, model: raw.model },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 200) : "generation_failed";
    return json({ error: "generation_failed", message }, 502);
  }
});
