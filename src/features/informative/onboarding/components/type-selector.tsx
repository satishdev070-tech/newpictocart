"use client";

import { useEffect, useState } from "react";
import { Check, Globe, ShoppingBag } from "lucide-react";
import { OnbEyebrow, OnbHeading, OnbSub, onbButton, onbChoice } from "@/components/onboarding-ui";
import { startCopy } from "@/features/start/copy";
import { trackInformativeEvent } from "../analytics";
import { START_TYPE_KEY } from "../draft";

type Choice = "ONLINE_STORE" | "INFORMATIVE";

/** Where the Informative choice continues; the informative journey reads `lang`. */
export function informativeEntryHref(locale: string): string {
  return `/start/informative/basic-info?lang=${encodeURIComponent(locale)}`;
}

/**
 * /start/build (step 2, after language): Online Store or Informative Website. Two large single-select
 * cards (native radios, so keyboard and screen readers work); the choice is persisted so refresh and
 * Back keep it. Rendered inside StartJourney, which owns navigation.
 */
export function TypeSelector({
  locale,
  onStore,
  onInformative,
  onBack,
}: {
  locale: string;
  onStore: () => void;
  onInformative: () => void;
  onBack: () => void;
}) {
  const c = startCopy(locale);
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

  function select(next: Choice) {
    setChoice(next);
    try {
      window.localStorage.setItem(START_TYPE_KEY, next);
    } catch {
      // ignore
    }
  }

  function next() {
    if (!choice) return;
    trackInformativeEvent({ name: "onboarding_type_selected", params: { type: choice } });
    if (choice === "INFORMATIVE") onInformative();
    else onStore();
  }

  const options: { id: Choice; title: string; text: string; icon: typeof ShoppingBag }[] = [
    { id: "ONLINE_STORE", title: c.build.storeTitle, text: c.build.storeDesc, icon: ShoppingBag },
    { id: "INFORMATIVE", title: c.build.infoTitle, text: c.build.infoDesc, icon: Globe },
  ];

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-8 pt-6 sm:pt-10" aria-labelledby="build-title">
      <div className="space-y-3 text-center">
        <OnbEyebrow>{c.build.eyebrow}</OnbEyebrow>
        <OnbHeading accent={c.build.titleAccent}>
          <span id="build-title">{c.build.title}</span>
        </OnbHeading>
        <OnbSub className="mx-auto max-w-xl">{c.build.sub}</OnbSub>
      </div>
      <fieldset>
        <legend className="sr-only">{c.build.legend}</legend>
        <div className="grid gap-4 md:grid-cols-2">
          {options.map((o) => {
            const active = choice === o.id;
            const Icon = o.icon;
            return (
              <label
                key={o.id}
                className={onbChoice(
                  active,
                  "flex cursor-pointer flex-col gap-3 p-6 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-mk-accent sm:p-7",
                )}
              >
                <input
                  type="radio"
                  name="website-type"
                  value={o.id}
                  checked={active}
                  onChange={() => select(o.id)}
                  className="sr-only"
                  aria-labelledby={`type-${o.id}`}
                  aria-describedby={`type-${o.id}-text`}
                />
                <span className="grid size-12 place-items-center rounded-[var(--r-md)] bg-mk-accent-tint text-mk-accent">
                  <Icon aria-hidden className="size-6" />
                </span>
                <span id={`type-${o.id}`} className="font-brand text-xl font-semibold text-mk-text">
                  {o.title}
                </span>
                <span id={`type-${o.id}-text`} className="text-[15px] leading-relaxed text-mk-muted">
                  {o.text}
                </span>
                {active ? (
                  <span className="absolute right-4 top-4 grid size-7 place-items-center rounded-full bg-mk-accent text-mk-accent-ink" aria-hidden>
                    <Check className="size-4" strokeWidth={3} />
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onBack} className={onbButton.secondary}>
          ← {c.back}
        </button>
        <button type="button" onClick={next} disabled={!choice} className={onbButton.primary}>
          {c.build.continue}
        </button>
      </div>
    </section>
  );
}
