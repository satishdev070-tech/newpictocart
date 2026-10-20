import "server-only";
import { logger } from "@/lib/observability/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/supabase/errors";
import { toUnsplashCategory, type UnsplashCategory } from "@/lib/unsplash-categories";
import { curatedStock, curatedStockSet, pickStock, sizedStockUrl, stockPhotoUrl, type StockImage, type StockSet, type StockSlot } from "@/lib/unsplash-stock";
import { isUnsplashImageUrl } from "@/features/media/unsplash/photos";
import { MEDIA_MAX_BYTES } from "@/features/media/rules";
import { registerImportedImage } from "@/features/media/server/media";
import { attachLibraryImages } from "@/features/catalog/server/media";
import type { ThemeConfig } from "@/features/theme/schema/config";

/** Curated JPEG width. One download is reused across every row that picked that photo. */
export const SEED_PHOTO_WIDTH = 1200;

export type SeedPhotoCounts = { products: number; categories: number; collections: number; blogs: number };

export type SeedPhotoAssignment = {
  category: UnsplashCategory;
  products: StockImage[];
  categories: StockImage[];
  collections: StockImage[];
  blogs: StockImage[];
  hero: StockImage | null;
};

export type SeedImagePaths = {
  hero: string | null;
  categoryById: Record<string, string>;
  collectionById: Record<string, string>;
  /** True when at least one product, category, collection, blog, or hero photo was stored. */
  attached: boolean;
};

export type SeedImageOrder = {
  categoryIds: string[];
  collectionIds: string[];
  productIds: string[];
  blogIds: string[];
};

export type FetchSeedPhoto = (url: string) => Promise<Uint8Array>;

export function emptySeedImagePaths(): SeedImagePaths {
  return { hero: null, categoryById: {}, collectionById: {}, attached: false };
}

/** Alt text keeps the curated description and the Unsplash credit. */
export function seedPhotoAlt(image: StockImage): string {
  const name = image.photographer?.name.trim();
  const credit = name ? `Photo: ${name} / Unsplash` : "Photo: Unsplash";
  const base = image.alt.trim();
  const text = base ? `${base}. ${credit}` : credit;
  return text.slice(0, 300);
}

/** JPEG URL for a curated photo. No Unsplash API key. */
export function seedPhotoUrl(image: StockImage): string {
  return sizedStockUrl(stockPhotoUrl(image.id), SEED_PHOTO_WIDTH);
}

function take(set: StockSet, slot: StockSlot, count: number, offset = 0): StockImage[] {
  const photos: StockImage[] = [];
  for (let i = 0; i < count; i++) {
    const photo = pickStock(set, slot, offset + i);
    if (photo) photos.push(photo);
  }
  return photos;
}

/**
 * Photos for one industry. Products cycle the product slot, categories and collections use tiles,
 * blogs use hero then story, and the homepage uses the first hero photo. PURE.
 */
export function assignSeedPhotos(industry: string, counts: SeedPhotoCounts): SeedPhotoAssignment {
  const category = toUnsplashCategory(industry);
  const set = curatedStockSet(category);
  const blogPool = [...curatedStock(category, "hero"), ...curatedStock(category, "story")];
  const blogs: StockImage[] = [];
  for (let i = 0; i < counts.blogs; i++) {
    const photo = blogPool[i % blogPool.length];
    if (photo) blogs.push(photo);
  }
  return {
    category,
    products: take(set, "products", counts.products),
    categories: take(set, "tiles", counts.categories),
    collections: take(set, "tiles", counts.collections, counts.categories),
    blogs,
    hero: pickStock(set, "hero", 0),
  };
}

/** Fills empty homepage hero, category, and collection slots. Leaves a photo the seller already chose. */
export function fillEmptyThemeImages(config: ThemeConfig, paths: SeedImagePaths): { config: ThemeConfig; changed: boolean } {
  let changed = false;
  const home = config.templates.home.map((section) => {
    const settings = { ...(section.settings as Record<string, unknown>) };
    if (section.type === "Hero" && paths.hero) {
      const slides = Array.isArray(settings.slides) ? (settings.slides as Record<string, unknown>[]) : [];
      let slideChanged = false;
      const nextSlides = slides.map((slide) => {
        const imagePath = typeof slide.imagePath === "string" ? slide.imagePath : "";
        if (imagePath || !paths.hero) return slide;
        slideChanged = true;
        return { ...slide, imagePath: paths.hero };
      });
      if (!slideChanged) return section;
      changed = true;
      return { ...section, settings: { ...settings, slides: nextSlides } };
    }
    if (section.type !== "CategoryGrid" && section.type !== "CollectionGrid") return section;
    const byId = section.type === "CategoryGrid" ? paths.categoryById : paths.collectionById;
    const items = Array.isArray(settings.items) ? (settings.items as Record<string, unknown>[]) : [];
    let itemChanged = false;
    const nextItems = items.map((item) => {
      const id = typeof item.id === "string" ? item.id : "";
      const imagePath = typeof item.imagePath === "string" ? item.imagePath : "";
      const next = id ? byId[id] : undefined;
      if (!next || imagePath) return item;
      itemChanged = true;
      return { ...item, imagePath: next };
    });
    if (!itemChanged) return section;
    changed = true;
    return { ...section, settings: { ...settings, items: nextItems } };
  });
  if (!changed) return { config, changed: false };
  return { config: { ...config, templates: { ...config.templates, home } }, changed: true };
}

type ImageRef = { id: string; missing: boolean };

async function fetchSeedPhoto(url: string): Promise<Uint8Array> {
  if (!isUnsplashImageUrl(url)) throw new Error("bad image url");
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000), redirect: "error" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MEDIA_MAX_BYTES) throw new Error("too large");
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > MEDIA_MAX_BYTES) throw new Error("too large");
  return bytes;
}

function orderBy<T extends { id: string }>(rows: T[], ids: string[] | undefined): T[] {
  if (!ids) return rows;
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
}

async function readCatalogue(tenantId: string, order?: SeedImageOrder): Promise<{ categories: ImageRef[]; collections: ImageRef[]; products: ImageRef[]; blogs: ImageRef[] }> {
  const supabase = await createSupabaseServerClient();
  let catQuery = supabase.from("categories").select("id, image_path").eq("tenant_id", tenantId).order("position").limit(50);
  let colQuery = supabase.from("collections").select("id, image_path").eq("tenant_id", tenantId).order("title").limit(20);
  let productQuery = supabase.from("products").select("id").eq("tenant_id", tenantId).order("created_at").limit(50);
  let blogQuery = supabase.from("blog_posts").select("id, cover_path").eq("tenant_id", tenantId).order("created_at").limit(20);
  const mediaQuery = supabase.from("product_media").select("product_id").eq("tenant_id", tenantId).eq("media_type", "image").limit(500);
  if (order?.categoryIds.length) catQuery = catQuery.in("id", order.categoryIds);
  if (order?.collectionIds.length) colQuery = colQuery.in("id", order.collectionIds);
  if (order?.productIds.length) productQuery = productQuery.in("id", order.productIds);
  if (order?.blogIds.length) blogQuery = blogQuery.in("id", order.blogIds);
  const [cats, cols, products, blogs, media] = await Promise.all([catQuery, colQuery, productQuery, blogQuery, mediaQuery]);
  if (cats.error) throw mapDbError(cats.error);
  if (cols.error) throw mapDbError(cols.error);
  if (products.error) throw mapDbError(products.error);
  if (blogs.error) throw mapDbError(blogs.error);
  if (media.error) throw mapDbError(media.error);
  const withImage = new Set((media.data ?? []).map((row) => row.product_id));
  return {
    categories: orderBy(cats.data ?? [], order?.categoryIds).map((row) => ({ id: row.id, missing: !row.image_path })),
    collections: orderBy(cols.data ?? [], order?.collectionIds).map((row) => ({ id: row.id, missing: !row.image_path })),
    products: orderBy(products.data ?? [], order?.productIds).map((row) => ({ id: row.id, missing: !withImage.has(row.id) })),
    blogs: orderBy(blogs.data ?? [], order?.blogIds).map((row) => ({ id: row.id, missing: !row.cover_path })),
  };
}

function skipped(tenantId: string, photoId: string, err: unknown) {
  logger.warn("onboarding.seed_images_skipped", {
    tenantId,
    photoId,
    message: err instanceof Error ? err.message.slice(0, 200) : "unknown",
  });
}

async function importPhoto(tenantId: string, userId: string, photo: StockImage, fetchPhoto: FetchSeedPhoto): Promise<string | null> {
  try {
    const url = seedPhotoUrl(photo);
    const bytes = await fetchPhoto(url);
    const item = await registerImportedImage(tenantId, userId, {
      bytes,
      filename: `${photo.id}.jpg`,
      folder: "seed",
      alt: seedPhotoAlt(photo),
      width: null,
      height: null,
    });
    return item.path;
  } catch (err) {
    skipped(tenantId, photo.id, err);
    return null;
  }
}

/**
 * Copies curated photos into this store's media library and attaches them where the catalogue
 * has none. A failed download is logged and skipped. Returns storage paths for the homepage.
 */
export async function seedCatalogueImages(args: {
  tenantId: string;
  userId: string;
  industry: string;
  order?: SeedImageOrder;
  fetchPhoto?: FetchSeedPhoto;
}): Promise<SeedImagePaths> {
  const empty = emptySeedImagePaths();
  try {
    const rows = await readCatalogue(args.tenantId, args.order);
    const needs = rows.categories.some((row) => row.missing) || rows.collections.some((row) => row.missing) || rows.products.some((row) => row.missing) || rows.blogs.some((row) => row.missing);
    if (!needs) return empty;

    const assignment = assignSeedPhotos(args.industry, {
      products: rows.products.length,
      categories: rows.categories.length,
      collections: rows.collections.length,
      blogs: rows.blogs.length,
    });
    const wanted = new Map<string, StockImage>();
    const add = (photo: StockImage | null | undefined) => {
      if (photo) wanted.set(photo.id, photo);
    };
    add(assignment.hero);
    rows.products.forEach((row, i) => {
      if (row.missing) add(assignment.products[i]);
    });
    rows.categories.forEach((row, i) => {
      if (row.missing) add(assignment.categories[i]);
    });
    rows.collections.forEach((row, i) => {
      if (row.missing) add(assignment.collections[i]);
    });
    rows.blogs.forEach((row, i) => {
      if (row.missing) add(assignment.blogs[i]);
    });

    const fetchPhoto = args.fetchPhoto ?? fetchSeedPhoto;
    const stored = new Map<string, string>();
    for (const photo of wanted.values()) {
      const path = await importPhoto(args.tenantId, args.userId, photo, fetchPhoto);
      if (path) stored.set(photo.id, path);
    }

    const supabase = await createSupabaseServerClient();
    const paths = emptySeedImagePaths();
    const heroPath = assignment.hero ? stored.get(assignment.hero.id) ?? null : null;
    if (heroPath) {
      paths.hero = heroPath;
      paths.attached = true;
    }

    for (const [i, row] of rows.categories.entries()) {
      const photoId = assignment.categories[i]?.id ?? "";
      const path = row.missing ? stored.get(photoId) : undefined;
      if (!path) continue;
      const { error } = await supabase.from("categories").update({ image_path: path }).eq("tenant_id", args.tenantId).eq("id", row.id).is("image_path", null);
      if (error) {
        skipped(args.tenantId, photoId, mapDbError(error));
        continue;
      }
      paths.categoryById[row.id] = path;
      paths.attached = true;
    }
    for (const [i, row] of rows.collections.entries()) {
      const photoId = assignment.collections[i]?.id ?? "";
      const path = row.missing ? stored.get(photoId) : undefined;
      if (!path) continue;
      // image_path only. saveCollection also replaces the product list.
      const { error } = await supabase.from("collections").update({ image_path: path }).eq("tenant_id", args.tenantId).eq("id", row.id).is("image_path", null);
      if (error) {
        skipped(args.tenantId, photoId, mapDbError(error));
        continue;
      }
      paths.collectionById[row.id] = path;
      paths.attached = true;
    }
    for (const [i, row] of rows.blogs.entries()) {
      const photoId = assignment.blogs[i]?.id ?? "";
      const path = row.missing ? stored.get(photoId) : undefined;
      if (!path) continue;
      const { error } = await supabase.from("blog_posts").update({ cover_path: path }).eq("tenant_id", args.tenantId).eq("id", row.id).is("cover_path", null);
      if (error) {
        skipped(args.tenantId, photoId, mapDbError(error));
        continue;
      }
      paths.attached = true;
    }
    for (const [i, row] of rows.products.entries()) {
      const path = row.missing ? stored.get(assignment.products[i]?.id ?? "") : undefined;
      if (!path) continue;
      try {
        await attachLibraryImages(args.tenantId, row.id, [path]);
        paths.attached = true;
      } catch (err) {
        skipped(args.tenantId, assignment.products[i]?.id ?? row.id, err);
      }
    }
    return paths;
  } catch (err) {
    skipped(args.tenantId, "catalogue", err);
    return empty;
  }
}
