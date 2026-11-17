import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  transcribe: vi.fn(),
  convert: vi.fn(),
  completions: vi.fn(),
}));
vi.mock("sarvamai", () => ({
  SarvamAIClient: class {
    speechToText = { transcribe: sdk.transcribe };
    textToSpeech = { convert: sdk.convert };
    chat = { completions: sdk.completions };
    text = { translate: vi.fn() };
  },
}));
vi.mock("@/lib/env/server", () => ({ serverEnv: () => ({ SARVAM_API_KEY: "test-key-not-real" }) }));
vi.mock("@/lib/observability/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { classifySarvamError, synthesizeSpeech, transcribeAudio, chatTurn } from "@/lib/sarvam/client";
import { AppError, toPublicError } from "@/lib/errors";

/** Shape of the SDK's SarvamAIError (statusCode + parsed body). */
function sdkError(statusCode: number, body: unknown, message = "Error") {
  return Object.assign(new Error(message), { name: "SarvamAIError", statusCode, body });
}

const QUOTA_BODY = { error: { message: "No credits available.", code: "insufficient_quota_error" } };

describe("classifySarvamError", () => {
  it.each([
    ["402 with insufficient_quota body", sdkError(402, QUOTA_BODY), "quota"],
    ["quota code without status", Object.assign(new Error("x"), { body: QUOTA_BODY }), "quota"],
    ["401", sdkError(401, { error: { message: "Invalid API key" } }), "auth"],
    ["403", sdkError(403, "forbidden"), "auth"],
    ["429", sdkError(429, { error: { message: "Rate limit exceeded" } }), "rate_limited"],
    ["500", sdkError(500, "oops"), "unavailable"],
    ["503", sdkError(503, null), "unavailable"],
    ["network", new TypeError("fetch failed"), "unavailable"],
    ["ECONNRESET cause", Object.assign(new Error("boom"), { cause: { code: "ECONNRESET" } }), "unavailable"],
    ["timeout", Object.assign(new Error("Timeout exceeded when calling POST /speech-to-text."), { name: "SarvamAITimeoutError" }), "unavailable"],
    ["400 bad audio", sdkError(400, { error: { message: "Invalid audio format or empty file" } }), "bad_audio"],
    ["400 other", sdkError(400, { error: { message: "Invalid language_code" } }), "unknown"],
    ["non-error", "nope", "unknown"],
  ])("%s", (_label, err, expected) => {
    expect(classifySarvamError(err)).toBe(expected);
  });
});

const audio = () => new Blob([new Uint8Array(2000)], { type: "audio/webm" });

async function sttError(err: unknown): Promise<AppError> {
  sdk.transcribe.mockRejectedValueOnce(err);
  try {
    await transcribeAudio({ audio: audio(), languageCode: "hi-IN" });
  } catch (e) {
    return e as AppError;
  }
  throw new Error("expected transcribeAudio to throw");
}

describe("transcribeAudio error mapping", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    [sdkError(402, QUOTA_BODY), "quota"],
    [sdkError(401, "bad key"), "auth"],
    [sdkError(429, "slow down"), "rate_limited"],
    [sdkError(500, "down"), "unavailable"],
    [new TypeError("fetch failed"), "unavailable"],
  ])("provider failure → stt_unavailable (%#)", async (err, cls) => {
    const e = await sttError(err);
    expect(e).toBeInstanceOf(AppError);
    expect(e.context).toMatchObject({ reason: "stt_unavailable", class: cls });
    const pub = toPublicError(e);
    expect(pub.code).toBe("VALIDATION");
    expect(pub.fieldErrors?.reason).toEqual(["stt_unavailable", cls]);
    expect(pub.fieldErrors?._form?.[0]).not.toMatch(/hear that clearly/i);
  });

  it("bad audio keeps the 'couldn't hear' message and no stt_unavailable marker", async () => {
    const e = await sttError(sdkError(400, { error: { message: "Audio file is empty" } }));
    const pub = toPublicError(e);
    expect(pub.fieldErrors?._form?.[0]).toMatch(/Couldn't hear that clearly/);
    expect(pub.fieldErrors?.reason).toBeUndefined();
  });

  it("returns the transcript on success", async () => {
    sdk.transcribe.mockResolvedValueOnce({ transcript: " namaste ", language_code: "hi-IN" });
    await expect(transcribeAudio({ audio: audio(), languageCode: "hi-IN" })).resolves.toEqual({ transcript: "namaste", detectedLanguage: "hi-IN" });
  });
});

describe("TTS and chat on provider failure", () => {
  beforeEach(() => vi.clearAllMocks());

  it("synthesizeSpeech returns null instead of throwing (no credits)", async () => {
    sdk.convert.mockRejectedValueOnce(sdkError(402, QUOTA_BODY));
    await expect(synthesizeSpeech({ text: "Namaste", languageCode: "hi-IN" })).resolves.toBeNull();
  });

  it("chatTurn throws sarvam_chat_failed with the class for the offline fallback", async () => {
    sdk.completions.mockRejectedValueOnce(sdkError(402, QUOTA_BODY));
    await expect(chatTurn({ messages: [{ role: "user", content: "hi" }] })).rejects.toMatchObject({
      context: { reason: "sarvam_chat_failed", class: "quota" },
    });
  });
});
