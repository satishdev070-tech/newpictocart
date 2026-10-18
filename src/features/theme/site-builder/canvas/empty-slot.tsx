"use client";

/**
 * Theme preview only: shown in place of an EMPTY page section list (a new blank page, an empty
 * home template, a content-page template with no sections) so the canvas still offers a "+".
 * Clicking asks the CanvasBridge (which owns the postMessage channel) to open the builder's
 * section picker for `slot`. Outside the builder canvas it is inert and hidden.
 */

export const EMPTY_SLOT_INSERT_EVENT = "pc:builder-empty-insert";

export function EmptySlotInsert({ slot, label }: { slot: string; label: string }) {
  return (
    <div className="hidden py-16 [[data-builder-canvas]_&]:block" data-builder-empty-slot={slot}>
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[#f97316]/50 px-6 py-10 text-center font-sans text-sm text-[#57534e]">
        <p>{label}</p>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent(EMPTY_SLOT_INSERT_EVENT, { detail: { slot } }))}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#f97316] px-4 py-2 font-medium text-white shadow-sm hover:bg-[#ea580c]"
        >
          <span aria-hidden>+</span> Add a section
        </button>
      </div>
    </div>
  );
}
