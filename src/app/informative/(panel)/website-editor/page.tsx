import { redirect } from "next/navigation";
import { requireInformativeTenant } from "@/features/informative/server/context";

/**
 * Sidebar entry for the full-screen Website editor. The editor itself lives outside the (panel)
 * layout (/informative/editor) so the panel chrome is hidden; this route keeps the sidebar's
 * "every item has a panel page" rule and sends the member there.
 */
export default async function InformativeWebsiteEditorEntry() {
  await requireInformativeTenant();
  redirect("/informative/editor?page=home");
}
