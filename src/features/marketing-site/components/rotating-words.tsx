"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Hero headline word that types itself out and cycles ("Home Bakers" → "Boutiques" …), as on the
 * earlier pictocart.in. Screen readers get the full list once; people who ask their system to
 * reduce motion see whole words swap instead of typing.
 */
export function RotatingWords({ words }: { words: string[] }) {
  const list = useMemo(() => words.filter(Boolean), [words]);
  const [index, setIndex] = useState(0);
  const [chars, setChars] = useState(list[0]?.length ?? 0);
  const [deleting, setDeleting] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (list.length < 2) return;
    if (reduced) {
      const t = setTimeout(() => setIndex((i) => (i + 1) % list.length), 2600);
      return () => clearTimeout(t);
    }
    const word = list[index] ?? "";
    const full = !deleting && chars >= word.length;
    const t = setTimeout(
      () => {
        if (full) setDeleting(true);
        else if (deleting && chars <= 0) {
          setDeleting(false);
          setIndex((i) => (i + 1) % list.length);
        } else setChars((c) => c + (deleting ? -1 : 1));
      },
      full ? 1800 : deleting ? 45 : 85,
    );
    return () => clearTimeout(t);
  }, [chars, deleting, index, list, reduced]);

  const word = list[index] ?? "";
  const shown = list.length < 2 || reduced ? word : word.slice(0, chars);
  return (
    <>
      <span className="sr-only">{list.join(", ")}</span>
      <span aria-hidden className="text-[#34d399]">
        {shown}
        <span className="ml-1 inline-block h-[0.85em] w-[3px] animate-pulse rounded-full bg-[#34d399]/80 motion-reduce:hidden" />
      </span>
    </>
  );
}
