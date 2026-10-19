import type { ReactNode } from "react";

export function StepHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: ReactNode }) {
  return (
    <div className="mb-8">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">{eyebrow}</p>
      <h1 className="mt-2 font-brand text-2xl font-extrabold tracking-tight text-brand-ink sm:text-3xl">{title}</h1>
      {description ? <p className="mt-2 text-muted">{description}</p> : null}
    </div>
  );
}
