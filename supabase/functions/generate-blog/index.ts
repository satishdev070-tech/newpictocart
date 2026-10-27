import { assertServerInvoke, json, readJson } from "../_shared/auth.ts";
import { generateJson, normalizeProviders, type Prompt } from "../_shared/llm.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const denied = assertServerInvoke(req);
  if (denied) return denied;

  try {
    const body = await readJson<Record<string, unknown>>(req);
    const providers = normalizeProviders(body.providers);
    if (!providers.length) return json({ error: "not_configured" }, 503);

    const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 300) : "";
    const storeName = typeof body.storeName === "string" ? body.storeName.trim().slice(0, 120) : "our store";
    const locale = typeof body.locale === "string" ? body.locale.trim().slice(0, 40) : "en-IN";
    if (topic.length < 3) return json({ error: "topic_required" }, 400);

    const prompt: Prompt = {
      system: `You write blog posts for small Indian ecommerce brands. Reply with ONLY JSON:
{"title":string,"excerpt":string,"tags":string[],"seoTitle":string,"seoDescription":string,"blocks":[{"type":"heading"|"paragraph"|"list"|"quote","level"?:2|3,"text"?:string,"style"?:"bullet"|"number","items"?:string[],"cite"?:string}]}
Rules:
- 4–10 blocks: start with a heading, mix paragraphs and one list; optional quote
- No HTML, no image blocks, no external links
- Friendly ${locale} retail tone for ${storeName}
- excerpt max 280 chars; tags 3–6 lowercase words`,
      user: `Write a blog post about: ${topic}`,
    };

    const result = await generateJson(providers, prompt);
    const data = result.data as Record<string, unknown>;
    const blocks = Array.isArray(data.blocks) ? data.blocks.slice(0, 20) : [];
    return json({
      title: String(data.title ?? "").slice(0, 200),
      excerpt: String(data.excerpt ?? "").slice(0, 500),
      tags: Array.isArray(data.tags) ? data.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 12) : [],
      seoTitle: String(data.seoTitle ?? "").slice(0, 120),
      seoDescription: String(data.seoDescription ?? "").slice(0, 320),
      blocks,
      provider: result.provider,
      model: result.model,
      tokens: result.tokens,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 300) : "failed";
    return json({ error: "generation_failed", message }, 502);
  }
});
