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

    const storeName = typeof body.storeName === "string" ? body.storeName.trim().slice(0, 120) : "Store";
    const locale = typeof body.locale === "string" ? body.locale.trim().slice(0, 40) : "en-IN";
    const focus = typeof body.focus === "string" ? body.focus.trim().slice(0, 40) : "auto";
    const metrics = body.metrics && typeof body.metrics === "object" ? body.metrics : {};
    const products = Array.isArray(body.products) ? body.products.slice(0, 12) : [];
    const setup = Array.isArray(body.setupPending) ? body.setupPending.map((s) => String(s).slice(0, 80)).slice(0, 12) : [];

    const prompt: Prompt = {
      system: `You are a concise business coach for Indian D2C sellers on Pictocart. Reply with ONLY JSON:
{"headline":string,"tips":[{"title":string,"detail":string,"priority":"high"|"medium"|"low"}],"focus":string}
Rules:
- 3–5 practical tips based ONLY on the provided metrics, products and pending setup steps
- No invented revenue figures; speak in plain ${locale} (light Hinglish OK if locale suggests)
- headline max 90 chars; each detail max 220 chars
- focus: one sentence next step
- Prefer actionable store ops (catalogue, fulfilment, pricing, content, conversion)`,
      user: `Store: ${storeName}
Requested focus: ${focus}
Metrics JSON: ${JSON.stringify(metrics).slice(0, 2000)}
Top products JSON: ${JSON.stringify(products).slice(0, 1500)}
Pending setup: ${setup.join("; ") || "none"}`,
    };

    const result = await generateJson(providers, prompt);
    const data = result.data as Record<string, unknown>;
    const tips = Array.isArray(data.tips) ? data.tips.slice(0, 6) : [];
    return json({
      headline: String(data.headline ?? "").slice(0, 120),
      focus: String(data.focus ?? "").slice(0, 280),
      tips: tips
        .map((t) => {
          const row = t && typeof t === "object" ? (t as Record<string, unknown>) : {};
          const priority = row.priority === "high" || row.priority === "low" ? row.priority : "medium";
          return {
            title: String(row.title ?? "").slice(0, 80),
            detail: String(row.detail ?? "").slice(0, 320),
            priority,
          };
        })
        .filter((t) => t.title && t.detail),
      provider: result.provider,
      model: result.model,
      tokens: result.tokens,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 300) : "failed";
    return json({ error: "generation_failed", message }, 502);
  }
});
