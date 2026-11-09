"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type AccordionItem = {
  id?: string;
  question: string;
  answer: ReactNode;
};

/**
 * Thin-divider accordion. Plus rotates to ×; panel height uses CSS grid-rows.
 */
export function Accordion({
  items,
  className,
  allowMultiple = false,
}: {
  items: AccordionItem[];
  className?: string;
  allowMultiple?: boolean;
}) {
  const baseId = useId();
  const [open, setOpen] = useState<Set<number>>(() => new Set());

  function toggle(i: number) {
    setOpen((prev) => {
      const next = new Set(allowMultiple ? prev : []);
      if (prev.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div className={cn("divide-y divide-mk-line border-y border-mk-line", className)}>
      {items.map((item, i) => {
        const isOpen = open.has(i);
        const panelId = `${baseId}-panel-${i}`;
        const buttonId = `${baseId}-btn-${i}`;
        return (
          <div key={item.id ?? item.question}>
            <h3 className="m-0">
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(i)}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between gap-4 py-5 text-left font-semibold text-mk-text",
                  "transition-colors duration-[var(--dur-fast,200ms)] hover:text-mk-accent",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent",
                )}
              >
                <span>{item.question}</span>
                <span
                  aria-hidden
                  className={cn(
                    "grid size-7 shrink-0 place-items-center text-lg leading-none text-mk-muted",
                    "transition-transform duration-[var(--dur-fast,200ms)] ease-[var(--ease-out,cubic-bezier(0.22,1,0.36,1))]",
                    isOpen && "rotate-45 text-mk-accent",
                  )}
                >
                  +
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={cn(
                "grid transition-[grid-template-rows] duration-[var(--dur,450ms)] ease-[var(--ease-out,cubic-bezier(0.22,1,0.36,1))]",
                "motion-reduce:transition-none",
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <div className="pb-5 text-sm leading-relaxed text-mk-muted">{item.answer}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
