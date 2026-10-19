"use client";

import { useRef, useState } from "react";
import { Eye, List, Pilcrow, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClassName } from "@/components/ui/field";
import { parseProductDescription } from "@/features/catalog/product-description";

type EditorMode = "write" | "preview";

/**
 * A lightweight authoring aid for product copy. It intentionally stores only plain text:
 * line breaks describe paragraphs, short title-cased lines are headings, and `• ` lines
 * become bullet lists on the storefront. This keeps the product schema and public renderer
 * safe while providing the familiar write/preview workflow sellers expect.
 */
export function ProductDescriptionEditor({ id, value, onChange, maxLength = 20_000 }: { id: string; value: string; onChange: (next: string) => void; maxLength?: number }) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<EditorMode>("write");
  const hintId = `${id}-hint`;

  const setValue = (next: string) => onChange(next.slice(0, maxLength));
  const focusAt = (start: number, end = start) => {
    requestAnimationFrame(() => {
      textarea.current?.focus();
      textarea.current?.setSelectionRange(start, end);
    });
  };
  const replace = (start: number, end: number, next: string, selection?: { start: number; end: number }) => {
    const valueAfter = `${value.slice(0, start)}${next}${value.slice(end)}`.slice(0, maxLength);
    setValue(valueAfter);
    const defaultPosition = Math.min(start + next.length, valueAfter.length);
    focusAt(selection?.start ?? defaultPosition, selection?.end ?? defaultPosition);
  };
  const selection = () => {
    const field = textarea.current;
    return { start: field?.selectionStart ?? value.length, end: field?.selectionEnd ?? value.length };
  };

  const addParagraph = () => {
    const { end } = selection();
    // Never replace a selected sentence just to start the next paragraph; put the
    // paragraph break after it, matching the behaviour of pressing Enter twice.
    const position = end;
    const spacing = value.slice(0, position).endsWith("\n\n") ? "" : "\n\n";
    replace(position, position, spacing);
  };

  const addHeading = () => {
    const { start, end } = selection();
    const selected = value.slice(start, end).trim();
    const heading = selected || "Section heading";
    const before = value.slice(0, start);
    const after = value.slice(end);
    const prefix = before && !before.endsWith("\n\n") ? "\n\n" : "";
    const suffix = after && !after.startsWith("\n\n") ? "\n\n" : "";
    const next = `${prefix}${heading}${suffix}`;
    const headingStart = start + prefix.length;
    replace(start, end, next, { start: headingStart, end: headingStart + heading.length });
  };

  const toggleBullets = () => {
    const { start, end } = selection();
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const nextLine = value.indexOf("\n", end);
    const lineEnd = nextLine === -1 ? value.length : nextLine;
    const selectedLines = value.slice(lineStart, lineEnd);
    if (!selectedLines.trim()) {
      replace(start, end, "• ");
      return;
    }
    const nonEmpty = selectedLines.split("\n").filter((line) => line.trim());
    const remove = nonEmpty.length > 0 && nonEmpty.every((line) => /^\s*[•·*-]\s+/.test(line));
    const formatted = selectedLines
      .split("\n")
      .map((line) => {
        if (!line.trim()) return line;
        if (remove) return line.replace(/^(\s*)[•·*-]\s+/, "$1");
        const indent = line.match(/^\s*/)?.[0] ?? "";
        return `${indent}• ${line.trim()}`;
      })
      .join("\n");
    replace(lineStart, lineEnd, formatted, { start: lineStart, end: lineStart + formatted.length });
  };

  const preview = parseProductDescription(value);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-secondary/60 px-2 py-2">
        <div role="tablist" aria-label="Description editor mode" className="flex items-center gap-1">
          <Button type="button" role="tab" aria-selected={mode === "write"} aria-controls={`${id}-write`} variant={mode === "write" ? "secondary" : "ghost"} size="sm" onClick={() => setMode("write")}>
            <Pilcrow aria-hidden /> Write
          </Button>
          <Button type="button" role="tab" aria-selected={mode === "preview"} aria-controls={`${id}-preview`} variant={mode === "preview" ? "secondary" : "ghost"} size="sm" onClick={() => setMode("preview")}>
            <Eye aria-hidden /> Preview
          </Button>
        </div>
        {mode === "write" ? (
          <div aria-label="Plain-text formatting" className="flex flex-wrap gap-1">
            <Button type="button" size="sm" variant="ghost" title="Add a short, title-cased heading" onClick={addHeading}>
              <Type aria-hidden /> Heading
            </Button>
            <Button type="button" size="sm" variant="ghost" title="Add or remove bullets for the selected lines" onClick={toggleBullets}>
              <List aria-hidden /> Bullets
            </Button>
            <Button type="button" size="sm" variant="ghost" title="Start a new paragraph" onClick={addParagraph}>
              <Pilcrow aria-hidden /> Paragraph
            </Button>
          </div>
        ) : null}
      </div>

      {mode === "write" ? (
        <div id={`${id}-write`} role="tabpanel" className="p-2">
          <textarea
            ref={textarea}
            id={id}
            className={`${inputClassName} min-h-56 resize-y border-0 shadow-none focus:ring-0`}
            rows={9}
            value={value}
            maxLength={maxLength}
            aria-describedby={hintId}
            placeholder="Describe what makes this product useful, special, and easy to choose."
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
      ) : (
        <div id={`${id}-preview`} role="tabpanel" className="min-h-56 p-5 text-sm leading-6 text-foreground">
          {preview.length ? (
            <div className="space-y-3">
              {preview.map((block, index) =>
                block.kind === "ul" ? (
                  <ul key={index} className="list-disc space-y-1.5 pl-5 marker:text-accent">
                    {block.items.map((item, itemIndex) => (
                      <li key={itemIndex}>{item}</li>
                    ))}
                  </ul>
                ) : block.kind === "h" ? (
                  <p key={index} className="pt-1 font-semibold text-foreground">
                    {block.text}
                  </p>
                ) : (
                  <p key={index}>{block.text}</p>
                ),
              )}
            </div>
          ) : (
            <p className="text-muted">Your formatted product description will appear here.</p>
          )}
        </div>
      )}
      <p id={hintId} className="border-t border-border px-3 py-2 text-xs text-muted">
        Plain text only: use blank lines for paragraphs, a short title-cased line for a heading, and • for bullets. {value.length.toLocaleString()} / {maxLength.toLocaleString()} characters.
      </p>
    </div>
  );
}
