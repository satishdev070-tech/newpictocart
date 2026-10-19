import type { CSSProperties } from "react";
import { ArrowRight, Award, CalendarDays, CheckCircle2, ChevronRight, Clock3, HeartHandshake, Menu, Phone, Quote, ShieldCheck } from "lucide-react";
import { FONT_STACKS, type FontKey } from "@/features/theme/schema/tokens";
import type { MarketplaceTheme } from "@/features/theme/marketplace/types";
import { sampleStyle } from "../sample-store";
import type { SamplePhoto } from "./theme-sample-store";

/* eslint-disable @next/next/no-img-element -- this is an intentionally unoptimised, remote-photo theme preview. */

type TemplateKind = "consultancy" | "interiors" | "restaurant" | "clinic" | "wedding" | "architecture" | "loans" | "visa" | "salon" | "cleaning";
type Profile = {
  kind: TemplateKind;
  utility: string;
  nav: string[];
  primaryAction: string;
  secondaryAction?: string;
  eyebrow: string;
  headline: string;
  copy: string;
  storyEyebrow: string;
  storyTitle: string;
  storyCopy: string;
  cards: [string, string][];
  stats: [string, string][];
};
type PreviewColors = { primary: string; secondary: string; accent: string; background: string; text: string; border: string };

const PROFILES: Record<string, Profile> = {
  "global-vision": {
    kind: "consultancy", utility: "info@globalvision.com  ·  +91 11 7892 3232", nav: ["Home", "About us", "Blog", "Services", "Contact us"], primaryAction: "Book free consultation", eyebrow: "Welcome to Global Vision", headline: "Your trusted partner for study & immigration abroad", copy: "From choosing the right country to landing your visa, our certified counsellors guide every step.", storyEyebrow: "About Global Vision", storyTitle: "Turning global ambitions into success", storyCopy: "A clear, human process for students and families making their next move with confidence.", cards: [["Profile assessment", "A practical route based on your goals."], ["University matching", "Shortlists made for the right fit."], ["Visa guidance", "Documentation, interview and arrival support."]], stats: [["18+", "years guiding students"], ["4.9/5", "family satisfaction"], ["32", "countries supported"]],
  },
  "urbanistic-studio": {
    kind: "interiors", utility: "+1 (555) 210-4870  ·  studio@urbanistic.com", nav: ["Home", "About us", "Blog", "Services", "Projects"], primaryAction: "Get quote", secondaryAction: "View portfolio", eyebrow: "Curated materials", headline: "Craft in every detail", copy: "Bespoke interiors that make considered spaces feel deeply personal.", storyEyebrow: "Why Urbanistic", storyTitle: "Built on five promises", storyCopy: "From the first concept through the final styling day, every detail is designed around the way you live.", cards: [["Full-service interiors", "A complete process, from brief to final styling."], ["Material intelligence", "Tactile finishes chosen to age beautifully."], ["Calm collaboration", "One experienced studio from start to finish."]], stats: [["126", "completed homes"], ["18", "years of practice"], ["5", "studio promises"]],
  },
  "pan-pizza": {
    kind: "restaurant", utility: "+1 234 567 8901  ·  order@panpizza.com", nav: ["Home", "About us", "Menu", "Services", "Contact us"], primaryAction: "Order now", secondaryAction: "See the menu", eyebrow: "Wood fired perfection", headline: "Every slice tells a story", copy: "Hand-tossed dough, slow sauce and a fire that never dies down.", storyEyebrow: "Our story", storyTitle: "Fourteen years of dough, fire and family", storyCopy: "Neighbourhood food made slowly, served warmly and remembered long after the last slice.", cards: [["Wood-fired pizza", "Slow-fermented dough and seasonal toppings."], ["Family table", "Big plates, better conversations."], ["Private events", "A generous menu for every celebration."]], stats: [["14", "years in the neighbourhood"], ["12k", "slices served monthly"], ["4.9/5", "guest rating"]],
  },
  "medicare-clinic": {
    kind: "clinic", utility: "+11-898-788-1234  ·  contact@medicare.com", nav: ["Home", "About us", "Blog", "Services", "Contact us"], primaryAction: "Book appointment", eyebrow: "Modern diagnostics on site", headline: "Compassionate care backed by modern medicine", copy: "Specialists, diagnostics and clear next steps under one reassuring roof.", storyEyebrow: "About us", storyTitle: "Care that puts patients first", storyCopy: "Modern treatment is better when it feels considered, understandable and close to home.", cards: [["Cardiology", "Specialist care and diagnostics."], ["Dental care", "Prevention and treatment made simple."], ["Eye care", "Comprehensive vision support."]], stats: [["5+", "years of care"], ["15", "specialist doctors"], ["37k", "patients treated"]],
  },
  "wedding-wonders": {
    kind: "wedding", utility: "9876543210  ·  info@weddingwonders.com", nav: ["Home", "About us", "Blog", "Wedding ceremony", "Contact us"], primaryAction: "Get started", eyebrow: "Welcome to Wedding Wonders", headline: "Where love finds its perfect match", copy: "A warm, trusted space for meaningful introductions and beautiful beginnings.", storyEyebrow: "Welcome to", storyTitle: "A little more about your love story", storyCopy: "Every connection deserves thoughtfulness, privacy and a celebration of what makes two people belong together.", cards: [["Thoughtful profiles", "Start with values that feel like yours."], ["Private introductions", "A considered and secure experience."], ["Real celebrations", "Stories from members who found their match."]], stats: [["1000+", "happy marriages"], ["12k", "verified profiles"], ["15", "years of trust"]],
  },
  archgenius: {
    kind: "architecture", utility: "+11-898-788-1234  ·  business@archgenius.com", nav: ["Home", "About us", "Blog", "Services", "Contact us"], primaryAction: "Get a quote", secondaryAction: "Explore our work", eyebrow: "Archgenius studio", headline: "We design spaces people love to live in", copy: "Award-winning architecture and interiors for homes, offices and public spaces across the country.", storyEyebrow: "Why Archgenius", storyTitle: "Numbers are fine. Craft is better.", storyCopy: "We keep teams small, timelines honest and details obsessive. That is how buildings age gracefully.", cards: [["Certified architects", "Technical confidence at every stage."], ["On-time delivery", "A disciplined process with weekly reports."], ["Sustainable first", "Long-life materials and smarter choices."]], stats: [["250+", "projects delivered"], ["18+", "years of practice"], ["14", "design awards"]],
  },
  "easy-loans": {
    kind: "loans", utility: "", nav: ["Home", "About us", "Blog", "Services", "Contact us"], primaryAction: "Apply now", secondaryAction: "Call now", eyebrow: "Easy loans", headline: "Your dream home is closer than you think", copy: "Home loans from 8.4% with doorstep documentation and 48-hour approvals.", storyEyebrow: "Who we are", storyTitle: "Building a brighter financial future, together", storyCopy: "Every loan starts with a conversation—not a form—because the right amount and repayment depend on where you are.", cards: [["Fast approvals", "A clear decision in as little as 48 hours."], ["Low interest rates", "Transparent pricing without the hidden parts."], ["Minimal paperwork", "A guided, digital-first application."], ["Expert guidance", "One advisor through every step."]], stats: [["25,000+", "loans approved"], ["₹1,200Cr", "amount disbursed"], ["48hrs", "average decision"]],
  },
  "envoy-visa": {
    kind: "visa", utility: "+91 98765 43210  ·  info@envoyvisa.com", nav: ["Home", "About us", "Blog", "Services", "Contact us"], primaryAction: "Apply now", secondaryAction: "View countries", eyebrow: "Study · work · settle", headline: "Visas approved in 30 days", copy: "Transparent process, document verification and end-to-end support—from application to arrival.", storyEyebrow: "About Envoy Visa", storyTitle: "Trusted visa guidance for every journey", storyCopy: "For over a decade we have helped students, families and professionals move forward with confidence.", cards: [["Dedicated support", "A named advisor answers your calls."], ["50,000+ customers", "Real experience across countries."], ["Cost-effective plans", "Transparent fees and choices."], ["Interview preparation", "Practice for your embassy day."]], stats: [["12+", "years of experience"], ["98%", "approval record"], ["30", "countries supported"]],
  },
  "belle-curls": {
    kind: "salon", utility: "", nav: ["Home", "About us", "Blog", "Products", "Contact us"], primaryAction: "Book now", eyebrow: "Beauty, crafted with care", headline: "Where expert styling meets genuine care", copy: "A calm, considered experience that leaves you looking—and feeling—like yourself.", storyEyebrow: "What we offer", storyTitle: "Beauty, crafted with care", storyCopy: "From precision cuts to nourishing rituals, every service begins with a proper conversation.", cards: [["Consultation", "A look designed around your life."], ["Premium products", "Only what your hair and skin need."], ["Expert stylists", "Experienced hands, personal attention."]], stats: [["4.9/5", "client rating"], ["12", "specialist stylists"], ["8k", "happy appointments"]],
  },
  "shinex-services": {
    kind: "cleaning", utility: "info@shinex.com  ·  +91 98765 43210", nav: ["Home", "About us", "Services", "Blog", "Contact us"], primaryAction: "Get a quote", secondaryAction: "Enquire now", eyebrow: "Commercial & office cleaning", headline: "Keep your workplace fresh, safe and productive", copy: "Flexible daily, weekly or monthly cleaning for offices, clinics, retail and hospitality.", storyEyebrow: "About ShineX", storyTitle: "Helping you shine, every step of the way", storyCopy: "Clear standards, flexible schedules and a professional team that adapts to your workplace.", cards: [["Home cleaning", "Regular care for apartments and villas."], ["Deep cleaning", "Top-to-bottom cleaning that resets a space."], ["Office cleaning", "Reliable quality for productive teams."], ["Sofa & carpet care", "Practical care for the details."]], stats: [["98%", "customer satisfaction"], ["95%", "on-time arrival"], ["24/7", "support availability"]],
  },
};

const fallbackProfile = (theme: MarketplaceTheme): Profile => ({
  kind: "consultancy", utility: "", nav: ["Home", "About", "Services", "Contact"], primaryAction: "Get in touch", eyebrow: `Welcome to ${theme.name}`, headline: theme.tagline, copy: theme.description, storyEyebrow: "Our approach", storyTitle: "Expert support, built around you", storyCopy: theme.description, cards: theme.features.slice(0, 3).map((feature) => [feature, "Clear, practical support at every step."]) as [string, string][], stats: [["100%", "client focused"], ["4.9/5", "average rating"], ["24/7", "support"]],
});

function SampleImage({ photo, className, priority = false }: { photo?: SamplePhoto; className?: string; priority?: boolean }) {
  if (!photo) return <div className={`bg-black/10 ${className ?? ""}`} />;
  return <img src={photo.url} alt={photo.alt} className={`size-full object-cover ${className ?? ""}`} loading={priority ? undefined : "lazy"} />;
}

function Eyebrow({ children, color }: { children: string; color: string }) {
  return <p className="text-[10px] font-semibold tracking-[.18em] uppercase @3xl:text-xs" style={{ color }}>{children}</p>;
}

export function InformativeTemplatePreview({ theme, photos }: { theme: MarketplaceTheme; photos: SamplePhoto[] }) {
  const p = PROFILES[theme.key] ?? fallbackProfile(theme);
  const s = sampleStyle(theme.preset);
  const c = s.colors;
  const heading = FONT_STACKS[s.headingFont as FontKey]?.stack;
  const body = FONT_STACKS[s.bodyFont as FontKey]?.stack;
  const hero = photos[0];
  const image = photos[1] ?? hero;
  const altImage = photos[2] ?? image;
  const centered = p.kind === "restaurant" || p.kind === "wedding" || p.kind === "salon";
  const darkHeader = p.kind === "restaurant" || p.kind === "architecture";
  const headerBg = darkHeader ? c.secondary : c.background;
  const headerText = darkHeader ? "#fff" : c.text;
  const button: CSSProperties = { background: c.primary, color: "#fff", borderRadius: s.buttonRadius };
  const headingStyle: CSSProperties = { fontFamily: heading, color: c.text, textTransform: s.uppercase ? "uppercase" : "none", letterSpacing: s.uppercase ? ".035em" : undefined };
  const pad = Math.max(32, Math.round(s.sectionGap * 0.72));
  const cardIcons = [ShieldCheck, Award, HeartHandshake, Clock3];

  return (
    <div className="@container min-h-full select-none overflow-hidden" style={{ background: c.background, color: c.text, fontFamily: body }} aria-label={`Sample informative website in the ${theme.name} theme`}>
      {p.utility ? <div className="px-4 py-2 text-center text-[9px] font-medium tracking-[.08em] @3xl:px-8 @3xl:text-left @3xl:text-[10px]" style={{ background: p.kind === "wedding" ? c.primary : c.secondary, color: "#fff" }}>{p.utility}</div> : null}
      <header className="relative z-10 border-b" style={{ background: headerBg, color: headerText, borderColor: darkHeader ? "rgba(255,255,255,.15)" : c.border }}>
        <div className={`relative mx-auto flex max-w-6xl items-center gap-3 px-4 py-3.5 @3xl:px-8 @3xl:py-4 ${centered ? "@3xl:justify-center" : ""}`}>
          <Menu aria-hidden className="size-5 @3xl:hidden" />
          <span className={`text-lg font-semibold @3xl:text-2xl ${centered ? "@3xl:absolute @3xl:left-8" : ""}`} style={{ fontFamily: heading, color: darkHeader ? "#fff" : c.primary }}>{theme.name}</span>
          <nav className="ml-auto hidden items-center gap-5 text-sm @3xl:flex" aria-label="Sample navigation">{p.nav.map((item) => <span key={item}>{item}</span>)}</nav>
          <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold @3xl:ml-3" style={button}>{p.kind === "clinic" ? <CalendarDays className="size-3.5" /> : null}{p.primaryAction}</span>
        </div>
      </header>

      <section className={`relative isolate flex min-h-[360px] items-end overflow-hidden @3xl:min-h-[540px] ${p.kind === "loans" ? "@3xl:min-h-[460px]" : ""}`} style={{ background: `linear-gradient(120deg, ${c.secondary}, ${c.primary})` }}>
        {hero ? <><SampleImage photo={hero} priority className="absolute inset-0 -z-10" /><div className="absolute inset-0 -z-10" style={{ background: p.kind === "loans" || p.kind === "visa" ? "rgba(13,32,49,.48)" : "rgba(0,0,0,.52)" }} /></> : null}
        <div className={`mx-auto w-full max-w-6xl px-5 py-12 @3xl:px-12 @3xl:py-20 ${centered ? "text-center" : ""}`} style={{ color: "#fff" }}>
          <Eyebrow color={p.kind === "restaurant" ? c.accent : "rgba(255,255,255,.86)"}>{p.eyebrow}</Eyebrow>
          <h1 className={`mt-3 max-w-3xl text-4xl leading-[.98] @3xl:text-6xl ${centered ? "@3xl:mx-auto" : ""}`} style={{ fontFamily: heading }}>{p.headline}</h1>
          <p className={`mt-5 max-w-xl text-sm leading-relaxed opacity-90 @3xl:text-base ${centered ? "@3xl:mx-auto" : ""}`}>{p.copy}</p>
          <div className={`mt-7 flex flex-wrap gap-3 ${centered ? "@3xl:justify-center" : ""}`}><span className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold" style={{ background: "#fff", color: c.primary, borderRadius: s.buttonRadius }}>{p.primaryAction}<ArrowRight className="size-4" /></span>{p.secondaryAction ? <span className="inline-flex items-center px-5 py-3 text-sm font-semibold" style={{ border: "1px solid rgba(255,255,255,.8)", borderRadius: s.buttonRadius }}>{p.secondaryAction}</span> : null}</div>
        </div>
      </section>

      <TemplateBody profile={p} images={[image, altImage, photos[3] ?? altImage]} colors={c} headingStyle={headingStyle} pad={pad} button={button} cardIcons={cardIcons} />

      <section className="relative overflow-hidden" style={{ background: c.primary, color: "#fff" }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-5 py-12 text-center @3xl:px-8 @3xl:py-16">
          <Eyebrow color="rgba(255,255,255,.7)">Ready when you are</Eyebrow>
          <h2 className="max-w-2xl text-3xl @3xl:text-4xl" style={{ fontFamily: heading }}>{p.kind === "restaurant" ? "A good table is waiting." : "Let’s make your next step simple."}</h2>
          <span className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold" style={{ background: "#fff", color: c.primary, borderRadius: s.buttonRadius }}>{p.kind === "clinic" ? <CalendarDays className="size-4" /> : <Phone className="size-4" />}{p.primaryAction}</span>
        </div>
      </section>
      <footer style={{ background: darkHeader ? c.secondary : c.text, color: "#fff" }}><div className="mx-auto grid max-w-6xl gap-6 px-5 py-10 text-sm @3xl:grid-cols-4 @3xl:px-8"><div><p className="text-xl" style={{ fontFamily: heading }}>{theme.name}</p><p className="mt-2 max-w-xs opacity-70">{theme.tagline}</p></div>{[["Explore", ...p.nav.slice(0, 3)], ["Contact", "Call us", "Email us", "Visit us"], ["Stay updated", "News", "Stories", "Resources"]].map(([title, ...links]) => <div key={title}><p className="font-semibold">{title}</p><ul className="mt-2 space-y-1.5 opacity-70">{links.map((link) => <li key={link}>{link}</li>)}</ul></div>)}</div></footer>
    </div>
  );
}

function TemplateBody({ profile: p, images, colors: c, headingStyle, pad, button, cardIcons }: { profile: Profile; images: (SamplePhoto | undefined)[]; colors: PreviewColors; headingStyle: CSSProperties; pad: number; button: CSSProperties; cardIcons: typeof ShieldCheck[] }) {
  const base = { paddingTop: pad, paddingBottom: pad };
  const isPortfolio = p.kind === "interiors" || p.kind === "architecture";
  const isRomantic = p.kind === "wedding" || p.kind === "salon" || p.kind === "restaurant";
  const isService = p.kind === "clinic" || p.kind === "loans" || p.kind === "visa" || p.kind === "cleaning";
  return <>
    <section className="mx-auto grid max-w-6xl items-center gap-8 px-5 @3xl:grid-cols-2 @3xl:px-8" style={base}>
      <div className={p.kind === "wedding" ? "@3xl:order-2" : ""}><Eyebrow color={c.accent}>{p.storyEyebrow}</Eyebrow><h2 className="mt-3 text-3xl leading-tight @3xl:text-4xl" style={headingStyle}>{p.storyTitle}</h2><p className="mt-4 max-w-xl text-sm leading-relaxed opacity-80 @3xl:text-base">{p.storyCopy}</p>{p.kind === "consultancy" || p.kind === "visa" ? <ul className="mt-5 grid gap-2 text-sm">{["Clear next steps", "Personal guidance", "Practical support"].map((item) => <li key={item} className="flex items-center gap-2"><CheckCircle2 className="size-4" style={{ color: c.primary }} />{item}</li>)}</ul> : <span className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold" style={button}>Explore more <ChevronRight className="size-4" /></span>}</div>
      <div className={`relative overflow-hidden ${p.kind === "wedding" ? "@3xl:order-1" : ""}`} style={{ aspectRatio: p.kind === "wedding" ? "4 / 5" : "4 / 3", borderRadius: p.kind === "architecture" ? 0 : 20, background: c.border }}><SampleImage photo={images[0]} /><div className="absolute inset-x-5 bottom-5 hidden border p-4 text-sm @3xl:block" style={{ background: "rgba(255,255,255,.92)", borderColor: c.border, color: c.text }}><p className="font-semibold">{p.kind === "interiors" ? "Material, light and lived-in detail." : p.kind === "restaurant" ? "Made slowly. Served warmly." : "A more thoughtful way forward."}</p></div></div>
    </section>

    {isPortfolio ? <PortfolioShowcase profile={p} images={images} colors={c} headingStyle={headingStyle} pad={pad} /> : null}
    {isRomantic ? <RomanticShowcase profile={p} images={images} colors={c} headingStyle={headingStyle} pad={pad} /> : null}
    {isService ? <ServiceShowcase profile={p} images={images} colors={c} headingStyle={headingStyle} pad={pad} cardIcons={cardIcons} /> : null}
    {p.kind === "consultancy" ? <ConsultancySteps colors={c} headingStyle={headingStyle} pad={pad} /> : null}

    <section style={{ background: p.kind === "wedding" || p.kind === "restaurant" ? c.secondary : c.background, color: p.kind === "wedding" || p.kind === "restaurant" ? "#fff" : c.text }}><div className="mx-auto grid max-w-6xl grid-cols-3 gap-3 px-5 py-9 text-center @3xl:gap-8 @3xl:px-8 @3xl:py-12">{p.stats.map(([value, label]) => <div key={label}><p className="text-2xl font-semibold @3xl:text-4xl" style={{ fontFamily: headingStyle.fontFamily }}>{value}</p><p className="mt-1 text-[10px] opacity-70 @3xl:text-xs">{label}</p></div>)}</div></section>

    {p.kind === "architecture" || p.kind === "visa" ? <FaqStrip profile={p} colors={c} headingStyle={headingStyle} pad={pad} /> : <QuoteStrip profile={p} colors={c} headingStyle={headingStyle} pad={pad} />}
  </>;
}

function PortfolioShowcase({ profile, images, colors: c, headingStyle, pad }: { profile: Profile; images: (SamplePhoto | undefined)[]; colors: PreviewColors; headingStyle: CSSProperties; pad: number }) {
  return <section className="mx-auto max-w-6xl px-5 @3xl:px-8" style={{ paddingBottom: pad }}><Eyebrow color={c.accent}>{profile.kind === "architecture" ? "Featured projects" : "Selected spaces"}</Eyebrow><h2 className="mt-3 text-3xl @3xl:text-4xl" style={headingStyle}>{profile.kind === "architecture" ? "Recent work from our studio" : "Spaces with a point of view"}</h2><div className="mt-7 grid gap-3 @3xl:grid-cols-4">{["01 Residence", "02 Business park", "03 Courtyard", "04 Flagship"].map((label, i) => <div key={label} className={`relative min-h-40 overflow-hidden p-4 text-white ${i < 3 ? "@3xl:min-h-72" : "@3xl:col-span-1"}`} style={{ background: c.secondary }}><SampleImage photo={images[i % images.length]} className="absolute inset-0 opacity-55" /><span className="relative text-xs tracking-[.14em] uppercase">{label}</span><span className="absolute right-4 bottom-4 text-sm">View project ↗</span></div>)}</div></section>;
}

function RomanticShowcase({ profile: p, images, colors: c, headingStyle, pad }: { profile: Profile; images: (SamplePhoto | undefined)[]; colors: PreviewColors; headingStyle: CSSProperties; pad: number }) {
  const title = p.kind === "wedding" ? "Stories that begin with a yes" : p.kind === "restaurant" ? "A table full of good things" : "A beauty ritual, made personal";
  return <section style={{ background: p.kind === "wedding" ? c.primary : c.background, color: p.kind === "wedding" ? "#fff" : c.text }}><div className="mx-auto max-w-6xl px-5 @3xl:px-8" style={{ paddingTop: pad, paddingBottom: pad }}><Eyebrow color={p.kind === "wedding" ? "rgba(255,255,255,.72)" : c.accent}>{p.kind === "wedding" ? "Our community" : "Made for moments"}</Eyebrow><h2 className="mt-3 text-3xl @3xl:text-4xl" style={{ ...headingStyle, color: "inherit" }}>{title}</h2><div className="mt-7 grid grid-cols-2 gap-3 @3xl:grid-cols-4">{["A thoughtful beginning", "Made with care", "A shared celebration", "The finishing touch"].map((label, i) => <div key={label} className="overflow-hidden" style={{ borderRadius: 14, background: c.border }}><div className="aspect-[4/5]"><SampleImage photo={images[i % images.length]} /></div><p className="p-3 text-xs font-medium" style={{ color: p.kind === "wedding" ? c.text : "inherit", background: p.kind === "wedding" ? "#fff" : undefined }}>{label}</p></div>)}</div></div></section>;
}

function ServiceShowcase({ profile: p, images, colors: c, headingStyle, pad, cardIcons }: { profile: Profile; images: (SamplePhoto | undefined)[]; colors: PreviewColors; headingStyle: CSSProperties; pad: number; cardIcons: typeof ShieldCheck[] }) {
  return <section className="mx-auto max-w-6xl px-5 @3xl:px-8" style={{ paddingBottom: pad }}><div className="grid gap-8 @3xl:grid-cols-[.8fr_1.2fr]"><div className="overflow-hidden" style={{ minHeight: 250, borderRadius: 18, background: c.border }}><SampleImage photo={images[1] ?? images[0]} /></div><div><Eyebrow color={c.accent}>{p.kind === "clinic" ? "Our departments" : p.kind === "visa" ? "Our expertise" : "Why choose us"}</Eyebrow><h2 className="mt-3 text-3xl @3xl:text-4xl" style={headingStyle}>{p.kind === "loans" ? "Borrowing without the headaches" : p.kind === "cleaning" ? "Cleaning services that work around you" : "The support you need, under one roof"}</h2><div className="mt-6 grid gap-3 @3xl:grid-cols-2">{p.cards.map(([title, copy], i) => { const Icon = cardIcons[i % cardIcons.length]!; return <div key={title} className="border p-4" style={{ borderColor: c.border, borderRadius: 12 }}><Icon className="size-5" style={{ color: c.primary }} /><h3 className="mt-3 text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-relaxed opacity-70">{copy}</p></div>; })}</div></div></div></section>;
}

function ConsultancySteps({ colors: c, headingStyle, pad }: { colors: PreviewColors; headingStyle: CSSProperties; pad: number }) {
  return <section style={{ background: c.background }}><div className="mx-auto max-w-6xl px-5 @3xl:px-8" style={{ paddingTop: pad / 2, paddingBottom: pad }}><Eyebrow color={c.accent}>Our easy process</Eyebrow><h2 className="mt-3 text-3xl @3xl:text-4xl" style={headingStyle}>A clear path from ambition to arrival</h2><ol className="mt-7 grid gap-4 @3xl:grid-cols-3">{[["01", "Tell us your goal"], ["02", "Build the right plan"], ["03", "Move forward with confidence"]].map(([number, title]) => <li key={number} className="border-t pt-4" style={{ borderColor: c.primary }}><span className="text-xs font-semibold" style={{ color: c.primary }}>{number}</span><p className="mt-2 font-semibold">{title}</p><p className="mt-1 text-sm opacity-70">Clear advice, practical details and a dedicated guide.</p></li>)}</ol></div></section>;
}

function QuoteStrip({ profile: p, colors: c, headingStyle, pad }: { profile: Profile; colors: PreviewColors; headingStyle: CSSProperties; pad: number }) {
  return <section style={{ background: c.border }}><div className="mx-auto max-w-4xl px-5 text-center @3xl:px-8" style={{ paddingTop: pad, paddingBottom: pad }}><Quote className="mx-auto size-7" style={{ color: c.primary }} /><p className="mt-4 text-xl leading-relaxed @3xl:text-2xl" style={headingStyle}>{p.kind === "clinic" ? "“They listened, explained everything clearly and made the whole process feel calm.”" : "“A thoughtful experience from the first conversation to the final result.”"}</p><p className="mt-4 text-xs font-semibold" style={{ color: c.primary }}>— A valued {p.kind === "restaurant" ? "guest" : "client"}</p></div></section>;
}

function FaqStrip({ profile: p, colors: c, headingStyle, pad }: { profile: Profile; colors: PreviewColors; headingStyle: CSSProperties; pad: number }) {
  const questions = p.kind === "visa" ? ["How long does visa processing take?", "What documents do I need?", "Do you guarantee approval?"] : ["How much does an architect cost?", "Do you handle approvals?", "Can you work with my contractor?"];
  return <section className="mx-auto max-w-6xl px-5 @3xl:px-8" style={{ paddingTop: pad, paddingBottom: pad }}><div className="grid gap-8 @3xl:grid-cols-[.65fr_1.35fr]"><div><Eyebrow color={c.accent}>Common questions</Eyebrow><h2 className="mt-3 text-3xl" style={headingStyle}>Everything you want to ask first.</h2></div><div>{questions.map((question, i) => <div key={question} className="flex items-center justify-between border-b py-4 text-sm" style={{ borderColor: c.border }}><span><b className="mr-3 opacity-50">0{i + 1}</b>{question}</span><ChevronRight className="size-4" style={{ color: c.primary }} /></div>)}</div></div></section>;
}
