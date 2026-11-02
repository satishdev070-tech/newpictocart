"use client";

import { useRef, useState, useTransition } from "react";
import { uploadLandingAssetAction } from "@/features/platform/actions";
import type { StepMediaKind } from "@/features/marketing-site/landing";
import { cn } from "@/lib/cn";

type Value = { imageUrl: string; imageAlt: string; mediaKind: StepMediaKind; posterUrl: string };

/**
 * Super Admin media control for landing Steps: upload JPG/PNG/WebP/GIF/MP4 into the
 * platform-branding bucket, or paste an https URL. Sets mediaKind automatically on upload.
 */
export function LandingMediaField({
  value,
  onChange,
  className,
}: {
  value: Value;
  onChange: (next: Value) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onFile(file: File | null) {
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const res = await uploadLandingAssetAction(null, fd);
      if (!res.ok) {
        setError(res.error.fieldErrors?.file?.[0] || res.error.message || "Upload failed");
        return;
      }
      onChange({
        ...value,
        imageUrl: res.data.url,
        mediaKind: res.data.mediaKind,
        imageAlt: value.imageAlt || file.name.replace(/\.[^.]+$/, "").slice(0, 120),
      });
    });
  }

  return (
    <div className={cn("grid gap-3 sm:col-span-2", className)}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid flex-1 gap-1 text-sm">
          <span className="font-medium text-foreground">Media URL</span>
          <input
            type="url"
            value={value.imageUrl}
            onChange={(e) => onChange({ ...value, imageUrl: e.target.value })}
            placeholder="https://… or upload below"
            className="h-10 rounded-md border border-border bg-white px-3 text-sm"
          />
          <span className="text-xs text-muted">JPG, PNG, WebP, GIF or MP4. 4:3 works best for steps.</span>
        </label>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"
            className="sr-only"
            onChange={(e) => {
              onFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
            className="h-10 rounded-md border border-border bg-white px-4 text-sm font-semibold hover:bg-surface-secondary disabled:opacity-60"
          >
            {pending ? "Uploading…" : "Upload"}
          </button>
          {value.imageUrl ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => onChange({ ...value, imageUrl: "", mediaKind: "image", posterUrl: "" })}
              className="h-10 rounded-md px-3 text-sm font-medium text-muted hover:text-foreground"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>
      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
      {value.imageUrl ? (
        <div className="flex flex-wrap items-start gap-4">
          <div className="overflow-hidden rounded-lg ring-1 ring-border">
            {value.mediaKind === "video" ? (
              <video src={value.imageUrl} poster={value.posterUrl || undefined} muted playsInline className="h-24 w-36 object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value.imageUrl} alt="" className="h-24 w-36 object-cover" />
            )}
          </div>
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Alt / description</span>
              <input
                value={value.imageAlt}
                onChange={(e) => onChange({ ...value, imageAlt: e.target.value })}
                className="h-10 rounded-md border border-border bg-white px-3 text-sm"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Kind</span>
              <select
                value={value.mediaKind}
                onChange={(e) => onChange({ ...value, mediaKind: e.target.value as StepMediaKind })}
                className="h-10 rounded-md border border-border bg-white px-3 text-sm"
              >
                <option value="image">Image</option>
                <option value="gif">GIF</option>
                <option value="video">Video (MP4)</option>
              </select>
            </label>
            {value.mediaKind === "video" ? (
              <label className="grid gap-1 text-sm sm:col-span-2">
                <span className="font-medium">Poster image URL (optional)</span>
                <input
                  type="url"
                  value={value.posterUrl}
                  onChange={(e) => onChange({ ...value, posterUrl: e.target.value })}
                  className="h-10 rounded-md border border-border bg-white px-3 text-sm"
                  placeholder="https://… still frame shown before play"
                />
              </label>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
