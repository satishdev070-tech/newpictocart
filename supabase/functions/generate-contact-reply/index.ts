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

    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "there";
    const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 200) : "";
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 4000) : "";
    const storeName = typeof body.storeName === "string" ? body.storeName.trim().slice(0, 120) : "our store";
    if (message.length < 2) return json({ error: "message_required" }, 400);

    const system =
      typeof body.system === "string" && body.system.trim().length > 20
        ? body.system.trim().slice(0, 8000)
        : `You draft polite email replies for Indian online store owners. Reply with ONLY JSON:
{"reply":string,"subject":string}
Rules:
- reply: 80–220 words, warm and clear, no HTML
- Do not invent order numbers, refunds, or policies the seller did not mention
- Sign off as the ${storeName} team
- subject: short reply subject line`;

    const user =
      typeof body.user === "string" && body.user.trim().length > 3
        ? body.user.trim().slice(0, 8000)
        : `Visitor name: ${name}\nSubject: ${subject || "(none)"}\nMessage:\n${message}`;

    const prompt: Prompt = { system, user };

    const result = await generateJson(providers, prompt);
    const data = result.data as Record<string, unknown>;
    return json({
      reply: String(data.reply ?? "").slice(0, 4000),
      subject: String(data.subject ?? "").slice(0, 200),
      provider: result.provider,
      model: result.model,
      tokens: result.tokens,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 300) : "failed";
    return json({ error: "generation_failed", message }, 502);
  }
});
