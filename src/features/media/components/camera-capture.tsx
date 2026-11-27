"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Camera, RefreshCw, SwitchCamera, Upload, X } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { CAMERA_ERROR_TEXT, captureFileName, captureSize, cameraErrorKind, prefersNativeCamera, type CameraErrorKind } from "@/features/media/camera";

type Props = {
  /** Called with one JPEG (webcam) or the photo the device camera app returned. */
  onCapture: (file: File) => void;
  label?: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
  disabled?: boolean;
};

function detectNative(): boolean {
  if (typeof window === "undefined") return false;
  return prefersNativeCamera({
    coarsePointer: window.matchMedia?.("(pointer: coarse)").matches ?? false,
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
  });
}

/**
 * "Click picture": on phones/tablets opens the device camera (`capture=environment`; the normal
 * Upload control next to it still opens the gallery). On laptops it opens a webcam preview with
 * Capture / Retake / Use photo, and "Upload instead" when there is no camera or access is blocked.
 */
export function CameraCaptureButton({ onCapture, label = "Click picture", size = "sm", variant = "secondary", className, disabled }: Props) {
  const nativeInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const titleId = useId();
  const [error, setError] = useState<CameraErrorKind | null>(null);
  const [starting, setStarting] = useState(false);
  const [shot, setShot] = useState<{ file: File; url: string } | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceIdx, setDeviceIdx] = useState(0);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }, []);

  const clearShot = useCallback(() => {
    setShot((s) => {
      if (s) URL.revokeObjectURL(s.url);
      return null;
    });
  }, []);

  const start = useCallback(
    async (deviceId?: string) => {
      stop();
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(window.isSecureContext ? "missing" : "insecure");
        return;
      }
      setStarting(true);
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: deviceId ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } } : { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => undefined);
        }
        const all = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        setDevices(all.filter((d) => d.kind === "videoinput"));
      } catch (err) {
        setError(cameraErrorKind(err));
      } finally {
        setStarting(false);
      }
    },
    [stop],
  );

  const close = useCallback(() => {
    stop();
    clearShot();
    dialog.current?.close();
  }, [stop, clearShot]);

  // Stop the camera if the component unmounts while the dialog is open.
  useEffect(() => () => stop(), [stop]);

  const open = () => {
    if (detectNative()) {
      nativeInput.current?.click();
      return;
    }
    clearShot();
    dialog.current?.showModal();
    void start();
  };

  const capture = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const { width, height } = captureSize(v.videoWidth, v.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(v, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], captureFileName(), { type: "image/jpeg" });
        setShot({ file, url: URL.createObjectURL(blob) });
        stop();
      },
      "image/jpeg",
      0.9,
    );
  };

  const use = () => {
    if (!shot) return;
    const file = shot.file;
    close();
    onCapture(file);
  };

  const retake = () => {
    clearShot();
    void start(devices[deviceIdx]?.deviceId);
  };

  const switchCamera = () => {
    const next = (deviceIdx + 1) % Math.max(devices.length, 1);
    setDeviceIdx(next);
    void start(devices[next]?.deviceId);
  };

  const pickFile = (list: FileList | null) => {
    const file = list?.[0];
    if (!file) return;
    if (dialog.current?.open) close();
    onCapture(file);
  };

  return (
    <>
      <Button type="button" variant={variant} size={size} className={className} disabled={disabled} onClick={open}>
        <Camera aria-hidden />
        {label}
      </Button>
      {/* Phones / tablets: the device camera app. */}
      <input
        ref={nativeInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          pickFile(e.target.files);
          e.target.value = "";
        }}
      />
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => e.target === dialog.current && close()}
        className="m-auto w-[min(94vw,640px)] max-w-none overflow-hidden rounded-2xl border border-border bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/60"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 id={titleId} className="text-h3">
            {shot ? "Use this photo?" : "Click picture"}
          </h2>
          <button type="button" onClick={close} aria-label="Close camera" className="grid size-10 place-items-center rounded-lg text-muted hover:bg-surface-secondary">
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <div className="relative aspect-[4/3] bg-black">
          {shot ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object-URL preview of the capture
            <img src={shot.url} alt="Captured photo" className="size-full object-contain" />
          ) : (
            <video ref={video} playsInline muted autoPlay className="size-full object-contain" aria-label="Camera preview" />
          )}
          {starting && !shot ? <p className="absolute inset-0 grid place-items-center text-small text-white/80">Starting camera…</p> : null}
          {error && !shot ? (
            <div role="alert" className="absolute inset-0 grid place-items-center bg-black/80 p-6 text-center text-small text-white">
              <p className="max-w-sm">{CAMERA_ERROR_TEXT[error]}</p>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 p-3">
          <input
            ref={uploadInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              pickFile(e.target.files);
              e.target.value = "";
            }}
          />
          <Button type="button" variant="ghost" className="min-h-11" onClick={() => uploadInput.current?.click()}>
            <Upload aria-hidden />
            Upload instead
          </Button>
          <div className="flex flex-wrap gap-2">
            {shot ? (
              <>
                <Button type="button" variant="secondary" className="min-h-11" onClick={retake}>
                  <RefreshCw aria-hidden />
                  Retake
                </Button>
                <Button type="button" className="min-h-11 px-5" onClick={use}>
                  Use photo
                </Button>
              </>
            ) : (
              <>
                {devices.length > 1 ? (
                  <Button type="button" variant="secondary" className="min-h-11" onClick={switchCamera} aria-label="Switch camera">
                    <SwitchCamera aria-hidden />
                  </Button>
                ) : null}
                <Button type="button" className="min-h-11 px-5" disabled={Boolean(error) || starting} onClick={capture}>
                  <Camera aria-hidden />
                  Capture
                </Button>
              </>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
