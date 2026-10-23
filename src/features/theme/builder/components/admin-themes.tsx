"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Eye, Pencil, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/layout";
import { buttonClass } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/form";
import { ActionDialog, InlineAction } from "@/features/settings/ui/action-controls";
import { ThemeMockup } from "../../marketplace/mockup";
import { THEME_STYLE_LABELS, type ThemePreset, type ThemeStyle } from "../../marketplace/types";
import { deleteThemeAction, duplicateThemeAction, setThemePublishedAction } from "../actions";

export type AdminThemeCard = {
  key: string;
  name: string;
  tagline: string;
  industry: string;
  industryLabel: string;
  style: ThemeStyle;
  preset: ThemePreset;
  source: "builtin" | "ai" | "duplicate" | "manual";
  published: boolean;
  updatedAt: string | null;
};

type SourceFilter = "all" | "builtin" | "custom" | "drafts";

/** Duplicate → opens the copy in the editor. */
export function DuplicateThemeButton({ themeKey, label = "Duplicate", variant = "secondary" }: { themeKey: string; label?: string; variant?: "secondary" | "primary" | "ghost" }) {
  const router = useRouter();
  const [state, action] = useActionState(duplicateThemeAction, null);
  useEffect(() => {
    if (state?.ok) router.push(`/admin/themes/${state.data.key}/edit`);
  }, [state, router]);
  return (
    <form action={action} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="key" value={themeKey} />
      <SubmitButton variant={variant} size="sm">
        <Copy aria-hidden className="size-3.5" /> {label}
      </SubmitButton>
      {state && !state.ok ? (
        <span role="alert" className="text-xs text-error">
          {state.error.message}
        </span>
      ) : null}
    </form>
  );
}

export function PublishThemeButton({ themeKey, published }: { themeKey: string; published: boolean }) {
  return <InlineAction action={setThemePublishedAction} fields={{ key: themeKey, publish: published ? "no" : "yes" }} label={published ? "Unpublish" : "Publish"} variant={published ? "secondary" : "primary"} success={published ? "Unpublished." : "Published: sellers can pick it now."} />;
}

export function DeleteThemeButton({ themeKey, name }: { themeKey: string; name: string }) {
  const router = useRouter();
  return (
    <ActionDialog
      action={async (prev, fd) => {
        const res = await deleteThemeAction(prev, fd);
        if (res.ok) router.push("/admin/themes");
        return res;
      }}
      fields={{ key: themeKey, confirm: "yes" }}
      title={`Delete ${name}?`}
      description="The theme leaves the marketplace for good. Stores that already applied it keep their current design."
      triggerLabel="Delete"
      confirmLabel="Delete theme"
      variant="danger"
      success="Deleted."
    >
      {() => null}
    </ActionDialog>
  );
}

export function AdminThemesGrid({ themes, industries }: { themes: AdminThemeCard[]; industries: { slug: string; label: string; count: number }[] }) {
  const [industry, setIndustry] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return themes.filter(
      (t) =>
        (!industry || t.industry === industry) &&
        (source === "all" || (source === "builtin" ? t.source === "builtin" : source === "custom" ? t.source !== "builtin" : t.source !== "builtin" && !t.published)) &&
        (!needle || `${t.name} ${t.tagline} ${t.style} ${t.key}`.toLowerCase().includes(needle)),
    );
  }, [themes, industry, source, q]);
  const chip = (active: boolean) => `inline-flex h-8 items-center gap-1 rounded-full border px-3 text-small ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-surface-secondary"}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <span className="sr-only">Search themes</span>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search themes" className="h-9 w-56 rounded-md border border-border bg-surface pr-3 pl-8 text-small" />
        </label>
        {(["all", "builtin", "custom", "drafts"] as const).map((s) => (
          <button key={s} type="button" className={chip(source === s)} aria-pressed={source === s} onClick={() => setSource(s)}>
            {{ all: "All", builtin: "Built-in", custom: "Custom", drafts: "Drafts" }[s]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Category">
        <button type="button" className={chip(!industry)} aria-pressed={!industry} onClick={() => setIndustry("")}>
          All categories <span className="opacity-70">{themes.length}</span>
        </button>
        {industries.map((i) => (
          <button key={i.slug} type="button" className={chip(industry === i.slug)} aria-pressed={industry === i.slug} onClick={() => setIndustry(i.slug)}>
            {i.label} <span className="opacity-70">{i.count}</span>
          </button>
        ))}
      </div>
      <p className="text-small text-muted" aria-live="polite">
        {shown.length} {shown.length === 1 ? "theme" : "themes"}
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((t) => (
          <li key={t.key} className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
            <Link href={`/admin/themes/${t.key}`} className="block aspect-[4/3] overflow-hidden border-b border-border" aria-label={`Preview ${t.name}`}>
              <ThemeMockup preset={t.preset} name={t.name.split(" ")[0]!} tagline={t.tagline} />
            </Link>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{t.name}</h3>
                  <p className="truncate text-small text-muted">{t.tagline || "—"}</p>
                </div>
                {t.source === "builtin" ? <Badge>Built-in</Badge> : t.published ? <Badge tone="success">Published</Badge> : <Badge tone="warning">Draft</Badge>}
              </div>
              <div className="flex flex-wrap gap-1.5 text-caption text-muted">
                <span>{t.industryLabel}</span>·<span>{THEME_STYLE_LABELS[t.style]}</span>
                {t.source === "ai" ? (
                  <span className="inline-flex items-center gap-1">
                    · <Sparkles aria-hidden className="size-3" /> AI
                  </span>
                ) : null}
              </div>
              <div className="mt-auto flex flex-wrap items-start gap-2 pt-2">
                <Link href={`/admin/themes/${t.key}`} className={buttonClass({ variant: "secondary", size: "sm" })}>
                  <Eye aria-hidden className="size-3.5" /> Preview
                </Link>
                {t.source === "builtin" ? (
                  <DuplicateThemeButton themeKey={t.key} label="Duplicate & edit" />
                ) : (
                  <>
                    <Link href={`/admin/themes/${t.key}/edit`} className={buttonClass({ variant: "secondary", size: "sm" })}>
                      <Pencil aria-hidden className="size-3.5" /> Edit
                    </Link>
                    <DuplicateThemeButton themeKey={t.key} />
                    <PublishThemeButton themeKey={t.key} published={t.published} />
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
