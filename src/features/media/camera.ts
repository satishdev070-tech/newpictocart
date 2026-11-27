/**
 * Pure helpers for "Click picture" (no DOM access here, so they are unit-tested).
 * Phones and tablets use the device camera app (`<input capture>`); laptops and desktops get a
 * live webcam preview (getUserMedia).
 */

export type DeviceHints = {
  /** `matchMedia("(pointer: coarse)").matches` — primary input is a finger. */
  coarsePointer: boolean;
  userAgent: string;
  /** `navigator.maxTouchPoints` (iPadOS reports a Mac user agent with > 1 touch points). */
  maxTouchPoints: number;
};

const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|Opera Mini|IEMobile/i;

/** True on phones and tablets → open the device camera instead of a webcam preview. */
export function prefersNativeCamera(h: DeviceHints): boolean {
  if (MOBILE_UA.test(h.userAgent)) return true;
  // iPadOS 13+ says "Macintosh"; a Mac has no touch points.
  if (/Macintosh/i.test(h.userAgent) && h.maxTouchPoints > 1) return true;
  return h.coarsePointer && h.maxTouchPoints > 0;
}

/** Longest side of a captured photo (keeps uploads well under the 10 MB limit). */
export const CAPTURE_MAX_SIDE = 2048;

/** Output size for a video frame, scaled down so the long side is at most `max`. */
export function captureSize(width: number, height: number, max = CAPTURE_MAX_SIDE): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** `photo-20261127-142305.jpg` (local time), so captures sort by time in the media library. */
export function captureFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `photo-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}.jpg`;
}

export type CameraErrorKind = "blocked" | "missing" | "busy" | "insecure" | "unknown";

/** Map a getUserMedia failure to what we tell the seller. */
export function cameraErrorKind(err: unknown): CameraErrorKind {
  const name = typeof err === "object" && err && "name" in err ? String((err as { name: unknown }).name) : "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return "blocked";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") return "missing";
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return "busy";
  if (name === "insecure") return "insecure";
  return "unknown";
}

export const CAMERA_ERROR_TEXT: Record<CameraErrorKind, string> = {
  blocked: "Camera access is blocked. Allow the camera for this site in your browser's address bar, or upload a photo instead.",
  missing: "No camera was found on this device. Upload a photo instead.",
  busy: "The camera is being used by another app. Close it and try again, or upload a photo instead.",
  insecure: "The camera only works on a secure (https) page. Upload a photo instead.",
  unknown: "The camera couldn't start. Try again, or upload a photo instead.",
};
