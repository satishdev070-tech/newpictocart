import "server-only";
import { signToken, verifyToken } from "@/lib/crypto";
import {
  PREVIEW_PURPOSE,
  PREVIEW_TTL_SECONDS,
  encodePreviewClaims,
  explainPreviewClaims,
  type PreviewClaims,
  type PreviewTokenFailReason,
} from "../preview";

/** Mints a preview token. Callers must already have checked theme.edit for `tenantId`. */
export function createPreviewToken(tenantId: string, userId: string, nowMs = Date.now()): { token: string; expiresAt: number } {
  const expiresAt = Math.floor(nowMs / 1000) + PREVIEW_TTL_SECONDS;
  return { token: signToken(PREVIEW_PURPOSE, encodePreviewClaims({ tenantId, userId, expiresAt })), expiresAt };
}

/** Verifies signature, tenant binding and expiry. */
export function verifyPreviewToken(token: string | null | undefined, tenantId: string, nowMs = Date.now()): PreviewClaims | null {
  const r = diagnosePreviewToken(token, tenantId, nowMs);
  return r.ok ? r.claims : null;
}

/** Same as {@link verifyPreviewToken}, but returns why verification failed (for /preview 403 + ops self-test). */
export function diagnosePreviewToken(
  token: string | null | undefined,
  tenantId: string,
  nowMs = Date.now(),
): { ok: true; claims: PreviewClaims } | { ok: false; reason: PreviewTokenFailReason } {
  if (!token) return { ok: false, reason: "malformed" };
  const payload = verifyToken(PREVIEW_PURPOSE, token);
  if (!payload) return { ok: false, reason: "sig_fail" };
  const decoded = explainPreviewClaims(payload, tenantId, nowMs);
  return decoded.ok ? { ok: true, claims: decoded.claims } : { ok: false, reason: decoded.reason };
}
