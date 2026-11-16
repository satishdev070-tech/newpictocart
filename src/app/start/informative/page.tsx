import { redirect } from "next/navigation";
import { parseInfoLocale } from "@/features/informative/onboarding/draft";

/** /start/informative → its first step, keeping `?lang=` (the step pages apply the flag gate). */
export default async function InformativeStartIndex({ searchParams }: PageProps<"/start/informative">) {
  const sp = await searchParams;
  const lang = parseInfoLocale(Array.isArray(sp.lang) ? sp.lang[0] : sp.lang);
  redirect(lang ? `/start/informative/basic-info?lang=${lang}` : "/start/informative/basic-info");
}
