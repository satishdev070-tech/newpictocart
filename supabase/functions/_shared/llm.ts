/**
 * Minimal JSON LLM client for Seller AI edge functions (Deno).
 * Keys from env only: GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY (first configured wins).
 * Vision: Gemini/Anthropic use image URLs or base64; OpenAI uses image_url parts.
 */

export type EdgeImage =
  | { type: "url"; url: string }
  | { type: "base64"; mimeType: string; data: string };

export type LlmJsonResult = { text: string; provider: string; model: string };

class LlmHttpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmHttpError";
  }
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
    throw new LlmHttpError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "network error");
  }
  if (!res.ok) throw new LlmHttpError(`HTTP ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new LlmHttpError("invalid response body");
  }
}

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
    throw new LlmHttpError("reply was not valid JSON");
  }
}

function geminiParts(user: string, images: EdgeImage[]) {
  const parts: Record<string, unknown>[] = [];
  for (const img of images) {
    if (img.type === "url") {
      parts.push({ fileData: { fileUri: img.url, mimeType: "image/jpeg" } });
    } else {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
    }
  }
  parts.push({ text: user });
  return parts;
}

async function callGemini(system: string, user: string, images: EdgeImage[]): Promise<LlmJsonResult> {
  const apiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
  if (!apiKey) throw new LlmHttpError("gemini not configured");
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash";
  const json = (await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { "x-goog-api-key": apiKey },
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: geminiParts(user, images) }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.6, maxOutputTokens: 4096 },
    },
    45_000,
  )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new LlmHttpError("empty gemini response");
  return { text, provider: "gemini", model };
}

async function callOpenAi(system: string, user: string, images: EdgeImage[]): Promise<LlmJsonResult> {
  const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!apiKey) throw new LlmHttpError("openai not configured");
  const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
  const content: unknown[] = [{ type: "text", text: user }];
  for (const img of images) {
    const url = img.type === "url" ? img.url : `data:${img.mimeType};base64,${img.data}`;
    content.push({ type: "image_url", image_url: { url } });
  }
  const json = (await postJson(
    Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com/v1/chat/completions",
    { authorization: `Bearer ${apiKey}` },
    {
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
      max_tokens: 4096,
    },
    60_000,
  )) as { choices?: { message?: { content?: string | null } }[] };
  const text = json.choices?.[0]?.message?.content ?? "";
  if (!text) throw new LlmHttpError("empty openai response");
  return { text, provider: "openai", model };
}

async function callAnthropic(system: string, user: string, images: EdgeImage[]): Promise<LlmJsonResult> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
  if (!apiKey) throw new LlmHttpError("anthropic not configured");
  const model = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-5";
  const blocks: unknown[] = [];
  for (const img of images) {
    if (img.type === "url") {
      blocks.push({ type: "image", source: { type: "url", url: img.url } });
    } else {
      blocks.push({ type: "image", source: { type: "base64", media_type: img.mimeType, data: img.data } });
    }
  }
  blocks.push({ type: "text", text: user });
  const json = (await postJson(
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    { model, max_tokens: 4096, system, messages: [{ role: "user", content: blocks }] },
    90_000,
  )) as { content?: { type: string; text?: string }[] };
  const text = (json.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  if (!text) throw new LlmHttpError("empty anthropic response");
  return { text, provider: "anthropic", model };
}

/** First configured provider: Gemini → OpenAI → Anthropic. */
export async function generateJsonText(system: string, user: string, images: EdgeImage[] = []): Promise<LlmJsonResult> {
  const errors: string[] = [];
  for (const call of [callGemini, callOpenAi, callAnthropic] as const) {
    try {
      return await call(system, user, images);
    } catch (err) {
      errors.push(err instanceof Error ? err.message.slice(0, 120) : "unknown");
    }
  }
  throw new LlmHttpError(`all providers failed: ${errors.join("; ") || "not configured"}`);
}
