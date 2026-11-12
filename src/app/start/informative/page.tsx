import { redirect } from "next/navigation";

/** /start/informative → its first step (the step pages apply the flag gate). */
export default function InformativeStartIndex() {
  redirect("/start/informative/basic-info");
}
