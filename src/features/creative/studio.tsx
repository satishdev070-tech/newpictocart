"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { ArrowRight, Download, ImagePlus, Palette, Sparkles } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/money";
import { MediaPicker } from "@/features/media/components/media-picker";
import { renderCreativeSvg, type Brand, type CreativeTemplate, type CreativeValues, type FieldKey } from "./engine";
import { saveCreativeAction } from "./actions";

const CATEGORY: Record<string, string> = {
  new_arrival: "New arrival", sale: "Sale", festival: "Festival", product_highlight: "Product highlight", collection_launch: "Collection launch",
  bestseller: "Bestseller", limited_edition: "Limited edition", discount: "Discount", announcement: "Announcement",
};

export type CreativeProduct = {
  id: string;
  title: string;
  summary: string | null;
  priceMinor: number | null;
  imagePath: string | null;
  imageUrl: string | null;
};

function fieldLimit(template: CreativeTemplate, key: FieldKey) {
  return template.spec.fields.find((field) => field.key === key)?.max;
}

function within(value: string, limit: number | undefined) {
  return limit ? value.slice(0, limit) : value;
}

/**
 * The visual editor stays deliberately lightweight: templates are rendered locally for instant
 * feedback, while the same validated values are rendered on the server before a PNG is saved.
 * A product selection is a copy-assist only; the action never trusts it as tenant identity.
 */
export function CreativeStudio({ templates, brand, canSave, products = [] }: { templates: CreativeTemplate[]; brand: Brand; canSave: boolean; products?: CreativeProduct[] }) {
  const [key, setKey] = useState(templates[0]?.key ?? "");
  const [category, setCategory] = useState("all");
  const t = templates.find((x) => x.key === key) ?? templates[0];
  const [values, setValues] = useState<CreativeValues>({});
  const [image, setImage] = useState<{ path: string; url: string } | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [state, action] = useActionState(saveCreativeAction, null);
  const { show } = useToast();
  const svg = useMemo(() => (t ? renderCreativeSvg(t, brand, values, image?.url ?? null) : ""), [t, brand, values, image]);
  const categories = useMemo(() => [...new Set(templates.map((template) => template.category))], [templates]);
  const visibleTemplates = category === "all" ? templates : templates.filter((template) => template.category === category);

  useEffect(() => {
    if (!state) return;
    show({
      tone: state.ok ? "success" : "error",
      message: state.ok ? "Design saved to your media library." : state.error.fieldErrors?._form?.[0] ?? state.error.message,
    });
  }, [show, state]);

  if (!t) return <p className="text-small text-muted">No templates are available yet.</p>;
  const errors = state && !state.ok ? (state.error.fieldErrors ?? {}) : {};
  const needsImage = t.spec.fields.some((f) => f.key === "image");
  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? null;

  const chooseProduct = (productId: string) => {
    setSelectedProductId(productId);
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    setValues((current) => {
      const next = { ...current };
      const headlineMax = fieldLimit(t, "headline");
      const summaryMax = fieldLimit(t, "subheadline");
      const priceMax = fieldLimit(t, "price");
      if (headlineMax) next.headline = within(product.title, headlineMax);
      if (summaryMax && product.summary) next.subheadline = within(product.summary, summaryMax);
      if (priceMax && product.priceMinor !== null) next.price = within(formatMoney(product.priceMinor), priceMax);
      return next;
    });
    if (product.imagePath && product.imageUrl) setImage({ path: product.imagePath, url: product.imageUrl });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_340px]">
      <nav aria-label="Creative templates" className="rounded-xl border border-border bg-surface p-3 xl:sticky xl:top-4 xl:self-start">
        <div className="mb-3 flex items-start gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-accent-soft text-accent"><Palette aria-hidden className="size-4" /></span>
          <div>
            <p className="text-small font-semibold">1. Choose a template</p>
            <p className="text-caption text-muted">Every design starts with your current brand kit.</p>
          </div>
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setCategory("all")} aria-pressed={category === "all"} className={`rounded-full border px-2.5 py-1 text-caption font-medium transition-colors ${category === "all" ? "border-accent bg-accent text-accent-foreground" : "border-border bg-surface hover:bg-surface-secondary"}`}>
            All ({templates.length})
          </button>
          {categories.map((item) => (
            <button key={item} type="button" onClick={() => setCategory(item)} aria-pressed={category === item} className={`rounded-full border px-2.5 py-1 text-caption font-medium transition-colors ${category === item ? "border-accent bg-accent text-accent-foreground" : "border-border bg-surface hover:bg-surface-secondary"}`}>
              {CATEGORY[item] ?? item}
            </button>
          ))}
        </div>
        <div className="max-h-[52vh] space-y-1 overflow-y-auto pr-1 xl:max-h-[calc(100vh-17rem)]">
        {visibleTemplates.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => {
              setKey(x.key);
            }}
            aria-pressed={x.key === t.key}
            className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-small transition-colors ${x.key === t.key ? "border-accent/35 bg-accent-soft text-accent" : "border-transparent hover:border-border hover:bg-surface-secondary"}`}
          >
            <span className="min-w-0"><span className="block truncate font-medium">{x.name}</span><span className="mt-0.5 block text-caption text-muted">{CATEGORY[x.category] ?? x.category}</span></span>
            <span className="shrink-0 text-caption text-muted">{x.width}×{x.height}</span>
          </button>
        ))}
        </div>
      </nav>

      <div className="rounded-xl border border-border bg-surface-secondary/65 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-small font-semibold">2. Preview your creative</p>
            <p className="text-caption text-muted">{CATEGORY[t.category] ?? t.category} · {t.width} × {t.height}px</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent-soft px-2.5 py-1 text-caption font-medium text-accent"><Sparkles aria-hidden className="size-3" /> Brand applied</span>
        </div>
        <div className="mx-auto max-w-[560px] overflow-hidden rounded-md shadow-sm" style={{ aspectRatio: `${t.width}/${t.height}` }} aria-label="Design preview" role="img">
          <div className="size-full [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-caption text-muted">
          <span className="inline-flex items-center gap-1"><span className="size-3 rounded-full border border-black/10" style={{ backgroundColor: brand.colors.primary }} /> Primary</span>
          <span className="inline-flex items-center gap-1"><span className="size-3 rounded-full border border-black/10" style={{ backgroundColor: brand.colors.accent }} /> Accent</span>
          <span>{brand.logoHref ? "Your logo is included" : "Your store name is used as the wordmark"}</span>
        </div>
        <p className="mt-2 text-center text-caption text-muted">Template v{t.version}. The saved PNG is rendered from the same preview and keeps your selected media in your store library.</p>
      </div>

      <form action={action} className="space-y-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
        <input type="hidden" name="template" value={t.key} />
        <input type="hidden" name="imagePath" value={image?.path ?? ""} />
        <div className="rounded-lg border border-border bg-surface-secondary/55 p-3">
          <div className="flex items-start gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"><ImagePlus aria-hidden className="size-4" /></span>
            <div className="min-w-0">
              <p className="text-small font-semibold">3. Start from a product</p>
              <p className="text-caption text-muted">Optional: fill product copy, price and its first image in one step.</p>
            </div>
          </div>
          {products.length ? (
            <div className="mt-3">
              <label htmlFor="creative-product" className="mb-1.5 block text-label">Product</label>
              <select id="creative-product" value={selectedProductId} onChange={(event) => chooseProduct(event.target.value)} className="h-9 w-full rounded-md border border-border bg-surface px-2.5 text-small focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15">
                <option value="">Custom creative — choose copy and image yourself</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}
              </select>
              {selectedProduct ? <p className="mt-1.5 text-caption text-success">Copy{selectedProduct.imageUrl ? " and the product image" : ""} added. You can refine everything below.</p> : null}
            </div>
          ) : (
            <p className="mt-3 text-caption text-muted">Add an active product to use product-led copy here.</p>
          )}
        </div>
        {needsImage ? (
          <div>
            <p className="mb-1 text-small font-medium">Product image</p>
            <MediaPicker folder="creative" title="Choose a product image" triggerLabel={image ? "Change image" : "Choose image"} onSelect={(items) => items[0] && setImage({ path: items[0].path, url: items[0].url })} />
            <p className="mt-1 text-caption text-muted">Choose a product photo, upload a new asset or browse the stock-photo library.</p>
            {errors.imagePath ? <p className="mt-1 text-caption text-error">{errors.imagePath[0]}</p> : null}
          </div>
        ) : null}
        {t.spec.fields
          .filter((f) => f.key !== "image")
          .map((f) => (
            <TextField
              key={`${t.key}-${f.key}`}
              label={f.label}
              name={f.key}
              maxLength={f.max}
              placeholder={f.placeholder}
              value={values[f.key as FieldKey] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              errors={errors[f.key]}
              optional={!f.required}
            />
          ))}
        <TextField label="Save as" name="name" defaultValue={`${t.name} ${new Date().toLocaleDateString("en-IN")}`} maxLength={120} errors={errors.name} />
        {state && !state.ok ? <p role="alert" className="text-small text-error">{state.error.fieldErrors?._form?.[0] ?? state.error.message}</p> : null}
        {state?.ok ? (
          <p role="status" className="flex flex-wrap items-center gap-2 rounded-md border border-success/25 bg-success/10 px-3 py-2 text-small text-success">
            Saved to your media library (folder “creative”).
            {state.data.url ? (
              <a href={state.data.url} target="_blank" rel="noopener noreferrer" download className="inline-flex items-center gap-1 underline">
                <Download className="size-3.5" aria-hidden /> Download PNG
              </a>
            ) : null}
            <Link href={`/dashboard/marketing/social/posts/new?asset=${encodeURIComponent(state.data.path)}`} className="inline-flex items-center gap-1 font-medium underline">Continue to social post <ArrowRight aria-hidden className="size-3.5" /></Link>
          </p>
        ) : null}
        {canSave ? <SubmitButton size="sm">Render &amp; save PNG</SubmitButton> : <p className="text-small text-muted">You can preview designs but not save them.</p>}
        <Link href="/dashboard/themes" className={buttonClass({ variant: "ghost", size: "sm", className: "!px-0 text-accent" })}>Edit visual brand in Theme editor <ArrowRight aria-hidden /></Link>
      </form>
    </div>
  );
}
