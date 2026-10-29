import type { CSSProperties, ElementType, ReactNode } from "react";
import {
  textLookAttrs,
  textLookStyle,
  type TextLook,
  type TextRole,
} from "@/features/theme/schema/text-style";

/**
 * Applies a structured TextLook as inline styles + data attributes for canvas text-box chrome.
 * Storefront and builder preview share this so overrides stay in sync.
 */

export function lookOf(raw: unknown): TextLook | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  return raw as TextLook;
}

type BoxProps = {
  role: TextRole;
  look?: TextLook | null;
  /** Slide / list index when the text lives on a list item (Hero slides). */
  itemIndex?: number;
  className?: string;
  style?: CSSProperties;
  as?: ElementType;
  children: ReactNode;
};

/** Wraps copy with look styles and `data-pc-text` hooks for the builder canvas. */
export function TextBox({ role, look, itemIndex, className, style, as: Tag = "div", children }: BoxProps) {
  const lookStyle = textLookStyle(look);
  const attrs = textLookAttrs(role, look, itemIndex);
  return (
    <Tag className={className} style={lookStyle || style ? { ...lookStyle, ...style } : undefined} {...attrs}>
      {children}
    </Tag>
  );
}

/** Style + attrs only (when the host element is already chosen, e.g. a heading tag). */
export function textBoxProps(
  role: TextRole,
  look: TextLook | undefined | null,
  itemIndex?: number,
): { style?: CSSProperties; attrs: Record<string, string> } {
  return { style: textLookStyle(look), attrs: textLookAttrs(role, look, itemIndex) };
}
