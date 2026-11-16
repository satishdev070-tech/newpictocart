"use client";

import { useEffect, useRef, useState } from "react";
import { INFO_CATEGORIES, isInfoCategory } from "../../categories";
import { findServiceType, serviceTypesByFamily } from "../../service-types";
import { slugify } from "../../slug";
import { checkInformativeSlugAction, type SlugCheck } from "../actions";
import { basicInfoStepSchema, LOGO_MAX_BYTES, type InformativeDraft } from "../draft";
import { OnbEyebrow, OnbHeading, OnbSub } from "@/components/onboarding-ui";
import { cn } from "@/lib/cn";
import { infoCopy, infoErrorText } from "@/features/start/i18n/info-copy";
import { ui } from "./shell";

type Fields = {
  businessName: string;
  serviceTypeId: string;
  serviceType: string;
  category: string;
  tagline: string;
  phone: string;
  whatsappSameAsPhone: boolean;
  whatsapp: string;
  email: string;
  city: string;
  address: string;
  slug: string;
};

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Service types per category, for the second picker. */
const TYPES_BY_FAMILY = serviceTypesByFamily();

/** Downscale to ≤ 512 px WebP (PNG fallback) in the browser so the draft stays small (no SVG). */
async function toLogoDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const webp = canvas.toDataURL("image/webp", 0.85);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
}

/** Informative Step 1 — basic business info (fields and rules from the plan's Step 1 table). */
export function BasicInfoStep({
  draft,
  rootDomain,
  onSave,
  onBack,
}: {
  draft: InformativeDraft;
  rootDomain: string;
  onSave: (basic: Fields, logoDataUrl: string | null) => void;
  onBack: () => void;
}) {
  const b = draft.basic;
  const c = infoCopy(draft.locale);
  const tb = c.basic;
  const [f, setF] = useState<Fields>({
    businessName: str(b.businessName),
    serviceTypeId: str(b.serviceTypeId),
    serviceType: str(b.serviceType),
    category: str(b.category),
    tagline: str(b.tagline),
    phone: str(b.phone),
    whatsappSameAsPhone: b.whatsappSameAsPhone !== false,
    whatsapp: str(b.whatsapp),
    email: str(b.email),
    city: str(b.city),
    address: str(b.address),
    slug: str(b.slug),
  });
  const [slugTouched, setSlugTouched] = useState(Boolean(str(b.slug)));
  const [logo, setLogo] = useState<string | null>(draft.logoDataUrl);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slugState, setSlugState] = useState<SlugCheck | "checking" | null>(null);
  const checkSeq = useRef(0);

  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => setF((prev) => ({ ...prev, [k]: v }));
  const custom = f.serviceTypeId === "custom";
  const picked = findServiceType(f.serviceTypeId);

  const familyTypes = isInfoCategory(f.category) ? (TYPES_BY_FAMILY.get(f.category) ?? []) : [];

  /** A new category clears a service picked from another category. */
  function pickCategory(category: string) {
    setF((prev) => {
      const keep = prev.serviceTypeId === "custom" || findServiceType(prev.serviceTypeId)?.family === category;
      return { ...prev, category, ...(keep ? {} : { serviceTypeId: "", serviceType: "" }) };
    });
  }

  function pickType(id: string) {
    const type = findServiceType(id);
    setF((prev) => ({ ...prev, serviceTypeId: type || id === "custom" ? id : "", serviceType: type ? type.label : "" }));
  }

  // Suggest the address from the name until the person edits it.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived suggestion
    if (!slugTouched) setF((prev) => ({ ...prev, slug: slugify(prev.businessName, 40) }));
  }, [f.businessName, slugTouched]);

  // Live availability check (debounced; ignores stale responses).
  useEffect(() => {
    const slug = f.slug.trim();
    if (slug.length < 3) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when too short to check
      setSlugState(null);
      return;
    }
    const seq = ++checkSeq.current;
    setSlugState("checking");
    const t = setTimeout(async () => {
      const r = await checkInformativeSlugAction({ slug });
      if (seq !== checkSeq.current) return;
      setSlugState(r.ok ? r.data : null);
    }, 400);
    return () => clearTimeout(t);
  }, [f.slug]);

  async function onLogo(file: File | undefined) {
    setLogoError(null);
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return setLogoError(tb.logoType);
    if (file.size > LOGO_MAX_BYTES) return setLogoError(tb.logoSize);
    try {
      setLogo(await toLogoDataUrl(file));
    } catch {
      setLogoError(tb.logoUnreadable);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = basicInfoStepSchema.safeParse(f);
    const next: Record<string, string> = {};
    if (!parsed.success) for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= infoErrorText(c, issue.message);
    if (slugState && slugState !== "checking" && !slugState.available) next.slug = slugState.reason === "taken" ? tb.taken : tb.unusable;
    setErrors(next);
    if (Object.keys(next).length) {
      document.getElementById(`f-${Object.keys(next)[0]}`)?.focus();
      return;
    }
    onSave(f, logo);
  }

  const err = (k: string) =>
    errors[k] ? (
      // aria-hidden keeps the message out of the label's accessible NAME; aria-describedby still announces it.
      <p id={`e-${k}`} className={ui.error} aria-hidden>
        {errors[k]}
      </p>
    ) : null;
  const a11y = (k: string, hint?: string) => {
    const describedBy = [errors[k] ? `e-${k}` : null, hint ?? null].filter(Boolean).join(" ");
    return { id: `f-${k}`, "aria-invalid": errors[k] ? true : undefined, "aria-describedby": describedBy || undefined };
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6" aria-labelledby="basic-title">
      <div className="flex flex-col gap-3">
        <OnbEyebrow>{tb.eyebrow}</OnbEyebrow>
        <div id="basic-title">
          <OnbHeading>{tb.title}</OnbHeading>
        </div>
        <OnbSub>{tb.sub}</OnbSub>
      </div>
      <div className={`${ui.card} grid gap-5 sm:grid-cols-2`}>
        <label className={`${ui.label} sm:col-span-2`}>
          {tb.businessName} *
          <input {...a11y("businessName")} className={ui.input} value={f.businessName} onChange={(e) => set("businessName", e.target.value)} maxLength={80} autoComplete="organization" required />
          {err("businessName")}
        </label>
        <label className={ui.label}>
          {tb.category} *
          <select {...a11y("category")} className={ui.input} value={f.category} onChange={(e) => pickCategory(e.target.value)} required>
            <option value="">{c.basic.choose}</option>
            {INFO_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>{c.categories[cat.id]}</option>
            ))}
          </select>
          {err("category")}
        </label>
        <label className={ui.label}>
          {tb.service}
          <select {...a11y("serviceTypeId", "h-type")} className={ui.input} value={f.serviceTypeId} onChange={(e) => pickType(e.target.value)} disabled={!f.category}>
            <option value="">{f.category ? tb.serviceChoose : tb.serviceNeedsCategory}</option>
            {familyTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
            <option value="custom">{tb.serviceCustom}</option>
          </select>
          {errors.serviceTypeId ? err("serviceTypeId") : <p id="h-type" className={ui.hint} aria-hidden>{tb.serviceHint}</p>}
        </label>
        {custom ? (
          <label className={`${ui.label} sm:col-span-2`}>
            {tb.customService} *
            <input {...a11y("serviceType")} className={ui.input} value={f.serviceType} onChange={(e) => set("serviceType", e.target.value)} maxLength={60} placeholder={tb.customServicePh} required />
            {err("serviceType")}
          </label>
        ) : null}
        <label className={`${ui.label} sm:col-span-2`}>
          {tb.tagline}
          <input {...a11y("tagline")} className={ui.input} value={f.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={120} placeholder={picked ? tb.taglineExample(picked.tagline) : tb.taglinePh} />
          {err("tagline")}
        </label>
        <label className={ui.label}>
          {tb.phone} *
          <input {...a11y("phone", "h-phone")} className={ui.input} value={f.phone} onChange={(e) => set("phone", e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" required />
          {errors.phone ? err("phone") : <p id="h-phone" className={ui.hint} aria-hidden>{tb.phoneHint}</p>}
        </label>
        <div>
          <label className={ui.label}>
            {tb.whatsapp}
            <input {...a11y("whatsapp")} className={ui.input} value={f.whatsappSameAsPhone ? f.phone : f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} disabled={f.whatsappSameAsPhone} type="tel" inputMode="tel" />
          </label>
          <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-mk-muted">
            <input type="checkbox" checked={f.whatsappSameAsPhone} onChange={(e) => set("whatsappSameAsPhone", e.target.checked)} className={ui.checkbox} />
            {tb.sameAsPhone}
          </label>
          {err("whatsapp")}
        </div>
        <label className={ui.label}>
          {tb.email} *
          <input {...a11y("email")} className={ui.input} value={f.email} onChange={(e) => set("email", e.target.value)} type="email" inputMode="email" autoComplete="email" required />
          {err("email")}
        </label>
        <label className={ui.label}>
          {tb.city} *
          <input {...a11y("city")} className={ui.input} value={f.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" required />
          {err("city")}
        </label>
        <label className={`${ui.label} sm:col-span-2`}>
          {tb.address}
          <input {...a11y("address")} className={ui.input} value={f.address} onChange={(e) => set("address", e.target.value)} autoComplete="street-address" maxLength={300} />
        </label>
        <div className="sm:col-span-2">
          <label className={ui.label} htmlFor="f-logo">{tb.logo}</label>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 sm:gap-4">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
              <img src={logo} alt={tb.logoAlt} width={56} height={56} className="size-14 shrink-0 rounded-[var(--r-sm)] border border-mk-line-strong bg-white object-contain" />
            ) : null}
            <input id="f-logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => onLogo(e.target.files?.[0])} className={`${ui.file} sm:w-auto`} aria-describedby="logo-hint" />
            {logo ? (
              <button type="button" className={ui.ghostBtn} onClick={() => setLogo(null)}>{tb.remove}</button>
            ) : null}
          </div>
          <p id="logo-hint" className={ui.hint}>{tb.logoHint}</p>
          {logoError ? <p className={ui.error} role="alert">{logoError}</p> : null}
        </div>
        <div className="sm:col-span-2">
        <label className={ui.label}>
          {tb.siteAddress} *
          <span className="mt-1.5 flex min-h-12 items-stretch overflow-hidden rounded-[var(--r-sm)] border border-mk-line-strong bg-mk-elev-2 transition-colors focus-within:border-mk-accent focus-within:ring-2 focus-within:ring-mk-accent/30 has-[[aria-invalid=true]]:border-red-500/70">
            <input
              {...a11y("slug", "h-slug")}
              className="min-h-11 min-w-0 flex-1 bg-transparent px-4 py-2 text-[15px] text-mk-text outline-none placeholder:text-mk-dim"
              value={f.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
              }}
              maxLength={63}
              autoCapitalize="none"
              spellCheck={false}
              required
            />
            <span className="flex max-w-[55%] shrink-0 items-center truncate border-l border-mk-line bg-white/[0.04] px-3 text-sm text-mk-muted" aria-hidden>.{rootDomain}</span>
          </span>
        </label>
          {/* Outside the label: announced politely, and not part of the field's accessible name. */}
          <p id="h-slug" className={cn(ui.hint, slugState && slugState !== "checking" && slugState.available && "text-emerald-400")} aria-live="polite">
            {slugState === "checking" ? tb.checking : slugState?.available ? `✓ ${tb.available(`${slugState.slug}.${rootDomain}`)}` : slugState?.reason === "taken" ? tb.takenTryAnother : slugState?.reason === "invalid" ? tb.invalidAddress : " "}
          </p>
          {err("slug")}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className={ui.ghostBtn}>← {c.back}</button>
        <button type="submit" className={ui.primaryBtn} disabled={slugState === "checking"}>{c.continue}</button>
      </div>
    </form>
  );
}
