/**
 * Minimal vision/text LLM helpers for seller-ai Edge Functions.
 * Keys arrive from the Next server (platform credentials / env) and are never logged.
 */

export type AiProvider = "gemini" | "groq" | "anthropic";
export type ProviderConfig = { id: AiProvider; apiKey: string; model: string };
export type PromptImage = { mediaType: "image/png" | "image/jpeg" | "image/webp"; data: string };
export type Prompt = { system: string; user: string; images?: PromptImage[] };

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

/** Prefer vision-capable providers when images are present. */
export function orderForImages(providers: ProviderConfig[], hasImages: boolean): ProviderConfig[] {
  if (!hasImages) return providers;
  const vision = providers.filter((p) => p.id === "gemini" || p.id === "anthropic");
  const rest = providers.filter((p) => p.id === "groq");
  return [...vision, ...rest];
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
  const parts: Record<string, unknown>[] = [
    ...(prompt.images ?? []).map((i) => ({ inlineData: { mimeType: i.mediaType, data: i.data } })),
    { text: prompt.user },
  ];
  const json = (await postJson(
    url,
    { "x-goog-api-key": p.apiKey },
    {
      systemInstruction: { parts: [{ text: prompt.system }] },
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.7, maxOutputTokens: 8192 },
    },
    TIMEOUT_MS.gemini,
  )) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]; usageMetadata?: { totalTokenCount?: number } };
  const cand = json.candidates?.[0];
  const text = cand?.content?.parts?.map((x) => x.text ?? "").join("") ?? "";
  if (!text) throw new OutputError(`empty response (${cand?.finishReason ?? "no candidate"})`);
  return { text, tokens: num(json.usageMetadata?.totalTokenCount) };
}

async function callGroq(p: ProviderConfig, prompt: Prompt): Promise<{ text: string; tokens: number | null }> {
  const imageNote = prompt.images?.length
    ? `\n\n(${prompt.images.length} product image(s) were attached but this text-only model cannot see them. Infer from the hint and write retail-ready copy.)`
    : "";
  const json = (await postJson(
    "https://api.groq.com/openai/v1/chat/completions",
    { authorization: `Bearer ${p.apiKey}` },
    {
      model: p.model,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: `${prompt.user}${imageNote}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_completion_tokens: 8192,
    },
    TIMEOUT_MS.groq,
  )) as { choices?: { message?: { content?: string | null } }[]; usage?: { total_tokens?: number } };
  const text = json.choices?.[0]?.message?.content ?? "";
  if (!text) throw new OutputError("empty response");
  return { text, tokens: num(json.usage?.total_tokens) };
}

async function callAnthropic(p: ProviderConfig, prompt: Prompt): Promise<{ text: string; tokens: number | null }> {
  const content: unknown[] = prompt.images?.length
    ? [
        ...prompt.images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.mediaType, data: i.data } })),
        { type: "text", text: prompt.user },
      ]
    : prompt.user;
  const json = (await postJson(
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": p.apiKey, "anthropic-version": "2023-06-01" },
    { model: p.model, max_tokens: 8192, system: prompt.system, messages: [{ role: "user", content }] },
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

/** Fetch public HTTPS image URLs and return base64 payloads (capped). */
export async function fetchImages(urls: string[], max = 4): Promise<PromptImage[]> {
  const out: PromptImage[] = [];
  for (const url of urls.slice(0, max)) {
    if (!/^https:\/\//i.test(url)) continue;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: "follow" });
      if (!res.ok) continue;
      const ct = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
      const mediaType = ct === "image/png" || ct === "image/webp" || ct === "image/jpeg" || ct === "image/jpg"
        ? (ct === "image/jpg" ? "image/jpeg" : ct)
        : null;
      if (!mediaType) continue;
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength < 32 || buf.byteLength > 4_000_000) continue;
      let binary = "";
      for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]!);
      out.push({ mediaType: mediaType as PromptImage["mediaType"], data: btoa(binary) });
    } catch {
      /* skip bad URLs */
    }
  }
  return out;
}

export function asImages(raw: unknown): PromptImage[] {
  if (!Array.isArray(raw)) return [];
  const out: PromptImage[] = [];
  for (const row of raw.slice(0, 4)) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const mediaType = r.mediaType;
    const data = typeof r.data === "string" ? r.data.replace(/^data:[^;]+;base64,/, "") : "";
    if ((mediaType !== "image/png" && mediaType !== "image/jpeg" && mediaType !== "image/webp") || data.length < 32 || data.length > 6_000_000) continue;
    out.push({ mediaType, data });
  }
  return out;
}
