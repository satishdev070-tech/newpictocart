"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { SARVAM_CHAT_TTS_CODES, SARVAM_LOCALES, type SarvamLocaleCode } from "@/lib/sarvam/locales";
import { START_INTENTS, type StartIntentId } from "../intents";
import { buildRegisterHref } from "../build-register-href";

type Screen = "welcome" | "lang" | "hello";

const FEATURES = ["Free forever", "50+ themes", "About 5 minutes"] as const;

const FLOATING = [
  { title: "Kota Doria Saree", meta: "₹2,190 · written by AI", rotate: "-8deg", pos: "left-[2%] top-[8%] hidden lg:block" },
  { title: "Brass Aarti Diya", meta: "₹520 · SEO ready", rotate: "7deg", pos: "right-[2%] top-[6%] hidden lg:block" },
  { title: "Whole Spices Box", meta: "From your shelf to the web", rotate: "5deg", pos: "left-[4%] bottom-[14%] hidden lg:block" },
] as const;

export function StartJourney({ plan, theme }: { plan?: string | null; theme?: string | null }) {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("welcome");
  const [locale, setLocale] = useState<SarvamLocaleCode>("en-IN");
  const [intent, setIntent] = useState<StartIntentId | null>(null);

  const primaryLocales = useMemo(
    () => SARVAM_LOCALES.filter((l) => (SARVAM_CHAT_TTS_CODES as readonly string[]).includes(l.code)),
    [],
  );
  const moreLocales = useMemo(
    () => SARVAM_LOCALES.filter((l) => !(SARVAM_CHAT_TTS_CODES as readonly string[]).includes(l.code)),
    [],
  );
  const selected = SARVAM_LOCALES.find((l) => l.code === locale);
  const stepLabel = screen === "welcome" ? null : screen === "lang" ? "Step 1 of 6" : "Step 2 of 6";
  const progress = screen === "lang" ? "16%" : screen === "hello" ? "33%" : "0%";

  function goRegister() {
    if (!intent) return;
    router.push(buildRegisterHref({ locale, intent, plan, theme }));
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#FBF6F1] text-[#2A2233]">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-48 size-[680px] rounded-full bg-[#FFCFA8] opacity-85 blur-[90px] motion-safe:animate-[startDrift_18s_ease-in-out_infinite]" />
        <div className="absolute -right-40 top-28 size-[620px] rounded-full bg-[#E3D0FF] opacity-85 blur-[90px] motion-safe:animate-[startDrift_22s_ease-in-out_infinite_reverse]" />
        <div className="absolute bottom-[-320px] left-[20%] h-[520px] w-[700px] rounded-full bg-[#CDE5FF] opacity-90 blur-[100px]" />
      </div>

      <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <div className="flex items-center gap-2.5">
          {screen !== "welcome" ? (
            <button
              type="button"
              onClick={() => setScreen(screen === "hello" ? "lang" : "welcome")}
              className="rounded-full border border-white/90 bg-white/60 px-3 py-2 text-sm text-[#5E5568]"
            >
              ← Back
            </button>
          ) : null}
          <Link href="/" className="flex items-center gap-2.5">
            <span className="size-[22px] rounded-[7px] bg-linear-to-br from-[#FDBA74] to-[#F97316]" aria-hidden />
            <span className="font-brand text-lg font-bold tracking-tight">pictocart</span>
          </Link>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/90 bg-white/60 px-3 py-2 text-[#5E5568]">
            <span className="size-1.5 rounded-full bg-[#22C55E]" aria-hidden />
            Voice on
          </span>
          <span className="rounded-full border border-white/90 bg-white/60 px-3 py-2 font-medium">{selected?.englishName ?? "English"} ▾</span>
        </div>
        {stepLabel ? (
          <div className="flex w-full max-w-md items-center gap-3 sm:mx-auto">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#2A2233]/8">
              <div className="h-full rounded-full bg-linear-to-r from-[#C084FC] to-[#F97316] transition-[width] duration-500" style={{ width: progress }} />
            </div>
            <span className="shrink-0 font-mono text-[11.5px] text-[#6B6275]">{stepLabel}</span>
          </div>
        ) : null}
      </header>

      {screen === "welcome" ? (
        <section className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-5 pb-16 pt-6 text-center sm:gap-7">
          {FLOATING.map((card) => (
            <div
              key={card.title}
              aria-hidden
              className={cn("absolute w-36 rounded-2xl bg-white/82 p-2.5 text-left shadow-[0_24px_50px_-20px_rgba(80,50,120,0.35)] motion-safe:animate-[startFloat_7s_ease-in-out_infinite]", card.pos)}
              style={{ transform: `rotate(${card.rotate})` }}
            >
              <div className="h-28 rounded-[10px] bg-[#EDE5DC]" />
              <p className="mt-2 text-xs font-semibold">{card.title}</p>
              <p className="text-[11.5px] text-[#C2410C]">{card.meta}</p>
            </div>
          ))}
          <div className="relative size-24">
            <div className="absolute -inset-6 rounded-full bg-[conic-gradient(from_0deg,#FFB98A,#E9C6FF,#B9DCFF,#FFB98A)] opacity-75 blur-[22px] motion-safe:animate-[startSpin_12s_linear_infinite]" />
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff_0,#FFE3CF_22%,#FDA872_55%,#C084FC_100%)] shadow-[inset_-10px_-16px_36px_rgba(120,60,200,0.35),0_20px_60px_-10px_rgba(249,115,22,0.45)] motion-safe:animate-[startBreathe_4s_ease-in-out_infinite]" />
          </div>
          <h1 className="max-w-xl font-brand text-4xl font-normal leading-[1.1] tracking-tight text-balance sm:text-6xl lg:text-7xl">
            Your store, <span className="italic text-[#C2410C]">dreamt up</span> from a single photo.
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-[#5E5568] sm:text-lg">
            Let our AI build it with you, or set it up yourself. Either way, you&apos;re selling in minutes.
          </p>
          <button
            type="button"
            onClick={() => setScreen("lang")}
            className="rounded-full bg-linear-to-br from-[#FB923C] to-[#F97316] px-8 py-4 text-base font-semibold text-white shadow-[0_16px_36px_-12px_rgba(249,115,22,0.65)]"
          >
            Let&apos;s begin →
          </button>
          <p className="flex flex-wrap justify-center gap-3 text-sm text-[#6B6275]">
            {FEATURES.map((f) => (
              <span key={f}>· {f}</span>
            ))}
          </p>
          <div className="absolute bottom-[12%] right-[3%] hidden items-center gap-2 rounded-full bg-white/88 px-3.5 py-2.5 text-sm shadow-[0_18px_40px_-18px_rgba(80,50,120,0.35)] lg:flex" aria-hidden>
            <span className="size-2 rounded-full bg-[#22C55E]" />
            New order · ₹2,190 from Pune
          </div>
        </section>
      ) : null}

      {screen === "lang" ? (
        <section className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-7 px-4 pb-12 pt-2 sm:px-8">
          <div className="text-center">
            <h2 className="font-brand text-3xl font-normal leading-tight text-balance sm:text-5xl">
              Which language feels like <span className="italic text-[#C2410C]">home</span>?
            </h2>
            <p className="mt-2.5 text-[15.5px] text-[#5E5568]">Every screen, Tara&apos;s voice and your listings will switch to it.</p>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {primaryLocales.map((l) => {
              const active = locale === l.code;
              return (
                <li key={l.code}>
                  <button
                    type="button"
                    onClick={() => setLocale(l.code)}
                    className={cn(
                      "flex min-h-24 w-full flex-col justify-between rounded-[20px] border px-4 py-3.5 text-left backdrop-blur-md transition",
                      active ? "border-[#F97316] bg-white shadow-[0_12px_30px_-16px_rgba(249,115,22,0.55)]" : "border-white/90 bg-white/55 hover:bg-white/80",
                    )}
                    aria-pressed={active}
                  >
                    <span className="text-2xl font-medium leading-snug">{l.nativeLabel}</span>
                    <span className="flex items-center justify-between gap-2 text-[13px] text-[#6B6275]">
                      {l.englishName}
                      {active ? <span className="grid size-5 place-items-center rounded-full bg-[#F97316] text-[11px] text-white">✓</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <details className="rounded-2xl border border-white/90 bg-white/40 px-4 py-3 text-sm text-[#5E5568]">
            <summary className="cursor-pointer font-medium">More Indian languages</summary>
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {moreLocales.map((l) => {
                const active = locale === l.code;
                return (
                  <li key={l.code}>
                    <button
                      type="button"
                      onClick={() => setLocale(l.code)}
                      className={cn(
                        "flex w-full flex-col rounded-2xl border px-3 py-2.5 text-left",
                        active ? "border-[#F97316] bg-white" : "border-transparent bg-white/70",
                      )}
                    >
                      <span className="font-medium">{l.nativeLabel}</span>
                      <span className="text-xs text-[#6B6275]">{l.englishName}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setScreen("hello")}
              className="rounded-full bg-linear-to-br from-[#FB923C] to-[#F97316] px-7 py-3.5 text-base font-semibold text-white shadow-[0_16px_36px_-12px_rgba(249,115,22,0.65)]"
            >
              Continue in {selected?.englishName ?? "English"} →
            </button>
          </div>
        </section>
      ) : null}

      {screen === "hello" ? (
        <section className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 px-4 pb-12 pt-2 sm:px-8 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <div className="relative size-28 sm:size-36">
              <div className="absolute -inset-7 rounded-full bg-[conic-gradient(from_0deg,#FFB98A,#E9C6FF,#B9DCFF,#FFB98A)] opacity-75 blur-[26px] motion-safe:animate-[startSpin_12s_linear_infinite]" />
              <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff_0,#FFE3CF_22%,#FDA872_55%,#C084FC_100%)] shadow-[inset_-12px_-20px_44px_rgba(120,60,200,0.35),0_24px_70px_-10px_rgba(249,115,22,0.45)] motion-safe:animate-[startBreathe_4s_ease-in-out_infinite]" />
            </div>
            <p className="max-w-md font-brand text-3xl leading-snug sm:text-4xl">
              Namaste! I&apos;m Tara. <span className="italic text-[#7C5AA6]">Before we build anything,</span> tell me a little about you.
            </p>
          </div>
          <div className="flex flex-col gap-4 rounded-[28px] border border-white/90 bg-white/58 p-5 shadow-[0_30px_70px_-30px_rgba(80,50,120,0.3)] backdrop-blur-xl sm:p-7">
            <p className="text-base font-semibold">What brings you to Pictocart today?</p>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {START_INTENTS.map((it) => {
                const active = intent === it.id;
                return (
                  <li key={it.id}>
                    <button
                      type="button"
                      onClick={() => setIntent(it.id)}
                      className={cn(
                        "flex h-full w-full flex-col gap-1 rounded-[18px] border px-4 py-3.5 text-left transition",
                        active ? "border-[#F97316] bg-[#FFF7ED]" : "border-transparent bg-white/70 hover:border-[#FED7AA]",
                      )}
                      aria-pressed={active}
                    >
                      <span className="text-[14.5px] font-semibold leading-snug">{it.title}</span>
                      <span className="text-[12.5px] text-[#6B6275]">{it.sub}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex justify-end">
              <button
                type="button"
                disabled={!intent}
                onClick={goRegister}
                className="rounded-full bg-linear-to-br from-[#FB923C] to-[#F97316] px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_16px_36px_-12px_rgba(249,115,22,0.65)] disabled:opacity-40"
              >
                Continue →
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <style>{`
        @keyframes startDrift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(80px, 60px) scale(1.12); }
        }
        @keyframes startSpin { to { transform: rotate(360deg); } }
        @keyframes startBreathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes startFloat {
          0%, 100% { translate: 0 0; }
          50% { translate: 0 -12px; }
        }
      `}</style>
    </div>
  );
}
