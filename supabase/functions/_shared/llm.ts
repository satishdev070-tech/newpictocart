/**
 * Minimal text LLM helpers for seller-ai Edge Functions.
 * Keys arrive from the Next server (platform credentials) and are never logged.
 */

export type AiProvider = "gemini" | "groq" | "anthropic";
export type ProviderConfig = { id: AiProvider; apiKey: string; model: string };
export type Prompt = { system: string; user: string };

export type LlmResult = {
  data: unknown;
  provider: AiProvider;
  model: string;
  tokens: number | null;
};

const DEFAULT_MODELS: Record<AiProvider, string> = {
  gemini: "gemini-2.0-flash",
  groq: "llama-3.3-70b-versatile",
  anthropic: "claude-sonnet-4-20250514",
};

const TIMEOUT_MS: Record<AiProvider, number> = { gemini: 45_000, groq: 30_000, anthropic: 90_000 };

class ProviderHttpError extends Error {}
class OutputError extends Error {}

function resolveModel(id: AiProvider, override?: string | null): string {
  return override && /^[a-zA-Z0-9][a-zA-Z0-9._\-/:]{1,99}$/.test(override) ? override : DEFAULT_MODELS[id];
}

export function normalizeProviders(raw: unknown): ProviderConfig[] {
  if (!Array.isArray(raw)) return [];
  const out: ProviderConfig[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = r.id;
    const apiKey = typeof r.apiKey === "string" ? r.apiKey.trim() : "";
    if ((id !== "gemini" && id !== "groq" && id !== "anthropic") || apiKey.length < 10) continue;
    out.push({ id, apiKey, model: resolveModel(id, typeof r.model === "string" ? r.model : null) });
  }
  return out;
}

async function postJson(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    throw new ProviderHttpError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "network error");
  }
  if (!res.ok) throw new ProviderHttpError(`HTTP ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new ProviderHttpError("invalid response body");
  }
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new OutputError("reply was not valid JSON");
  }
}

async function callGemini(p: ProviderConfig, prompt: Prompt): Promise<{ text: string; tokens: number | null }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(p.model)}:generateContent`;
  const json = (await postJson(
    url,
    { "x-goog-api-key": p.apiKey },
    {
      systemInstruction: { parts: [{ text: prompt.system }] },
      contents: [{ role: "user", parts: [{ text: prompt.user }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.7, maxOutputTokens: 4096 },
    },
    TIMEOUT_MS.gemini,
  )) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]; usageMetadata?: { totalTokenCount?: number } };
  const cand = json.candidates?.[0];
  const text = cand?.content?.parts?.map((x) => x.text ?? "").join("") ?? "";
  if (!text) throw new OutputError(`empty response (${cand?.finishReason ?? "no candidate"})`);
  return { text, tokens: num(json.usageMetadata?.totalTokenCount) };
}

async function callGroq(p: ProviderConfig, prompt: Prompt): Promise<{ text: string; tokens: number | null }> {
  const json = (await postJson(
    "https://api.groq.com/openai/v1/chat/completions",
    { authorization: `Bearer ${p.apiKey}` },
    {
      model: p.model,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_completion_tokens: 4096,
    },
    TIMEOUT_MS.groq,
  )) as { choices?: { message?: { content?: string | null } }[]; usage?: { total_tokens?: number } };
  const text = json.choices?.[0]?.message?.content ?? "";
  if (!text) throw new OutputError("empty response");
  return { text, tokens: num(json.usage?.total_tokens) };
}

async function callAnthropic(p: ProviderConfig, prompt: Prompt): Promise<{ text: string; tokens: number | null }> {
  const json = (await postJson(
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": p.apiKey, "anthropic-version": "2023-06-01" },
    { model: p.model, max_tokens: 4096, system: prompt.system, messages: [{ role: "user", content: prompt.user }] },
    TIMEOUT_MS.anthropic,
  )) as { content?: { type: string; text?: string }[]; stop_reason?: string; usage?: { input_tokens?: number; output_tokens?: number } };
  if (json.stop_reason === "refusal") throw new ProviderHttpError("declined by the model");
  const text = (json.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  if (!text) throw new OutputError(`empty response (${json.stop_reason ?? "unknown"})`);
  const tokens = (num(json.usage?.input_tokens) ?? 0) + (num(json.usage?.output_tokens) ?? 0);
  return { text, tokens: tokens || null };
}

const ADAPTERS: Record<AiProvider, (p: ProviderConfig, prompt: Prompt) => Promise<{ text: string; tokens: number | null }>> = {
  gemini: callGemini,
  groq: callGroq,
  anthropic: callAnthropic,
};

export async function generateJson(providers: ProviderConfig[], prompt: Prompt): Promise<LlmResult> {
  if (!providers.length) throw new Error("not_configured");
  const failures: string[] = [];
  for (const p of providers) {
    let lastError = "";
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const call = await ADAPTERS[p.id](
          p,
          attempt === 1 ? prompt : { ...prompt, user: `${prompt.user}\n\nYour previous reply was not valid JSON (${lastError}). Reply again with only the JSON object.` },
        );
        return { data: extractJson(call.text), provider: p.id, model: p.model, tokens: call.tokens };
      } catch (err) {
        if (err instanceof OutputError) {
          lastError = err.message.slice(0, 200);
          continue;
        }
        lastError = err instanceof ProviderHttpError ? err.message : "unexpected error";
        break;
      }
    }
    failures.push(`${p.id}: ${lastError}`);
  }
  throw new Error(`All AI providers failed: ${failures.join("; ")}`);
}
