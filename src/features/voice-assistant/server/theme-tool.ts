import "server-only";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenant/membership";
import { saveThemeDraftAction } from "@/features/theme/actions";
import { getThemeEditorData } from "@/features/theme/server/queries";
import { THEME_COLOR_TOKENS, type ThemeColorToken } from "../schemas";

/**
 * Theme tools for the voice assistant: read the current colours and write ONE colour token into
 * the store's theme DRAFT. Publishing stays a separate, explicit action in the theme editor.
 *
 * The write reuses saveThemeDraftAction, so it gets the same validation (strict theme schema,
 * tenant-owned assets), permission check (theme.edit) and stale-draft guard: the draft's
 * updated_at is passed as the base, and a theme editor open with unsaved changes gets the normal
 * "someone else saved this theme" conflict on its next save instead of silently overwriting.
 */

export type ThemeColors = Record<ThemeColorToken, string>;

export async function readThemeColors(tenantId: string): Promise<ThemeColors | null> {
  const data = await getThemeEditorData(tenantId);
  if (!data) return null;
  const colors = data.config.tokens.colors as Record<string, string>;
  return Object.fromEntries(THEME_COLOR_TOKENS.map((t) => [t, String(colors[t] ?? "").toLowerCase()])) as ThemeColors;
}

/** Sets `token` to `color` in the draft. Returns the colour it replaced. */
export async function writeThemeColor(ctx: Pick<TenantContext, "tenantId">, token: ThemeColorToken, color: string): Promise<{ before: string }> {
  const data = await getThemeEditorData(ctx.tenantId);
  if (!data) throw new AppError("INTERNAL", { fieldErrors: { _form: ["Couldn't load your theme. Try again in a moment."] } });
  const colors = data.config.tokens.colors as Record<string, string>;
  const before = String(colors[token] ?? "").toLowerCase();
  const config = { ...data.config, tokens: { ...data.config.tokens, colors: { ...colors, [token]: color } } };
  const fd = new FormData();
  fd.set("config", JSON.stringify(config));
  if (data.draftUpdatedAt) fd.set("baseUpdatedAt", data.draftUpdatedAt);
  const r = await saveThemeDraftAction(null, fd);
  if (!r.ok) {
    const msg = r.error.fieldErrors?._form?.[0] ?? r.error.message ?? "Couldn't save the theme draft.";
    throw new AppError(r.error.code === "CONFLICT" ? "CONFLICT" : "VALIDATION", { fieldErrors: { _form: [msg] } });
  }
  return { before };
}
