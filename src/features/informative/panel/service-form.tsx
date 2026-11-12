"use client";

import { useState } from "react";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { PRICE_TYPES, PRICE_TYPE_LABELS, priceTypeNeedsAmount, type PriceType } from "../pricing";
import type { InfoService } from "../model";
import { saveServiceAction } from "../actions";
import { ActionForm, ImageField } from "./ui";

/** Create / edit a service (name, slug, descriptions, image, price type + price, duration, category, flags, SEO). */
export function ServiceForm({ service, imageUrl }: { service?: InfoService; imageUrl?: string | null }) {
  const [priceType, setPriceType] = useState<PriceType>(service?.priceType ?? "FIXED");
  return (
    <ActionForm action={saveServiceAction} submitLabel={service ? "Save service" : "Add service"} redirectTo="/informative/services">
      {(e) => (
        <>
          {service ? <input type="hidden" name="id" value={service.id} /> : null}
          <TextField label="Name" name="name" defaultValue={service?.name} required maxLength={120} errors={e.name} />
          <TextField label="Short description" name="shortDescription" defaultValue={service?.shortDescription ?? ""} maxLength={300} optional errors={e.shortDescription} hint="One line shown on service cards." />
          <TextAreaField label="Description" name="description" defaultValue={service?.description ?? ""} rows={6} maxLength={10000} optional errors={e.description} hint="Plain text. Line breaks are kept." />
          <ImageField name="imagePath" label="Image" initialPath={service?.imagePath} initialUrl={imageUrl} />
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              label="Price type"
              name="priceType"
              value={priceType}
              onChange={(ev) => setPriceType(ev.target.value as PriceType)}
              options={PRICE_TYPES.map((p) => ({ value: p, label: PRICE_TYPE_LABELS[p] }))}
              errors={e.priceType}
            />
            <TextField
              label="Price (₹)"
              name="pricePaise"
              inputMode="decimal"
              defaultValue={service?.pricePaise != null ? String(service.pricePaise / 100) : ""}
              disabled={!priceTypeNeedsAmount(priceType)}
              optional={!priceTypeNeedsAmount(priceType)}
              errors={e.pricePaise}
            />
            <TextField label="Duration (minutes)" name="durationMinutes" inputMode="numeric" defaultValue={service?.durationMinutes ?? ""} optional errors={e.durationMinutes} />
          </div>
          <TextField label="Category" name="category" defaultValue={service?.category ?? ""} maxLength={60} optional errors={e.category} />
          <TextField label="Address (URL)" name="slug" defaultValue={service?.slug ?? ""} optional errors={e.slug} hint="Leave empty to create one from the name, e.g. /services/hair-cut." />
          <div className="flex flex-wrap gap-6">
            <CheckboxField label="Show on website" name="isActive" defaultChecked={service?.isActive ?? true} />
            <CheckboxField label="Featured" name="isFeatured" defaultChecked={service?.isFeatured ?? false} />
          </div>
          <fieldset className="space-y-4 rounded-lg border border-border p-4">
            <legend className="px-1 text-small font-medium">Search engines (optional)</legend>
            <TextField label="SEO title" name="seoTitle" defaultValue={service?.seo.title ?? ""} maxLength={70} optional errors={e.seoTitle} />
            <TextField label="SEO description" name="seoDescription" defaultValue={service?.seo.description ?? ""} maxLength={160} optional errors={e.seoDescription} />
          </fieldset>
        </>
      )}
    </ActionForm>
  );
}
