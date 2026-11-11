"use client";

import { useState } from "react";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { INFO_CATEGORIES } from "../categories";
import type { InfoSite } from "../model";
import { SOCIAL_NETWORKS } from "../schemas";
import { FONT_PAIRS } from "../themes/fonts";
import {
  closeSiteAction,
  saveAppearanceAction,
  saveBusinessInfoAction,
  saveHoursAction,
  saveNotificationSettingsAction,
  saveSeoAction,
  saveSiteOptionsAction,
  saveSocialLinksAction,
} from "../actions";
import { ActionForm, ImageField } from "./ui";

export type ThemeOption = { id: string; name: string; bestFor: string };

/** Switch design (content is kept), colours, font pair, logo, favicon, hero image. */
export function AppearanceForm({ site, themes, images, previewName }: { site: InfoSite; themes: ThemeOption[]; images: { logo: string | null; favicon: string | null; hero: string | null }; previewName: string }) {
  const [themeId, setThemeId] = useState(site.themeId);
  const [custom, setCustom] = useState(Boolean(site.primaryColor || site.secondaryColor));
  const [primary, setPrimary] = useState(site.primaryColor ?? "#0f2a44");
  const [secondary, setSecondary] = useState(site.secondaryColor ?? "#4a5b6c");
  return (
    <ActionForm action={saveAppearanceAction} submitLabel="Save appearance" success="Saved. Your content stays the same in every design.">
      {(e) => (
        <>
          <fieldset>
            <legend className="mb-2 text-small font-medium">Design</legend>
            <input type="hidden" name="themeId" value={themeId} />
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {themes.map((t) => (
                <li key={t.id}>
                  <label className={cn("block cursor-pointer overflow-hidden rounded-lg border focus-within:outline-2 focus-within:outline-accent", themeId === t.id ? "border-accent ring-2 ring-accent/30" : "border-border")}>
                    <input type="radio" name="themePick" value={t.id} checked={themeId === t.id} onChange={() => setThemeId(t.id)} className="sr-only" aria-labelledby={`th-${t.id}`} />
                    {/* eslint-disable-next-line @next/next/no-img-element -- static thumbnail */}
                    <img src={`/informative/themes/${t.id}.webp`} alt="" width={640} height={400} loading="lazy" className="aspect-[8/5] w-full object-cover" />
                    <span className="block p-3">
                      <span id={`th-${t.id}`} className="block text-small font-semibold">{t.name}</span>
                      <span className="block text-caption text-muted">{t.bestFor}</span>
                    </span>
                  </label>
                  <a href={`/informative/preview/${t.id}?name=${encodeURIComponent(previewName)}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-caption font-medium text-accent hover:underline">
                    Preview {t.name}
                  </a>
                </li>
              ))}
            </ul>
            {e.themeId ? <p className="mt-1 text-small text-error">{e.themeId[0]}</p> : null}
          </fieldset>
          <fieldset className="space-y-3 rounded-lg border border-border p-4">
            <legend className="px-1 text-small font-medium">Colours</legend>
            <CheckboxField label="Use my own brand colours" name="useCustomColours" checked={custom} onChange={(ev) => setCustom(ev.target.checked)} hint="Text colours are adjusted automatically so everything stays readable." />
            {custom ? (
              <div className="flex flex-wrap gap-6">
                <label className="text-small font-medium">
                  Primary
                  <input type="color" value={primary} onChange={(ev) => setPrimary(ev.target.value)} className="mt-1 block h-10 w-20" />
                  <input type="hidden" name="primaryColor" value={primary} />
                </label>
                <label className="text-small font-medium">
                  Secondary
                  <input type="color" value={secondary} onChange={(ev) => setSecondary(ev.target.value)} className="mt-1 block h-10 w-20" />
                  <input type="hidden" name="secondaryColor" value={secondary} />
                </label>
              </div>
            ) : null}
          </fieldset>
          <SelectField label="Fonts" name="fontPair" defaultValue={site.fontPair ?? ""} options={[{ value: "", label: "The design's own fonts" }, ...FONT_PAIRS.map((p) => ({ value: p.id, label: p.label }))]} errors={e.fontPair} />
          <div className="grid gap-6 sm:grid-cols-3">
            <ImageField name="logoPath" label="Logo" initialPath={site.logoPath} initialUrl={images.logo} />
            <ImageField name="faviconPath" label="Favicon" initialPath={site.faviconPath} initialUrl={images.favicon} hint="Square image, at least 64×64." />
            <ImageField name="heroImagePath" label="Hero image" initialPath={site.heroImagePath} initialUrl={images.hero} />
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function BusinessInfoForm({ site }: { site: InfoSite }) {
  const c = site.contact;
  const [same, setSame] = useState(!c.whatsapp || c.whatsapp === c.phone);
  return (
    <ActionForm action={saveBusinessInfoAction}>
      {(e) => (
        <>
          <TextField label="Business name" name="businessName" defaultValue={site.businessName} required maxLength={80} errors={e.businessName} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Category" name="category" defaultValue={site.category} options={INFO_CATEGORIES.map((x) => ({ value: x.id, label: x.label }))} errors={e.category} />
            <TextField label="Tagline" name="tagline" defaultValue={site.tagline ?? ""} maxLength={120} optional errors={e.tagline} />
          </div>
          <TextAreaField label="About your business" name="about" defaultValue={site.about ?? ""} rows={5} maxLength={5000} optional errors={e.about} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Phone" name="phone" type="tel" defaultValue={c.phone ?? ""} required errors={e.phone} />
            <TextField label="Email" name="email" type="email" defaultValue={c.email ?? ""} required errors={e.email} />
          </div>
          <CheckboxField label="WhatsApp number is the same as phone" name="whatsappSameAsPhone" checked={same} onChange={(ev) => setSame(ev.target.checked)} />
          {!same ? <TextField label="WhatsApp number" name="whatsapp" type="tel" defaultValue={c.whatsapp ?? ""} optional errors={e.whatsapp} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="City" name="city" defaultValue={c.city ?? ""} required errors={e.city} />
            <TextField label="Map link" name="mapUrl" type="url" defaultValue={c.mapUrl ?? ""} optional errors={e.mapUrl} hint="Google Maps share link (https://…)." />
          </div>
          <TextField label="Full address" name="address" defaultValue={c.address ?? ""} maxLength={300} optional errors={e.address} />
        </>
      )}
    </ActionForm>
  );
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_NUM = [1, 2, 3, 4, 5, 6, 0];

export function HoursForm({ site }: { site: InfoSite }) {
  const initial = DAY_NUM.map((day) => site.hours.find((h) => h.day === day) ?? { day, open: "09:00", close: "18:00", closed: day === 0 });
  const [rows, setRows] = useState(initial);
  return (
    <ActionForm action={saveHoursAction}>
      {() => (
        <>
          <input type="hidden" name="hours" value={JSON.stringify(rows)} />
          <table className="w-full text-small">
            <caption className="sr-only">Opening hours</caption>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.day} className="border-b border-border last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-medium">{DAYS[i]}</th>
                  <td className="py-2 pr-3">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={r.closed} onChange={(ev) => setRows((x) => x.map((y, j) => (j === i ? { ...y, closed: ev.target.checked } : y)))} className="size-4" />
                      Closed
                    </label>
                  </td>
                  <td className="py-2">
                    <span className="flex items-center gap-2">
                      <input type="time" aria-label={`${DAYS[i]} opens`} value={r.open} disabled={r.closed} onChange={(ev) => setRows((x) => x.map((y, j) => (j === i ? { ...y, open: ev.target.value } : y)))} className="rounded-md border border-border bg-surface px-2 py-1" />
                      –
                      <input type="time" aria-label={`${DAYS[i]} closes`} value={r.close} disabled={r.closed} onChange={(ev) => setRows((x) => x.map((y, j) => (j === i ? { ...y, close: ev.target.value } : y)))} className="rounded-md border border-border bg-surface px-2 py-1" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </ActionForm>
  );
}

export function SocialLinksForm({ site }: { site: InfoSite }) {
  return (
    <ActionForm action={saveSocialLinksAction}>
      {(e) => (
        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIAL_NETWORKS.map((n) => (
            <TextField key={n} label={n === "x" ? "X (Twitter)" : n.charAt(0).toUpperCase() + n.slice(1)} name={n} type="url" defaultValue={site.socialLinks[n] ?? ""} placeholder="https://" optional errors={e[n]} />
          ))}
        </div>
      )}
    </ActionForm>
  );
}

export function SeoForm({ site, ogUrl }: { site: InfoSite; ogUrl: string | null }) {
  return (
    <ActionForm action={saveSeoAction}>
      {(e) => (
        <>
          <TextField label="Site title" name="title" defaultValue={site.seo.title ?? ""} maxLength={70} optional errors={e.title} hint="Shown in Google and browser tabs. Up to 70 characters." />
          <TextAreaField label="Meta description" name="description" defaultValue={site.seo.description ?? ""} rows={3} maxLength={160} optional errors={e.description} hint="Up to 160 characters." />
          <ImageField name="ogImagePath" label="Social share image" initialPath={site.seo.ogImagePath} initialUrl={ogUrl} hint="1200×630 works best." />
        </>
      )}
    </ActionForm>
  );
}

export function SiteOptionsForm({ site }: { site: InfoSite }) {
  return (
    <ActionForm action={saveSiteOptionsAction}>
      {(e) => (
        <>
          <TextField label="Message after an enquiry is sent" name="enquirySuccessMessage" defaultValue={site.options.enquirySuccessMessage ?? ""} maxLength={300} optional errors={e.enquirySuccessMessage} placeholder="Thanks! We'll get back to you within a day." />
          <CheckboxField label="Ask for a preferred date and time on the enquiry form" name="showPreferredDateTime" defaultChecked={site.options.showPreferredDateTime ?? false} hint="Always shown for clinics, salons, gyms and academies." />
          <TextAreaField label="Privacy text" name="privacyText" defaultValue={site.options.privacyText ?? ""} rows={5} maxLength={5000} optional errors={e.privacyText} hint="Linked from the enquiry form. Leave empty to use the standard text." />
        </>
      )}
    </ActionForm>
  );
}

export function NotificationForm({ value }: { value: { notifyEmail: string | null; notifyEmailEnabled: boolean; notifyWhatsappEnabled: boolean } }) {
  return (
    <ActionForm action={saveNotificationSettingsAction}>
      {(e) => (
        <>
          <CheckboxField label="Email me when someone sends an enquiry" name="notifyEmailEnabled" defaultChecked={value.notifyEmailEnabled} />
          <TextField label="Send enquiry emails to" name="notifyEmail" type="email" defaultValue={value.notifyEmail ?? ""} optional errors={e.notifyEmail} />
          <CheckboxField label="WhatsApp alerts (when available for your account)" name="notifyWhatsappEnabled" defaultChecked={value.notifyWhatsappEnabled} />
        </>
      )}
    </ActionForm>
  );
}

export function CloseSiteForm({ slug }: { slug: string }) {
  return (
    <ActionForm action={closeSiteAction} submitLabel="Delete website" className="space-y-3">
      {(e) => <TextField label={`Type ${slug} to confirm`} name="confirmSlug" autoComplete="off" required errors={e.confirmSlug} />}
    </ActionForm>
  );
}
