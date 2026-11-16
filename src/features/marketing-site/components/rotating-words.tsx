"use client";

import { useEffect, useMemo, useState } from "react";
import { useHeroSync } from "./hero-sync";

/**
 * Hero headline word that types itself out and cycles ("Home Bakers" → "Boutiques" …), as on the
 * earlier pictocart.in. Screen readers get the full list once; people who ask their system to
 * reduce motion see whole words swap instead of typing. Inside a HeroSyncProvider the current word
 * is shared with the theme screenshots, so they change together (and a dot click re-types).
 */
export function RotatingWords({ words }: { words: string[] }) {
  const list = useMemo(() => words.filter(Boolean), [words]);
  const sync = useHeroSync();
  const [localIndex, setLocalIndex] = useState(0);
  const index = (sync ? sync.index : localIndex) % Math.max(list.length, 1);
  const setIndex = sync ? sync.setIndex : setLocalIndex;
  const [chars, setChars] = useState(list[0]?.length ?? 0);
  const [deleting, setDeleting] = useState(false);
  const [reduced, setReduced] = useState(false);
  // Index changed (by the typing loop or a dot click): start typing the new word from scratch.
  const [typingFor, setTypingFor] = useState(index);
  if (typingFor !== index) {
    setTypingFor(index);
    setChars(0);
    setDeleting(false);
  }

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (list.length < 2) return;
    if (reduced) {
      const t = setTimeout(() => setIndex((index + 1) % list.length), 3200);
      return () => clearTimeout(t);
    }
    const word = list[index] ?? "";
    const full = !deleting && chars >= word.length;
    const t = setTimeout(
      () => {
        if (full) setDeleting(true);
        else if (deleting && chars <= 0) setIndex((index + 1) % list.length);
        else setChars((c) => c + (deleting ? -1 : 1));
      },
      full ? 2400 : deleting ? 40 : 80,
    );
    return () => clearTimeout(t);
  }, [chars, deleting, index, list, reduced, setIndex]);

  const word = list[index] ?? "";
  const shown = list.length < 2 || reduced ? word : word.slice(0, chars);
  return (
    <>
      <span className="sr-only">{list.join(", ")}</span>
      <span aria-hidden className="text-mk-accent underline decoration-mk-accent/40 decoration-[0.06em] underline-offset-[0.12em]">
        {shown}
        <span className="ml-1 inline-block h-[0.85em] w-[3px] animate-pulse rounded-sm bg-mk-accent motion-reduce:hidden" />
      </span>
    </>
  );
}
