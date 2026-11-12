"use client";

import { useEffect, useRef, useState } from "react";
import { INFO_CATEGORIES, infoCategoryLabel, isInfoCategory } from "../../categories";
import { findServiceType, serviceTypesByFamily } from "../../service-types";
import { slugify } from "../../slug";
import { checkInformativeSlugAction, type SlugCheck } from "../actions";
import { basicInfoStepSchema, LOGO_MAX_BYTES, type InformativeDraft } from "../draft";
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

/** Picker groups: theme family → its service types, in INFO_CATEGORIES order. */
const GROUPS = [...serviceTypesByFamily().entries()];

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
  const [f, setF] = useState<Fields>({
    businessName: str(b.businessName),
    // Drafts from before service types had only a category: treat them as "type your own".
    serviceTypeId: str(b.serviceTypeId) || (str(b.category) ? "custom" : ""),
    serviceType: str(b.serviceType) || (isInfoCategory(b.category) ? infoCategoryLabel(str(b.category)) : ""),
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

  function pickType(id: string) {
    const type = findServiceType(id);
    if (type) setF((prev) => ({ ...prev, serviceTypeId: id, serviceType: type.label, category: type.family }));
    else if (id === "custom") setF((prev) => ({ ...prev, serviceTypeId: id, serviceType: "", category: "" }));
    else setF((prev) => ({ ...prev, serviceTypeId: "", serviceType: "", category: "" }));
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
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return setLogoError("Use a PNG, JPG or WebP image.");
    if (file.size > LOGO_MAX_BYTES) return setLogoError("The logo must be 2 MB or smaller.");
    try {
      setLogo(await toLogoDataUrl(file));
    } catch {
      setLogoError("That image couldn't be read. Try another file.");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = basicInfoStepSchema.safeParse(f);
    const next: Record<string, string> = {};
    if (!f.serviceTypeId) next.serviceTypeId = "Choose the service you offer";
    if (!parsed.success) for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
    // A picked type sets the category itself; only "type your own" shows the category field.
    if (!custom) delete next.category;
    if (slugState && slugState !== "checking" && !slugState.available) next.slug = slugState.reason === "taken" ? "That address is taken." : "That address can't be used.";
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
      <div>
        <h1 id="basic-title" className="font-brand text-3xl sm:text-4xl">Tell us about your business</h1>
        <p className="mt-2 text-[#5E5568]">This shows on your website. You can change it any time.</p>
      </div>
      <div className={`${ui.card} grid gap-5 sm:grid-cols-2`}>
        <label className={`${ui.label} sm:col-span-2`}>
          Business name *
          <input {...a11y("businessName")} className={ui.input} value={f.businessName} onChange={(e) => set("businessName", e.target.value)} maxLength={80} autoComplete="organization" required />
          {err("businessName")}
        </label>
        <label className={`${ui.label} sm:col-span-2`}>
          What service do you offer? *
          <select {...a11y("serviceTypeId", "h-type")} className={ui.input} value={f.serviceTypeId} onChange={(e) => pickType(e.target.value)} required>
            <option value="">Choose your service…</option>
            {GROUPS.map(([family, types]) => (
              <optgroup key={family} label={infoCategoryLabel(family)}>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </optgroup>
            ))}
            <option value="custom">Something else (type your own)</option>
          </select>
          {errors.serviceTypeId ? err("serviceTypeId") : <p id="h-type" className={ui.hint} aria-hidden>We&apos;ll set up your website with services and FAQs for this. You can change everything later.</p>}
        </label>
        {custom ? (
          <>
            <label className={ui.label}>
              Your service *
              <input {...a11y("serviceType")} className={ui.input} value={f.serviceType} onChange={(e) => set("serviceType", e.target.value)} maxLength={60} placeholder="e.g. Yoga retreat" required />
              {err("serviceType")}
            </label>
            <label className={ui.label}>
              Closest category *
              <select {...a11y("category")} className={ui.input} value={f.category} onChange={(e) => set("category", e.target.value)} required>
                <option value="">Choose…</option>
                {INFO_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              {err("category")}
            </label>
          </>
        ) : null}
        <label className={ui.label}>
          Tagline
          <input {...a11y("tagline")} className={ui.input} value={f.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={120} placeholder={picked ? `e.g. ${picked.tagline}` : "e.g. Gentle care for the whole family"} />
          {err("tagline")}
        </label>
        <label className={ui.label}>
          Phone *
          <input {...a11y("phone", "h-phone")} className={ui.input} value={f.phone} onChange={(e) => set("phone", e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" required />
          {errors.phone ? err("phone") : <p id="h-phone" className={ui.hint} aria-hidden>Indian mobile number (+91).</p>}
        </label>
        <div>
          <label className={ui.label}>
            WhatsApp number
            <input {...a11y("whatsapp")} className={ui.input} value={f.whatsappSameAsPhone ? f.phone : f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} disabled={f.whatsappSameAsPhone} type="tel" inputMode="tel" />
          </label>
          <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={f.whatsappSameAsPhone} onChange={(e) => set("whatsappSameAsPhone", e.target.checked)} className="size-4 accent-[#C2410C]" />
            Same as phone
          </label>
          {err("whatsapp")}
        </div>
        <label className={ui.label}>
          Email *
          <input {...a11y("email")} className={ui.input} value={f.email} onChange={(e) => set("email", e.target.value)} type="email" inputMode="email" autoComplete="email" required />
          {err("email")}
        </label>
        <label className={ui.label}>
          City *
          <input {...a11y("city")} className={ui.input} value={f.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" required />
          {err("city")}
        </label>
        <label className={`${ui.label} sm:col-span-2`}>
          Full address
          <input {...a11y("address")} className={ui.input} value={f.address} onChange={(e) => set("address", e.target.value)} autoComplete="street-address" maxLength={300} />
        </label>
        <div className="sm:col-span-2">
          <label className={ui.label} htmlFor="f-logo">Logo</label>
          <div className="mt-1 flex items-center gap-4">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
              <img src={logo} alt="Your logo" width={56} height={56} className="size-14 rounded-xl border border-[#2A2233]/15 bg-white object-contain" />
            ) : null}
            <input id="f-logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => onLogo(e.target.files?.[0])} className="text-sm file:mr-3 file:min-h-11 file:rounded-full file:border-0 file:bg-[#2A2233] file:px-4 file:text-white" aria-describedby="logo-hint" />
            {logo ? (
              <button type="button" className={ui.ghostBtn} onClick={() => setLogo(null)}>Remove</button>
            ) : null}
          </div>
          <p id="logo-hint" className={ui.hint}>Optional. PNG, JPG or WebP, up to 2 MB.</p>
          {logoError ? <p className={ui.error} role="alert">{logoError}</p> : null}
        </div>
        <div className="sm:col-span-2">
        <label className={ui.label}>
          Website address *
          <span className="mt-1 flex items-stretch overflow-hidden rounded-xl border border-[#2A2233]/20 bg-white focus-within:border-[#C2410C]">
            <input
              {...a11y("slug", "h-slug")}
              className="min-h-11 min-w-0 flex-1 px-3 py-2 outline-none"
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
            <span className="flex items-center bg-[#2A2233]/5 px-3 text-sm text-[#5E5568]" aria-hidden>.{rootDomain}</span>
          </span>
        </label>
          {/* Outside the label: announced politely, and not part of the field's accessible name. */}
          <p id="h-slug" className={ui.hint} aria-live="polite">
            {slugState === "checking" ? "Checking…" : slugState?.available ? `✓ ${slugState.slug}.${rootDomain} is available` : slugState?.reason === "taken" ? "That address is taken. Try another." : slugState?.reason === "invalid" ? "Use lowercase letters, numbers and single hyphens." : " "}
          </p>
          {err("slug")}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className={ui.ghostBtn}>← Back</button>
        <button type="submit" className={ui.primaryBtn} disabled={slugState === "checking"}>Continue</button>
      </div>
    </form>
  );
}
