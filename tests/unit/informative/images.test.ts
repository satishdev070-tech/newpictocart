import { beforeEach, describe, expect, it, vi } from "vitest";
import { INFO_CATEGORIES } from "@/features/informative/categories";
import { SERVICE_TYPES } from "@/features/informative/service-types";
import {
  categoryPhotos,
  INFO_PHOTO_ALIASES,
  INFO_PHOTOS_PER_SITE,
  infoPhotoAlt,
  infoPhotoSet,
  photoPoolKey,
  planInfoImages,
  serviceTypePhotos,
} from "@/features/informative/images/catalog";
import { INFO_PHOTO_ROWS } from "@/features/informative/images/photos";
import { completeDraftSchema, parseDraft, parseInfoLocale, EMPTY_DRAFT } from "@/features/informative/onboarding/draft";
import { buildCompletionPayload } from "@/features/informative/onboarding/payload";
import { findInformativeTheme } from "@/features/informative/themes/registry";
import { isUnsplashImageUrl } from "@/features/media/unsplash/photos";

const CURATED_ID = /^photo-\d{10,16}-[0-9a-f]{8,16}$/;

describe("curated informative photos", () => {
  it("every row is a well-formed images.unsplash.com photo with credit and alt text", () => {
    for (const [key, rows] of Object.entries(INFO_PHOTO_ROWS)) {
      expect(rows.length, key).toBeGreaterThanOrEqual(3);
      for (const p of serviceTypePhotos(key)) {
        expect(p.id).toMatch(CURATED_ID);
        expect(isUnsplashImageUrl(p.url)).toBe(true);
        expect(p.photographer.name.length).toBeGreaterThan(0);
        expect(p.alt.length).toBeGreaterThan(0);
      }
    }
  });

  it("every service type has its own list or an alias to an existing one (never a generic fallback)", () => {
    for (const t of SERVICE_TYPES) {
      const key = photoPoolKey(t.id);
      expect(key, t.id).not.toBeNull();
      expect(key === t.id || INFO_PHOTO_ALIASES[t.id] === key, t.id).toBe(true);
    }
    for (const target of Object.values(INFO_PHOTO_ALIASES)) expect(INFO_PHOTO_ROWS[target]).toBeDefined();
    // Every list belongs to a real service type.
    for (const key of Object.keys(INFO_PHOTO_ROWS)) expect(SERVICE_TYPES.some((t) => t.id === key), key).toBe(true);
  });

  it("every service type gets a non-empty set of ≥ 7 unique photos led by its own pool", () => {
    for (const t of SERVICE_TYPES) {
      const set = infoPhotoSet(t.family, t.id);
      expect(set.length, t.id).toBeGreaterThanOrEqual(INFO_PHOTOS_PER_SITE);
      expect(new Set(set.map((p) => p.id)).size).toBe(set.length);
      const own = serviceTypePhotos(t.id).map((p) => p.id);
      expect(own).toContain(set[0]!.id);
    }
  });

  it("every category (and a custom service) gets photos only from that category's service types", () => {
    for (const c of INFO_CATEGORIES) {
      const allowed = new Set(SERVICE_TYPES.filter((t) => t.family === c.id).flatMap((t) => serviceTypePhotos(t.id).map((p) => p.id)));
      const mix = categoryPhotos(c.id);
      expect(mix.length, c.id).toBeGreaterThanOrEqual(INFO_PHOTOS_PER_SITE);
      for (const p of mix) expect(allowed.has(p.id), `${c.id} ${p.id}`).toBe(true);
      const custom = infoPhotoSet(c.id, "custom");
      expect(custom.length).toBeGreaterThanOrEqual(INFO_PHOTOS_PER_SITE);
      for (const p of custom) expect(allowed.has(p.id), `${c.id} custom ${p.id}`).toBe(true);
    }
    // Unknown category → "other".
    expect(infoPhotoSet("nope", null).length).toBeGreaterThanOrEqual(INFO_PHOTOS_PER_SITE);
  });

  it.each([
    ["dentist", /dental|dentist/i],
    ["salon", /hair|salon/i],
    ["gym", /gym|barbell|dumbbell|treadmill|kettlebell/i],
    ["interior_designer", /living room|interior/i],
    ["yoga_studio", /yoga/i],
    ["photographer", /camera|photo/i],
  ])("%s photos are about the service", (id, re) => {
    const set = infoPhotoSet(null, id);
    expect(re.test(set[0]!.alt)).toBe(true);
    expect(set.slice(0, INFO_PHOTOS_PER_SITE).filter((p) => re.test(p.alt)).length).toBeGreaterThanOrEqual(4);
  });

  it("plan: hero + 6 gallery + one per service, deterministic, ≤ 7 unique downloads", () => {
    const a = planInfoImages({ category: "clinic_healthcare", serviceTypeId: "dentist", serviceCount: 6 });
    const b = planInfoImages({ category: "clinic_healthcare", serviceTypeId: "dentist", serviceCount: 6 });
    expect(a).toEqual(b);
    expect(a.gallery).toHaveLength(6);
    expect(a.services).toHaveLength(6);
    expect(a.services[0]!.id).not.toBe(a.gallery[0]!.id); // first service ≠ About photo
    expect(new Set([a.hero, ...a.gallery, ...a.services].map((p) => p.id)).size).toBeLessThanOrEqual(INFO_PHOTOS_PER_SITE);
    expect(planInfoImages({ category: "other", serviceTypeId: "", serviceCount: 0 }).services).toEqual([]);
  });

  it("alt text keeps the credit and fits the 200-char column", () => {
    for (const p of infoPhotoSet("events_community", "wedding_planner")) {
      const alt = infoPhotoAlt(p);
      expect(alt.length).toBeLessThanOrEqual(200);
      expect(alt).toMatch(/Photo: .+ \/ Unsplash$/);
    }
  });
});

describe("completion payload includes relevant images and the locale", () => {
  const theme = findInformativeTheme("nexus-core")!;
  const base = { businessName: "Smile Care", phone: "9876543210", whatsappSameAsPhone: true, email: "hi@smile.in", city: "Pune", address: "", slug: "smile-care" };

  it.each(SERVICE_TYPES.map((t) => [t.id, t.family] as const))("%s", (id, family) => {
    const d = completeDraftSchema.parse({ v: 1, basic: { ...base, category: family, serviceTypeId: id, serviceType: "" }, themeId: theme.id, services: [], servicesSkipped: true });
    const p = buildCompletionPayload(d, theme);
    expect(serviceTypePhotos(id).map((x) => x.id)).toContain(p.images.hero.id);
    expect(p.images.gallery.length).toBeGreaterThanOrEqual(6);
    expect(p.images.services).toHaveLength(p.services.length);
  });

  it("custom service → category photos; seller's own services each get one", () => {
    const d = completeDraftSchema.parse({
      v: 1,
      basic: { ...base, category: "salon_beauty", serviceTypeId: "custom", serviceType: "Mehendi artist" },
      themeId: theme.id,
      services: [
        { name: "Bridal mehendi", priceType: "ON_REQUEST" },
        { name: "Party mehendi", priceType: "ON_REQUEST" },
      ],
    });
    const p = buildCompletionPayload(d, theme);
    expect(p.images.services).toHaveLength(2);
    expect(categoryPhotos("salon_beauty").map((x) => x.id)).toContain(p.images.hero.id);
    expect(p.locale).toBe("en-IN");
  });

  it("locale: ?lang= codes are normalised; unknown values fall back to English without losing the draft", () => {
    expect(parseInfoLocale("hi-IN")).toBe("hi-IN");
    expect(parseInfoLocale("hi")).toBe("hi-IN");
    expect(parseInfoLocale("xx-YY")).toBeNull();
    expect(parseInfoLocale(undefined)).toBeNull();
    const kept = parseDraft({ ...EMPTY_DRAFT, themeId: "nexus-core", locale: "klingon" });
    expect(kept.themeId).toBe("nexus-core");
    expect(kept.locale).toBe("en-IN");
    expect(parseDraft({ v: 1, basic: {} }).locale).toBe("en-IN"); // drafts from before the locale field
    const d = completeDraftSchema.parse({ v: 1, basic: { ...base, category: "gym_fitness", serviceTypeId: "gym", serviceType: "" }, themeId: theme.id, locale: "hi-IN" });
    expect(buildCompletionPayload(d, theme).locale).toBe("hi-IN");
  });
});

// ---- Server seeding, in batches (mocked Supabase + media) -----------------------------------

type Call = { table: string; op: string; payload?: unknown; filters: [string, unknown][] };
const calls: Call[] = [];
/** media_assets rows already imported (folder "seed"). */
let media: { storage_path: string; filename: string }[] = [];
/** info_gallery_items image paths already present. */
let galleryPaths: string[] = [];
let heroSet = false;
const servicesWithImage = new Set<string>();

function builder(table: string) {
  const call: Call = { table, op: "select", filters: [] };
  const b: Record<string, unknown> = {};
  const chain = (fn: (...a: unknown[]) => void) => (...a: unknown[]) => {
    fn(...a);
    return b;
  };
  b.update = chain((p) => Object.assign(call, { op: "update", payload: p }));
  b.insert = (p: unknown) => {
    Object.assign(call, { op: "insert", payload: p });
    calls.push(call);
    for (const r of p as { image_path: string }[]) galleryPaths.push(r.image_path);
    return Promise.resolve({ error: null });
  };
  b.select = chain(() => undefined);
  b.eq = chain((k, v) => call.filters.push([String(k), v]));
  b.is = chain((k, v) => call.filters.push([String(k), v]));
  b.in = chain((k, v) => call.filters.push([String(k), v]));
  b.then = (resolve: (v: unknown) => void) => {
    calls.push(call);
    if (call.op === "select" && table === "media_assets") {
      const names = (call.filters.find(([k]) => k === "filename")?.[1] ?? []) as string[];
      return resolve({ data: media.filter((m) => names.includes(m.filename)), error: null });
    }
    if (call.op === "select" && table === "info_gallery_items") return resolve({ data: galleryPaths.map((image_path) => ({ image_path })), error: null });
    if (call.op === "update" && table === "info_sites") {
      const was = heroSet;
      heroSet = true;
      return resolve({ data: was ? [] : [{ tenant_id: "t" }], error: null });
    }
    if (call.op === "update" && table === "info_services") {
      const slug = String(call.filters.find(([k]) => k === "slug")?.[1]);
      const was = servicesWithImage.has(slug);
      servicesWithImage.add(slug);
      return resolve({ data: was ? [] : [{ id: slug }], error: null });
    }
    return resolve({ data: [], error: null });
  };
  return b;
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ from: (t: string) => builder(t) }) }));
vi.mock("@/features/media/server/media", () => ({
  registerImportedImage: vi.fn(async (tenantId: string, _u: string, input: { filename: string }) => {
    const path = `tenant/${tenantId}/media/${input.filename}`;
    media.push({ storage_path: path, filename: input.filename });
    return { path };
  }),
}));
vi.mock("@/lib/observability/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn() } }));

describe("importInformativeImagesBatch", () => {
  const tenantId = "11111111-1111-4111-8111-111111111111";
  beforeEach(() => {
    calls.length = 0;
    media = [];
    galleryPaths = [];
    heroSet = false;
    servicesWithImage.clear();
  });

  it("imports ≤ 2 photos per call, counts down `remaining` to 0, and downloads each photo once", async () => {
    const { importInformativeImagesBatch, planPhotos } = await import("@/features/informative/images/seed");
    const plan = planInfoImages({ category: "gym_fitness", serviceTypeId: "gym", serviceCount: 3 });
    const total = planPhotos(plan).length;
    const fetched: string[] = [];
    const fetchPhoto = async (url: string) => {
      fetched.push(url);
      return new Uint8Array([1]);
    };
    const remaining: number[] = [];
    for (let i = 0; i < 10; i++) {
      const r = await importInformativeImagesBatch({ tenantId, userId: "u1", plan, serviceSlugs: ["a", "b", "c"], batchSize: 2, fetchPhoto });
      expect(r.imported.length).toBeLessThanOrEqual(2);
      remaining.push(r.remaining);
      if (r.remaining === 0) break;
    }
    expect(remaining).toEqual(Array.from({ length: Math.ceil(total / 2) }, (_, i) => Math.max(0, total - 2 * (i + 1))));
    expect(fetched.every((u) => isUnsplashImageUrl(u))).toBe(true);
    expect(new Set(fetched).size).toBe(fetched.length);
    expect(fetched.length).toBe(total);
    expect(fetched.length).toBeLessThanOrEqual(INFO_PHOTOS_PER_SITE);
    // A call after everything is in imports nothing.
    const again = await importInformativeImagesBatch({ tenantId, userId: "u1", plan, serviceSlugs: ["a", "b", "c"], fetchPhoto });
    expect(again).toMatchObject({ imported: [], remaining: 0 });
    expect(fetched.length).toBe(total);
    // Every gallery photo once, every service an image; tenant-scoped paths.
    expect(galleryPaths).toHaveLength(plan.gallery.length);
    expect(new Set(galleryPaths).size).toBe(galleryPaths.length);
    expect(galleryPaths.every((g) => g.startsWith(`tenant/${tenantId}/`))).toBe(true);
    expect([...servicesWithImage].sort()).toEqual(["a", "b", "c"]);
  });

  it("never overwrites: hero and service updates only where empty, and a seller's own gallery is left alone", async () => {
    const { importInformativeImagesBatch } = await import("@/features/informative/images/seed");
    galleryPaths = ["tenant/x/media/sellers-own.jpg"];
    const plan = planInfoImages({ category: "salon_beauty", serviceTypeId: "salon", serviceCount: 1 });
    for (let i = 0; i < 10; i++) {
      const r = await importInformativeImagesBatch({ tenantId, userId: "u1", plan, serviceSlugs: ["s"], fetchPhoto: async () => new Uint8Array([1]) });
      if (!r.remaining) break;
    }
    expect(calls.some((c) => c.table === "info_gallery_items" && c.op === "insert")).toBe(false);
    expect(galleryPaths).toEqual(["tenant/x/media/sellers-own.jpg"]);
    const updates = calls.filter((c) => c.op === "update");
    expect(updates.length).toBeGreaterThan(0);
    for (const u of updates) {
      const col = u.table === "info_sites" ? "hero_image_path" : "image_path";
      expect(u.filters).toContainEqual([col, null]);
    }
  });

  it("failed downloads are reported, skipped next time, and never loop forever", async () => {
    const { importInformativeImagesBatch, planPhotos } = await import("@/features/informative/images/seed");
    const plan = planInfoImages({ category: "salon_beauty", serviceTypeId: "salon", serviceCount: 1 });
    const total = planPhotos(plan).length;
    const skip: string[] = [];
    let calls = 0;
    for (; calls < 10; calls++) {
      const r = await importInformativeImagesBatch({ tenantId, userId: "u1", plan, serviceSlugs: ["s"], skip, fetchPhoto: async () => Promise.reject(new Error("offline")) });
      expect(r.imported).toEqual([]);
      skip.push(...r.failed);
      if (!r.remaining) break;
    }
    expect(skip).toHaveLength(total);
    expect(calls + 1).toBe(Math.ceil(total / 2));
    expect(media).toEqual([]);
  });
});
