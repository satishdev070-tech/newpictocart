"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Mic } from "lucide-react";

// The drawer, speech code and server-action references load only after the first tap.
const VoiceDrawer = dynamic(() => import("./voice-drawer").then((m) => m.VoiceDrawer), { ssr: false });

/** Floating push-to-talk button (sits above the "Ask Pictocart AI" button). */
export function VoiceLauncher({ storeName }: { storeName: string }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [autoListen, setAutoListen] = useState(false);
  return (
    <>
      {loaded ? <VoiceDrawer open={open} storeName={storeName} autoListen={autoListen} onClose={() => setOpen(false)} /> : null}
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setLoaded(true);
            setAutoListen(true);
            setOpen(true);
          }}
          aria-haspopup="dialog"
          aria-label="Talk to Pictocart voice assistant"
          title="Talk to Pictocart (voice assistant)"
          className="fixed right-4 bottom-20 z-40 grid size-12 place-items-center rounded-full bg-foreground text-surface shadow-lg ring-1 ring-white/20 transition-transform hover:scale-[1.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:right-6 sm:bottom-24"
        >
          <Mic aria-hidden className="size-5" />
        </button>
      ) : null}
    </>
  );
}
