import type { CSSProperties, ElementType, ReactNode } from "react";
import {
  textLookAttrs,
  textLookStyle,
  type TextLook,
  type TextRole,
} from "@/features/theme/schema/text-style";
import { HeadingText, headingClass, type HeadingStyle } from "./parts";

/**
 * Applies a structured TextLook as inline styles + data attributes for canvas text-box chrome.
 * Storefront and builder preview share this so overrides stay in sync.
 */

export function lookOf(raw: unknown): TextLook | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  return raw as TextLook;
}

/**
 * Tailwind `!text-current` sets `color: currentColor !important`, which beats an inline
 * `look.color`. Only apply it when the seller has not set a look colour.
 */
export function textCurrentClass(look?: TextLook | null): string {
  return look?.color ? "" : "!text-current";
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

/** Intro block with per-role TextLook (sections that share headingFields). */
export type SectionIntroProps = {
  eyebrow?: string;
  heading?: string;
  subheading?: string;
  accent?: string;
  headingStyle?: HeadingStyle;
  note?: string;
  action?: ReactNode;
  eyebrowLook?: TextLook | null;
  headingLook?: TextLook | null;
  subheadingLook?: TextLook | null;
};

/** Intro props (+ looks) from a section's shared heading settings. */
export function hpLooks(s: {
  eyebrow: string;
  heading: string;
  subheading: string;
  headingAccent?: string;
  headingStyle?: HeadingStyle;
  headingNote?: string;
  eyebrowLook?: unknown;
  headingLook?: unknown;
  subheadingLook?: unknown;
}): SectionIntroProps {
  return {
    eyebrow: s.eyebrow,
    heading: s.heading,
    subheading: s.subheading,
    accent: s.headingAccent,
    headingStyle: s.headingStyle,
    note: s.headingNote,
    eyebrowLook: lookOf(s.eyebrowLook),
    headingLook: lookOf(s.headingLook),
    subheadingLook: lookOf(s.subheadingLook),
  };
}

/** Same layout as `Intro` in parts.tsx, with TextBox + look styles on title copy. */
export function SectionIntro({
  eyebrow,
  heading,
  subheading,
  accent,
  headingStyle,
  note,
  action,
  eyebrowLook,
  headingLook,
  subheadingLook,
}: SectionIntroProps) {
  if (!eyebrow && !heading && !subheading && !action && !note) return null;
  return (
    <div className="sf-intro mb-8 flex flex-col gap-2 @[48rem]:flex-row @[48rem]:items-end @[48rem]:justify-between">
      <div className="max-w-2xl space-y-2">
        {eyebrow ? (
          <TextBox role="eyebrow" look={eyebrowLook} as="p" className="sf-eyebrow">
            {eyebrow}
          </TextBox>
        ) : null}
        {heading ? (
          <TextBox role="heading" look={headingLook} as="h2" className={headingClass(headingStyle, "sf-heading text-3xl @[64rem]:text-4xl")}>
            {accent ? <HeadingText heading={heading} accent={accent} /> : heading}
          </TextBox>
        ) : null}
        {subheading ? (
          <TextBox role="subheading" look={subheadingLook} as="p" className="sf-muted">
            {subheading}
          </TextBox>
        ) : null}
      </div>
      {action}
      {note ? <p className="sf-intro-note">{note}</p> : null}
    </div>
  );
}
