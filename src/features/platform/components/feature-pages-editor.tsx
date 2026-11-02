"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { ExternalLink, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { inputClassName } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import {
  FEATURE_GROUP_LABELS,
  FEATURE_GROUPS,
  type FeatureGroup,
  type FeaturePage,
  type FeaturePagesDocument,
} from "@/features/marketing-site/feature-pages";
import type { StepMediaKind } from "@/features/marketing-site/landing";
import { resetFeaturePagesAction, saveFeaturePagesAction } from "../actions";
import { LandingMediaField } from "./landing-media-field";

function mediaKindFromUrl(url: string): StepMediaKind {
  const u = url.toLowerCase();
  if (/\.mp4(\?|$)/.test(u) || u.includes("video/mp4")) return "video";
  if (/\.gif(\?|$)/.test(u)) return "gif";
  return "image";
}

/**
 * Super-admin CMS for `/features/{slug}` pages. Edits the feature_pages document in memory;
 * Save & publish persists via saveFeaturePagesAction.
 */
export function FeaturePagesEditor({ initial, defaults }: { initial: FeaturePagesDocument; defaults: FeaturePagesDocument }) {
  const [doc, setDoc] = useState<FeaturePagesDocument>(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [group, setGroup] = useState<FeatureGroup>("sell");
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(async (prev: Awaited<ReturnType<typeof saveFeaturePagesAction>> | null, fd: FormData) => {
    const result = await saveFeaturePagesAction(prev, fd);
    if (result.ok) setSaved(String(fd.get("content")));
    return result;
  }, null);
  const [resetState, resetAction, resetting] = useActionState(async (prev: Awaited<ReturnType<typeof resetFeaturePagesAction>> | null, fd: FormData) => {
    const result = await resetFeaturePagesAction(prev, fd);
    if (result.ok) {
      setDoc(defaults);
      setSaved(JSON.stringify(defaults));
      setOpenSlug(null);
    }
    return result;
  }, null);

  const json = useMemo(() => JSON.stringify(doc), [doc]);
  const dirty = json !== saved;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const pagesInGroup = doc.pages.filter((p) => p.group === group).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

  function updatePage(slug: string, next: FeaturePage) {
    setDoc((d) => ({
      pages: d.pages.map((p) => (p.slug === slug ? next : p)),
    }));
  }

  return (
    <div className="grid w-full gap-4 lg:grid-cols-[200px_1fr]">
      <nav aria-label="Feature groups" className="lg:sticky lg:top-4 lg:self-start">
        <ul className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1.5 lg:flex-col lg:overflow-visible">
          {FEATURE_GROUPS.map((g) => {
            const count = doc.pages.filter((p) => p.group === g).length;
            return (
              <li key={g}>
                <button
                  type="button"
                  onClick={() => {
                    setGroup(g);
                    setOpenSlug(null);
                  }}
                  aria-current={group === g ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-small whitespace-nowrap",
                    group === g ? "bg-accent-soft font-semibold text-foreground" : "text-muted hover:bg-surface-secondary hover:text-foreground",
                  )}
                >
                  {FEATURE_GROUP_LABELS[g]}
                  <span className="text-caption text-subtle">{count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0 space-y-4">
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface/95 px-4 py-3 backdrop-blur">
          <p className="text-small text-muted" role="status">
            {dirty ? <span className="font-semibold text-warning">Unsaved changes</span> : "All changes saved. Public pages update within a few minutes."}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <a href="/features" target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-small hover:bg-surface-secondary">
              Features hub <ExternalLink aria-hidden className="size-3.5" />
            </a>
            <form action={formAction}>
              <input type="hidden" name="content" value={json} />
              <Button type="submit" pending={pending} disabled={!dirty}>
                Save & publish
              </Button>
            </form>
          </div>
        </div>
        <FormMessage state={state} success="Saved. Feature pages have been updated." />
        <FormMessage state={resetState} success="Reset to built-in defaults." />

        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">{FEATURE_GROUP_LABELS[group]} features</h2>
            <p className="text-caption text-muted">{pagesInGroup.length} pages · live at /features/&#123;slug&#125;</p>
          </div>
          <ul className="divide-y divide-border rounded-md border border-border">
            {pagesInGroup.map((page) => {
              const open = openSlug === page.slug;
              return (
                <li key={page.slug}>
                  <div className="flex items-center gap-2 px-3 py-2">
                    <button type="button" onClick={() => setOpenSlug(open ? null : page.slug)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 rounded py-1 text-left text-small font-medium hover:text-accent">
                      {page.published ? <Eye aria-hidden className="size-3.5 shrink-0 text-success" /> : <EyeOff aria-hidden className="size-3.5 shrink-0 text-subtle" />}
                      <span className="truncate">{page.title || page.slug}</span>
                      <span className="truncate text-caption font-normal text-muted">/{page.slug}</span>
                    </button>
                    <a href={page.slug === "theme-marketplace" ? "/themes" : `/features/${page.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-secondary hover:text-foreground" aria-label={`Open ${page.title}`}>
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                  {open ? (
                    <div className="border-t border-border bg-surface-secondary/40 p-4">
                      <PageFields page={page} onChange={(next) => updatePage(page.slug, next)} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        <form
          action={resetAction}
          onSubmit={(e) => {
            if (!window.confirm("Reset all feature pages to the built-in English defaults? Your saved CMS copy will be removed.")) e.preventDefault();
          }}
          className="flex justify-end"
        >
          <Button type="submit" variant="secondary" pending={resetting}>
            Reset to defaults
          </Button>
        </form>
      </div>
    </div>
  );
}

function PageFields({ page, onChange }: { page: FeaturePage; onChange: (p: FeaturePage) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Title</span>
        <input value={page.title} onChange={(e) => onChange({ ...page, title: e.target.value })} className={inputClassName} maxLength={80} />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Slug</span>
        <input value={page.slug} readOnly className={cn(inputClassName, "bg-surface-secondary text-muted")} />
        <span className="text-caption text-muted">Slug is fixed so mega-menu links stay stable.</span>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Eyebrow</span>
        <input value={page.eyebrow} onChange={(e) => onChange({ ...page, eyebrow: e.target.value })} className={inputClassName} maxLength={60} />
      </label>
      <label className="grid gap-1 text-sm sm:flex sm:items-end sm:gap-3">
        <span className="flex items-center gap-2 pb-2">
          <input type="checkbox" checked={page.published} onChange={(e) => onChange({ ...page, published: e.target.checked })} className="size-4 rounded border-border" />
          <span className="text-sm font-medium">Published</span>
        </span>
        <span className="grid flex-1 gap-1">
          <span className="font-medium text-sm">Order</span>
          <input
            type="number"
            min={0}
            max={99}
            value={page.order}
            onChange={(e) => onChange({ ...page, order: Math.min(99, Math.max(0, Number(e.target.value) || 0)) })}
            className={cn(inputClassName, "w-24")}
          />
        </span>
      </label>
      <label className="grid gap-1 text-sm sm:col-span-2">
        <span className="font-medium">Summary</span>
        <textarea value={page.summary} onChange={(e) => onChange({ ...page, summary: e.target.value })} rows={2} maxLength={280} className={cn(inputClassName, "min-h-[4.5rem] py-2")} />
      </label>
      <label className="grid gap-1 text-sm sm:col-span-2">
        <span className="font-medium">Body</span>
        <textarea value={page.body} onChange={(e) => onChange({ ...page, body: e.target.value })} rows={5} maxLength={4000} className={cn(inputClassName, "min-h-[8rem] py-2")} />
      </label>
      <label className="grid gap-1 text-sm sm:col-span-2">
        <span className="font-medium">Bullets (one per line, max 8)</span>
        <textarea
          value={page.bullets.join("\n")}
          onChange={(e) =>
            onChange({
              ...page,
              bullets: e.target.value
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean)
                .slice(0, 8),
            })
          }
          rows={4}
          className={cn(inputClassName, "min-h-[6rem] py-2 font-mono text-xs")}
        />
      </label>
      <LandingMediaField
        value={{
          imageUrl: page.infographicUrl,
          imageAlt: page.infographicAlt,
          mediaKind: mediaKindFromUrl(page.infographicUrl),
          posterUrl: "",
        }}
        onChange={(v) => onChange({ ...page, infographicUrl: v.imageUrl, infographicAlt: v.imageAlt })}
      />
      <label className="grid gap-1 text-sm">
        <span className="font-medium">SEO title</span>
        <input value={page.seoTitle} onChange={(e) => onChange({ ...page, seoTitle: e.target.value })} className={inputClassName} maxLength={80} />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">SEO description</span>
        <input value={page.seoDescription} onChange={(e) => onChange({ ...page, seoDescription: e.target.value })} className={inputClassName} maxLength={200} />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">CTA label</span>
        <input value={page.ctaLabel} onChange={(e) => onChange({ ...page, ctaLabel: e.target.value })} className={inputClassName} maxLength={60} />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">CTA link</span>
        <input value={page.ctaHref} onChange={(e) => onChange({ ...page, ctaHref: e.target.value })} className={inputClassName} maxLength={300} />
      </label>
    </div>
  );
}
