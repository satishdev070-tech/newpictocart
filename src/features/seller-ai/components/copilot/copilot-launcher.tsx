"use client";

import { useState, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { copilotCopy } from "@/features/seller-ai/copilot/copy";

/**
 * Floating "Ask Pictocart AI" button. The drawer (and its server-action references) is a lazy
 * chunk rendered by `children(open, close)` only after the first click.
 */
export function CopilotLauncher({ panelLanguage, children }: { panelLanguage?: string | null; children: (open: boolean, close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const copy = copilotCopy(panelLanguage);
  return (
    <>
      {loaded ? children(open, () => setOpen(false)) : null}
      {!open ? (
        <button
          type="button"
          data-tour="ai-agent"
          onClick={() => {
            setLoaded(true);
            setOpen(true);
          }}
          aria-haspopup="dialog"
          className="fixed right-4 bottom-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-accent px-4 text-small font-semibold text-white shadow-lg ring-1 ring-white/20 transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:right-6 sm:bottom-6"
          aria-label={copy.open}
        >
          <Sparkles aria-hidden className="size-5" />
          <span className="hidden sm:inline">{copy.open}</span>
        </button>
      ) : null}
    </>
  );
}
