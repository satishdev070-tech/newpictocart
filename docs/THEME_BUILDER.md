# Seller site builder (Dashboard → Storefront → Theme editor)

A full-screen visual builder over the existing theme document (ADR-024 / ADR-017). Modelled on the
interaction style of hosted site builders (page switcher, left icon rail, on-canvas section toolbar);
our own code, styling (orange panel tokens) and wording.

## Component tree

```
app/dashboard/theme/page.tsx           requireTenantPermission("theme.edit") → getBuilderData(ctx)
└─ SiteBuilder (fixed inset-0, covers the dashboard shell)
   └─ BuilderProvider (site-builder/context.tsx)      theme + undo history, page, panel, selection, device
      ├─ TopBar          back · store · Pages: ▾ · undo/redo · desktop/mobile · Preview · Save draft · Publish · versions
      ├─ IconRail        Pages · Menus · Theme settings · Embed apps · … · Layers
      ├─ PanelHost       PagesPanel · MenusPanel(+LinkDialog) · ThemePanel · EmbedsPanel · LayersPanel
      │                  PopupPanel · SectionPanel (Edit / Change design / Settings / Colours) · InsertPanel (+ AI)
      └─ CanvasFrame     iframe of the store (preview cookie) ⇄ postMessage ⇄ CanvasBridge
```

Storefront side (`store/[host]`), only under a verified preview cookie:

```
layout.tsx  ThemeSlot("layout.header") · children · ThemeSlot("layout.footer") · SiteExtras · CanvasBridge
pages       ThemeSlot("templates.home") / TemplateFrame(template) / ThemeSlot("pages.<id>")
CanvasSlot  client wrapper; shows a server-rendered override for its slot when the builder sends one
```

## State and undo

`history.ts` — `{ past, present, future, saved }` of whole theme documents (structural sharing keeps
snapshots cheap; documents are ≤ 256 KB). `apply` pushes a step; edits with the same `coalesce` key
within 1 s replace the top step (typing in one field = one undo step). Limit 100 steps. `dirty` =
present differs from the last saved draft. All edits are pure functions in `ops.ts`.

## Preview messaging

The canvas is the real storefront in an iframe on the store origin. The builder posts
`{type:"theme", rev, config, changedLists}` (debounced); the bridge calls the storefront server action
`renderCanvasAction` (`site-builder/canvas-actions.tsx`) with the unsaved JSON and the slot keys on the
page whose list changed. The action resolves the tenant from the verified host, requires the signed
preview cookie for that tenant, parses with the render-time parser and returns the slots as React
nodes plus the token CSS; nothing is stored. Each slot swaps in its override, so the canvas shows
exactly what the storefront renders. The bridge posts `ready / select / action / insert / rendered`
back. Both sides check `event.origin` and `event.source`; messages are parsed by `protocol.ts`.

## Schema changes (all defaulted — old themes render unchanged)

- `templates`: + `collectionList, page, blog, search, cart, account` (PageContent marker places the
  page's own content; empty = page renders as before). Wired via `TemplateFrame` / route layouts.
- `pages[]`: site-builder pages `{id, handle, title, seoTitle, seoDescription, sections}` at
  `/pages/<handle>` (take precedence over content pages with the same slug).
- `popups[]`, `embeds` (WhatsApp button, back to top), `menus` (theme copies of menus by handle;
  replace the database menu with the same handle, so menu edits follow draft → publish).
- `tokens.typography` (H1–H6, paragraph, small: size / weight / font / line height; 0 = theme default).
- Section envelope: optional `style {background, text, accent}` colour overrides.

No database migration.

## Pages panel and page sections

- Each row in Pages has a ⋮ menu. Site-builder pages: SEO & page setup (title, handle, SEO title /
  description, social image `socialImagePath`, `noindex`), Rename, Set as subitem, Set as homepage,
  Duplicate, Delete. Blog: Manage blog, Rename. Contact / FAQ: Rename, Set as subitem. Pure ops in
  `site-builder/page-ops.ts`.
- `homePageId` (default ""): "/" renders that page's sections in the `templates.home` slot (the slot
  reports list `pages.<id>`; `slotList` / `changedLists` map it), and the builder's Home row edits it.
  A dangling id parses to "". `/pages/<handle>` of the homepage sets canonical "/".
- `builtinTitles {blog, contact, faq}` (default ""): renamed built-in page headings.
- "Set as subitem" nests the page's item under the parent's item in the theme copy of the header
  menu (`config.menus[header.menuHandle]`, copied from the DB menu on first use).
- Empty page lists show an "Add a section" placeholder on the canvas (`canvas/empty-slot.tsx` →
  `pc:builder-empty-insert` → CanvasBridge posts `insert` with no anchor).
- Page sections (`sections/definitions-pages.ts`, `render/sections-pages.tsx`, diagrams in
  `site-builder/variant-diagrams-pages.ts`): ContactInfo (store details, mailto / WhatsApp buttons,
  Google Maps embed limited to `https://www.google.com/maps/embed?…` in a sandboxed iframe),
  RichText (plain text paragraphs), BlogPosts, Gallery, Team, CallToAction; each has ≥3 variants.
