import type { TenantPermission } from "@/lib/permissions/matrix";
import { INFORMATIVE_HOME } from "../website-type";

/**
 * What the "Your website is ready" panel offers (pure; unit tested). Publishing reuses the panel's
 * setSiteStatusAction, which checks theme.publish again on the server (repo.setSiteStatus) and RLS.
 */
export type FinishInfo = {
  /** "Go to my dashboard". */
  dashboardUrl: string;
  /** Where to go after publishing. */
  afterPublishUrl: string;
  /** Owner draft preview of the site. */
  previewUrl: string;
  canPublish: boolean;
  published: boolean;
  themeId: string;
};

export const INFORMATIVE_PREVIEW = "/informative/site-preview";

export function completionInfo(permissions: ReadonlySet<TenantPermission>, published: boolean, themeId: string): FinishInfo {
  return {
    dashboardUrl: `${INFORMATIVE_HOME}?welcome=1`,
    afterPublishUrl: INFORMATIVE_HOME,
    previewUrl: INFORMATIVE_PREVIEW,
    canPublish: permissions.has("theme.publish") && !published,
    published,
    themeId,
  };
}
