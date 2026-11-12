"use client";

import { ActionForm } from "./ui";
import { setSiteStatusAction } from "../actions";

/** Publish / unpublish button (theme.publish). */
export function PublishForm({ status }: { status: "DRAFT" | "PUBLISHED" }) {
  const next = status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
  return (
    <ActionForm action={setSiteStatusAction} submitLabel={next === "PUBLISHED" ? "Publish website" : "Unpublish"} success={next === "PUBLISHED" ? "Your website is live." : "Your website is hidden."} className="flex flex-wrap items-center gap-3">
      {() => <input type="hidden" name="status" value={next} />}
    </ActionForm>
  );
}
