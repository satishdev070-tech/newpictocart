import { redirect } from "next/navigation";
import { requireInformativeTenant } from "@/features/informative/server/context";
import { INFORMATIVE_HOME } from "@/features/informative/website-type";

/** Bare /informative → the panel home (after the same guard as every panel page). */
export default async function InformativeIndex() {
  await requireInformativeTenant();
  redirect(INFORMATIVE_HOME);
}
