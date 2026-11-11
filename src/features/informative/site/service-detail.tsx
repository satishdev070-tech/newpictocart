import { cn } from "@/lib/cn";
import { formatDuration, formatServicePrice } from "../pricing";
import type { PriceType } from "../pricing";
import { btnPrimary, btnSecondary, Img, Section, whatsappHref } from "./ui";
import type { SiteView } from "./view";

export type ServiceDetailData = { name: string; description: string | null; shortDescription: string | null; imageUrl: string | null; priceType: PriceType; pricePaise: number | null; durationMinutes: number | null; category: string | null };

/** ServiceDetail section: image, description, price / duration and the WhatsApp + enquiry CTAs. */
export function ServiceDetail({ service, view, contactHref }: { service: ServiceDetailData; view: SiteView; contactHref: string }) {
  const price = formatServicePrice(service.priceType, service.pricePaise);
  const duration = formatDuration(service.durationMinutes);
  const wa = whatsappHref(view.contact.whatsapp ?? view.contact.phone, view.businessName);
  const waAbout = wa ? wa.replace(/text=[^&]*/, `text=${encodeURIComponent(`Hi ${view.businessName}, I'd like to know more about ${service.name}.`)}`) : null;
  return (
    <Section>
      <div className="grid items-start gap-10 md:grid-cols-2">
        {service.imageUrl ? <Img src={service.imageUrl} alt="" width={1200} height={900} priority className="aspect-[4/3] w-full rounded-(--if-radius) object-cover" /> : null}
        <div className={cn(!service.imageUrl && "md:col-span-2 md:max-w-3xl")}>
          {service.category ? <p className="mb-2 text-sm font-semibold tracking-wide text-(--if-link) uppercase">{service.category}</p> : null}
          {service.shortDescription ? <p className="text-xl text-(--if-text)">{service.shortDescription}</p> : null}
          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2">
            {price ? (
              <div>
                <dt className="text-sm text-(--if-muted)">Price</dt>
                <dd className="text-lg font-semibold text-(--if-link)">{price}</dd>
              </div>
            ) : null}
            {duration ? (
              <div>
                <dt className="text-sm text-(--if-muted)">Duration</dt>
                <dd className="text-lg font-semibold">{duration}</dd>
              </div>
            ) : null}
          </dl>
          {service.description ? <p className="mt-6 leading-relaxed whitespace-pre-line text-(--if-muted)">{service.description}</p> : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={contactHref} className={btnPrimary}>{view.ctaLabel}</a>
            {waAbout ? (
              <a href={waAbout} target="_blank" rel="noopener noreferrer" data-enquiry-source="WHATSAPP_CLICK" className={cn(btnSecondary, "text-(--if-text)")}>
                Ask on WhatsApp
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </Section>
  );
}
