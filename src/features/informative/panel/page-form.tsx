"use client";

import { CheckboxField, TextField } from "@/components/ui/field";
import type { InfoPage } from "../model";
import { savePageAction } from "../actions";
import { ActionForm } from "./ui";

/** Page settings (title, address for custom pages, published, SEO). New custom pages open in the editor. */
export function PageForm({ page }: { page?: InfoPage }) {
  const custom = !page || page.type === "CUSTOM";
  return (
    <ActionForm action={savePageAction} submitLabel={page ? "Save settings" : "Create page"} redirectTo={page ? undefined : (d) => `/informative/pages/${d.id}`}>
      {(e) => (
        <>
          {page ? <input type="hidden" name="id" value={page.id} /> : null}
          <TextField label="Title" name="title" defaultValue={page?.title} required maxLength={120} errors={e.title} />
          {custom ? <TextField label="Address (URL)" name="slug" defaultValue={page?.slug ?? ""} optional errors={e.slug} hint="Leave empty to create one from the title." /> : <p className="text-small text-muted">Address: /{page.type === "HOME" ? "" : page.slug}</p>}
          <CheckboxField label="Published" name="isPublished" defaultChecked={page?.isPublished ?? true} />
          <TextField label="SEO title" name="seoTitle" defaultValue={page?.seo.title ?? ""} maxLength={70} optional errors={e.seoTitle} />
          <TextField label="SEO description" name="seoDescription" defaultValue={page?.seo.description ?? ""} maxLength={160} optional errors={e.seoDescription} />
        </>
      )}
    </ActionForm>
  );
}
