"use client";

import { startCopy } from "../copy";

export function LivePreview({
  locale,
  host,
  productCount,
}: {
  locale: string;
  host: string | null;
  productCount?: number;
}) {
  const c = startCopy(locale);
  return (
    <div className="flex h-full min-h-[320px] flex-col gap-2 lg:min-h-[480px]">
      <div className="flex items-center justify-between gap-2 text-sm text-[#5E5568]">
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-[#22C55E]" aria-hidden />
          {c.livePreview}
        </span>
        {productCount !== undefined ? <span className="text-[#6B6275]">{startCopy(locale).products.count(productCount)}</span> : null}
      </div>
      <div className="relative flex flex-1 flex-col overflow-hidden rounded-[20px] border border-[#2A2233]/10 bg-linear-to-br from-[#F4F0FA] to-[#E8EEF8] shadow-inner">
        {host ? (
          <div className="border-b border-[#2A2233]/8 bg-white/70 px-4 py-2 text-center text-xs font-medium text-[#6B6275]">{host}</div>
        ) : null}
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-[#6B6275]">
          {host ? <span className="font-medium text-[#2A2233]">Store preview</span> : <span className="max-w-[200px]">Your storefront will appear here as you build.</span>}
        </div>
      </div>
    </div>
  );
}
