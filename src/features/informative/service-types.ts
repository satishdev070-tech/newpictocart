import type { InfoCategory } from "./categories";
import type { PriceType } from "./pricing";

/**
 * Service types offered in Informative onboarding (pure data; docs/informative/PROGRESS.md M9).
 *
 * Each type belongs to one of the 9 theme families (`info_sites.category`) and carries a ready-made
 * starter site: tagline, About text, 4–6 services with indicative prices (integer paise) and FAQs.
 * The copy is generic and true for any business of that type (no invented awards, years or
 * reviews); `{name}` and `{city}` are filled in at onboarding. Sellers edit everything afterwards,
 * and the AI build (when configured) rewrites it for their business.
 *
 * Imported only by onboarding and the AI build, never by the public site or the store.
 */

export type SeedService = { name: string; shortDescription: string; priceType: PriceType; pricePaise: number | null; durationMinutes: number | null };
export type SeedFaq = { question: string; answer: string };
export type ServiceType = {
  id: string;
  label: string;
  family: InfoCategory;
  /** Extra search words for the picker. */
  keywords: string;
  tagline: string;
  about: string;
  services: SeedService[];
  faqs: SeedFaq[];
};

type S = [name: string, desc: string, type: PriceType, rupees: number | null, minutes: number | null];
type F = [question: string, answer: string];

function t(id: string, label: string, family: InfoCategory, keywords: string, tagline: string, about: string, services: S[], faqs: F[]): ServiceType {
  return {
    id,
    label,
    family,
    keywords,
    tagline,
    about,
    services: services.map(([name, shortDescription, priceType, rupees, durationMinutes]) => ({
      name,
      shortDescription,
      priceType,
      pricePaise: rupees == null ? null : Math.round(rupees * 100),
      durationMinutes,
    })),
    faqs: faqs.map(([question, answer]) => ({ question, answer })),
  };
}

const BOOK: F = ["How do I book?", "Send us an enquiry on this website or message us on WhatsApp, and we'll confirm a time that suits you."];
const PAY: F = ["How can I pay?", "We accept UPI, cards and cash. We share the full price before we start, so there are no surprises."];
const AREA: F = ["Which areas do you cover?", "We serve {city} and nearby areas. Tell us your location in the enquiry and we'll confirm."];

export const SERVICE_TYPES: readonly ServiceType[] = [
  // ---- Clinic / healthcare ----------------------------------------------------------------------
  t("dentist", "Dentist / Dental clinic", "clinic_healthcare", "dental teeth tooth orthodontist braces",
    "Gentle dental care for the whole family",
    "{name} is a dental clinic in {city} offering check-ups, cleaning, fillings and cosmetic treatments. We explain every option before we begin and keep visits as comfortable as possible.",
    [["Dental check-up", "Examination, advice and a treatment plan if needed.", "FIXED", 300, 20], ["Scaling & polishing", "Professional cleaning for healthier gums.", "STARTING_FROM", 1000, 40], ["Tooth-coloured filling", "Repair cavities with a natural-looking filling.", "STARTING_FROM", 1200, 45], ["Root canal treatment", "Save an infected tooth, usually in 1–2 visits.", "STARTING_FROM", 4500, 60], ["Teeth whitening", "A brighter smile in a single session.", "STARTING_FROM", 6000, 60], ["Braces & aligners", "Consultation for straightening options.", "ON_REQUEST", null, 30]],
    [BOOK, ["Do you treat children?", "Yes, we see patients of all ages, including first dental visits for children."], ["Is root canal treatment painful?", "It's done under local anaesthesia, so most patients feel little more than a filling."], PAY]),
  t("physiotherapist", "Physiotherapist", "clinic_healthcare", "physio rehab back pain sports injury",
    "Move better, recover faster",
    "{name} offers physiotherapy in {city} for back and neck pain, sports injuries and recovery after surgery. Every plan starts with a proper assessment and comes with exercises you can do at home.",
    [["Assessment", "A full assessment and a written recovery plan.", "FIXED", 600, 45], ["Physiotherapy session", "Hands-on treatment and guided exercise.", "FIXED", 700, 45], ["Sports injury rehab", "Get back to training safely.", "STARTING_FROM", 800, 45], ["Post-surgery rehab", "Recovery after knee, hip or spine surgery.", "STARTING_FROM", 800, 45], ["Home visit", "Treatment at home when travel is hard.", "STARTING_FROM", 1200, 45]],
    [BOOK, ["How many sessions will I need?", "It depends on the problem. We'll give you an estimate after the first assessment."], ["Do I need a doctor's referral?", "No. You can book directly; bring any reports you already have."], PAY]),
  t("clinic", "Clinic / General physician", "clinic_healthcare", "doctor gp family physician hospital",
    "Caring doctors, close to home",
    "{name} is a clinic in {city} offering consultations, preventive check-ups and care for long-term conditions. Short waits, unhurried consultations and clear advice.",
    [["General consultation", "Fever, infections, lifestyle concerns and more.", "FIXED", 500, 15], ["Health check-up", "Tests and a doctor's review of your results.", "STARTING_FROM", 1500, 45], ["Diabetes & BP care", "Regular monitoring and a plan that fits your life.", "FIXED", 600, 20], ["Child health check", "Growth, vaccinations and nutrition advice.", "FIXED", 600, 20], ["Home visit", "For elderly or bed-ridden patients nearby.", "ON_REQUEST", null, null]],
    [BOOK, ["Do I need an appointment?", "Appointments are recommended so you don't wait, but walk-ins are welcome during clinic hours."], ["Do you do lab tests?", "Yes, samples can be collected at the clinic and reports are shared on WhatsApp."], PAY]),
  t("diagnostic_lab", "Diagnostic lab / Pathology", "clinic_healthcare", "blood test lab pathology sample collection",
    "Accurate tests, fast reports",
    "{name} is a diagnostic lab in {city} offering blood tests and health packages, with home sample collection and digital reports.",
    [["Complete blood count", "One of the most common routine tests.", "FIXED", 300, null], ["Thyroid profile", "T3, T4 and TSH.", "FIXED", 500, null], ["Full body package", "A wide panel of routine tests in one visit.", "STARTING_FROM", 1500, null], ["Diabetes panel", "Fasting sugar, HbA1c and more.", "FIXED", 700, null], ["Home sample collection", "A trained technician visits your home.", "STARTING_FROM", 100, null]],
    [["How do I get my report?", "Reports are shared on WhatsApp and email, usually within 24 hours."], ["Do I need to fast?", "Some tests need fasting. We'll tell you when you book."], AREA]),
  t("veterinarian", "Veterinarian / Pet clinic", "clinic_healthcare", "vet pet dog cat animal",
    "Kind care for your pets",
    "{name} is a veterinary clinic in {city} for dogs, cats and other pets: check-ups, vaccinations, treatment and advice.",
    [["Pet consultation", "Examination and treatment advice.", "FIXED", 500, 20], ["Vaccination", "Core vaccines on schedule.", "STARTING_FROM", 400, 15], ["Deworming", "Regular deworming for a healthy pet.", "STARTING_FROM", 200, 10], ["Pet health check", "A full check-up with advice on diet and care.", "FIXED", 800, 30], ["Surgery consultation", "Planned procedures, explained clearly.", "ON_REQUEST", null, 30]],
    [BOOK, ["Which animals do you treat?", "Mainly dogs and cats. Ask us about other pets and we'll tell you if we can help."], PAY]),
  t("ayurveda", "Ayurveda / Homeopathy clinic", "clinic_healthcare", "ayurvedic homeopathic panchakarma wellness",
    "Traditional care for modern lives",
    "{name} offers Ayurvedic and holistic consultations in {city}, with treatment plans that fit your routine.",
    [["Consultation", "A detailed consultation and personalised plan.", "FIXED", 500, 30], ["Panchakarma", "Detox therapies over several days.", "STARTING_FROM", 3000, null], ["Abhyanga massage", "Full-body herbal oil massage.", "FIXED", 1500, 60], ["Follow-up visit", "Review your progress and adjust the plan.", "FIXED", 300, 15]],
    [BOOK, ["How long does treatment take?", "It depends on your condition. We'll explain the expected duration at the first consultation."], PAY]),

  // ---- Consultancy / professional services -------------------------------------------------------
  t("chartered_accountant", "CA / Accountant / Tax consultant", "consultancy", "ca accountant gst income tax itr audit bookkeeping",
    "Tax and accounts, handled right",
    "{name} helps individuals and businesses in {city} with income tax, GST, bookkeeping and compliance. Clear advice, on-time filings and answers in plain language.",
    [["Income tax return (ITR)", "Filing for salaried people and professionals.", "STARTING_FROM", 999, null], ["GST registration", "New GST registration, start to finish.", "FIXED", 2500, null], ["GST return filing", "Monthly or quarterly returns, on time.", "STARTING_FROM", 1500, null], ["Bookkeeping", "Clean monthly books.", "STARTING_FROM", 3000, null], ["Company / LLP registration", "Incorporation and post-registration compliance.", "STARTING_FROM", 9999, null], ["Consultation", "Talk through your tax or compliance question.", "FIXED", 1000, 30]],
    [["What documents do I need for ITR?", "PAN, Aadhaar, Form 16 or income details, and bank statements. We'll send you a checklist."], ["Can you work with us online?", "Yes. Most of our clients share documents online; we meet on phone or video when needed."], ["How do you charge?", "A fixed fee for defined work, agreed before we start."]]),
  t("lawyer", "Lawyer / Advocate", "consultancy", "advocate legal law firm court notary",
    "Clear legal advice you can act on",
    "{name} provides legal advice and representation in {city} for property, family, civil and business matters. We explain your options plainly and keep you updated at every step.",
    [["Legal consultation", "Understand your position and options.", "FIXED", 1500, 45], ["Legal notice drafting", "A properly drafted notice, sent on your behalf.", "STARTING_FROM", 3000, null], ["Property document review", "Check sale deeds, agreements and titles.", "STARTING_FROM", 5000, null], ["Agreement drafting", "Rental, partnership and service agreements.", "STARTING_FROM", 3000, null], ["Court representation", "Representation in civil and family matters.", "ON_REQUEST", null, null]],
    [["Is the first consultation confidential?", "Yes. Everything you share with us is kept confidential."], ["Can we meet online?", "Yes, consultations can be in person or on video."], ["How are fees decided?", "Fees depend on the matter. We'll quote clearly before starting."]]),
  t("it_services", "IT services / Software company", "consultancy", "software web app development it support website",
    "Technology that works for your business",
    "{name} builds websites, apps and software for businesses in {city} and beyond, and keeps them running with reliable support.",
    [["Business website", "A fast, mobile-friendly website.", "STARTING_FROM", 15000, null], ["Mobile app development", "Android and iOS apps.", "ON_REQUEST", null, null], ["Custom software", "Tools built around how you work.", "ON_REQUEST", null, null], ["IT support (monthly)", "Help desk and maintenance.", "STARTING_FROM", 5000, null], ["Free discovery call", "Talk through your idea.", "FIXED", 0, 30]],
    [["How long does a website take?", "A typical business website takes 2–4 weeks once content is ready."], ["Do you provide support after launch?", "Yes, we offer monthly support and maintenance plans."], ["Do you work with clients in other cities?", "Yes, we work with clients across India online."]]),
  t("digital_marketing", "Digital marketing agency", "consultancy", "seo social media ads google ads instagram marketing",
    "Marketing that brings real enquiries",
    "{name} helps businesses in {city} grow online with SEO, social media, ads and content, with simple monthly reports on what's working.",
    [["Social media management", "Posts, reels and community management.", "STARTING_FROM", 10000, null], ["Google & Meta ads", "Campaign setup and management.", "STARTING_FROM", 8000, null], ["SEO", "Get found on Google for what you do.", "STARTING_FROM", 10000, null], ["Google Business Profile", "Setup and optimisation for local search.", "FIXED", 3000, null], ["Marketing audit", "A review of what to fix first.", "FIXED", 2500, 60]],
    [["Is there a minimum contract?", "Monthly plans run month to month after an initial three months."], ["Is the ad budget included?", "No. Ad spend is paid directly to Google or Meta; our fee covers management."], ["How do I see results?", "You get a simple monthly report with enquiries, reach and spend."]]),
  t("real_estate", "Real estate agent / Property dealer", "consultancy", "property broker flats rent buy sell plots",
    "Find the right property, without the stress",
    "{name} helps families and investors in {city} buy, sell and rent homes, plots and commercial spaces, with honest advice and help with paperwork.",
    [["Buy a property", "Shortlisted options that match your budget.", "ON_REQUEST", null, null], ["Sell your property", "Pricing advice, listing and buyer visits.", "ON_REQUEST", null, null], ["Rentals", "Find tenants or a home to rent.", "ON_REQUEST", null, null], ["Documentation help", "Agreements, registration and loans.", "ON_REQUEST", null, null]],
    [["What do you charge?", "Our brokerage is agreed upfront and is in line with local practice."], ["Do you help with home loans?", "Yes, we can connect you with lenders and help with the paperwork."], AREA]),
  t("insurance_agent", "Insurance / Financial advisor", "consultancy", "insurance lic health life mutual funds investment",
    "Protect what matters, plan what's next",
    "{name} helps families in {city} choose life and health insurance and plan their savings, with advice that fits their needs and budget.",
    [["Health insurance", "Cover for you and your family.", "ON_REQUEST", null, null], ["Life insurance", "Term and savings plans compared.", "ON_REQUEST", null, null], ["Motor insurance", "New policies and renewals.", "ON_REQUEST", null, null], ["Claim assistance", "Help when you need to make a claim.", "ON_REQUEST", null, null], ["Free review", "A review of the cover you already have.", "FIXED", 0, 30]],
    [["Do you charge for advice?", "The first review is free. We'll explain how we're paid before you buy anything."], ["Can you help with an existing claim?", "Yes, we help with documents and follow-ups."]]),
  t("travel_agency", "Travel agency / Tour operator", "consultancy", "tours holidays tickets visa trips packages",
    "Holidays planned around you",
    "{name} plans holidays, pilgrimages and business trips from {city}: tickets, hotels, visas and tours, all arranged in one place.",
    [["Holiday packages", "Domestic and international trips.", "ON_REQUEST", null, null], ["Flight & train tickets", "Bookings at fair prices.", "ON_REQUEST", null, null], ["Visa assistance", "Documents and appointments.", "STARTING_FROM", 1500, null], ["Group & pilgrimage tours", "Planned trips for families and groups.", "ON_REQUEST", null, null], ["Hotel bookings", "Stays that suit your budget.", "ON_REQUEST", null, null]],
    [["Can you customise a package?", "Yes, every trip can be adjusted to your dates, budget and interests."], PAY, ["What if I need to cancel?", "Cancellation terms depend on the airline and hotels; we'll explain them before you book."]]),

  // ---- Salon / beauty ---------------------------------------------------------------------------
  t("salon", "Salon / Beauty parlour", "salon_beauty", "hair cut parlour unisex beauty facial",
    "Look good, feel great",
    "{name} is a salon in {city} for haircuts, colour, skin and beauty treatments, with trained stylists and quality products.",
    [["Haircut & styling", "A cut that suits you, finished with styling.", "STARTING_FROM", 300, 45], ["Hair colour", "Global colour, highlights and touch-ups.", "STARTING_FROM", 1500, 90], ["Facial", "Cleansing and glow facials.", "STARTING_FROM", 1000, 60], ["Waxing & threading", "Quick, hygienic grooming.", "STARTING_FROM", 100, 20], ["Hair spa", "Deep conditioning treatment.", "STARTING_FROM", 800, 45], ["Manicure & pedicure", "Nail care and polish.", "STARTING_FROM", 500, 45]],
    [BOOK, ["Do you take walk-ins?", "Yes, when a stylist is free. Booking ahead guarantees your time."], PAY]),
  t("spa", "Spa / Massage centre", "salon_beauty", "massage wellness body therapy relaxation",
    "Relax, restore, recharge",
    "{name} is a spa in {city} offering massages and body therapies by trained therapists in a calm, clean space.",
    [["Swedish massage", "Relaxing full-body massage.", "FIXED", 2000, 60], ["Deep tissue massage", "Firm pressure for muscle tension.", "FIXED", 2500, 60], ["Foot reflexology", "Pressure-point foot therapy.", "FIXED", 1000, 30], ["Body scrub", "Exfoliation for smoother skin.", "FIXED", 1800, 45], ["Couple's package", "Side-by-side treatments.", "STARTING_FROM", 4000, 90]],
    [BOOK, ["Should I arrive early?", "Please arrive 10 minutes early to settle in."], PAY]),
  t("bridal_makeup", "Bridal makeup artist", "salon_beauty", "makeup mua bride wedding party makeup mehendi",
    "Makeup for your big day",
    "{name} is a makeup artist in {city} for brides, family and parties, using quality products for a look that lasts all day.",
    [["Bridal makeup", "HD or airbrush bridal look with hair styling.", "STARTING_FROM", 15000, 180], ["Engagement / reception makeup", "A look for every function.", "STARTING_FROM", 8000, 120], ["Party makeup", "For guests and family.", "STARTING_FROM", 3000, 60], ["Hair styling", "Buns, braids and blow-dries.", "STARTING_FROM", 1500, 45], ["Trial session", "Try your look before the day.", "STARTING_FROM", 3000, 90]],
    [["Do you travel to the venue?", "Yes, we come to your home or venue. Travel charges may apply outside {city}."], ["How early should I book?", "For wedding dates, booking 1–3 months ahead is best."], PAY]),
  t("tattoo_studio", "Tattoo / Piercing studio", "salon_beauty", "tattoo piercing ink art",
    "Custom tattoos, done safely",
    "{name} is a tattoo and piercing studio in {city} with custom designs, sterile equipment and aftercare guidance.",
    [["Small tattoo", "Simple designs up to a few inches.", "STARTING_FROM", 1500, 60], ["Custom tattoo", "Designed with you, priced by size and detail.", "ON_REQUEST", null, null], ["Cover-up", "Rework an old tattoo.", "ON_REQUEST", null, null], ["Piercing", "Ear and body piercings.", "STARTING_FROM", 500, 20]],
    [["Is it safe?", "We use single-use needles and sterilised equipment for every client."], ["How do I care for a new tattoo?", "We give you written aftercare instructions and are a message away if you have questions."], BOOK]),
  t("nail_studio", "Nail studio", "salon_beauty", "nails gel extensions nail art",
    "Nails you'll love to show off",
    "{name} is a nail studio in {city} for gel polish, extensions and nail art.",
    [["Gel polish", "Long-lasting glossy colour.", "STARTING_FROM", 800, 45], ["Nail extensions", "Acrylic or gel extensions.", "STARTING_FROM", 1800, 90], ["Nail art", "Designs from simple to detailed.", "STARTING_FROM", 300, 30], ["Removal & refill", "Safe removal and refills.", "STARTING_FROM", 500, 45]],
    [BOOK, ["How long does gel polish last?", "Usually two to three weeks with normal care."], PAY]),

  // ---- Gym / fitness ----------------------------------------------------------------------------
  t("gym", "Gym / Fitness centre", "gym_fitness", "gym workout fitness weights crossfit personal trainer",
    "Get stronger, every week",
    "{name} is a gym in {city} with modern equipment, group classes and trainers who help you reach your goals safely.",
    [["Monthly membership", "Full gym access.", "FIXED", 1500, null], ["Quarterly membership", "Three months of full access.", "FIXED", 4000, null], ["Personal training", "One-to-one sessions with a trainer.", "STARTING_FROM", 5000, null], ["Group classes", "HIIT, strength and functional training.", "STARTING_FROM", 1000, 60], ["Free trial session", "Try the gym before you join.", "FIXED", 0, 60]],
    [["Can I try before joining?", "Yes, book a free trial session and a trainer will show you around."], ["What are your timings?", "Our opening hours are listed on this website. Message us for holiday timings."], PAY]),
  t("yoga_studio", "Yoga studio / Instructor", "gym_fitness", "yoga meditation pranayama classes",
    "Yoga for every body",
    "{name} offers yoga classes in {city} for beginners and regular practitioners, in small groups or one-to-one.",
    [["Group yoga (monthly)", "Regular classes in a small group.", "FIXED", 1500, 60], ["Private session", "One-to-one class at your pace.", "STARTING_FROM", 800, 60], ["Online classes", "Live classes from home.", "FIXED", 1000, 60], ["Corporate yoga", "Sessions for teams at work.", "ON_REQUEST", null, 60], ["Trial class", "Your first class is free.", "FIXED", 0, 60]],
    [["I'm a complete beginner. Is that okay?", "Absolutely. Classes are adapted for every level."], ["What should I bring?", "Comfortable clothes and water. Mats are available if you don't have one."], BOOK]),
  t("martial_arts", "Martial arts / Self-defence", "gym_fitness", "karate taekwondo boxing kickboxing self defence",
    "Discipline, fitness and confidence",
    "{name} teaches martial arts and self-defence in {city} for children and adults, with graded belts and regular practice.",
    [["Kids' classes (monthly)", "Fun, structured training for ages 5+.", "FIXED", 1200, 60], ["Adult classes (monthly)", "Fitness and technique for adults.", "FIXED", 1500, 60], ["Self-defence workshop", "Practical skills in one session.", "STARTING_FROM", 800, 120], ["Trial class", "Try a class for free.", "FIXED", 0, 60]],
    [["What age can children start?", "Children can usually start from age 5."], BOOK, PAY]),

  // ---- Coaching / academy ------------------------------------------------------------------------
  t("coaching_centre", "Tutor / Coaching centre", "dance_academy_coaching", "tuition coaching classes jee neet board exam tutor",
    "Learn better, score better",
    "{name} is a coaching centre in {city} for school subjects and competitive exams, with small batches, regular tests and personal attention.",
    [["School tuition (monthly)", "Maths, science and more for classes 6–12.", "STARTING_FROM", 2000, null], ["Board exam preparation", "Revision, mock tests and doubt sessions.", "STARTING_FROM", 3000, null], ["Competitive exam coaching", "Structured preparation with tests.", "ON_REQUEST", null, null], ["Home tuition", "One-to-one at your home.", "STARTING_FROM", 4000, null], ["Free demo class", "Attend a class before you join.", "FIXED", 0, 60]],
    [["What is the batch size?", "We keep batches small so every student gets attention."], ["Do you share progress with parents?", "Yes, we share test results and feedback regularly."], BOOK]),
  t("dance_academy", "Dance academy", "dance_academy_coaching", "dance classes bollywood classical hip hop zumba",
    "Learn to dance with joy",
    "{name} is a dance academy in {city} teaching classical, Bollywood and contemporary styles to children and adults.",
    [["Kids' dance (monthly)", "Fun classes for ages 5+.", "FIXED", 1500, 60], ["Adult batch (monthly)", "Bollywood and contemporary.", "FIXED", 2000, 60], ["Wedding choreography", "Sangeet and first-dance routines.", "STARTING_FROM", 5000, null], ["Zumba / dance fitness", "High-energy fitness classes.", "FIXED", 1500, 60], ["Trial class", "Your first class is free.", "FIXED", 0, 60]],
    [["Do I need experience?", "No. We have beginner batches for every age."], BOOK, PAY]),
  t("music_school", "Music school / Teacher", "dance_academy_coaching", "music guitar piano keyboard singing vocals tabla",
    "Music lessons for every age",
    "{name} teaches vocals and instruments in {city}, for beginners through advanced students, with optional exam preparation.",
    [["Guitar lessons (monthly)", "Weekly lessons, beginner to advanced.", "FIXED", 2000, 60], ["Keyboard / piano", "Learn to read and play.", "FIXED", 2000, 60], ["Vocal training", "Classical and contemporary singing.", "FIXED", 2000, 60], ["Online lessons", "Live one-to-one lessons.", "STARTING_FROM", 2500, 45], ["Trial lesson", "Meet the teacher and try a lesson.", "FIXED", 0, 30]],
    [["Do I need my own instrument?", "It helps for practice, but you can use ours during class."], BOOK, PAY]),
  t("driving_school", "Driving school", "dance_academy_coaching", "driving lessons car licence",
    "Learn to drive with confidence",
    "{name} is a driving school in {city} with patient instructors, dual-control cars and help with your driving licence.",
    [["Beginner course", "Daily lessons with a dual-control car.", "STARTING_FROM", 4000, null], ["Refresher course", "Regain confidence on the road.", "STARTING_FROM", 2500, null], ["Licence assistance", "Help with learner's and permanent licence.", "STARTING_FROM", 1500, null], ["Single lesson", "One practice session.", "FIXED", 500, 45]],
    [["Do you pick up from home?", "Yes, in most areas of {city}. Ask when you book."], ["How long is the course?", "Most beginners are confident in 15–20 sessions."], BOOK]),
  t("art_classes", "Art / Craft classes", "dance_academy_coaching", "drawing painting art craft sketching",
    "Create something new every week",
    "{name} runs drawing, painting and craft classes in {city} for children and adults.",
    [["Kids' art (monthly)", "Drawing and colouring for ages 5+.", "FIXED", 1200, 60], ["Adult painting", "Acrylic, watercolour and sketching.", "FIXED", 1800, 90], ["Weekend workshop", "A one-day themed workshop.", "STARTING_FROM", 800, 180], ["Trial class", "Try a class first.", "FIXED", 0, 60]],
    [["Are materials included?", "Basic materials are included in class fees."], BOOK]),

  // ---- Events / community -----------------------------------------------------------------------
  t("event_planner", "Event planner / Decorator", "events_community", "events decoration birthday party corporate events",
    "Events planned, so you can enjoy them",
    "{name} plans and decorates birthdays, anniversaries, corporate events and family functions in {city}, from first idea to the last guest.",
    [["Birthday party", "Theme, decor and coordination.", "STARTING_FROM", 10000, null], ["Corporate event", "Conferences, launches and team events.", "ON_REQUEST", null, null], ["Decoration only", "Balloons, flowers and stage decor.", "STARTING_FROM", 5000, null], ["Full event planning", "Venue, vendors and day-of management.", "ON_REQUEST", null, null]],
    [["How early should I book?", "Two to four weeks ahead is ideal; we can sometimes manage less."], PAY, AREA]),
  t("wedding_planner", "Wedding planner", "events_community", "wedding planning shaadi venue mehendi sangeet",
    "Your wedding, beautifully planned",
    "{name} plans weddings in {city} and destination weddings across India: venues, decor, vendors and coordination on every day of the celebration.",
    [["Full wedding planning", "End-to-end planning and management.", "ON_REQUEST", null, null], ["Decor & design", "Mandap, stage and venue styling.", "ON_REQUEST", null, null], ["Day-of coordination", "We run the day so you can enjoy it.", "STARTING_FROM", 25000, null], ["Vendor management", "Caterers, photographers and more.", "ON_REQUEST", null, null]],
    [["Do you plan destination weddings?", "Yes, we plan weddings in {city} and other destinations."], ["How is the fee decided?", "It depends on the scale of the wedding. We'll share a clear quote after our first meeting."], BOOK]),
  t("caterer", "Caterer", "events_community", "catering food party orders tiffin",
    "Food your guests will remember",
    "{name} caters weddings, parties and corporate events in {city}, with menus planned around your guests and budget.",
    [["Wedding catering", "Multi-cuisine menus for every function.", "ON_REQUEST", null, null], ["Party catering", "Birthdays and get-togethers.", "STARTING_FROM", 350, null], ["Corporate lunches", "Daily or event catering for offices.", "ON_REQUEST", null, null], ["Live counters", "Chaat, pasta, tandoor and more.", "ON_REQUEST", null, null], ["Menu tasting", "Taste before you finalise.", "ON_REQUEST", null, null]],
    [["What is the minimum order?", "Tell us your guest count and we'll suggest a menu and price."], ["Is the price per plate?", "Yes, most menus are priced per plate; live counters may be extra."], AREA]),
  t("photographer", "Photographer / Videographer", "events_community", "photography photo video wedding shoot pre wedding",
    "Moments, beautifully captured",
    "{name} is a photographer in {city} for weddings, events, portraits and products, with edited photos delivered online.",
    [["Wedding photography", "Candid and traditional coverage.", "STARTING_FROM", 30000, null], ["Pre-wedding shoot", "A styled shoot at your chosen location.", "STARTING_FROM", 15000, null], ["Event photography", "Birthdays, parties and corporate events.", "STARTING_FROM", 8000, null], ["Portrait session", "Individual or family portraits.", "STARTING_FROM", 3000, 60], ["Product photography", "Clean images for your catalogue.", "STARTING_FROM", 2000, null]],
    [["When do we get the photos?", "Edited photos are usually delivered within 2–4 weeks, depending on the event."], ["Do you travel?", "Yes, travel and stay outside {city} are charged at cost."], BOOK]),
  t("dj_sound", "DJ / Sound & lights", "events_community", "dj music sound system lights band",
    "The right music for every moment",
    "{name} provides DJs, sound systems and lighting for weddings, parties and events in {city}.",
    [["DJ for parties", "Music and mixing for your crowd.", "STARTING_FROM", 8000, null], ["Wedding DJ & sound", "Sangeet, baraat and reception.", "STARTING_FROM", 15000, null], ["Sound system rental", "Speakers and mics for events.", "STARTING_FROM", 4000, null], ["Lighting setup", "Stage and dance-floor lights.", "STARTING_FROM", 5000, null]],
    [["Can we share a playlist?", "Yes, send us your favourites and any songs to avoid."], AREA, PAY]),
  t("ngo", "NGO / Community organisation", "events_community", "ngo charity trust volunteer donation community",
    "Together, we can do more",
    "{name} works in {city} to support the community through programmes, events and volunteering. Get in touch to volunteer, partner or support our work.",
    [["Volunteer with us", "Give your time to a cause you care about.", "ON_REQUEST", null, null], ["Partner with us", "Programmes with companies and schools.", "ON_REQUEST", null, null], ["Community programmes", "Ongoing work in the community.", "ON_REQUEST", null, null], ["Events & drives", "Join our upcoming activities.", "ON_REQUEST", null, null]],
    [["How can I volunteer?", "Send us an enquiry with your availability and interests, and we'll get in touch."], ["How can I support your work?", "Contact us and we'll share how you can help."]]),
  t("banquet_hall", "Banquet hall / Venue", "events_community", "banquet hall venue lawn party hall marriage hall",
    "A venue for every celebration",
    "{name} is an event venue in {city} for weddings, receptions, birthdays and corporate events, with in-house arrangements and flexible packages.",
    [["Wedding booking", "Halls and lawns for your celebration.", "ON_REQUEST", null, null], ["Birthday & party booking", "Smaller halls for get-togethers.", "ON_REQUEST", null, null], ["Corporate events", "Meetings, seminars and launches.", "ON_REQUEST", null, null], ["Venue visit", "See the venue before you book.", "FIXED", 0, 30]],
    [["What is the guest capacity?", "Tell us your guest count and we'll suggest the right space."], ["Is catering included?", "We offer packages with and without catering."], BOOK]),

  // ---- Interior design / home -------------------------------------------------------------------
  t("interior_designer", "Interior designer", "interior_design", "interiors home design modular kitchen wardrobe",
    "Homes designed around how you live",
    "{name} designs homes and offices in {city}: layouts, modular kitchens, wardrobes and full interiors, from concept to handover.",
    [["Design consultation", "Ideas, layout and a budget estimate.", "STARTING_FROM", 2000, 60], ["Full home interiors", "Design and execution, turnkey.", "ON_REQUEST", null, null], ["Modular kitchen", "Custom kitchens built to fit.", "STARTING_FROM", 120000, null], ["Wardrobes & storage", "Built-in storage for every room.", "ON_REQUEST", null, null], ["3D design", "See your space before it's built.", "STARTING_FROM", 5000, null]],
    [["How long does a full home take?", "Most homes take 6–10 weeks after the design is final."], ["Do you work within a budget?", "Yes, we design around the budget you set."], AREA]),
  t("architect", "Architect", "interior_design", "architecture building plans house design approvals",
    "Thoughtful buildings, well planned",
    "{name} is an architecture practice in {city} designing homes and commercial buildings, with help on approvals and site supervision.",
    [["Consultation", "Discuss your site, needs and budget.", "STARTING_FROM", 2000, 60], ["House design", "Plans, elevations and working drawings.", "ON_REQUEST", null, null], ["Approvals", "Drawings and help with local approvals.", "ON_REQUEST", null, null], ["Site supervision", "Regular site visits during construction.", "ON_REQUEST", null, null]],
    [["How are fees calculated?", "Usually by built-up area or as a percentage of project cost. We'll quote before starting."], AREA]),
  t("contractor", "Builder / Civil contractor", "interior_design", "construction builder renovation contractor civil work",
    "Quality construction, on time",
    "{name} is a construction and renovation contractor in {city} for homes, shops and offices, with clear estimates and regular updates.",
    [["New construction", "Homes and small buildings.", "ON_REQUEST", null, null], ["Renovation", "Kitchens, bathrooms and full homes.", "ON_REQUEST", null, null], ["Waterproofing", "Terraces, bathrooms and walls.", "STARTING_FROM", 5000, null], ["Site visit & estimate", "We inspect and give a written estimate.", "FIXED", 0, 60]],
    [["Do you give a written estimate?", "Yes, after a site visit."], AREA, PAY]),
  t("carpenter", "Carpenter / Furniture maker", "interior_design", "carpentry furniture woodwork repair",
    "Furniture made to fit",
    "{name} makes and repairs furniture in {city}: beds, wardrobes, kitchens and custom pieces.",
    [["Custom furniture", "Made to your size and design.", "ON_REQUEST", null, null], ["Furniture repair", "Fix and refinish what you have.", "STARTING_FROM", 500, null], ["Door & window work", "Repairs and new fittings.", "STARTING_FROM", 500, null], ["Polish & finish", "Restore the look of wood furniture.", "ON_REQUEST", null, null]],
    [AREA, ["Do you give an estimate first?", "Yes, after seeing the work or photos."], PAY]),
  t("painter", "Painter / Home painting", "interior_design", "painting wall paint house painting texture",
    "Fresh walls, neat finish",
    "{name} provides home and office painting in {city}, with neat work, quality paints and cleanup after the job.",
    [["Interior painting", "Walls and ceilings.", "ON_REQUEST", null, null], ["Exterior painting", "Weatherproof finishes.", "ON_REQUEST", null, null], ["Texture & designer walls", "Feature walls and textures.", "ON_REQUEST", null, null], ["Free site visit", "Measurement and estimate.", "FIXED", 0, 30]],
    [["How long does a 2BHK take?", "Usually 4–6 days, depending on the work."], AREA, PAY]),

  // ---- Personal brand ---------------------------------------------------------------------------
  t("freelancer", "Freelancer / Consultant", "personal_brand", "freelance designer writer developer consultant",
    "Skilled work, delivered on time",
    "I'm {name}, a freelancer based in {city}. I work with businesses and individuals on projects of every size, with clear communication and reliable delivery.",
    [["Project work", "Defined projects with a fixed quote.", "ON_REQUEST", null, null], ["Hourly consulting", "Expert help when you need it.", "STARTING_FROM", 1500, 60], ["Monthly retainer", "Ongoing support every month.", "ON_REQUEST", null, null], ["Free intro call", "Tell me about your project.", "FIXED", 0, 30]],
    [["How do we start?", "Send an enquiry with a short brief, and I'll reply with questions and a quote."], ["Do you work remotely?", "Yes, I work with clients across India online."]]),
  t("life_coach", "Coach / Mentor", "personal_brand", "life coach career coach mentor counselling",
    "Clarity, confidence and a plan",
    "I'm {name}, a coach in {city}. I help people get clear on their goals and build habits that last, through one-to-one sessions and group programmes.",
    [["Discovery call", "A free call to see if we're a fit.", "FIXED", 0, 30], ["1:1 coaching session", "A focused session on your goals.", "FIXED", 2500, 60], ["Coaching programme", "A structured programme over several weeks.", "ON_REQUEST", null, null], ["Workshops", "Group sessions for teams and communities.", "ON_REQUEST", null, null]],
    [["Are sessions online?", "Yes, sessions can be online or in person in {city}."], ["Is it confidential?", "Yes, everything we discuss stays between us."]]),
  t("astrologer", "Astrologer / Vastu consultant", "personal_brand", "astrology kundli horoscope vastu numerology",
    "Guidance for life's big decisions",
    "{name} offers astrology, kundli and vastu consultations in {city} and online.",
    [["Kundli reading", "A detailed reading of your birth chart.", "FIXED", 1100, 45], ["Marriage matching", "Kundli matching for couples.", "FIXED", 1100, 30], ["Vastu consultation", "For homes and offices.", "STARTING_FROM", 2100, 60], ["Phone consultation", "Ask your questions by phone.", "FIXED", 501, 20]],
    [["What details do I need?", "Your date, time and place of birth."], ["Are consultations online?", "Yes, on phone or video, or in person in {city}."], BOOK]),
  t("doctor_personal", "Doctor (personal practice)", "personal_brand", "doctor specialist consultant personal",
    "Expert care you can reach",
    "Dr. {name} is a specialist practising in {city}, offering consultations in clinic and online.",
    [["Clinic consultation", "In-person consultation.", "FIXED", 800, 20], ["Online consultation", "Video consultation from home.", "FIXED", 600, 15], ["Follow-up", "Review within two weeks.", "FIXED", 400, 15], ["Second opinion", "Review of reports and treatment plans.", "ON_REQUEST", null, 30]],
    [BOOK, ["Can I consult online?", "Yes, online consultations are available for follow-ups and many first visits."], PAY]),

  // ---- Other / home & local services ------------------------------------------------------------
  t("plumber", "Plumber", "other", "plumbing tap leakage pipe bathroom fitting",
    "Leaks fixed, fast",
    "{name} provides plumbing services in {city}: leaks, blockages, fittings and bathroom work, with upfront pricing.",
    [["Tap & leak repair", "Fix dripping taps and leaks.", "STARTING_FROM", 200, null], ["Blockage clearing", "Drains, sinks and toilets.", "STARTING_FROM", 300, null], ["Bathroom fitting", "Taps, showers and sanitaryware.", "STARTING_FROM", 500, null], ["Water tank cleaning", "Overhead and underground tanks.", "STARTING_FROM", 800, null], ["Visit & inspection", "We find the problem and quote.", "FIXED", 150, 30]],
    [AREA, ["Do you charge a visit fee?", "A small visit fee applies, which is adjusted if you go ahead with the work."], PAY]),
  t("electrician", "Electrician", "other", "electrical wiring fan switch inverter repair",
    "Safe electrical work, done right",
    "{name} provides electrical repairs and installations in {city}: wiring, fittings, inverters and appliances.",
    [["Switch & socket repair", "Quick fixes and replacements.", "STARTING_FROM", 150, null], ["Fan & light installation", "Ceiling fans, lights and fixtures.", "STARTING_FROM", 250, null], ["Wiring work", "New wiring and rewiring.", "ON_REQUEST", null, null], ["Inverter installation", "Setup and maintenance.", "STARTING_FROM", 500, null], ["Visit & inspection", "We find the fault and quote.", "FIXED", 150, 30]],
    [AREA, ["Is the work safe?", "Yes, our electricians follow safety standards and test everything before leaving."], PAY]),
  t("ac_repair", "AC & appliance repair", "other", "ac service air conditioner fridge washing machine repair",
    "Cool, working appliances again",
    "{name} services and repairs ACs, fridges, washing machines and other appliances in {city}, with trained technicians and genuine parts.",
    [["AC service", "Cleaning and performance check.", "STARTING_FROM", 500, 60], ["AC installation", "Split and window ACs.", "STARTING_FROM", 1500, null], ["Gas refilling", "Top-up or full refill.", "STARTING_FROM", 2500, null], ["Fridge repair", "Cooling and other faults.", "STARTING_FROM", 300, null], ["Washing machine repair", "All major brands.", "STARTING_FROM", 300, null]],
    [AREA, ["Do you give a warranty?", "Yes, repairs come with a service warranty. Ask for details when you book."], PAY]),
  t("pest_control", "Pest control", "other", "pest control termite cockroach mosquito",
    "Pest-free homes and offices",
    "{name} provides pest control in {city} for cockroaches, termites, mosquitoes and more, with safe, approved treatments.",
    [["Cockroach control", "Gel and spray treatment.", "STARTING_FROM", 999, null], ["Termite treatment", "Protection for wood and walls.", "STARTING_FROM", 2500, null], ["Mosquito control", "Fogging and treatment.", "STARTING_FROM", 999, null], ["Annual contract", "Regular treatments all year.", "ON_REQUEST", null, null]],
    [["Is it safe for children and pets?", "We use approved products and tell you how long to stay out of treated areas."], AREA, PAY]),
  t("cleaning", "Cleaning services", "other", "home cleaning deep cleaning sofa carpet bathroom",
    "Spotless homes, without the effort",
    "{name} provides home and office cleaning in {city}: deep cleaning, kitchens, bathrooms, sofas and more.",
    [["Full home deep cleaning", "Every room, top to bottom.", "STARTING_FROM", 3000, null], ["Kitchen cleaning", "Degreasing and deep clean.", "STARTING_FROM", 1200, null], ["Bathroom cleaning", "Tiles, fittings and fixtures.", "STARTING_FROM", 500, null], ["Sofa & carpet cleaning", "Shampoo and vacuum.", "STARTING_FROM", 800, null], ["Office cleaning", "One-time or regular.", "ON_REQUEST", null, null]],
    [AREA, ["Do you bring supplies?", "Yes, our team brings all equipment and cleaning products."], PAY]),
  t("packers_movers", "Packers & movers", "other", "shifting relocation packers movers transport",
    "Moving made easy",
    "{name} provides packing and moving services in {city} and across India, for homes, offices and vehicles.",
    [["Local shifting", "Within {city}.", "ON_REQUEST", null, null], ["Intercity moving", "Across India.", "ON_REQUEST", null, null], ["Office relocation", "Planned moves with minimal downtime.", "ON_REQUEST", null, null], ["Vehicle transport", "Cars and bikes.", "ON_REQUEST", null, null], ["Free survey & quote", "We check your items and quote.", "FIXED", 0, 30]],
    [["Is my goods insured?", "Transit insurance is available. Ask us for details."], ["How early should I book?", "A week ahead is ideal, especially at month-end."], PAY]),
  t("car_repair", "Car / Bike service centre", "other", "car repair garage mechanic bike service",
    "Reliable service for your vehicle",
    "{name} is a service centre in {city} for car and bike servicing, repairs, denting and painting.",
    [["General service", "Oil change, checks and wash.", "STARTING_FROM", 2500, null], ["Bike service", "Full service for two-wheelers.", "STARTING_FROM", 600, null], ["Denting & painting", "Scratches and dents repaired.", "ON_REQUEST", null, null], ["Battery & tyres", "Replacement and checks.", "ON_REQUEST", null, null], ["Pick-up & drop", "We collect and return your vehicle.", "STARTING_FROM", 300, null]],
    [["Do you use genuine parts?", "Yes, we use genuine or OEM-quality parts and show you old parts on request."], AREA, PAY]),
  t("tailor", "Tailor / Boutique", "other", "tailoring stitching blouse boutique alteration",
    "Clothes that fit perfectly",
    "{name} is a tailoring boutique in {city} for stitching, alterations and custom outfits.",
    [["Blouse stitching", "Designer and simple blouses.", "STARTING_FROM", 600, null], ["Suit / kurta stitching", "Made to your measurements.", "STARTING_FROM", 800, null], ["Alterations", "Fitting, hemming and repairs.", "STARTING_FROM", 100, null], ["Custom outfit", "Designed with you.", "ON_REQUEST", null, null]],
    [["How long does stitching take?", "Usually 5–7 days; express service is available."], BOOK, PAY]),
  t("laundry", "Laundry / Dry cleaning", "other", "laundry dry clean ironing wash",
    "Fresh clothes, picked up and delivered",
    "{name} offers laundry, dry cleaning and ironing in {city}, with pick-up and delivery.",
    [["Wash & fold", "Priced per kg.", "STARTING_FROM", 80, null], ["Dry cleaning", "Suits, sarees and more.", "STARTING_FROM", 150, null], ["Ironing", "Priced per piece.", "STARTING_FROM", 10, null], ["Pick-up & delivery", "From your door.", "ON_REQUEST", null, null]],
    [AREA, ["How long does it take?", "Usually 24–48 hours."], PAY]),
  t("printing", "Printing / Signage", "other", "printing flex banners visiting cards signage",
    "Print that gets noticed",
    "{name} provides printing and signage in {city}: visiting cards, flyers, banners, boards and more.",
    [["Visiting cards", "Classic and premium finishes.", "STARTING_FROM", 300, null], ["Flyers & brochures", "Designed and printed.", "ON_REQUEST", null, null], ["Flex & banners", "Indoor and outdoor.", "STARTING_FROM", 20, null], ["Shop signage", "Boards and LED signs.", "ON_REQUEST", null, null]],
    [["Can you design it for us?", "Yes, our designers can create the artwork."], ["How fast is delivery?", "Most jobs are ready in 1–3 days."], PAY]),
  t("daycare", "Daycare / Play school", "other", "daycare creche play school preschool kids",
    "A safe, happy place to learn and play",
    "{name} is a daycare and play school in {city} with caring staff, a safe space and a day full of play and learning.",
    [["Play school", "Morning programme for ages 2–4.", "ON_REQUEST", null, null], ["Full-day daycare", "Care for working parents.", "ON_REQUEST", null, null], ["After-school care", "Homework help and activities.", "ON_REQUEST", null, null], ["Visit the centre", "See our space and meet the team.", "FIXED", 0, 30]],
    [["What is the child-to-staff ratio?", "Ask us during your visit and we'll explain how we staff each group."], ["Are meals provided?", "Ask us about meals and snacks when you visit."], BOOK]),
  t("homestay", "Homestay / Guest house", "other", "homestay guest house hotel stay rooms",
    "A comfortable stay, like home",
    "{name} is a homestay in {city} with clean rooms, home-cooked food and friendly hosts.",
    [["Standard room", "Per night, for two.", "STARTING_FROM", 1500, null], ["Family room", "Per night, for up to four.", "STARTING_FROM", 2500, null], ["Meals", "Home-cooked breakfast and dinner.", "ON_REQUEST", null, null], ["Long stays", "Weekly and monthly rates.", "ON_REQUEST", null, null]],
    [["What are check-in and check-out times?", "Ask us when you book and we'll confirm timings."], BOOK, PAY]),
  t("pet_grooming", "Pet grooming / Boarding", "other", "pet grooming dog boarding training",
    "Happy, groomed pets",
    "{name} offers pet grooming, boarding and training in {city}, with gentle handling and a clean, safe space.",
    [["Bath & grooming", "Bath, brush and trim.", "STARTING_FROM", 800, 60], ["Full grooming", "Haircut, nails and ears.", "STARTING_FROM", 1500, 90], ["Pet boarding", "Per day, with walks and care.", "STARTING_FROM", 600, null], ["Training", "Basic obedience sessions.", "ON_REQUEST", null, null]],
    [BOOK, ["Can I stay with my pet?", "Yes, you're welcome to stay during grooming."], PAY]),
  t("courier", "Courier / Logistics", "other", "courier parcel delivery logistics transport",
    "Reliable delivery, every time",
    "{name} provides courier and logistics services from {city}, for documents and parcels across India.",
    [["Document courier", "Fast delivery of documents.", "STARTING_FROM", 100, null], ["Parcel delivery", "Domestic parcels by weight.", "ON_REQUEST", null, null], ["Business shipping", "Regular pick-ups for businesses.", "ON_REQUEST", null, null], ["International courier", "Documents and parcels abroad.", "ON_REQUEST", null, null]],
    [["Do you pick up?", "Yes, pick-up is available in most areas of {city}."], PAY]),
];

const BY_ID = new Map(SERVICE_TYPES.map((s) => [s.id, s]));

export function findServiceType(id: string | null | undefined): ServiceType | null {
  return id ? BY_ID.get(id) ?? null : null;
}

/** Service types grouped by theme family, in the order of INFO_CATEGORIES. */
export function serviceTypesByFamily(): Map<InfoCategory, ServiceType[]> {
  const m = new Map<InfoCategory, ServiceType[]>();
  for (const s of SERVICE_TYPES) m.set(s.family, [...(m.get(s.family) ?? []), s]);
  return m;
}

/** Case-insensitive search over label and keywords (picker). */
export function searchServiceTypes(query: string, limit = 12): ServiceType[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/);
  return SERVICE_TYPES.filter((s) => {
    const hay = `${s.label} ${s.keywords}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  }).slice(0, limit);
}

/** Fills {name} and {city}; a missing city reads naturally ("your area"). */
export function fillTemplate(text: string, v: { name: string; city: string | null | undefined }): string {
  return text.replaceAll("{name}", v.name.trim()).replaceAll("{city}", v.city?.trim() || "your area");
}

/** The ready-made starter content for a service type, filled for this business. */
export function seedFor(type: ServiceType, v: { name: string; city: string | null | undefined }) {
  return {
    tagline: fillTemplate(type.tagline, v),
    about: fillTemplate(type.about, v),
    services: type.services.map((s) => ({ ...s, name: fillTemplate(s.name, v), shortDescription: fillTemplate(s.shortDescription, v) })),
    faqs: type.faqs.map((f) => ({ question: fillTemplate(f.question, v), answer: fillTemplate(f.answer, v) })),
  };
}
