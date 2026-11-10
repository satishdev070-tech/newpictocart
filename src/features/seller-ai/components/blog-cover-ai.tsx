"use client";

import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Hint, Label, inputClassName as input } from "@/components/ui/field";
import { importUnsplashAction, listUnsplashAction } from "@/features/media/unsplash-actions";
import { UnsplashCredit, actionError } from "@/features/media/components/unsplash-browser";
import type { UnsplashPhoto } from "@/features/media/unsplash/photos";
import { assetUrl } from "@/lib/storage/assets";

/**
 * Cover / hero image for the blog editor: keep manual upload, plus Generate with AI via Unsplash
 * (search by topic/title → pick or auto-use first → import into the store media library).
 */
export function BlogCoverAi({
  topic,
  coverUrl,
  coverPath,
  onCoverPath,
}: {
  /** Topic or post title used as the Unsplash search query. */
  topic: string;
  coverUrl: string | null;
  coverPath: string | null;
  onCoverPath: (path: string | null, previewUrl: string | null) => void;
}) {
  const fileId = useId();
  const [q, setQ] = useState("");
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [importingId, setImportingId] = useState<string | null>(null);

  const searchAndMaybePick = (auto: boolean) => {
    const query = q.trim() || topic.trim();
    if (query.length < 2) {
      setError("Enter a topic or title (at least 2 characters) to search Unsplash.");
      return;
    }
    setError(null);
    start(async () => {
      const r = await listUnsplashAction({ q: query, page: 1 });
      if (!r.ok) {
        setError(actionError(r));
        return;
      }
      setPhotos(r.data.photos);
      if (!r.data.photos.length) {
        setError("No Unsplash photos matched. Try a shorter topic.");
        setPickerOpen(true);
        return;
      }
      if (auto) {
        await importPhoto(r.data.photos[0]!);
      } else {
        setPickerOpen(true);
      }
    });
  };

  const importPhoto = async (photo: UnsplashPhoto) => {
    setImportingId(photo.id);
    setError(null);
    const r = await importUnsplashAction({ id: photo.id, folder: "blog" });
    setImportingId(null);
    if (!r.ok) {
      setError(actionError(r));
      return;
    }
    onCoverPath(r.data.item.path, r.data.item.url || assetUrl(r.data.item.path));
    setPickerOpen(false);
  };

  const preview = coverUrl;

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor={fileId}>Cover / hero image</Label>
        <input
          id={fileId}
          name="cover"
          type="file"
          accept="image/*"
          className="text-sm"
          onChange={() => {
            // Manual upload wins over a previously imported Unsplash path.
            onCoverPath(null, null);
          }}
        />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- editor thumbnail
          <img src={preview} alt="" className="mt-2 aspect-video w-full rounded object-cover" />
        ) : null}
        {coverPath ? <input type="hidden" name="coverPath" value={coverPath} /> : null}
      </div>

      <div className="rounded-md border border-border bg-surface-secondary/40 p-3 space-y-2">
        <p className="text-label">Generate with AI (Unsplash)</p>
        <input
          className={input}
          value={q}
          maxLength={80}
          placeholder={topic.trim() || "Search photos by topic"}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" pending={pending && !pickerOpen} onClick={() => searchAndMaybePick(true)}>
            Auto-pick cover
          </Button>
          <Button type="button" size="sm" variant="ghost" pending={pending} onClick={() => searchAndMaybePick(false)}>
            Choose photo
          </Button>
        </div>
        <Hint>Imports a copy into your media library. Manual upload above still works.</Hint>
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-error/25 bg-error/10 px-3 py-2 text-small text-error">
          {error}
        </p>
      ) : null}

      {pickerOpen && photos.length ? (
        <ul className="grid grid-cols-2 gap-2">
          {photos.slice(0, 8).map((photo) => (
            <li key={photo.id} className="overflow-hidden rounded-md border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element -- Unsplash hotlink thumb */}
              <img src={photo.thumb} alt={photo.alt} className="aspect-video w-full object-cover" />
              <div className="space-y-1 p-2">
                <UnsplashCredit photo={photo} />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  pending={importingId === photo.id}
                  disabled={Boolean(importingId)}
                  onClick={() => void importPhoto(photo)}
                >
                  Use photo
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
