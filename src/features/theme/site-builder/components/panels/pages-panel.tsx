"use client";

import { useId, useState } from "react";
import { ExternalLink, FileText, GripVertical, Home, Lock, Megaphone, Plus, Settings, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { pageMetaSchema, MAX_POPUPS, MAX_THEME_PAGES } from "@/features/theme/schema/site";
import type { SectionInstance, SectionType } from "@/features/theme/sections/types";
import { useBuilder } from "../../context";
import { addPage, duplicatePage, newPopup, removePage, slugify, updatePageMeta, upsertPopup } from "../../ops";
import { BLANK_TEMPLATE, PAGE_TEMPLATES, type PageTemplate } from "../../page-templates";
import { PAGE_GROUP_LABELS, type BuilderPage, type PageGroup } from "../../pages";
import { Dialog, FieldRow, IconButton, PanelFrame, Row, input, useReorder } from "../ui";

/**
 * Pages & menu panel: a sub-nav of page groups (Pages / eCommerce / Members area / Popups) and the
 * group's pages. Clicking a page loads it in the canvas; the gear opens its settings. Site-builder
 * pages can be reordered, renamed, re-addressed, duplicated and deleted; new ones start from a
 * blank page or a template (page-templates.ts).
 */

const GROUPS: { key: PageGroup; icon: typeof FileText }[] = [
  { key: "pages", icon: FileText },
  { key: "ecommerce", icon: ShoppingBag },
  { key: "members", icon: Lock },
  { key: "popups", icon: Megaphone },
];

export function PagesPanel() {
  const { config, apply, pages, page, setPageKey, setPanel } = useBuilder();
  const [group, setGroup] = useState<PageGroup>(page.group);
  const [settingsFor, setSettingsFor] = useState<BuilderPage | null>(null);
  const [adding, setAdding] = useState(false);

  const list = pages.filter((p) => p.group === group);
  const reorder = useReorder((from, to) =>
    apply((c) => {
      const next = [...c.pages];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it!);
      return { ...c, pages: next };
    }),
  );

  const open = (p: BuilderPage) => {
    setPageKey(p.key);
    if (p.popupId) setPanel({ kind: "popup", popupId: p.popupId });
  };
  const gear = (p: BuilderPage) => {
    if (p.popupId) {
      setPageKey(p.key);
      setPanel({ kind: "popup", popupId: p.popupId });
    } else setSettingsFor(p);
  };
  const addPopup = () => {
    if (config.popups.length >= MAX_POPUPS) return;
    const p = newPopup();
    apply((c) => upsertPopup(c, p));
    setPageKey(`popup:${p.id}`);
    setPanel({ kind: "popup", popupId: p.id });
  };

  const footer =
    group === "pages" ? (
      <Button variant="accent" className="w-full" disabled={config.pages.length >= MAX_THEME_PAGES} onClick={() => setAdding(true)}>
        <Plus />
        Add page
      </Button>
    ) : group === "popups" ? (
      <Button variant="accent" className="w-full" disabled={config.popups.length >= MAX_POPUPS} onClick={addPopup}>
        <Plus />
        Add popup
      </Button>
    ) : undefined;

  return (
    <PanelFrame title="Pages & menu" onClose={() => setPanel(null)} footer={footer}>
      <div className="flex gap-3">
        <nav aria-label="Page groups" className="flex w-24 shrink-0 flex-col gap-1">
          {GROUPS.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              aria-current={group === key ? "true" : undefined}
              onClick={() => setGroup(key)}
              className={cn("flex flex-col items-center gap-1 rounded-lg px-1.5 py-2 text-center text-xs", group === key ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface-secondary hover:text-foreground")}
            >
              <Icon className="size-4" />
              {PAGE_GROUP_LABELS[key]}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1 space-y-1.5">
          {list.length === 0 ? (
            <p className="py-2 text-small text-muted">{group === "popups" ? "No popups yet. Popups can welcome visitors, collect emails or open from a link." : "Nothing here yet."}</p>
          ) : null}
          {list.map((p) => {
            const themeIndex = p.themePageId ? config.pages.findIndex((x) => x.id === p.themePageId) : -1;
            const active = p.key === page.key;
            return (
              <Row key={p.key} active={active} {...(themeIndex >= 0 ? reorder.itemProps(themeIndex) : {})} className="pr-1">
                {themeIndex >= 0 ? (
                  <span {...reorder.handleProps(themeIndex)}>
                    <GripVertical className="size-4" />
                  </span>
                ) : p.key === "home" ? (
                  <Home className="size-4 shrink-0 text-muted" />
                ) : null}
                <button type="button" onClick={() => open(p)} aria-current={active ? "page" : undefined} className="min-w-0 flex-1 truncate text-left">
                  {p.label}
                  {p.popupId && !config.popups.find((x) => x.id === p.popupId)?.enabled ? <span className="ml-1.5 text-xs text-muted">(off)</span> : null}
                </button>
                <IconButton label={`${p.label} settings`} onClick={() => gear(p)}>
                  <Settings />
                </IconButton>
              </Row>
            );
          })}
        </div>
      </div>

      {settingsFor ? <PageSettingsDialog page={settingsFor} onClose={() => setSettingsFor(null)} /> : null}
      <AddPageDialog open={adding} onClose={() => setAdding(false)} />
    </PanelFrame>
  );
}

// -----------------------------------------------------------------------------
// Page settings
// -----------------------------------------------------------------------------

function PageSettingsDialog({ page, onClose }: { page: BuilderPage; onClose: () => void }) {
  const themePage = useBuilder().config.pages.find((p) => p.id === page.themePageId);
  if (!themePage) {
    return (
      <Dialog open onClose={onClose} title={`${page.label} settings`} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
        <div className="space-y-3 text-small">
          <p>
            This is a built-in store page. You can change its sections here in the builder
            {page.settingsHref ? "; its content and details are managed in your dashboard." : "."}
          </p>
          {page.settingsHref ? (
            <a href={page.settingsHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
              Open in dashboard
              <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </div>
      </Dialog>
    );
  }
  return <ThemePageSettings pageId={themePage.id} onClose={onClose} />;
}

function ThemePageSettings({ pageId, onClose }: { pageId: string; onClose: () => void }) {
  const { config, apply, setPageKey, page: current } = useBuilder();
  const src = config.pages.find((p) => p.id === pageId)!;
  const [title, setTitle] = useState(src.title);
  const [handle, setHandle] = useState(src.handle);
  const [seoTitle, setSeoTitle] = useState(src.seoTitle);
  const [seoDescription, setSeoDescription] = useState(src.seoDescription);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const ids = { title: useId(), handle: useId(), seoTitle: useId(), seoDesc: useId() };
  const slug = slugify(handle || title);

  const save = () => {
    const r = pageMetaSchema.safeParse({ id: src.id, handle: slug, title, seoTitle, seoDescription });
    if (!r.success) {
      const next: Record<string, string> = {};
      for (const i of r.error.issues) next[String(i.path[0])] ??= i.message;
      return setErrors(next);
    }
    const { id: _id, ...patch } = r.data;
    apply((c) => updatePageMeta(c, src.id, patch));
    onClose();
  };
  const duplicate = () => {
    const r = duplicatePage(config, src.id);
    if (!r.page) return;
    apply(r.config);
    setPageKey(`theme:${r.page.id}`);
    onClose();
  };
  const remove = () => {
    apply((c) => removePage(c, src.id));
    if (current.themePageId === src.id) setPageKey("home");
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Page settings"
      footer={
        confirmDelete ? (
          <>
            <span className="mr-auto self-center text-small">Delete “{src.title}”? Links to it stop working.</span>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Keep
            </Button>
            <Button variant="danger" onClick={remove}>
              Delete page
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" className="mr-auto text-error" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
            <Button variant="secondary" onClick={duplicate} disabled={config.pages.length >= MAX_THEME_PAGES}>
              Duplicate
            </Button>
            <Button variant="accent" onClick={save}>
              Save
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        <FieldRow label="Page title" htmlFor={ids.title}>
          <input id={ids.title} className={input} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
          {errors.title ? <p className="text-xs text-error">{errors.title}</p> : null}
        </FieldRow>
        <FieldRow label="URL handle" htmlFor={ids.handle} hint={`Address: /pages/${slug}${slug !== src.handle ? " · links to the old address stop working" : ""}`}>
          <div className="flex items-center gap-1">
            <span className="shrink-0 text-small text-muted">/pages/</span>
            <input id={ids.handle} className={input} value={handle} maxLength={60} onChange={(e) => setHandle(e.target.value)} />
          </div>
          {errors.handle ? <p className="text-xs text-error">{errors.handle}</p> : null}
        </FieldRow>
        <FieldRow label="SEO title" htmlFor={ids.seoTitle} hint={`${seoTitle.length}/70 · leave empty to use the page title`}>
          <input id={ids.seoTitle} className={input} value={seoTitle} maxLength={70} onChange={(e) => setSeoTitle(e.target.value)} />
        </FieldRow>
        <FieldRow label="SEO description" htmlFor={ids.seoDesc} hint={`${seoDescription.length}/160`}>
          <textarea id={ids.seoDesc} className={cn(input, "min-h-20 py-2")} value={seoDescription} maxLength={160} onChange={(e) => setSeoDescription(e.target.value)} />
        </FieldRow>
      </div>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// Add page
// -----------------------------------------------------------------------------

function AddPageDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [chosen, setChosen] = useState<PageTemplate | null>(null);
  const close = () => {
    setChosen(null);
    onClose();
  };
  return (
    <Dialog open={open} onClose={close} title={chosen ? `New page: ${chosen.label}` : "Add a page"} wide={!chosen}>
      {chosen ? <NamePage template={chosen} onBack={() => setChosen(null)} onDone={close} /> : <TemplateGrid onPick={setChosen} />}
    </Dialog>
  );
}

function TemplateGrid({ onPick }: { onPick: (t: PageTemplate) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {[BLANK_TEMPLATE, ...PAGE_TEMPLATES].map((t) => (
        <button key={t.key} type="button" onClick={() => onPick(t)} className="group flex flex-col overflow-hidden rounded-lg border border-border bg-surface text-left hover:border-accent focus-visible:border-accent">
          <div className="aspect-[4/5] overflow-hidden border-b border-border bg-surface-secondary p-2">
            <Wireframe sections={t.sections} />
          </div>
          <div className="space-y-0.5 p-2.5">
            <p className="text-small font-medium group-hover:text-accent">{t.label}</p>
            <p className="line-clamp-3 text-xs text-muted">{t.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

function NamePage({ template, onBack, onDone }: { template: PageTemplate; onBack: () => void; onDone: () => void }) {
  const { config, apply, setPageKey } = useBuilder();
  const [title, setTitle] = useState(template.key === "blank" ? "New page" : template.label);
  const [error, setError] = useState("");
  const id = useId();
  const create = () => {
    if (!title.trim()) return setError("Give the page a title");
    const r = addPage(config, title, structuredClone(template.sections));
    if (!r.page) return setError(`A theme can have at most ${MAX_THEME_PAGES} pages`);
    apply(r.config);
    setPageKey(`theme:${r.page.id}`);
    onDone();
  };
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        create();
      }}
    >
      <FieldRow label="Page title" htmlFor={id} hint={`Address: /pages/${slugify(title)} (made unique if it is taken)`}>
        <input id={id} className={input} value={title} maxLength={80} autoFocus onChange={(e) => {
            setTitle(e.target.value);
            setError("");
          }} />
        {error ? <p className="text-xs text-error">{error}</p> : null}
      </FieldRow>
      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button variant="accent" type="submit">
          Create page
        </Button>
      </div>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Template thumbnail: a wireframe drawn from the template's sections (no images).
// -----------------------------------------------------------------------------

const W = 120;
const HEIGHTS: Partial<Record<SectionType, number>> = {
  Hero: 46,
  PromoBanner: 30,
  EditorialImageText: 34,
  BrandStory: 30,
  Testimonials: 26,
  FAQ: 34,
  Newsletter: 22,
  ProductGrid: 34,
  FeatureBand: 34,
  CollectionGrid: 34,
  CategoryGrid: 34,
  Lookbook: 46,
  TrustBadges: 16,
  SocialProof: 30,
  VideoBanner: 40,
  Marquee: 8,
};

function lines(x: number, y: number, widths: number[], h = 2.5) {
  return widths.map((w, i) => <rect key={i} x={x} y={y + i * (h + 2.5)} width={w} height={h} rx={1} />);
}

function block(type: SectionType, y: number, key: string) {
  const g = (children: React.ReactNode, cls = "text-muted/50") => (
    <g key={key} className={cls} fill="currentColor">
      {children}
    </g>
  );
  const row = (n: number, h: number, top = 10) => {
    const gap = 3;
    const w = (W - 8 - gap * (n - 1)) / n;
    return Array.from({ length: n }, (_, i) => <rect key={i} x={4 + i * (w + gap)} y={y + top} width={w} height={h} rx={1.5} />);
  };
  switch (type) {
    case "Hero":
    case "VideoBanner":
      return (
        <g key={key}>
          <rect x={0} y={y} width={W} height={(HEIGHTS[type] ?? 40) - 2} className="text-muted/30" fill="currentColor" />
          <g className="text-surface" fill="currentColor">
            {lines(10, y + 14, [50, 36])}
            <rect x={10} y={y + 28} width={22} height={6} rx={3} />
          </g>
        </g>
      );
    case "PromoBanner":
      return g(<rect x={4} y={y + 2} width={W - 8} height={24} rx={2} />, "text-muted/35");
    case "EditorialImageText":
      return g(
        <>
          <rect x={4} y={y + 2} width={52} height={28} rx={2} className="text-muted/35" />
          {lines(62, y + 7, [44, 50, 38, 28])}
        </>,
      );
    case "BrandStory":
      return g(
        <>
          {lines(30, y + 3, [60, 50, 40])}
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={32 + i * 28} cy={y + 23} r={4} className="text-accent/60" />
          ))}
        </>,
      );
    case "Testimonials":
      return g(
        <>
          {lines(40, y + 2, [40])}
          {row(3, 14, 8)}
        </>,
        "text-muted/40",
      );
    case "FAQ":
      return g(
        <>
          {lines(35, y + 2, [50])}
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={10} y={y + 9 + i * 6} width={W - 20} height={4} rx={1} />
          ))}
        </>,
        "text-muted/40",
      );
    case "Newsletter":
      return g(
        <>
          {lines(40, y + 2, [40])}
          <rect x={25} y={y + 9} width={50} height={7} rx={2} className="text-surface" />
          <rect x={77} y={y + 9} width={18} height={7} rx={2} className="text-accent/70" />
        </>,
        "text-muted/40",
      );
    case "ProductGrid":
    case "FeatureBand":
      return g(
        <>
          {lines(4, y + 2, [36])}
          {row(4, 22, 8)}
        </>,
        "text-muted/40",
      );
    case "CollectionGrid":
    case "CategoryGrid":
      return g(
        <>
          {lines(4, y + 2, [40])}
          {row(3, 24, 8)}
        </>,
        "text-muted/40",
      );
    case "Lookbook":
      return g(
        <>
          {lines(4, y + 2, [30])}
          <rect x={4} y={y + 8} width={36} height={36} rx={2} />
          <rect x={43} y={y + 8} width={34} height={20} rx={2} />
          <rect x={43} y={y + 30} width={34} height={14} rx={2} />
          <rect x={80} y={y + 8} width={36} height={36} rx={2} />
        </>,
        "text-muted/40",
      );
    case "TrustBadges":
      return g(
        <>
          {[0, 1, 2, 3].map((i) => (
            <circle key={i} cx={18 + i * 28} cy={y + 7} r={4} />
          ))}
        </>,
        "text-accent/50",
      );
    case "SocialProof":
      return g(
        <>
          {lines(40, y + 2, [40])}
          {row(4, 20, 8)}
        </>,
        "text-muted/40",
      );
    case "Marquee":
      return g(<rect x={0} y={y + 1} width={W} height={5} />, "text-foreground/60");
    default:
      return g(<rect x={4} y={y + 2} width={W - 8} height={(HEIGHTS[type] ?? 24) - 4} rx={2} />, "text-muted/35");
  }
}

function Wireframe({ sections }: { sections: Omit<SectionInstance, "id">[] }) {
  let y = 12;
  const header = (
    <g key="header" className="text-muted/50" fill="currentColor">
      <rect x={4} y={3} width={18} height={4} rx={1} />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={70 + i * 16} y={4} width={12} height={2} rx={1} />
      ))}
    </g>
  );
  const blocks = sections.map((s, i) => {
    const el = block(s.type, y, `${i}`);
    y += HEIGHTS[s.type] ?? 26;
    return el;
  });
  const total = Math.max(y, 150);
  return (
    <svg viewBox={`0 0 ${W} ${total}`} className="w-full rounded bg-surface" role="img" aria-label={sections.length ? `Layout: ${sections.map((s) => s.type).join(", ")}` : "Empty page"}>
      {header}
      {sections.length ? (
        blocks
      ) : (
        <g className="text-muted/50">
          <rect x={20} y={50} width={80} height={50} rx={3} fill="none" stroke="currentColor" strokeDasharray="3 2" />
          <path d="M60 67v16M52 75h16" stroke="currentColor" strokeWidth={2} />
        </g>
      )}
    </svg>
  );
}
