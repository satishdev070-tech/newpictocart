"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import { CameraCaptureButton } from "@/features/media/components/camera-capture";

export type LocalImage = { key: number; file: File; preview: string };

const ACCEPTED = /^image\/(png|jpeg|webp)$/i;
const ACCEPTED_NAME = /\.(png|jpe?g|webp)$/i;

/** Local photos for an AI card (object-URL previews; nothing uploads until Generate / Apply). */
export function useAiPhotos(max = 4) {
  const nextKey = useRef(0);
  const [images, setImages] = useState<LocalImage[]>([]);
  const latest = useRef(images);
  useEffect(() => {
    latest.current = images;
  }, [images]);

  useEffect(() => () => latest.current.forEach((i) => URL.revokeObjectURL(i.preview)), []);

  const add = useCallback(
    (files: FileList | File[] | null) => {
      if (!files) return;
      setImages((prev) => {
        const room = max - prev.length;
        if (room <= 0) return prev;
        const accepted = Array.from(files)
          .filter((f) => ACCEPTED.test(f.type) || ACCEPTED_NAME.test(f.name))
          .slice(0, room)
          .map((file) => ({ key: nextKey.current++, file, preview: URL.createObjectURL(file) }));
        return [...prev, ...accepted];
      });
    },
    [max],
  );
  const remove = useCallback((key: number) => {
    setImages((prev) => {
      const gone = prev.find((i) => i.key === key);
      if (gone) URL.revokeObjectURL(gone.preview);
      return prev.filter((i) => i.key !== key);
    });
  }, []);
  const clear = useCallback(() => {
    setImages((prev) => {
      prev.forEach((i) => URL.revokeObjectURL(i.preview));
      return [];
    });
  }, []);
  return { images, add, remove, clear, max, slotsLeft: max - images.length };
}

/** Photo grid + Choose photos (gallery / files) + Click picture (camera). */
export function AiPhotoPicker({ photos, label = "Photos" }: { photos: ReturnType<typeof useAiPhotos>; label?: string }) {
  const fileId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const { images, add, remove, clear, max, slotsLeft } = photos;
  return (
    <div>
      <Label htmlFor={fileId}>{label}</Label>
      <input
        id={fileId}
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple={max > 1}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
      {images.length ? (
        <ul className="mb-2 grid grid-cols-4 gap-2">
          {images.map((img) => (
            <li key={img.key} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-secondary">
              {/* Local object URL preview only. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.preview} alt="" className="size-full object-cover" />
              <button
                type="button"
                onClick={() => remove(img.key)}
                className="absolute top-1 right-1 grid size-8 place-items-center rounded-md bg-surface/90 text-muted shadow-xs ring-1 ring-border hover:text-foreground"
                aria-label={`Remove ${img.file.name}`}
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
          {slotsLeft > 0 ? (
            <li>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="grid aspect-square size-full place-items-center rounded-lg border border-dashed border-border bg-surface-secondary text-muted hover:border-border-strong hover:text-foreground"
                aria-label="Add more photos"
              >
                <ImagePlus aria-hidden className="size-5" />
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <CameraCaptureButton onCapture={(file) => add([file])} disabled={slotsLeft <= 0} className="min-h-11 sm:min-h-8" />
        <Button type="button" variant="secondary" size="sm" className="min-h-11 sm:min-h-8" onClick={() => fileRef.current?.click()} disabled={slotsLeft <= 0}>
          <ImagePlus aria-hidden className="size-4" />
          {images.length ? (slotsLeft ? "Upload more" : "Photo limit reached") : "Upload"}
        </Button>
        {images.length ? (
          <>
            <span className="text-small text-muted">
              {images.length} of {max}
            </span>
            <Button type="button" variant="ghost" size="sm" className="min-h-11 sm:min-h-8" onClick={clear}>
              Clear
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
