"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/field";
import type { InfoFaq, InfoGalleryItem, InfoTeamMember, InfoTestimonial } from "../model";
import { addGalleryItemsAction, saveFaqAction, saveGalleryItemAction, saveTeamMemberAction, saveTestimonialAction, uploadInformativeImageAction } from "../actions";
import { ActionForm, ImageField } from "./ui";

export function TeamMemberForm({ member, photoUrl }: { member?: InfoTeamMember; photoUrl?: string | null }) {
  return (
    <ActionForm action={saveTeamMemberAction} submitLabel={member ? "Save" : "Add member"} success={member ? "Saved." : "Added."}>
      {(e) => (
        <>
          {member ? <input type="hidden" name="id" value={member.id} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Name" name="name" defaultValue={member?.name} required maxLength={80} errors={e.name} />
            <TextField label="Role" name="role" defaultValue={member?.role ?? ""} maxLength={80} optional errors={e.role} hint="e.g. Senior stylist, Head coach" />
          </div>
          <TextAreaField label="Bio" name="bio" defaultValue={member?.bio ?? ""} rows={3} maxLength={1000} optional errors={e.bio} />
          <ImageField name="photoPath" label="Photo" initialPath={member?.photoPath} initialUrl={photoUrl} />
          <CheckboxField label="Show on website" name="isVisible" defaultChecked={member?.isVisible ?? true} />
        </>
      )}
    </ActionForm>
  );
}

export function TestimonialForm({ item, photoUrl }: { item?: InfoTestimonial; photoUrl?: string | null }) {
  return (
    <ActionForm action={saveTestimonialAction} submitLabel={item ? "Save" : "Add testimonial"} success={item ? "Saved." : "Added."}>
      {(e) => (
        <>
          {item ? <input type="hidden" name="id" value={item.id} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Name" name="authorName" defaultValue={item?.authorName} required maxLength={80} errors={e.authorName} />
            <SelectField label="Rating" name="rating" defaultValue={String(item?.rating ?? 5)} options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} star${n > 1 ? "s" : ""}` }))} errors={e.rating} />
          </div>
          <TextAreaField label="What they said" name="text" defaultValue={item?.text} rows={3} required maxLength={1000} errors={e.text} hint="Only add words your client actually said." />
          <ImageField name="authorPhotoPath" label="Photo" initialPath={item?.authorPhotoPath} initialUrl={photoUrl} />
          <CheckboxField label="Show on website" name="isVisible" defaultChecked={item?.isVisible ?? true} />
        </>
      )}
    </ActionForm>
  );
}

export function FaqForm({ faq }: { faq?: InfoFaq }) {
  return (
    <ActionForm action={saveFaqAction} submitLabel={faq ? "Save" : "Add question"} success={faq ? "Saved." : "Added."}>
      {(e) => (
        <>
          {faq ? <input type="hidden" name="id" value={faq.id} /> : null}
          <TextField label="Question" name="question" defaultValue={faq?.question} required maxLength={300} errors={e.question} />
          <TextAreaField label="Answer" name="answer" defaultValue={faq?.answer} rows={3} required maxLength={3000} errors={e.answer} />
          <CheckboxField label="Show on website" name="isVisible" defaultChecked={faq?.isVisible ?? true} />
        </>
      )}
    </ActionForm>
  );
}

export function GalleryItemForm({ item }: { item: InfoGalleryItem }) {
  return (
    <ActionForm action={saveGalleryItemAction} submitLabel="Save" className="space-y-3">
      {(e) => (
        <>
          <input type="hidden" name="id" value={item.id} />
          <TextField label="Caption" name="caption" defaultValue={item.caption ?? ""} maxLength={200} optional errors={e.caption} />
          <TextField label="Alt text" name="alt" defaultValue={item.alt ?? ""} maxLength={200} optional errors={e.alt} hint="Describe the photo for people using screen readers." />
          <TextField label="Album" name="album" defaultValue={item.album ?? ""} maxLength={60} optional errors={e.album} />
        </>
      )}
    </ActionForm>
  );
}

/** Multi-upload: each file is uploaded, then all are added to the gallery in one action. */
export function GalleryUploader() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const list = [...files].slice(0, 30);
    setBusy(true);
    const paths: string[] = [];
    const failed: string[] = [];
    for (const [i, file] of list.entries()) {
      setStatus(`Uploading ${i + 1} of ${list.length}…`);
      const fd = new FormData();
      fd.set("file", file);
      const r = await uploadInformativeImageAction(fd);
      if (r.ok) paths.push(r.data.path);
      else failed.push(file.name);
    }
    if (paths.length) {
      const r = await addGalleryItemsAction({ paths });
      if (!r.ok) failed.push("(saving)");
    }
    setBusy(false);
    setStatus(failed.length ? `Added ${paths.length}. Couldn't add: ${failed.join(", ")}` : `Added ${paths.length} photo${paths.length === 1 ? "" : "s"}.`);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-dashed border-border p-4">
      <label htmlFor="gallery-upload" className="text-small font-medium">Add photos</label>
      <input id="gallery-upload" type="file" multiple accept="image/png,image/jpeg,image/webp,image/avif,image/gif" disabled={busy} onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} className="mt-1 block text-small" />
      <p className="mt-1 text-caption text-muted" aria-live="polite">{status ?? "Select up to 30 images at once (JPG, PNG or WebP, 10 MB each)."}</p>
      {busy ? <Button type="button" variant="ghost" size="sm" pending disabled>Uploading</Button> : null}
    </div>
  );
}
