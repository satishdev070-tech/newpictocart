"use client";

import { cn } from "@/lib/cn";
import { START_INTENTS, type StartIntentId } from "../intents";
import { startCopy } from "../copy";
import { TaraOrb } from "../components/tara-orb";

export function IntentScreen({
  locale,
  intent,
  onSelect,
  onContinue,
}: {
  locale: string;
  intent: StartIntentId | null;
  onSelect: (id: StartIntentId) => void;
  onContinue: () => void;
}) {
  const c = startCopy(locale);
  return (
    <section className="grid w-full items-center gap-8 lg:grid-cols-2">
      <div className="flex flex-col gap-5">
        <TaraOrb size="lg" />
        <p className="max-w-md font-brand text-3xl leading-snug sm:text-4xl">{c.intent.tara}</p>
      </div>
      <div className="flex flex-col gap-4 rounded-[28px] border border-white/90 bg-white/58 p-5 shadow-[0_30px_70px_-30px_rgba(80,50,120,0.3)] backdrop-blur-xl sm:p-7">
        <p className="text-base font-semibold">{c.intent.question}</p>
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {START_INTENTS.map((it) => {
            const active = intent === it.id;
            const copy = c.intents[it.id];
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => onSelect(it.id)}
                  className={cn(
                    "flex h-full w-full flex-col gap-1 rounded-[18px] border px-4 py-3.5 text-left transition",
                    active ? "border-[#F97316] bg-[#FFF7ED]" : "border-transparent bg-white/70 hover:border-[#FED7AA]",
                  )}
                  aria-pressed={active}
                >
                  <span className="text-[14.5px] font-semibold leading-snug">{copy.title}</span>
                  <span className="text-[12.5px] text-[#6B6275]">{copy.sub}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-end">
          <button
            type="button"
            disabled={!intent}
            onClick={onContinue}
            className="rounded-full bg-linear-to-br from-[#FB923C] to-[#F97316] px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_16px_36px_-12px_rgba(249,115,22,0.65)] disabled:opacity-40"
          >
            {c.intent.continue}
          </button>
        </div>
      </div>
    </section>
  );
}
