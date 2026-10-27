"use client";

import { useId, useRef } from "react";
import type { SizeChart } from "@/features/storefront/server/catalog";

/** "Size chart" link that opens the product's chart (own or inherited from its category) in a modal dialog. */
export function SizeChartButton({ chart, className = "" }: { chart: SizeChart; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Own wrapper: as a direct child of a space-y-* stack the dialog would get its margins overridden (no centring).
  return (
    <div className={className}>
      <button type="button" className="sf-link inline-flex min-h-8 items-center gap-1.5 text-sm" aria-haspopup="dialog" onClick={() => ref.current?.showModal()}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 8h18v8H3zM7 8v3M11 8v4M15 8v3M19 8v4" />
        </svg>
        Size chart
      </button>
      {/* Clicking the backdrop (the dialog element itself, outside the panel) closes it. */}
      <dialog ref={ref} className="sf-dialog sf-dialog-center" aria-labelledby={titleId} onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}>
        <div className="p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id={titleId} className="sf-heading text-xl">
              {chart.name} <span className="sf-muted block text-sm sm:inline">Measurements in {chart.unit === "cm" ? "centimetres" : "inches"}</span>
            </h2>
            <button type="button" onClick={() => ref.current?.close()} className="sf-btn sf-btn-outline min-h-10 shrink-0 px-3 py-1.5 text-sm" aria-label="Close size chart">
              Close
            </button>
          </div>
          <div className="overflow-x-auto" tabIndex={0} aria-label={`${chart.name} table`}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  {chart.columns.map((c, i) => (
                    <th key={i} scope="col" className="sf-border whitespace-nowrap border-b px-3 py-2">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chart.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((cell, j) =>
                      j === 0 ? (
                        <th key={j} scope="row" className="sf-border whitespace-nowrap border-b px-3 py-2 font-medium">
                          {cell}
                        </th>
                      ) : (
                        <td key={j} className="sf-border whitespace-nowrap border-b px-3 py-2">
                          {cell}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {chart.note ? <p className="sf-muted mt-3 whitespace-pre-line text-xs">{chart.note}</p> : null}
        </div>
      </dialog>
    </div>
  );
}
