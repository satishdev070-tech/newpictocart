"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/cn";
import { trackInformativeEvent } from "../analytics";
import { START_TYPE_KEY } from "../draft";
import { ui } from "./shell";

type Choice = "ONLINE_STORE" | "INFORMATIVE";

const OPTIONS: { id: Choice; title: string; text: string; icon: typeof ShoppingBag }[] = [
  { id: "ONLINE_STORE", title: "Online Store", text: "Sell products online with cart, payments and orders.", icon: ShoppingBag },
  {
    id: "INFORMATIVE",
    title: "Informative Website",
    text: "Showcase your services, get enquiries and bookings. Ideal for clinics, salons, gyms, consultancies, academies, interior designers.",
    icon: Globe,
  },
];

/**
 * Step 0 (docs/informative/PLAN.md): two large single-select cards (native radios, so keyboard and
 * screen readers work), choice persisted so refresh and Back keep it. Online Store continues to the
 * existing first step, same URL and component as today.
 */
export function TypeSelector({ storeQuery }: { storeQuery: string }) {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(START_TYPE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the saved choice once
      if (saved === "ONLINE_STORE" || saved === "INFORMATIVE") setChoice(saved);
    } catch {
      // ignore
    }
  }, []);

  function select(c: Choice) {
    setChoice(c);
    try {
      window.localStorage.setItem(START_TYPE_KEY, c);
    } catch {
      // ignore
    }
  }

  function next() {
    if (!choice) return;
    trackInformativeEvent({ name: "onboarding_type_selected", params: { type: choice } });
    router.push(choice === "INFORMATIVE" ? "/start/informative/basic-info" : storeQuery ? `/start/lang?${storeQuery}` : "/start/lang");
  }

  return (
    <section className="flex flex-col gap-8" aria-labelledby="build-title">
      <div className="text-center">
        <h1 id="build-title" className="font-brand text-4xl leading-tight text-balance sm:text-5xl">
          What do you want to build?
        </h1>
        <p className="mt-3 text-lg text-[#5E5568]">Pick one to get started. You can&apos;t switch type later, so choose what fits your business.</p>
      </div>
      <fieldset>
        <legend className="sr-only">Website type</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {OPTIONS.map((o) => {
            const active = choice === o.id;
            const Icon = o.icon;
            return (
              <label
                key={o.id}
                className={cn(
                  "relative flex cursor-pointer flex-col gap-3 rounded-3xl border bg-white/80 p-6 shadow-sm transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#C2410C]",
                  active ? "border-[#C2410C] ring-2 ring-[#C2410C]/30" : "border-[#2A2233]/15 hover:border-[#2A2233]/40",
                )}
              >
                <input type="radio" name="website-type" value={o.id} checked={active} onChange={() => select(o.id)} className="sr-only" aria-labelledby={`type-${o.id}`} aria-describedby={`type-${o.id}-text`} />
                <Icon aria-hidden className="size-8 text-[#C2410C]" />
                <span id={`type-${o.id}`} className="text-xl font-semibold">{o.title}</span>
                <span id={`type-${o.id}-text`} className="text-[#5E5568]">{o.text}</span>
                {active ? <span className="absolute top-4 right-4 grid size-6 place-items-center rounded-full bg-[#C2410C] text-xs text-white" aria-hidden>✓</span> : null}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="flex justify-end">
        <button type="button" onClick={next} disabled={!choice} className={ui.primaryBtn}>
          Continue
        </button>
      </div>
    </section>
  );
}
