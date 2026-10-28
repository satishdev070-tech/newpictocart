import "server-only";
import type { z } from "zod";
import type { AiProvider } from "../schemas";
import type { Prompt } from "../prompts";

/**
 * Pluggable LLM layer (REST, no SDK dependency). Each adapter asks for JSON, we validate it with
 * zod, retry once on a parse/validation failure, and fall back to the next configured provider on
 * HTTP, network or timeout errors. API keys go only in request headers (never in URLs, logs or
 * thrown messages).
 *
 * Endpoints (official docs):
 * - Gemini: POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent, header x-goog-api-key,
 *   generationConfig.responseMimeType = "application/json".
 * - Groq: POST https://api.groq.com/openai/v1/chat/completions (OpenAI-compatible), Bearer key,
 *   response_format {type: "json_object"} (the prompt must mention JSON).
 * - NVIDIA NIM: POST https://integrate.api.nvidia.com/v1/chat/completions (OpenAI-compatible), Bearer key.
 *   Nemotron reasoning is switched off with the `/no_think` system flag and any <think> block is
 *   stripped; photos go to a Llama vision model as image_url data URIs when the routed model is text-only.
 * - Anthropic: POST https://api.anthropic.com/v1/messages, x-api-key + anthropic-version, with
 *   server-side refusal fallback (`fallbacks: "default"`, beta server-side-fallback-2026-07-01).
 */

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  nvidia: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
  gemini: "gemini-3.8-flash",
  groq: "llama-3.3-70b-versatile",
  anthropic: "claude-opus-5-5",
};

/** Used for NVIDIA when the prompt carries photos and the configured model is text-only. */
export const NVIDIA_VISION_MODEL = "meta/llama-3.2-11b-vision-instruct";
export const NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

const TIMEOUT_MS: Record<AiProvider, number> = { nvidia: 60_000, gemini: 30_000, groq: 30_000, anthropic: 90_000 };

export type ProviderConfig = { id: AiProvider; apiKey: string; model: string };
export type LlmCall = { text: string; tokens: number | null };
export type GenerateResult<T> = { data: T; provider: AiProvider; model: string; tokens: number | null; attempts: number };
type Fetch = typeof fetch;

/** Thrown when every configured provider failed. `failures` holds safe, key-free reasons for logs. */
export class LlmError extends Error {
  constructor(
    readonly reason: "not_configured" | "failed",
    readonly failures: { provider: AiProvider; error: string }[] = [],
  ) {
    super(reason === "not_configured" ? "No AI provider is configured" : `All AI providers failed: ${failures.map((f) => `${f.provider}: ${f.error}`).join("; ")}`);
    this.name = "LlmError";
  }
}

/** Provider/transport failure: move on to the next provider. */
class ProviderHttpError extends Error {}
/** Model answered but not with valid JSON for our schema: retry once on the same provider. */
class OutputError extends Error {}

/** Optional per-credential model override (from the platform credential's extra.model). */
export function resolveModel(id: AiProvider, override: string | undefined | null): string {
  return override && /^[a-zA-Z0-9][a-zA-Z0-9._\-/:]{1,99}$/.test(override) ? override : DEFAULT_MODELS[id];
}

async function postJson(fetchImpl: Fetch, url: string, headers: Record<string, string>, body: unknown, timeoutMs: number): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchImpl(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    throw new ProviderHttpError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "network error");
  }
  if (!res.ok) {
    // Status only: provider error bodies can echo request details.
    throw new ProviderHttpError(`HTTP ${res.status}`);
  }
  try {
    return await res.json();
  } catch {
    throw new ProviderHttpError("invalid response body");
  }
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

async function callGemini(fetchImpl: Fetch, p: ProviderConfig, prompt: Prompt): Promise<LlmCall> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(p.model)}:generateContent`;
  const json = (await postJson(
    fetchImpl,
    url,
    { "x-goog-api-key": p.apiKey },
    {
      systemInstruction: { parts: [{ text: prompt.system }] },
      contents: [{ role: "user", parts: [...(prompt.images ?? []).map((i) => ({ inlineData: { mimeType: i.mediaType, data: i.data } })), { text: prompt.user }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.8, maxOutputTokens: 8192 },
    },
    TIMEOUT_MS.gemini,
  )) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]; usageMetadata?: { totalTokenCount?: number } };
  const cand = json.candidates?.[0];
  const text = cand?.content?.parts?.map((x) => x.text ?? "").join("") ?? "";
  if (!text) throw new OutputError(`empty response (${cand?.finishReason ?? "no candidate"})`);
  return { text, tokens: num(json.usageMetadata?.totalTokenCount) };
}

async function callGroq(fetchImpl: Fetch, p: ProviderConfig, prompt: Prompt): Promise<LlmCall> {
  const json = (await postJson(
    fetchImpl,
    "https://api.groq.com/openai/v1/chat/completions",
    { authorization: `Bearer ${p.apiKey}` },
    {
      model: p.model,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_completion_tokens: 8192,
    },
    TIMEOUT_MS.groq,
  )) as { choices?: { message?: { content?: string | null } }[]; usage?: { total_tokens?: number } };
  const text = json.choices?.[0]?.message?.content ?? "";
  if (!text) throw new OutputError("empty response");
  return { text, tokens: num(json.usage?.total_tokens) };
}

/** True for NVIDIA model ids that accept images (…-vl-…, vision). */
export function isNvidiaVisionModel(model: string): boolean {
  return /(^|[-/_.])vl([-/_.]|$)|vision/i.test(model);
}

/** Request body for NVIDIA's OpenAI-compatible chat endpoint (pure, unit tested). */
export function nvidiaRequestBody(model: string, prompt: Prompt): { model: string; body: Record<string, unknown> } {
  const images = prompt.images ?? [];
  const useModel = images.length && !isNvidiaVisionModel(model) ? NVIDIA_VISION_MODEL : model;
  const vision = isNvidiaVisionModel(useModel);
  // Nemotron reasoning models think by default; JSON copywriting doesn't need it.
  const system = /nemotron/i.test(useModel) && !vision ? `/no_think\n${prompt.system}` : prompt.system;
  const user =
    images.length && vision
      ? [...images.map((i) => ({ type: "image_url", image_url: { url: `data:${i.mediaType};base64,${i.data}` } })), { type: "text", text: prompt.user }]
      : prompt.user;
  return {
    model: useModel,
    body: {
      model: useModel,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.6,
      top_p: 0.95,
      max_tokens: vision ? 4096 : 8192,
      stream: false,
    },
  };
}

/** Removes a leading <think>…</think> block some Nemotron models still emit (and unclosed ones before JSON). */
export function stripThinking(text: string): string {
  let t = text.replace(/^\s*<think>[\s\S]*?<\/think>\s*/i, "").trim();
  if (/^\s*<think>/i.test(t)) {
    const jsonStart = t.search(/[{[]/);
    t = jsonStart > 0 ? t.slice(jsonStart) : "";
  }
  return t.trim();
}

async function callNvidia(fetchImpl: Fetch, p: ProviderConfig, prompt: Prompt): Promise<LlmCall> {
  const { body } = nvidiaRequestBody(p.model, prompt);
  const json = (await postJson(fetchImpl, NVIDIA_CHAT_URL, { authorization: `Bearer ${p.apiKey}`, accept: "application/json" }, body, TIMEOUT_MS.nvidia)) as {
    choices?: { message?: { content?: string | null }; finish_reason?: string }[];
    usage?: { total_tokens?: number };
  };
  const text = stripThinking(json.choices?.[0]?.message?.content ?? "");
  if (!text) throw new OutputError(`empty response (${json.choices?.[0]?.finish_reason ?? "no choice"})`);
  return { text, tokens: num(json.usage?.total_tokens) };
}

async function callAnthropic(fetchImpl: Fetch, p: ProviderConfig, prompt: Prompt): Promise<LlmCall> {
  const json = (await postJson(
    fetchImpl,
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": p.apiKey, "anthropic-version": "2023-06-01", "anthropic-beta": "server-side-fallback-2026-07-01" },
    {
      model: p.model,
      max_tokens: 16000,
      // Short-form copywriting: low effort keeps latency and cost down (thinking stays adaptive).
      output_config: { effort: "low" },
      fallbacks: "default",
      system: prompt.system,
      messages: [{ role: "user", content: prompt.images?.length ? [...prompt.images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.mediaType, data: i.data } })), { type: "text", text: prompt.user }] : prompt.user }],
    },
    TIMEOUT_MS.anthropic,
  )) as { content?: { type: string; text?: string }[]; stop_reason?: string; usage?: { input_tokens?: number; output_tokens?: number } };
  if (json.stop_reason === "refusal") throw new ProviderHttpError("declined by the model");
  const text = (json.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  if (!text) throw new OutputError(`empty response (${json.stop_reason ?? "unknown"})`);
  const tokens = (num(json.usage?.input_tokens) ?? 0) + (num(json.usage?.output_tokens) ?? 0);
  return { text, tokens: tokens || null };
}

const ADAPTERS: Record<AiProvider, (f: Fetch, p: ProviderConfig, prompt: Prompt) => Promise<LlmCall>> = { nvidia: callNvidia, gemini: callGemini, groq: callGroq, anthropic: callAnthropic };

/** Short, key-free preview of a bad reply for logs / retry hints (never includes API keys). */
function replyPreview(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim().slice(0, 120);
  if (!flat) return "";
  return ` (got: ${JSON.stringify(flat)}${text.trim().length > 120 ? "…" : ""})`;
}

/** Extracts the JSON object/array from a model reply (tolerates think tags, fences, or stray prose). */
export function extractJson(text: string): unknown {
  const cleaned = stripThinking(text)
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    /* try the first balanced object or array below */
  }
  for (const [open, close] of [
    ["{", "}"],
    ["[", "]"],
  ] as const) {
    const start = cleaned.indexOf(open);
    const end = cleaned.lastIndexOf(close);
    if (start < 0 || end <= start) continue;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      /* try next shape */
    }
  }
  throw new OutputError(`reply was not valid JSON${replyPreview(cleaned)}`);
}

/**
 * Runs the prompt on the first provider that succeeds, in the given order. Per provider: one retry
 * if the reply isn't valid JSON for `schema`; HTTP/network/timeout errors fall through to the next
 * provider. Token usage is summed over all attempts of the provider that succeeded.
 */
export async function generateJson<S extends z.ZodType>(providers: ProviderConfig[], prompt: Prompt, schema: S, fetchImpl: Fetch = fetch): Promise<GenerateResult<z.output<S>>> {
  if (!providers.length) throw new LlmError("not_configured");
  const failures: { provider: AiProvider; error: string }[] = [];
  for (const p of providers) {
    let tokens: number | null = null;
    let lastError = "";
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const call = await ADAPTERS[p.id](fetchImpl, p, attempt === 1 ? prompt : { ...prompt, user: `${prompt.user}\n\nYour previous reply was not valid JSON in the required shape (${lastError}). Reply again with only the JSON object.` });
        if (call.tokens != null) tokens = (tokens ?? 0) + call.tokens;
        const parsed = schema.safeParse(extractJson(call.text));
        if (!parsed.success) throw new OutputError(`schema: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "root"} ${i.message}`).join(", ")}`);
        return { data: parsed.data, provider: p.id, model: p.model, tokens, attempts: attempt };
      } catch (err) {
        if (err instanceof OutputError) {
          // NVIDIA reasoning models often wrap or truncate JSON; tag failures so Admin / logs are clear.
          const detail = err.message.slice(0, 180);
          lastError = (p.id === "nvidia" ? `NVIDIA parse failure: ${detail}` : detail).slice(0, 200);
          continue;
        }
        lastError = err instanceof ProviderHttpError ? err.message : "unexpected error";
        break;
      }
    }
    failures.push({ provider: p.id, error: lastError });
  }
  throw new LlmError("failed", failures);
}
