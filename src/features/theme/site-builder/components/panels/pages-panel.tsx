"use client";

import { useId, useState, useTransition } from "react";
import { ExternalLink, FileText, GripVertical, Home, Lock, Megaphone, Plus, Settings, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { BUILTIN_TITLE_DEFAULTS, builtinTitlesSchema, pageMetaSchema, MAX_POPUPS, MAX_THEME_PAGES, type BuiltinTitleKey } from "@/features/theme/schema/site";
import type { SectionInstance, SectionType } from "@/features/theme/sections/types";
import { renameContentPageAction } from "@/features/content/actions";
import { useBuilder } from "../../context";
import { addPage, duplicatePage, newPopup, removePage, slugify, uniqueHandle, updatePageMeta, upsertPopup } from "../../ops";
import { headerMenu, menuParentIndex, nestPageInMenu, pageLink, setBuiltinTitle, setHomePage } from "../../page-ops";
import { BLANK_TEMPLATE, PAGE_TEMPLATE_FAMILY_LABELS, PAGE_TEMPLATE_FAMILY_ORDER, PAGE_TEMPLATES, type PageTemplate } from "../../page-templates";
import { PAGE_GROUP_LABELS, type BuilderPage, type PageGroup } from "../../pages";
import { ImageField } from "../fields";
import { Dialog, FieldRow, IconButton, MoreMenu, PanelFrame, Row, Toggle, input, useReorder } from "../ui";

/**
 * Pages & menu panel: a sub-nav of page groups (Pages / eCommerce / Members area / Popups) and the
 * group's pages. Clicking a page loads it in the canvas. Each page row has a ⋮ menu:
 *  - site-builder pages: SEO & page setup · Rename · Set as subitem · Set as homepage · Duplicate · Delete
 *  - the Home row: the homepage's own actions when a page is set as homepage (config.homePageId)
 *  - Blog: Manage blog · Rename; Contact / FAQ: Rename · Set as subitem; content pages: Set as subitem
 *    (the store's Contact content page is merged into the Contact row; Rename there renames both)
 * Site-builder pages can be reordered by dragging; new ones start from a blank page or a template
 * (page-templates.ts) via "Add new page" pinned at the bottom.
 */

const GROUPS: { key: PageGroup; icon: typeof FileText }[] = [
  { key: "pages", icon: FileText },
  { key: "ecommerce", icon: ShoppingBag },
  { key: "members", icon: Lock },
  { key: "popups", icon: Megaphone },
];

type PageDialog = { kind: "seo" | "rename" | "subitem" | "delete" | "info"; page: BuilderPage };
type MenuItem = { label: string; onSelect: () => void; danger?: boolean; disabled?: boolean };

const BUILTIN_RENAMABLE = new Set<string>(["blog", "contact", "faq"]);
const openTab = (href: string) => window.open(href, "_blank", "noopener,noreferrer");

export function PagesPanel() {
  const { config, apply, pages, page, setPageKey, setPanel, pageSources } = useBuilder();
  const [group, setGroup] = useState<PageGroup>(page.group);
  const [dialog, setDialog] = useState<PageDialog | null>(null);
  const [adding, setAdding] = useState(false);
  const reserved = pageSources.contentPages.map((p) => p.slug);

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
    } else setDialog({ kind: "info", page: p });
  };
  const addPopup = () => {
    if (config.popups.length >= MAX_POPUPS) return;
    const p = newPopup();
    apply((c) => upsertPopup(c, p));
    setPageKey(`popup:${p.id}`);
    setPanel({ kind: "popup", popupId: p.id });
  };
  const duplicate = (themePageId: string) => {
    const r = duplicatePage(config, themePageId, reserved);
    if (!r.page) return;
    apply(r.config);
    setPageKey(`theme:${r.page.id}`);
  };
  const makeHome = (themePageId: string) => {
    apply((c) => setHomePage(c, themePageId));
    setPageKey("home");
  };
  const unsetHome = () => {
    const id = config.homePageId;
    apply((c) => setHomePage(c, null));
    if (id) setPageKey(`theme:${id}`);
  };

  /** The ⋮ menu for a row in the Pages group. */
  const menuFor = (p: BuilderPage): MenuItem[] => {
    const d = (kind: PageDialog["kind"]) => () => setDialog({ kind, page: p });
    const isHome = p.key === "home";
    if (p.themePageId) {
      return [
        { label: "SEO & page setup", onSelect: d("seo") },
        { label: "Rename", onSelect: d("rename") },
        ...(isHome ? [] : [{ label: "Set as subitem", onSelect: d("subitem") }]),
        isHome ? { label: "Use the original home page", onSelect: unsetHome } : { label: "Set as homepage", onSelect: () => makeHome(p.themePageId!) },
        { label: "Duplicate page", onSelect: () => duplicate(p.themePageId!), disabled: config.pages.length >= MAX_THEME_PAGES },
        { label: "Delete page", onSelect: d("delete"), danger: true },
      ];
    }
    if (isHome) return [{ label: "Page setup", onSelect: d("info") }];
    if (p.key === "blog") {
      return [
        { label: "Manage blog", onSelect: () => openTab("/dashboard/content/blog") },
        { label: "Rename", onSelect: d("rename") },
        { label: "Set as subitem", onSelect: d("subitem") },
      ];
    }
    const items: MenuItem[] = [];
    if (BUILTIN_RENAMABLE.has(p.key)) items.push({ label: "Rename", onSelect: d("rename") });
    if (pageLink(config, p)) items.push({ label: "Set as subitem", onSelect: d("subitem") });
    if (p.settingsHref) items.push({ label: "Edit in dashboard", onSelect: () => openTab(p.settingsHref!) });
    return items.length ? items : [{ label: "Page setup", onSelect: d("info") }];
  };

  const footer =
    group === "pages" ? (
      <Button variant="accent" className="w-full" disabled={config.pages.length >= MAX_THEME_PAGES} onClick={() => setAdding(true)}>
        <Plus />
        Add new page
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
            const isHome = p.key === "home";
            const themeIndex = p.themePageId && !isHome ? config.pages.findIndex((x) => x.id === p.themePageId) : -1;
            const active = p.key === page.key;
            return (
              <Row key={p.key} active={active} {...(themeIndex >= 0 ? reorder.itemProps(themeIndex) : {})} className="pr-1">
                {themeIndex >= 0 ? (
                  <span {...reorder.handleProps(themeIndex)}>
                    <GripVertical className="size-4" />
                  </span>
                ) : isHome ? (
                  <Home className="size-4 shrink-0 text-muted" aria-label="Homepage" />
                ) : null}
                <button type="button" onClick={() => open(p)} aria-current={active ? "page" : undefined} className="min-w-0 flex-1 truncate text-left">
                  {p.label}
                  {isHome && p.themePageId ? <span className="ml-1.5 text-xs text-muted">(homepage)</span> : null}
                  {p.popupId && !config.popups.find((x) => x.id === p.popupId)?.enabled ? <span className="ml-1.5 text-xs text-muted">(off)</span> : null}
                </button>
                {group === "pages" ? (
                  <MoreMenu label={`${p.label} options`} items={menuFor(p)} />
                ) : (
                  <IconButton label={`${p.label} settings`} onClick={() => gear(p)}>
                    <Settings />
                  </IconButton>
                )}
              </Row>
            );
          })}
        </div>
      </div>

      {dialog?.kind === "info" ? <BuiltinInfoDialog page={dialog.page} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "seo" && dialog.page.themePageId ? <SeoDialog pageId={dialog.page.themePageId} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "rename" ? <RenameDialog page={dialog.page} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "subitem" ? <SubitemDialog page={dialog.page} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "delete" && dialog.page.themePageId ? <DeleteDialog pageId={dialog.page.themePageId} onClose={() => setDialog(null)} /> : null}
      <AddPageDialog open={adding} onClose={() => setAdding(false)} />
    </PanelFrame>
  );
}

// -----------------------------------------------------------------------------
// Built-in page info (eCommerce / members pages, the home template)
// -----------------------------------------------------------------------------

function BuiltinInfoDialog({ page, onClose }: { page: BuilderPage; onClose: () => void }) {
  const home = page.key === "home";
  const templateLike = page.group === "ecommerce" || page.group === "members" || page.key === "contact" || page.key === "faq" || page.key === "blog";
  return (
    <Dialog open onClose={onClose} title={`${page.label} settings`} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <div className="space-y-3 text-small">
        <p>
          This is a built-in store page. You can change its sections here in the builder
          {page.settingsHref ? "; its content and details are managed in your dashboard." : "."}
        </p>
        {templateLike ? (
          <p className="text-muted">
            Click a section on the canvas (or open Layers) to use the same Edit · Change design · Settings · Colours panel as on the home page. Add sections above or below the page&apos;s own content marker.
          </p>
        ) : null}
        {home ? <p className="text-muted">To use one of your own pages as the homepage, open its ⋮ menu and choose “Set as homepage”. The store’s search title and description are in Settings → SEO.</p> : null}
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

// -----------------------------------------------------------------------------
// SEO & page setup
// -----------------------------------------------------------------------------

function SeoDialog({ pageId, onClose }: { pageId: string; onClose: () => void }) {
  const { config, apply, pageSources, store } = useBuilder();
  const reserved = pageSources.contentPages.map((p) => p.slug);
  const src = config.pages.find((p) => p.id === pageId);
  const [title, setTitle] = useState(src?.title ?? "");
  const [handle, setHandle] = useState(src?.handle ?? "");
  const [seoTitle, setSeoTitle] = useState(src?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(src?.seoDescription ?? "");
  const [socialImagePath, setSocialImagePath] = useState(src?.socialImagePath ?? "");
  const [noindex, setNoindex] = useState(src?.noindex ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const ids = { title: useId(), handle: useId(), seoTitle: useId(), seoDesc: useId(), image: useId() };
  if (!src) return null;
  const slug = slugify(handle || title);
  const isHome = config.homePageId === src.id;

  const save = () => {
    const r = pageMetaSchema.safeParse({ id: src.id, handle: slug, title, seoTitle, seoDescription, socialImagePath, noindex });
    if (!r.success) {
      const next: Record<string, string> = {};
      for (const i of r.error.issues) next[String(i.path[0])] ??= i.message;
      return setErrors(next);
    }
    const { id: _id, ...patch } = r.data;
    apply((c) => updatePageMeta(c, src.id, patch, reserved));
    onClose();
  };

  const host = (() => {
    try {
      return new URL(store.origin).host;
    } catch {
      return store.origin;
    }
  })();
  const previewTitle = seoTitle || title || "Page title";

  return (
    <Dialog
      open
      onClose={onClose}
      title="SEO & page setup"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FieldRow label="Page title" htmlFor={ids.title} hint="Shown in the Pages list and menus.">
          <input id={ids.title} className={input} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
          {errors.title ? <p className="text-xs text-error">{errors.title}</p> : null}
        </FieldRow>
        <FieldRow label="URL handle" htmlFor={ids.handle} hint={`Address: /pages/${slug}${isHome ? " (also shown at / as your homepage)" : ""}${slug !== src.handle ? " · links to the old address stop working" : ""}`}>
          <div className="flex items-center gap-1">
            <span className="shrink-0 text-small text-muted">/pages/</span>
            <input id={ids.handle} className={input} value={handle} maxLength={60} onChange={(e) => setHandle(e.target.value)} />
          </div>
          {errors.handle ? <p className="text-xs text-error">{errors.handle}</p> : null}
        </FieldRow>
        <FieldRow label="SEO title" htmlFor={ids.seoTitle} hint={`${seoTitle.length}/70 · leave empty to use the page title`}>
          <input id={ids.seoTitle} className={input} value={seoTitle} maxLength={70} onChange={(e) => setSeoTitle(e.target.value)} />
          {errors.seoTitle ? <p className="text-xs text-error">{errors.seoTitle}</p> : null}
        </FieldRow>
        <FieldRow label="SEO description" htmlFor={ids.seoDesc} hint={`${seoDescription.length}/160`}>
          <textarea id={ids.seoDesc} className={cn(input, "min-h-20 py-2")} value={seoDescription} maxLength={160} onChange={(e) => setSeoDescription(e.target.value)} />
          {errors.seoDescription ? <p className="text-xs text-error">{errors.seoDescription}</p> : null}
        </FieldRow>
        <div className="rounded-lg border border-border bg-surface-secondary/50 p-3" aria-label="Search result preview">
          <p className="truncate text-xs text-muted">
            {host}/pages/{slug}
          </p>
          <p className="truncate text-body font-medium text-[#1a0dab] dark:text-[#8ab4f8]">{previewTitle}</p>
          <p className="line-clamp-2 text-xs text-muted">{seoDescription || "Add a description to control what search results show under the title."}</p>
        </div>
        <div>
          <ImageField id={ids.image} label="Social share image" value={socialImagePath} onChange={setSocialImagePath} />
          <p className="mt-1 text-xs text-muted">Shown when the page is shared on WhatsApp, Facebook or X. Empty = your store’s default.</p>
          {errors.socialImagePath ? <p className="text-xs text-error">{errors.socialImagePath}</p> : null}
        </div>
        <Toggle checked={noindex} onChange={setNoindex} label="Hide this page from search engines" />
      </div>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// Rename
// -----------------------------------------------------------------------------

function RenameDialog({ page, onClose }: { page: BuilderPage; onClose: () => void }) {
  const { config, apply } = useBuilder();
  const themePage = page.themePageId ? config.pages.find((p) => p.id === page.themePageId) : undefined;
  const builtinKey = !themePage && BUILTIN_RENAMABLE.has(page.key) ? (page.key as BuiltinTitleKey) : null;
  const [title, setTitle] = useState(themePage?.title ?? (builtinKey ? config.builtinTitles[builtinKey] || page.label : page.label));
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const id = useId();

  const save = () => {
    if (themePage) {
      const r = pageMetaSchema.shape.title.safeParse(title);
      if (!r.success) return setError(r.error.issues[0]?.message ?? "Check the title");
      apply((c) => updatePageMeta(c, themePage.id, { title: r.data }));
    } else if (builtinKey) {
      const r = builtinTitlesSchema.safeParse({ ...config.builtinTitles, [builtinKey]: title });
      if (!r.success) return setError(r.error.issues[0]?.message ?? "Check the title");
      const value = r.data[builtinKey];
      // The merged Contact row is also a content page (/pages/contact, where menus usually link):
      // rename it too, or the store keeps showing the old name there.
      if (page.contentPageId && value) {
        const contentPageId = page.contentPageId;
        return startTransition(async () => {
          const res = await renameContentPageAction({ id: contentPageId, title: value });
          if (!res.ok) return setError(res.error.message);
          apply((c) => setBuiltinTitle(c, builtinKey, value));
          onClose();
        });
      }
      apply((c) => setBuiltinTitle(c, builtinKey, value));
    }
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Rename “${page.label}”`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" type="submit" form={`${id}-form`} pending={pending}>
            Save
          </Button>
        </>
      }
    >
      <form
        id={`${id}-form`}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <FieldRow
          label="Page name"
          htmlFor={id}
          hint={
            builtinKey
              ? page.contentPageId
                ? "Shown as the page heading on your store. Also renames this page in Content → Pages (saved right away); the address stays the same."
                : `Shown as the page heading on your store. Leave empty for “${BUILTIN_TITLE_DEFAULTS[builtinKey]}”.`
              : "The address stays the same; change it in SEO & page setup."
          }
        >
          <input
            id={id}
            className={input}
            value={title}
            maxLength={themePage ? 80 : 60}
            autoFocus
            onChange={(e) => {
              setTitle(e.target.value);
              setError("");
            }}
          />
          {error ? <p className="text-xs text-error">{error}</p> : null}
        </FieldRow>
      </form>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// Set as subitem (header menu nesting)
// -----------------------------------------------------------------------------

function SubitemDialog({ page, onClose }: { page: BuilderPage; onClose: () => void }) {
  const { config, apply, pages, dbMenus } = useBuilder();
  const link = pageLink(config, page);
  const hm = headerMenu(config, dbMenus);
  const parents = pages.filter((p) => p.group === "pages" && p.key !== page.key && p.key !== "home" && pageLink(config, p));
  const currentIndex = hm && link ? menuParentIndex(hm.menu, link) : -1;
  const currentParent = currentIndex >= 0 ? hm!.menu.items[currentIndex] : null;
  const currentKey = currentParent ? (parents.find((p) => {
    const l = pageLink(config, p);
    return l && l.type === currentParent.link.type && l.ref === currentParent.link.ref;
  })?.key ?? "") : "";
  const [parentKey, setParentKey] = useState(currentKey);
  const [error, setError] = useState("");
  const id = useId();

  const save = () => {
    if (!link) return onClose();
    const parent = parents.find((p) => p.key === parentKey);
    const parentLink = parent ? pageLink(config, parent) : null;
    const r = nestPageInMenu(config, dbMenus, { title: page.label, link }, parent && parentLink ? { title: parent.label, link: parentLink } : null);
    if (r.error) return setError(r.error);
    apply(r.config);
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Set as subitem"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={save} disabled={!hm || !link}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-small">
        <p>
          Show <strong>{page.label}</strong> in the header menu as a subitem of another page (it opens from that page’s dropdown).
          {currentParent ? ` It’s currently under “${currentParent.title}”.` : ""}
        </p>
        {hm ? (
          <FieldRow label="Parent page" htmlFor={id}>
            <select
              id={id}
              className={input}
              value={parentKey}
              onChange={(e) => {
                setParentKey(e.target.value);
                setError("");
              }}
            >
              <option value="">None (top level of the menu)</option>
              {parents.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </FieldRow>
        ) : (
          <p className="text-error">Your header has no menu. Pick one in Theme settings → Header first.</p>
        )}
        <p className="text-xs text-muted">This edits the theme’s copy of the header menu; you can fine-tune it in the Menus panel.</p>
        {error ? <p className="text-xs text-error">{error}</p> : null}
      </div>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// Delete
// -----------------------------------------------------------------------------

function DeleteDialog({ pageId, onClose }: { pageId: string; onClose: () => void }) {
  const { config, apply, page: current, setPageKey } = useBuilder();
  const src = config.pages.find((p) => p.id === pageId);
  if (!src) return null;
  const isHome = config.homePageId === src.id;
  const remove = () => {
    apply((c) => removePage(c, src.id));
    if (current.themePageId === src.id) setPageKey("home");
    onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="Delete page"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep page
          </Button>
          <Button variant="danger" onClick={remove}>
            Delete page
          </Button>
        </>
      }
    >
      <p className="text-small">
        Delete “{src.title}”? Links to /pages/{src.handle} stop working{isHome ? " and your store goes back to the original home page" : ""}. You can undo this until you save.
      </p>
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
  const groups = PAGE_TEMPLATE_FAMILY_ORDER.map((family) => ({
    family,
    label: PAGE_TEMPLATE_FAMILY_LABELS[family],
    templates: family === "other" ? [BLANK_TEMPLATE, ...PAGE_TEMPLATES.filter((t) => t.family === "other")] : PAGE_TEMPLATES.filter((t) => t.family === family),
  })).filter((g) => g.templates.length > 0);

  return (
    <div className="space-y-5">
      {groups.map(({ family, label, templates }) => (
        <section key={family} className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {templates.map((t) => (
              <TemplateCard key={t.key} template={t} onPick={onPick} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TemplateCard({ template: t, onPick }: { template: PageTemplate; onPick: (t: PageTemplate) => void }) {
  return (
    <button type="button" onClick={() => onPick(t)} className="group flex flex-col overflow-hidden rounded-lg border border-border bg-surface text-left hover:border-accent focus-visible:border-accent">
      <div className="aspect-[4/5] overflow-hidden border-b border-border bg-surface-secondary p-2">
        <Wireframe sections={t.sections} />
      </div>
      <div className="space-y-0.5 p-2.5">
        <p className="text-small font-medium group-hover:text-accent">{t.label}</p>
        <p className="line-clamp-3 text-xs text-muted">{t.description}</p>
      </div>
    </button>
  );
}

function NamePage({ template, onBack, onDone }: { template: PageTemplate; onBack: () => void; onDone: () => void }) {
  const { config, apply, setPageKey, pageSources } = useBuilder();
  const [title, setTitle] = useState(template.key === "blank" ? "New page" : template.label);
  const [error, setError] = useState("");
  const id = useId();
  const create = () => {
    if (!title.trim()) return setError("Give the page a title");
    const r = addPage(config, title, structuredClone(template.sections), pageSources.contentPages.map((p) => p.slug));
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
      <FieldRow label="Page title" htmlFor={id} hint={`Address: /pages/${uniqueHandle(config, title, undefined, pageSources.contentPages.map((p) => p.slug))}`}>
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
  ContactInfo: 34,
  RichText: 30,
  BlogPosts: 34,
  Gallery: 40,
  Team: 34,
  CallToAction: 24,
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
    case "ContactInfo":
      return g(
        <>
          {lines(40, y + 2, [40])}
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x={4 + i * 38} y={y + 9} width={36} height={22} rx={2} className="text-muted/30" />
              <circle cx={12 + i * 38} cy={y + 15} r={3} className="text-accent/60" />
            </g>
          ))}
        </>,
        "text-muted/40",
      );
    case "RichText":
      return g(<>{lines(30, y + 2, [60, 58, 54, 60, 40])}</>, "text-muted/40");
    case "BlogPosts":
    case "Team":
      return g(
        <>
          {lines(4, y + 2, [36])}
          {row(3, 22, 8)}
        </>,
        "text-muted/40",
      );
    case "Gallery":
      return g(
        <>
          {lines(4, y + 2, [30])}
          {row(3, 14, 8)}
          {row(3, 14, 24)}
        </>,
        "text-muted/40",
      );
    case "CallToAction":
      return (
        <g key={key}>
          <rect x={0} y={y} width={W} height={22} className="text-accent/30" fill="currentColor" />
          <g className="text-surface" fill="currentColor">
            {lines(35, y + 5, [50])}
            <rect x={48} y={y + 12} width={24} height={6} rx={3} />
          </g>
        </g>
      );
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
