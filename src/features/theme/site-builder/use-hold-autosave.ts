"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { useBuilder } from "./context";

type HoldHandlers = {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onBlur: () => void;
};

/**
 * Pause draft autosave while a slider / colour control is held.
 * Spread onto range and colour inputs: pointerdown holds; pointerup / cancel / blur releases.
 * Also listens on `window` for pointerup so releasing outside the thumb still clears the hold.
 */
export function useHoldAutosave(): HoldHandlers {
  const { setHoldAutosave } = useBuilder();
  const heldRef = useRef(false);
  const windowCleanupRef = useRef<(() => void) | null>(null);

  const release = () => {
    if (!heldRef.current) return;
    heldRef.current = false;
    windowCleanupRef.current?.();
    windowCleanupRef.current = null;
    setHoldAutosave(false);
  };

  const hold = () => {
    if (heldRef.current) return;
    heldRef.current = true;
    setHoldAutosave(true);
    const onWin = () => release();
    window.addEventListener("pointerup", onWin);
    window.addEventListener("pointercancel", onWin);
    windowCleanupRef.current = () => {
      window.removeEventListener("pointerup", onWin);
      window.removeEventListener("pointercancel", onWin);
    };
  };

  // Clear if the control unmounts mid-drag (panel switch / tab change).
  useEffect(() => {
    return () => {
      if (!heldRef.current) return;
      heldRef.current = false;
      windowCleanupRef.current?.();
      windowCleanupRef.current = null;
      setHoldAutosave(false);
    };
  }, [setHoldAutosave]);

  return {
    onPointerDown: (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      hold();
    },
    onPointerUp: release,
    onPointerCancel: release,
    onBlur: release,
  };
}
