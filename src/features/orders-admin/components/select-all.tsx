"use client";

/** Header checkbox that ticks every `name` checkbox in its form (the orders list's bulk print selection). */
export function SelectAllCheckbox({ name, label }: { name: string; label: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      onChange={(e) => {
        for (const box of e.currentTarget.form?.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="${name}"]`) ?? []) box.checked = e.currentTarget.checked;
      }}
    />
  );
}
