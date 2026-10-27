import { assertServerInvoke, json, readJson } from "../_shared/auth.ts";
import { asImages, fetchImages, generateJson, normalizeProviders, orderForImages, type Prompt } from "../_shared/llm.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const denied = assertServerInvoke(req);
  if (denied) return denied;

  try {
    const body = await readJson<Record<string, unknown>>(req);
    const providers = orderForImages(normalizeProviders(body.providers), true);
    if (!providers.length) return json({ error: "not_configured" }, 503);

    const hint = typeof body.hint === "string" ? body.hint.trim().slice(0, 500) : "";
    const locale = typeof body.locale === "string" ? body.locale.trim().slice(0, 40) : "en-IN";
    const urls = Array.isArray(body.imageUrls) ? body.imageUrls.filter((u): u is string => typeof u === "string").slice(0, 4) : [];
    const images = [...asImages(body.images), ...(urls.length ? await fetchImages(urls) : [])].slice(0, 4);
    if (!images.length && !hint) return json({ error: "image_or_hint_required" }, 400);

    const prompt: Prompt = {
      system: `You are a product listing writer for Indian online stores. Reply with ONLY a JSON object (no markdown) matching:
{"title":string,"description":string,"shortDescription":string,"tags":string[],"priceMinor":integer,"productTypeHint":string|null,"categoryHint":string|null,"seoTitle":string,"seoDescription":string}
Rules:
- title: clear retail title, max 120 chars
- description: HTML-free plain text with short paragraphs separated by blank lines; useful details only; max 4000 chars
- shortDescription: one sentence, max 280 chars
- tags: 3–8 short lowercase tags
- priceMinor: suggested retail price in Indian paise (integer). Example ₹1,299 = 129900. Never invent absurd prices.
- productTypeHint / categoryHint: short guesses or null
- seoTitle max 70 chars; seoDescription max 160 chars
- Locale tone: ${locale}. Do not invent stock, SKUs, or fake certifications.`,
      user: `Write a product listing from the attached image(s)${hint ? ` and this seller hint: ${hint}` : ""}. If you cannot see an image, still produce a useful draft from the hint alone.`,
      images,
    };

    const result = await generateJson(providers, prompt);
    const data = result.data as Record<string, unknown>;
    return json({
      title: String(data.title ?? "").slice(0, 200),
      description: String(data.description ?? "").slice(0, 8000),
      shortDescription: String(data.shortDescription ?? "").slice(0, 500),
      tags: Array.isArray(data.tags) ? data.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 12) : [],
      priceMinor: Number.isFinite(Number(data.priceMinor)) ? Math.max(0, Math.round(Number(data.priceMinor))) : 0,
      productTypeHint: data.productTypeHint == null ? null : String(data.productTypeHint).slice(0, 60),
      categoryHint: data.categoryHint == null ? null : String(data.categoryHint).slice(0, 80),
      seoTitle: String(data.seoTitle ?? "").slice(0, 120),
      seoDescription: String(data.seoDescription ?? "").slice(0, 320),
      provider: result.provider,
      model: result.model,
      tokens: result.tokens,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 300) : "failed";
    return json({ error: "generation_failed", message }, 502);
  }
});
