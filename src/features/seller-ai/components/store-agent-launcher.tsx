"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Bot } from "lucide-react";
import type { StoreAgentText } from "./store-agent-panel";

// The chat (and its server action reference) loads only when the seller opens it.
const StoreAgentPanel = dynamic(() => import("./store-agent-panel").then((m) => m.StoreAgentPanel), { ssr: false });

/** Floating Pica2 AI Assistant button for the seller dashboard. */
export function StoreAgentLauncher({ text }: { text: StoreAgentText }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {loaded ? <StoreAgentPanel text={text} open={open} onClose={() => setOpen(false)} /> : null}
      {!open ? (
        <button
          type="button"
          data-tour="ai-agent"
          onClick={() => {
            setLoaded(true);
            setOpen(true);
          }}
          className="fixed right-4 bottom-4 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#c026d3] px-4 text-small font-semibold text-white shadow-lg ring-1 ring-white/20 transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 sm:right-6 sm:bottom-6"
          aria-label={text.open}
        >
          <Bot aria-hidden className="size-5" />
          <span className="hidden sm:inline">{text.open}</span>
        </button>
      ) : null}
    </>
  );
}
