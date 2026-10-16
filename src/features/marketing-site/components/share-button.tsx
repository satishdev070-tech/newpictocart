"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Link2, Mail, Share2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { SHARE_LABELS, shareUrl, type ShareNetwork } from "../chrome-content";
import { BRAND_CHIP, BrandIcons } from "./chrome-icons";

/**
 * Footer "Share" button: a popover of share links for the current page, plus copy link and the
 * device share sheet (Web Share API) where the browser has one. Escape or a click outside closes it.
 */

const CHIP: Record<ShareNetwork, string> = {
  whatsapp: BRAND_CHIP.whatsapp,
  facebook: BRAND_CHIP.facebook,
  x: "bg-black text-white ring-1 ring-white/20",
  linkedin: BRAND_CHIP.linkedin,
  telegram: BRAND_CHIP.telegram,
  pinterest: BRAND_CHIP.pinterest,
  email: "bg-[#ea4335] text-white",
  copy: "bg-white/15 text-white",
};

function NetworkIcon({ network, copied }: { network: ShareNetwork; copied: boolean }) {
  if (network === "copy") return copied ? <Check aria-hidden className="size-4" /> : <Link2 aria-hidden className="size-4" />;
  if (network === "email") return <Mail aria-hidden className="size-4" />;
  const Icon = BrandIcons[network];
  return <Icon className="size-4" />;
}

export function ShareButton({ label, text, networks }: { label: string; text: string; networks: ShareNetwork[] }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  // The page URL is read in the browser when the popover opens (not during server rendering).
  const [url, setUrl] = useState("");
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const pageUrl = () => window.location.href.split("#")[0]!;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", pageUrl());
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: document.title, text, url: pageUrl() });
      setOpen(false);
    } catch {
      // Dismissed by the user, or not allowed: the popover stays open with the other options.
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          if (!open) {
            setUrl(pageUrl());
            setCanNativeShare(typeof navigator.share === "function");
          }
          setOpen(!open);
        }}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-full border border-white/15 px-4 text-sm font-semibold text-white/85 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
          open && "border-white/30 bg-white/10 text-white",
        )}
      >
        <Share2 aria-hidden className="size-4" />
        {label}
      </button>
      <div
        id={panelId}
        role="group"
        aria-label={label}
        className={cn(
          "absolute right-1/2 bottom-full z-30 mb-3 w-[min(19rem,calc(100vw-2rem))] translate-x-1/2 rounded-2xl border border-white/10 bg-[#11113a] p-3 text-left shadow-[0_24px_60px_-20px_rgb(0_0_0/0.9)] transition-[opacity,transform,visibility] duration-150 motion-reduce:transition-none md:right-0 md:translate-x-0",
          open ? "visible translate-y-0 opacity-100" : "invisible translate-y-1 opacity-0",
        )}
      >
        <ul className="grid grid-cols-4 gap-1">
          {networks.map((n) => {
            const href = url ? shareUrl(n, url, text) : null;
            const inner = (
              <>
                <span className={cn("grid size-10 place-items-center rounded-full transition-transform group-hover:scale-110 motion-reduce:transition-none", CHIP[n])}>
                  <NetworkIcon network={n} copied={n === "copy" && copied} />
                </span>
                <span className="text-[0.7rem] leading-tight text-white/70 group-hover:text-white">{n === "copy" && copied ? "Copied!" : SHARE_LABELS[n]}</span>
              </>
            );
            const cls = "group flex w-full flex-col items-center gap-1.5 rounded-xl px-1 py-2 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-white";
            return (
              <li key={n}>
                {n !== "copy" ? (
                  // Before the first open there's no URL yet; the popover is hidden then anyway.
                  <a href={href ?? undefined} target={n === "email" ? undefined : "_blank"} rel="noopener noreferrer" className={cls} onClick={() => setOpen(false)}>
                    {inner}
                  </a>
                ) : (
                  <button type="button" onClick={copy} className={cls}>
                    {inner}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {canNativeShare ? (
          <button type="button" onClick={nativeShare} className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-semibold text-white hover:bg-white/15">
            <Share2 aria-hidden className="size-4" /> More options…
          </button>
        ) : null}
        <span aria-live="polite" className="sr-only">
          {copied ? "Link copied" : ""}
        </span>
      </div>
    </div>
  );
}
