/**
 * DEMO STORES — two complete, live demo storefronts for every store category (72 in all), with
 * owners, catalogue, Unsplash photography, content, shipping, GST settings, reviews and a
 * published marketplace theme. Data: ./data, plans: ./generate.ts, theme: ./theme.ts.
 *
 *   pnpm seed:demo-stores --dry-run                       # print the plan, write nothing
 *   pnpm seed:demo-stores [--category=<industry>] [--slug=a,b] [--retheme]
 *   pnpm seed:demo-stores --remove [--category=<industry>] [--slug=a,b]
 *   pnpm seed:demo-stores --target=remote --yes …         # REQUIRED for a non-local Supabase URL
 *
 * SAFETY
 *  - Writes only to a local Supabase (localhost / 127.0.0.1 / *.localhost / *.test) unless both
 *    --target=remote and --yes are passed (guard.ts). --dry-run never contacts Supabase.
 *  - --remove closes the stores (status 'cancelled', offline); see remove() for why it isn't a hard delete.
 *  - Only slugs from ./data are touched. An existing tenant with such a slug is used only if it is
 *    store_type 'demo', owned by owner@<slug>.demo.test and not in PROTECTED_TENANT_IDS; otherwise
 *    that store is skipped. --remove applies the same checks before deleting anything.
 *  - Idempotent: keyed on the store slug and product/category/collection slugs; a re-run fills
 *    gaps (e.g. a run that stopped) and leaves existing rows alone. --retheme publishes a freshly
 *    built theme (the previous version stays in the theme history).
 *  - Tenant data is written as the demo owner (RLS, the same RPCs and tables as the dashboard:
 *    create_tenant, save_product, set_collection_products). The secret key (ADR-006, scripts) is
 *    used only for auth admin calls, the platform-owned columns (status, plan, store_type,
 *    category, launch state), sample reviews (no owner insert policy) and --remove.
 *  - Owners get a random password that is never printed or stored (sign-in only via the super
 *    admin "Log in as store" flow); accounts carry app_metadata.demo_store = true.
 */
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { toDecimalString } from "../../src/lib/money";
import { productInputSchema, toSaveProductPayload } from "../../src/features/catalog/schemas";
import { findMarketplaceTheme } from "../../src/features/theme/marketplace/catalog";
import { PROTECTED_TENANT_IDS } from "../../src/features/theme/marketplace/showcase";
import { importedFilename } from "../../src/features/media/unsplash/photos";
import { planAll, validatePlan, type ProductPlan, type StorePlan } from "./generate";
import { assertSafeTarget, parseArgs } from "./guard";
import { creditOf, loadCache, nth, photosFor, photoUrl, type DemoPhoto } from "./photos";
import { buildThemeConfig, type ThemeRefs } from "./theme";

const opts = parseArgs(process.argv.slice(2));

function env(name: string): string {
  const v = process.env[name] ?? "";
  return v.startsWith("$") ? (process.env[v.slice(1).replace(/[{}]/g, "")] ?? "") : v;
}
const URL_ = env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
const SECRET = env("SUPABASE_SECRET_KEY");
const PUBLISHABLE = env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const ROOT = process.env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN || "localhost";

const targetLabel = assertSafeTarget(URL_, opts);
let plans = planAll(opts.category ?? undefined);
if (opts.slugs.length) plans = plans.filter((p) => opts.slugs.includes(p.slug));
if (!plans.length) throw new Error("no demo stores match the filters");
const problems = plans.flatMap(validatePlan);
if (problems.length) throw new Error(`invalid seed data:\n${problems.join("\n")}`);
console.log(`Target: ${targetLabel} · ${plans.length} demo store(s)${opts.remove ? " · REMOVE" : ""}`);

// ------------------------------------------------------------------ dry run

const cache = loadCache();
const uncached = [...new Set(plans.flatMap((p) => p.categories.map((c) => c.query)))].filter((q) => !cache[q]?.length);
if (uncached.length) {
  const msg = `${uncached.length} department photo search(es) aren't cached yet (run pnpm seed:demo-stores:photos --wait); those departments would get generic curated photos`;
  if (!opts.dryRun && !opts.remove && targetLabel.startsWith("REMOTE") && !opts.allowCuratedPhotos) throw new Error(`${msg}. Refusing a remote run; pass --allow-curated-photos to seed anyway.`);
  console.warn(`! ${msg}.`);
}
if (opts.dryRun) {
  for (const p of plans) {
    const cached = p.categories.filter((c) => cache[c.query]?.length).length;
    const variants = p.products.reduce((a, x) => a + x.variants.length, 0);
    console.log(`${opts.remove ? "would remove" : "•"} ${p.slug.padEnd(20)} ${p.name.padEnd(24)} ${p.industry.padEnd(18)} theme=${p.themeKey} (${p.layout.hero}/${p.layout.products}/${p.layout.headerStyle}/${p.layout.footerLayout}) · ${p.categories.length} categories · ${p.products.length} products · ${variants} variants · photos ${cached}/${p.categories.length} searched`);
  }
  const perCat = new Map<string, number>();
  for (const p of plans) perCat.set(p.industry, (perCat.get(p.industry) ?? 0) + 1);
  console.log(`\n${perCat.size} categories × ${[...new Set(perCat.values())].join("/")} stores = ${plans.length} stores, ${plans.reduce((a, p) => a + p.products.length, 0)} products. Dry run: nothing written.`);
  process.exit(0);
}
if (!SECRET || !PUBLISHABLE) throw new Error("SUPABASE_SECRET_KEY and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required");

// ------------------------------------------------------------------ HTTP

async function http<T>(method: string, path: string, o: { token?: string; body?: unknown; prefer?: string } = {}): Promise<T> {
  const res = await fetch(`${URL_}${path}`, {
    method,
    headers: { apikey: o.token ? PUBLISHABLE : SECRET, Authorization: `Bearer ${o.token ?? SECRET}`, "Content-Type": "application/json", Prefer: o.prefer ?? "return=representation" },
    body: o.body === undefined ? undefined : JSON.stringify(o.body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path.split("?")[0]} → ${res.status} ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : null) as T;
}
/** As the platform (secret key). */
const sys = <T = unknown,>(method: string, path: string, body?: unknown) => http<T>(method, `/rest/v1/${path}`, { body });
/** As the store owner (RLS). */
const own = <T = unknown,>(token: string, method: string, path: string, body?: unknown) => http<T>(method, `/rest/v1/${path}`, { body, token });

async function upload(token: string, path: string, bytes: Buffer, type: string) {
  const res = await fetch(`${URL_}/storage/v1/object/store-assets/${path}`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${token}`, "Content-Type": type, "x-upsert": "true", "cache-control": "31536000" },
    body: new Uint8Array(bytes),
  });
  if (!res.ok) throw new Error(`upload ${path} → ${res.status} ${await res.text()}`);
}

async function pool<T>(items: T[], n: number, fn: (x: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i]!, i);
    }
  }));
}

async function download(url: string): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (attempt >= 5) throw new Error(`download ${url}: ${String(e)}`);
      await new Promise((r) => setTimeout(r, attempt * 3000));
    }
  }
}

// ------------------------------------------------------------------ accounts & guard

type AdminUser = { id: string; email?: string; app_metadata?: Record<string, unknown> };

async function findTenant(slug: string): Promise<{ id: string; store_type: string } | null> {
  const rows = await sys<{ id: string; store_type: string }[]>("GET", `tenants?select=id,store_type&slug=eq.${encodeURIComponent(slug)}`);
  return rows[0] ?? null;
}

/** null = safe to use (or absent); a string = why this tenant must not be touched. */
async function refuseReason(p: StorePlan, t: { id: string; store_type: string }): Promise<string | null> {
  if (PROTECTED_TENANT_IDS.has(t.id.toLowerCase())) return "protected tenant";
  if (t.store_type !== "demo") return `store_type is "${t.store_type}", not demo`;
  const owners = await sys<{ user_id: string }[]>("GET", `tenant_memberships?select=user_id&tenant_id=eq.${t.id}&role=eq.owner`);
  const users = await Promise.all(owners.map((o) => http<AdminUser>("GET", `/auth/v1/admin/users/${o.user_id}`).catch(() => null)));
  if (!users.some((u) => u?.email === p.owner.email)) return `not owned by ${p.owner.email}`;
  return null;
}

async function ownerSession(p: StorePlan): Promise<{ token: string; userId: string }> {
  try {
    await http("POST", "/auth/v1/admin/users", {
      body: { email: p.owner.email, password: `${randomBytes(24).toString("base64url")}aA1!`, email_confirm: true, user_metadata: { display_name: p.owner.name, demo: true }, app_metadata: { demo_store: true, demo_slug: p.slug } },
    });
  } catch (e) {
    if (!/422|already/i.test(String(e))) throw e;
  }
  // Supabase Auth rate-limits token verification per IP: back off and retry instead of failing the store.
  for (let attempt = 1; ; attempt++) {
    const link = await http<{ properties?: { hashed_token?: string }; hashed_token?: string }>("POST", "/auth/v1/admin/generate_link", { body: { type: "magiclink", email: p.owner.email } });
    const res = await fetch(`${URL_}/auth/v1/verify`, { method: "POST", headers: { apikey: PUBLISHABLE, "Content-Type": "application/json" }, body: JSON.stringify({ type: "magiclink", token_hash: link.properties?.hashed_token ?? link.hashed_token }) });
    const j = (await res.json().catch(() => ({}))) as { access_token?: string; user?: { id: string }; msg?: string; error_description?: string };
    if (j.access_token && j.user) return { token: j.access_token, userId: j.user.id };
    if (attempt >= 8) throw new Error(`session failed for ${p.owner.email}: HTTP ${res.status} ${j.msg ?? j.error_description ?? ""}`);
    const wait = Math.min(attempt * 30, 180);
    console.log(`  sign-in for ${p.owner.email} refused (HTTP ${res.status} ${j.msg ?? j.error_description ?? ""}); retrying in ${wait}s`);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
}

// ------------------------------------------------------------------ images

type Img = { path: string; bytes: Buffer; width: number; height: number; photo: DemoPhoto; what: string };

async function fetchPhoto(tenantId: string, folder: string, name: string, photo: DemoPhoto, w: number, h: number, what: string): Promise<Img> {
  const raw = await download(photoUrl(photo.id, w, h));
  const out = await sharp(raw).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
  return { path: `tenant/${tenantId}/${folder}/${name}-${photo.id.replace(/^photo-/, "").slice(0, 10)}.webp`, bytes: out.data, width: out.info.width, height: out.info.height, photo, what };
}

const assetRow = (tenantId: string, img: Img, folder: string, userId: string) => ({
  tenant_id: tenantId,
  storage_path: img.path,
  mime_type: "image/webp",
  bytes: img.bytes.length,
  width: img.width,
  height: img.height,
  // Credit stays with the file, as in the Media Library's Unsplash import.
  alt_text: `${img.what.slice(0, 200)} (${creditOf(img.photo)})`,
  filename: importedFilename({ id: img.photo.id, photographer: img.photo.photographer }).replace(/\.jpg$/, ".webp"),
  folder,
  uploaded_by: userId,
});

function brandSvg(p: StorePlan, kind: "logo" | "favicon"): string {
  const theme = findMarketplaceTheme(p.themeKey)!;
  const c = theme.preset.tokens.colors;
  const inverted = p.layout.headerStyle === "inverted";
  const badge = inverted ? (c.accent ?? "#b4532a") : (c.primary ?? "#1f1a17");
  const ink = inverted ? (c.background ?? "#ffffff") : (c.text ?? "#1f1a17");
  const mono = p.name.replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  if (kind === "favicon") return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" rx="60" fill="${badge}"/><text x="128" y="${mono.length > 1 ? 160 : 168}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${mono.length > 1 ? 104 : 128}" fill="${c.background ?? "#fff"}">${esc(mono)}</text></svg>`;
  const width = 150 + Math.round(p.name.length * 27);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="120"><rect x="6" y="12" width="96" height="96" rx="24" fill="${badge}"/><text x="54" y="${mono.length > 1 ? 76 : 80}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${mono.length > 1 ? 40 : 52}" fill="${inverted ? ink : (c.background ?? "#fff")}">${esc(mono)}</text><text x="124" y="76" font-family="Georgia, 'Times New Roman', serif" font-weight="600" font-size="46" fill="${ink}">${esc(p.name)}</text></svg>`;
}

// ------------------------------------------------------------------ product

async function saveProduct(p: StorePlan, pr: ProductPlan, tenantId: string, token: string, catId: Record<string, string>): Promise<string> {
  const input = productInputSchema.parse({
    title: pr.title,
    slug: pr.slug,
    description: pr.description,
    shortDescription: pr.short,
    productType: pr.type,
    brand: p.name,
    categoryId: catId[pr.department],
    status: "active",
    featured: pr.featured,
    tags: pr.tags,
    attributes: {},
    careInstructions: pr.care,
    shippingInfo: p.shippingNote,
    returnInfo: p.returnsNote,
    hsnCode: pr.hsn,
    seoTitle: pr.seoTitle,
    seoDescription: pr.seoDescription,
    options: pr.option ? [pr.option] : [],
    variants: pr.variants.map((v) => ({
      option1: v.option1,
      option2: null,
      sku: v.sku,
      price: toDecimalString(v.price),
      compareAtPrice: v.compareAtPrice === null ? "" : toDecimalString(v.compareAtPrice),
      weightGrams: String(pr.weightGrams),
      trackInventory: true,
      lowStockThreshold: "3",
      initialStock: String(v.initialStock),
    })),
  });
  return http<string>("POST", "/rest/v1/rpc/save_product", { token, body: { p_tenant: tenantId, p_payload: toSaveProductPayload(input, { allowInitialStock: true }) } });
}

// ------------------------------------------------------------------ one store

async function seed(p: StorePlan) {
  const existing = await findTenant(p.slug);
  if (existing) {
    const why = await refuseReason(p, existing);
    if (why) {
      console.warn(`✗ ${p.slug}: skipped, an existing tenant uses this slug (${why})`);
      return false;
    }
  }
  console.log(`${existing ? "↻" : "▶"} ${p.name} (${p.industry}, ${p.themeName})`);
  const owner = await ownerSession(p);
  const T = owner.token;
  const tenantId = existing?.id ?? (await http<string>("POST", "/rest/v1/rpc/create_tenant", { token: T, body: { p_name: p.name, p_slug: p.slug, p_root_domain: ROOT } }));
  const W = `tenant_id=eq.${tenantId}`;

  // Platform-owned columns (secret key): live, demo-marked, in its category.
  const [plan] = await sys<{ id: string }[]>("GET", "plans?select=id&code=eq.growth");
  await sys("PATCH", `tenants?id=eq.${tenantId}`, { status: "active", trial_ends_at: null, store_type: "demo", ...(plan ? { plan_id: plan.id } : {}) });
  const [cat] = await sys<{ id: string }[]>("GET", `store_categories?select=id&slug=eq.${p.industry}`);
  await sys("PATCH", `stores?${W}`, { category_id: cat?.id ?? null, launch_status: "live", launched_at: new Date().toISOString() });

  // Store settings (as the owner, like Settings → Store / Tax / COD).
  await own(T, "PATCH", `stores?${W}`, {
    tagline: p.tagline,
    description: p.story[0]!.slice(0, 2000),
    email: p.email,
    phone: p.phone,
    whatsapp: p.whatsapp,
    address: p.address,
    social: p.social,
    legal_name: p.legalName,
    seo: p.seo,
    tax_settings: p.taxSettings,
    cod_settings: { enabled: true, fee: Number(toDecimalString(p.codPaise.fee)), min_order: Number(toDecimalString(p.codPaise.minOrder)), max_order: Number(toDecimalString(p.codPaise.maxOrder)) },
  });
  if (!(await own<unknown[]>(T, "GET", `shipping_rates?select=id&${W}&limit=1`)).length) {
    await own(T, "POST", "shipping_rates", p.shipping.map((r) => ({ tenant_id: tenantId, name: r.name, price: toDecimalString(r.price), min_subtotal: toDecimalString(r.minSubtotal), max_subtotal: r.maxSubtotal === null ? null : toDecimalString(r.maxSubtotal), min_weight_grams: 0, max_weight_grams: null, pincode_prefixes: r.pincodePrefixes, estimated_days_min: r.daysMin, estimated_days_max: r.daysMax, cod_allowed: r.codAllowed, active: true, position: r.position })));
  }

  // Categories & collections (by slug).
  const oldCats = await own<{ id: string; slug: string }[]>(T, "GET", `categories?select=id,slug&${W}`);
  const addCats = p.categories.filter((c) => !oldCats.some((o) => o.slug === c.slug));
  const cats = [...oldCats, ...(addCats.length ? await own<{ id: string; slug: string }[]>(T, "POST", "categories", addCats.map((c) => ({ tenant_id: tenantId, name: c.name, slug: c.slug, description: c.description, position: p.categories.indexOf(c) + 1 }))) : [])];
  const catId = Object.fromEntries(cats.map((c) => [c.slug, c.id]));
  const oldCols = await own<{ id: string; slug: string }[]>(T, "GET", `collections?select=id,slug&${W}`);
  const addCols = p.collections.filter((c) => !oldCols.some((o) => o.slug === c.slug));
  const cols = [
    ...oldCols,
    ...(addCols.length
      ? await own<{ id: string; slug: string }[]>(T, "POST", "collections", addCols.map((c) => ({ tenant_id: tenantId, title: c.title, slug: c.slug, description: c.description, type: c.tag ? "automated" : "manual", rules: { match: "all", conditions: c.tag ? [{ field: "tag", op: "eq", value: c.tag }] : [] }, sort_order: c.tag ? "newest" : "manual", position: p.collections.indexOf(c) + 1 })))
      : []),
  ];
  const colId = Object.fromEntries(cols.map((c) => [c.slug, c.id]));

  // Products (save_product RPC as the owner: same validation as the dashboard).
  const oldProducts = await own<{ id: string; slug: string }[]>(T, "GET", `products?select=id,slug&${W}`);
  const productIds: string[] = [];
  for (const pr of p.products) productIds.push(oldProducts.find((o) => o.slug === pr.slug)?.id ?? (await saveProduct(p, pr, tenantId, T, catId)));
  const best = p.products.map((x, i) => (x.collections.includes("bestsellers") ? productIds[i]! : null)).filter((x): x is string => !!x);
  await http("POST", "/rest/v1/rpc/set_collection_products", { token: T, body: { p_collection: colId.bestsellers, p_product_ids: best } });

  // Product photos (only for products without media).
  const withMedia = new Set((await own<{ product_id: string }[]>(T, "GET", `product_media?select=product_id,storage_path&${W}&position=eq.0`)).map((m) => m.product_id));
  const fronts: string[] = new Array(p.products.length).fill("");
  const known = await own<{ product_id: string; storage_path: string }[]>(T, "GET", `product_media?select=product_id,storage_path&${W}&position=eq.0`);
  const credits: Img[] = [];
  const assets: Record<string, unknown>[] = [];
  await pool(p.products, 5, async (pr, i) => {
    const photos = photosFor(cache, pr.photo.q, p.industry);
    const picks = [nth(photos, pr.photo.picks[0]), nth(photos, pr.photo.picks[1])].filter((x, k, a) => a.findIndex((y) => y.id === x.id) === k);
    if (withMedia.has(productIds[i]!)) {
      fronts[i] = known.find((k) => k.product_id === productIds[i])!.storage_path;
      return;
    }
    const imgs = await Promise.all(picks.map((ph, k) => fetchPhoto(tenantId, "products", `${pr.slug}-${k + 1}`, ph, 1200, 1500, k === 0 ? pr.title : `${pr.title}, another view`)));
    for (const img of imgs) await upload(T, img.path, img.bytes, "image/webp");
    await own(T, "POST", "product_media", imgs.map((img, k) => ({ tenant_id: tenantId, product_id: productIds[i], storage_path: img.path, alt_text: img.what, width: img.width, height: img.height, position: k, media_type: "image" })));
    imgs.forEach((img) => assets.push(assetRow(tenantId, img, "products", owner.userId)));
    credits.push(...imgs);
    fronts[i] = imgs[0]!.path;
  });

  // Banners & brand.
  const dep = (i: number) => photosFor(cache, p.categories[i % p.categories.length]!.query, p.industry, "hero");
  const w = p.which;
  const bannerSpecs: [keyof ThemeRefs["images"], DemoPhoto, number, number, string][] = [
    ["hero1", nth(dep(0), 12 + w), 2400, 1200, `${p.name}: ${p.tagline}`],
    ["hero2", nth(dep(1), 12 + w), 2400, 1200, p.categories[1]!.name],
    ["heroMobile", nth(dep(0), 12 + w), 1200, 1500, p.tagline],
    ["story", nth(dep(2), 14 + w), 1400, 1750, `${p.name} studio`],
    ["feature", nth(dep(2), 16 + w), 1600, 1200, p.categories[2]!.name],
    ["feature2", nth(dep(3), 14 + w), 1600, 1200, p.categories[3]!.name],
    ["promo1", nth(dep(3), 16 + w), 1400, 1000, p.categories[3]!.name],
    ["promo2", nth(dep(4), 14 + w), 1400, 1000, "Deals"],
  ];
  const haveAssets = new Set((await own<{ storage_path: string }[]>(T, "GET", `media_assets?select=storage_path&${W}`)).map((a) => a.storage_path));
  const images = {} as ThemeRefs["images"];
  await pool(bannerSpecs, 4, async ([key, photo, bw, bh, what]) => {
    const img = await fetchPhoto(tenantId, "theme", key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`), photo, bw, bh, what);
    images[key] = img.path;
    if (haveAssets.has(img.path)) return;
    await upload(T, img.path, img.bytes, "image/webp");
    assets.push(assetRow(tenantId, img, "banners", owner.userId));
    credits.push(img);
  });
  const logo = await sharp(Buffer.from(brandSvg(p, "logo"))).png().toBuffer({ resolveWithObject: true });
  const fav = await sharp(Buffer.from(brandSvg(p, "favicon"))).resize(256).png().toBuffer();
  const logoPath = `tenant/${tenantId}/brand/logo.png`;
  const favPath = `tenant/${tenantId}/brand/favicon.png`;
  await upload(T, logoPath, logo.data, "image/png");
  await upload(T, favPath, fav, "image/png");
  for (const [path, bytes, width, height, alt] of [[logoPath, logo.data, logo.info.width, logo.info.height, `${p.name} logo`], [favPath, fav, 256, 256, `${p.name} icon`]] as const) {
    if (!haveAssets.has(path)) assets.push({ tenant_id: tenantId, storage_path: path, mime_type: "image/png", bytes: bytes.length, width, height, alt_text: alt, filename: path.split("/").pop(), folder: "brand", uploaded_by: owner.userId });
  }
  if (assets.length) await own(T, "POST", "media_assets", assets);
  await own(T, "PATCH", `stores?${W}`, { logo_path: logoPath, favicon_path: favPath, seo: { ...p.seo, og_image_path: images.hero1 } });

  // Category / collection tiles: a product photo each, preferring unused ones.
  const used = new Set<string>();
  const tile = (match: (x: ProductPlan) => boolean) => {
    const idx = p.products.map((x, i) => (match(x) ? i : -1)).filter((i) => i >= 0);
    const i = idx.find((k) => !used.has(fronts[k]!)) ?? idx[0];
    if (i === undefined) return "";
    used.add(fronts[i]!);
    return fronts[i]!;
  };
  const categoryImages: Record<string, string> = {};
  for (const c of p.categories) {
    categoryImages[c.slug] = tile((x) => x.department === c.slug);
    if (categoryImages[c.slug]) await own(T, "PATCH", `categories?id=eq.${catId[c.slug]}`, { image_path: categoryImages[c.slug] });
  }
  const collectionImages: Record<string, string> = {};
  for (const c of p.collections) {
    collectionImages[c.slug] = tile((x) => (c.tag ? x.tags.includes(c.tag) : x.collections.includes(c.slug)));
    if (collectionImages[c.slug]) await own(T, "PATCH", `collections?id=eq.${colId[c.slug]}`, { image_path: collectionImages[c.slug] });
  }

  // Menus.
  if (!(await own<unknown[]>(T, "GET", `menus?select=id&${W}&limit=1`)).length) {
    const made = await own<{ id: string; handle: string }[]>(T, "POST", "menus", [
      { tenant_id: tenantId, handle: "main", title: "Main menu" },
      { tenant_id: tenantId, handle: "shop", title: "Shop" },
      { tenant_id: tenantId, handle: "footer", title: "Help" },
    ]);
    const m = Object.fromEntries(made.map((x) => [x.handle, x.id]));
    const [shop] = await own<{ id: string }[]>(T, "POST", "menu_items", { tenant_id: tenantId, menu_id: m.main, title: "Shop", link_type: "url", url: "/collections", position: 1, highlight: false });
    await own(T, "POST", "menu_items", p.categories.map((c, i) => ({ tenant_id: tenantId, menu_id: m.main, parent_id: shop!.id, title: c.name, link_type: "url", url: `/categories/${c.slug}`, position: i + 1, highlight: false })));
    await own(T, "POST", "menu_items", [
      ...p.categories.slice(0, 3).map((c, i) => ({ tenant_id: tenantId, menu_id: m.main, title: c.name, link_type: "url", url: `/categories/${c.slug}`, position: i + 2, highlight: false })),
      { tenant_id: tenantId, menu_id: m.main, title: "Deals", link_type: "url", url: "/collections/deals", position: 5, highlight: true },
      { tenant_id: tenantId, menu_id: m.main, title: "About", link_type: "url", url: "/pages/about", position: 6, highlight: false },
    ]);
    await own(T, "POST", "menu_items", p.categories.map((c, i) => ({ tenant_id: tenantId, menu_id: m.shop, title: c.name, link_type: "url", url: `/categories/${c.slug}`, position: i + 1, highlight: false })));
    await own(T, "POST", "menu_items", [["About us", "/pages/about"], ["Shipping", "/pages/shipping-policy"], ["Returns", "/pages/returns"], ["FAQ", "/faq"], ["Contact", "/pages/contact"], ["Privacy", "/pages/privacy"], ["Terms", "/pages/terms"], ["Image credits", "/pages/image-credits"]].map(([title, url], i) => ({ tenant_id: tenantId, menu_id: m.footer, title, link_type: "url", url, position: i + 1, highlight: false })));
  }

  // Pages, FAQs, reviews (only when absent).
  const para = (text: string) => ({ type: "paragraph", text });
  const now = new Date().toISOString();
  // Every photo the store uses (deterministic from the plan + cache, so a resumed run lists all).
  const used_: { what: string; photo: DemoPhoto }[] = [
    ...p.products.flatMap((pr) => {
      const photos = photosFor(cache, pr.photo.q, p.industry);
      return [{ what: pr.title, photo: nth(photos, pr.photo.picks[0]) }, { what: pr.title, photo: nth(photos, pr.photo.picks[1]) }];
    }),
    ...bannerSpecs.map(([, photo, , , what]) => ({ what: `Banner: ${what}`, photo })),
  ];
  const photographers = [...new Map(used_.map((c) => [c.photo.id, c])).values()];
  const pages = [
    ...p.pages,
    { slug: "image-credits", title: "Image credits", kind: "page" as const, body: [`${p.name} is a demo store on Pictocart: the brand, people, products and prices are illustrative. Photographs are from Unsplash (Unsplash License).`, ...photographers.map((c) => `${c.what}: ${creditOf(c.photo)}${c.photo.photographer ? ` (${c.photo.photographer.url})` : ""}`)] },
  ];
  const havePages = new Set((await own<{ slug: string }[]>(T, "GET", `pages?select=slug&${W}`)).map((x) => x.slug));
  const addPages = pages.filter((x) => !havePages.has(x.slug));
  if (addPages.length) await own(T, "POST", "pages", addPages.map((x) => ({ tenant_id: tenantId, title: x.title, slug: x.slug, kind: x.kind, status: "published", published_at: now, body: x.body.map(para) })));
  if (!(await own<unknown[]>(T, "GET", `faqs?select=id&${W}&limit=1`)).length) await own(T, "POST", "faqs", p.faqs.map(([question, answer], i) => ({ tenant_id: tenantId, question, answer, position: i + 1 })));
  if (!(await own<unknown[]>(T, "GET", `reviews?select=id&${W}&limit=1`)).length) {
    // Reviews have no owner insert policy (they come from shoppers or imports): written with the
    // secret key as source "sample" (migration 1700), which the storefront labels and the
    // dashboard removes in one click. Not verified purchases: there are no orders behind them.
    await sys("POST", "reviews", p.reviews.map((r) => ({ tenant_id: tenantId, product_id: productIds[r.product], rating: r.rating, title: r.title, body: r.body, author_name: r.author, status: "approved", verified_purchase: false, source: "sample" })));
  }

  // Theme: store content + marketplace preset (applyThemePreset), saved as the draft and
  // published with publish_theme, the same steps as "Apply & publish" in the theme marketplace.
  const versions = await own<{ id: string; status: string; version: number }[]>(T, "GET", `theme_versions?select=id,status,version&${W}&order=version.desc`);
  if (!versions.some((v) => v.status === "published") || opts.retheme) {
    const config = buildThemeConfig(p, { categoryIds: catId, collectionIds: colId, productIds, fronts, categoryImages, collectionImages, images });
    const draft = versions.find((v) => v.status === "draft");
    if (draft) await own(T, "PATCH", `theme_versions?id=eq.${draft.id}&status=eq.draft`, { config, theme_key: p.themeKey, label: p.themeName });
    else await own(T, "POST", "theme_versions", { tenant_id: tenantId, version: (versions[0]?.version ?? 0) + 1, status: "draft", label: p.themeName, theme_key: p.themeKey, config, created_by: owner.userId });
    await http("POST", "/rest/v1/rpc/publish_theme", { token: T, body: { p_tenant: tenantId, p_label: p.themeName } });
  }
  console.log(`  ✓ ${p.products.length} products · ${credits.length} photos · http://${p.slug}.${ROOT}${ROOT === "localhost" ? ":3000" : ""}`);
  return true;
}

// ------------------------------------------------------------------ remove

/**
 * Takes a demo store down the way the platform closes stores (close_own_store, migration 2600):
 * status 'cancelled' (storefront 404s, leaves the dashboard switcher, platform data keeps it as
 * store_type 'demo') and launch_status 'draft'. Nothing is hard-deleted: tenants cascade into the
 * append-only audit log, so the platform has no delete path. Re-running the seeder reopens it.
 */
async function remove(p: StorePlan) {
  const t = await findTenant(p.slug);
  if (!t) return console.log(`• ${p.slug}: not present`);
  const why = await refuseReason(p, t);
  if (why) return console.warn(`✗ ${p.slug}: NOT removed (${why})`);
  await sys("PATCH", `tenants?id=eq.${t.id}`, { status: "cancelled" });
  await sys("PATCH", `stores?tenant_id=eq.${t.id}`, { launch_status: "draft" });
  console.log(`✓ ${p.slug}: closed (offline, still marked demo; re-run the seeder to reopen)`);
}

// ------------------------------------------------------------------ main

let ok = 0;
for (const p of plans) {
  try {
    if (opts.remove) await remove(p);
    else if (await seed(p)) ok += 1;
  } catch (e) {
    console.error(`✗ ${p.slug}: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  }
}
console.log(opts.remove ? "done" : `done: ${ok}/${plans.length} stores seeded`);
