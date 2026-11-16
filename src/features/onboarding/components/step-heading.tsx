import type { ReactNode } from "react";
import { OnbEyebrow } from "@/components/onboarding-ui";

export function StepHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: ReactNode }) {
  return (
    <div className="mb-8">
      <OnbEyebrow>{eyebrow}</OnbEyebrow>
      <h1 className="mt-2 font-brand text-2xl font-semibold tracking-[-0.02em] text-mk-text sm:text-3xl">{title}</h1>
      {description ? <p className="mt-2 text-mk-muted">{description}</p> : null}
    </div>
  );
}
