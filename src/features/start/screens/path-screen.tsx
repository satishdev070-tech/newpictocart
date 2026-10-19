"use client";

import { cn } from "@/lib/cn";
import { startCopy } from "../copy";
import { TaraOrb } from "../components/tara-orb";

export function PathScreen({
  locale,
  path,
  onSelect,
  onContinue,
}: {
  locale: string;
  path: "ai" | "manual" | null;
  onSelect: (p: "ai" | "manual") => void;
  onContinue: () => void;
}) {
  const c = startCopy(locale);
  return (
    <section className="flex w-full flex-col gap-8">
      <div className="text-center">
        <h2 className="font-brand text-3xl sm:text-5xl">
          {c.path.title}
          <span className="text-[#C2410C]">{c.path.titleAccent}</span>?
        </h2>
        <p className="mt-2 text-[#5E5568]">{c.path.sub}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <PathCard
          active={path === "ai"}
          onClick={() => onSelect("ai")}
          badge={c.path.aiBadge}
          title={c.path.aiTitle}
          desc={c.path.aiDesc}
          bullets={c.path.aiBullets}
          highlight
          visual={<TaraOrb size="sm" className="mx-auto" />}
        />
        <PathCard
          active={path === "manual"}
          onClick={() => onSelect("manual")}
          badge={c.path.manualBadge}
          title={c.path.manualTitle}
          desc={c.path.manualDesc}
          bullets={c.path.manualBullets}
          visual={<div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#EDE9FE] text-2xl">▦</div>}
        />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={!path}
          onClick={onContinue}
          className="rounded-full bg-linear-to-br from-[#FB923C] to-[#F97316] px-7 py-3.5 font-semibold text-white shadow-[0_16px_36px_-12px_rgba(249,115,22,0.65)] disabled:opacity-40"
        >
          {path === "manual" ? c.path.ctaManual : c.path.ctaAi}
        </button>
      </div>
    </section>
  );
}

function PathCard({
  active,
  onClick,
  badge,
  title,
  desc,
  bullets,
  visual,
  highlight,
}: {
  active: boolean;
  onClick: () => void;
  badge: string;
  title: string;
  desc: string;
  bullets: string[];
  visual: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col gap-4 rounded-[28px] border p-6 text-left transition",
        active ? "border-[#F97316] bg-white shadow-[0_20px_50px_-24px_rgba(249,115,22,0.45)]" : "border-white/90 bg-white/55",
        highlight && !active && "border-[#FED7AA]/80",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {visual}
        <span className="rounded-full bg-[#FFF7ED] px-2.5 py-1 text-xs font-semibold text-[#C2410C]">{badge}</span>
      </div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="text-sm text-[#5E5568]">{desc}</p>
      <ul className="space-y-1.5 text-sm text-[#2A2233]">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="text-[#F97316]">✓</span>
            {b}
          </li>
        ))}
      </ul>
    </button>
  );
}
