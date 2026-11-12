import type { UnsplashCategory } from "@/lib/unsplash-categories";
import type { InfoCategory } from "./categories";
import type { PriceType } from "./pricing";

/**
 * Demo content per category (pure). Used ONLY for onboarding previews and the theme switcher, and as
 * the source of the 3 clearly-marked sample services seeded when a seller skips Step 3. Never saved
 * otherwise (docs/informative/PLAN.md "Demo content per theme"). Businesses and people are fictional.
 * Photos come from the curated, credited Unsplash pools in src/lib/unsplash-stock.ts.
 */
export type DemoService = { name: string; shortDescription: string; priceType: PriceType; pricePaise: number | null; durationMinutes: number | null; category: string };
export type DemoContent = {
  businessName: string;
  tagline: string;
  about: string;
  services: [DemoService, DemoService, DemoService, DemoService, DemoService, DemoService];
  testimonials: [DemoTestimonial, DemoTestimonial, DemoTestimonial];
  faqs: [DemoFaq, DemoFaq, DemoFaq, DemoFaq];
  team: { name: string; role: string; bio: string }[];
  stats: { value: string; label: string }[];
  highlights: { title: string; text: string }[];
  ctaLabel: string;
  photoCategory: UnsplashCategory;
};
type DemoTestimonial = { authorName: string; rating: number; text: string };
type DemoFaq = { question: string; answer: string };

const rs = (rupees: number) => rupees * 100;

export const DEMO_CONTENT: Record<InfoCategory, DemoContent> = {
  consultancy: {
    businessName: "Meridian Advisory",
    tagline: "Clear advice for growing businesses",
    about: "We help founders and family businesses with tax, compliance and growth planning. Practical advice, explained in plain language, from a team that answers the phone.",
    services: [
      { name: "Business setup", shortDescription: "Company or LLP registration, GST and bank account in one go.", priceType: "STARTING_FROM", pricePaise: rs(9999), durationMinutes: null, category: "Compliance" },
      { name: "Tax planning", shortDescription: "Year-round planning so March holds no surprises.", priceType: "FIXED", pricePaise: rs(4999), durationMinutes: 60, category: "Tax" },
      { name: "GST filing", shortDescription: "Monthly and quarterly returns, reconciled and on time.", priceType: "STARTING_FROM", pricePaise: rs(1499), durationMinutes: null, category: "Compliance" },
      { name: "Growth strategy", shortDescription: "A 90-day plan built around your numbers.", priceType: "ON_REQUEST", pricePaise: null, durationMinutes: 90, category: "Advisory" },
      { name: "Bookkeeping", shortDescription: "Clean books every month, ready for any audit.", priceType: "STARTING_FROM", pricePaise: rs(2999), durationMinutes: null, category: "Accounts" },
      { name: "First consultation", shortDescription: "A 30-minute call to understand where you are.", priceType: "FIXED", pricePaise: rs(0), durationMinutes: 30, category: "Advisory" },
    ],
    testimonials: [
      { authorName: "Rohan M.", rating: 5, text: "They untangled three years of filings in a month and explained every step." },
      { authorName: "Priya S.", rating: 5, text: "Finally an advisor who replies the same day. Our setup took a week." },
      { authorName: "Imran K.", rating: 4, text: "Practical, honest advice. The growth plan paid for itself in a quarter." },
    ],
    faqs: [
      { question: "Do you work with small businesses?", answer: "Yes. Most of our clients are founders and family businesses with under 50 people." },
      { question: "Can we meet online?", answer: "Of course. We meet on video or phone, and in person at our office by appointment." },
      { question: "How do you charge?", answer: "Fixed fees for defined work, and a monthly retainer for ongoing support." },
      { question: "What do I need for the first call?", answer: "Just a rough idea of your business and your questions. We'll ask for documents later." },
    ],
    team: [
      { name: "Anita Rao", role: "Founder, Chartered Accountant", bio: "Fifteen years advising growing businesses." },
      { name: "Vikram Shah", role: "Tax lead", bio: "Specialises in GST and direct tax planning." },
      { name: "Neha Iyer", role: "Client success", bio: "Keeps every filing on schedule." },
    ],
    stats: [{ value: "12+", label: "Years in practice" }, { value: "400+", label: "Businesses advised" }, { value: "24h", label: "Average reply time" }],
    highlights: [
      { title: "Plain-language advice", text: "No jargon. You'll always know what we're doing and why." },
      { title: "Fixed, upfront fees", text: "Agreed before we start, so there are no surprise bills." },
      { title: "One point of contact", text: "A named advisor who knows your business." },
    ],
    ctaLabel: "Book a consultation",
    photoCategory: "services",
  },
  clinic_healthcare: {
    businessName: "Sunrise Family Clinic",
    tagline: "Gentle care for the whole family",
    about: "A neighbourhood clinic offering general medicine, paediatrics and preventive check-ups. Short waits, unhurried consultations and follow-up you can count on.",
    services: [
      { name: "General consultation", shortDescription: "Fever, infections, lifestyle concerns and more.", priceType: "FIXED", pricePaise: rs(500), durationMinutes: 15, category: "Consultations" },
      { name: "Child health check", shortDescription: "Growth, vaccination schedule and nutrition advice.", priceType: "FIXED", pricePaise: rs(600), durationMinutes: 20, category: "Paediatrics" },
      { name: "Full body check-up", shortDescription: "Blood work, ECG and a doctor's review.", priceType: "STARTING_FROM", pricePaise: rs(2499), durationMinutes: 60, category: "Preventive" },
      { name: "Diabetes care", shortDescription: "Regular monitoring and a plan that fits your life.", priceType: "FIXED", pricePaise: rs(700), durationMinutes: 20, category: "Chronic care" },
      { name: "Physiotherapy", shortDescription: "Recovery from injury, back and joint pain.", priceType: "FIXED", pricePaise: rs(800), durationMinutes: 45, category: "Therapy" },
      { name: "Home visit", shortDescription: "For elderly or bed-ridden patients nearby.", priceType: "ON_REQUEST", pricePaise: null, durationMinutes: null, category: "Consultations" },
    ],
    testimonials: [
      { authorName: "Meera T.", rating: 5, text: "The doctor took time to explain everything. My son actually likes coming here." },
      { authorName: "Arjun P.", rating: 5, text: "Booked in the morning, seen within the hour. Clean and calm." },
      { authorName: "Lakshmi N.", rating: 4, text: "Very caring with my mother's diabetes follow-ups." },
    ],
    faqs: [
      { question: "Do I need an appointment?", answer: "Walk-ins are welcome, but an appointment keeps your wait short." },
      { question: "Which insurance do you accept?", answer: "Ask us about your provider; we'll help with the paperwork." },
      { question: "Are reports available online?", answer: "Yes, lab reports are shared on WhatsApp or email." },
      { question: "What are your timings?", answer: "Monday to Saturday, morning and evening sessions. See our hours below." },
    ],
    team: [
      { name: "Dr. Kavita Menon", role: "General physician", bio: "MBBS, MD. Family medicine for 18 years." },
      { name: "Dr. Sameer Joshi", role: "Paediatrician", bio: "Child health and vaccinations." },
      { name: "Ritu Das", role: "Physiotherapist", bio: "Sports injuries and rehabilitation." },
    ],
    stats: [{ value: "20k+", label: "Patients cared for" }, { value: "15 min", label: "Average wait" }, { value: "6 days", label: "Open every week" }],
    highlights: [
      { title: "Unhurried consultations", text: "Time to listen, examine and explain." },
      { title: "Lab tests on site", text: "Samples collected here, reports on your phone." },
      { title: "Follow-up included", text: "A free review within seven days of your visit." },
    ],
    ctaLabel: "Book an appointment",
    photoCategory: "services",
  },
  salon_beauty: {
    businessName: "Blush & Bloom Studio",
    tagline: "Hair, skin and beauty, done beautifully",
    about: "A calm studio for haircuts, colour, skin and bridal beauty. Experienced stylists, premium products and an appointment that never feels rushed.",
    services: [
      { name: "Haircut & styling", shortDescription: "Consultation, wash, cut and blow-dry.", priceType: "STARTING_FROM", pricePaise: rs(799), durationMinutes: 60, category: "Hair" },
      { name: "Global colour", shortDescription: "Rich, even colour with an ammonia-free option.", priceType: "STARTING_FROM", pricePaise: rs(2999), durationMinutes: 120, category: "Hair" },
      { name: "Signature facial", shortDescription: "Deep cleanse, massage and glow mask.", priceType: "FIXED", pricePaise: rs(1999), durationMinutes: 75, category: "Skin" },
      { name: "Manicure & pedicure", shortDescription: "Shape, cuticle care and polish.", priceType: "FIXED", pricePaise: rs(1299), durationMinutes: 90, category: "Nails" },
      { name: "Bridal makeup", shortDescription: "Trial session plus the big day.", priceType: "ON_REQUEST", pricePaise: null, durationMinutes: null, category: "Bridal" },
      { name: "Keratin treatment", shortDescription: "Smooth, frizz-free hair for months.", priceType: "STARTING_FROM", pricePaise: rs(4999), durationMinutes: 180, category: "Hair" },
    ],
    testimonials: [
      { authorName: "Sana R.", rating: 5, text: "Best haircut I've had in years, and they actually listened." },
      { authorName: "Divya K.", rating: 5, text: "My bridal look was exactly what I imagined. Thank you!" },
      { authorName: "Pooja M.", rating: 5, text: "The facial is pure bliss. Spotless and relaxing studio." },
    ],
    faqs: [
      { question: "Do you take walk-ins?", answer: "We do when a chair is free, but appointments are recommended on weekends." },
      { question: "Which products do you use?", answer: "Professional, salon-grade brands, with vegan options on request." },
      { question: "Can I book a bridal trial?", answer: "Yes, trials are booked two to four weeks before the event." },
      { question: "What is your cancellation policy?", answer: "Please give us four hours' notice so we can offer the slot to someone else." },
    ],
    team: [
      { name: "Farah Ali", role: "Creative director", bio: "Colour specialist, 12 years behind the chair." },
      { name: "Riya Kapoor", role: "Senior stylist", bio: "Precision cuts and bridal hair." },
      { name: "Anjali Verma", role: "Skin therapist", bio: "Facials and skin consultations." },
    ],
    stats: [{ value: "8k+", label: "Happy clients" }, { value: "4.9★", label: "Average rating" }, { value: "10", label: "Years of styling" }],
    highlights: [
      { title: "Hygiene first", text: "Sterilised tools and fresh linen for every guest." },
      { title: "Premium products", text: "Professional brands, gentle on hair and skin." },
      { title: "Expert stylists", text: "Trained regularly in the latest techniques." },
    ],
    ctaLabel: "Book an appointment",
    photoCategory: "beauty",
  },
  gym_fitness: {
    businessName: "Summit Strength Club",
    tagline: "Train hard. Climb higher.",
    about: "A strength and conditioning gym with expert coaches, small-group classes and personal training. Every programme starts with an assessment and a plan.",
    services: [
      { name: "Monthly membership", shortDescription: "Full gym access, 6 am to 10 pm.", priceType: "FIXED", pricePaise: rs(1999), durationMinutes: null, category: "Membership" },
      { name: "Personal training", shortDescription: "One-to-one coaching with a certified trainer.", priceType: "STARTING_FROM", pricePaise: rs(799), durationMinutes: 60, category: "Coaching" },
      { name: "Strength class", shortDescription: "Small groups, big lifts, great technique.", priceType: "FIXED", pricePaise: rs(399), durationMinutes: 50, category: "Classes" },
      { name: "HIIT bootcamp", shortDescription: "High-energy conditioning in 45 minutes.", priceType: "FIXED", pricePaise: rs(349), durationMinutes: 45, category: "Classes" },
      { name: "Nutrition plan", shortDescription: "A simple, sustainable eating plan.", priceType: "FIXED", pricePaise: rs(1499), durationMinutes: 45, category: "Coaching" },
      { name: "Free trial session", shortDescription: "Try a class and meet the coaches.", priceType: "FIXED", pricePaise: rs(0), durationMinutes: 60, category: "Membership" },
    ],
    testimonials: [
      { authorName: "Karan B.", rating: 5, text: "Down 9 kg and deadlifting double my bodyweight. Coaches are brilliant." },
      { authorName: "Aisha F.", rating: 5, text: "The bootcamp is tough but the community keeps me coming back." },
      { authorName: "Dev N.", rating: 4, text: "Clean, well-equipped and never too crowded." },
    ],
    faqs: [
      { question: "I'm a beginner. Is that okay?", answer: "Absolutely. Every member starts with an assessment and a beginner-friendly plan." },
      { question: "Can I pause my membership?", answer: "Yes, for up to 30 days a year for travel or illness." },
      { question: "Do you have showers and lockers?", answer: "Yes, with clean changing rooms for everyone." },
      { question: "Is there parking?", answer: "Free two-wheeler and car parking right outside." },
    ],
    team: [
      { name: "Rahul Singh", role: "Head coach", bio: "Strength and conditioning, 10 years." },
      { name: "Sneha Pillai", role: "Group fitness lead", bio: "HIIT and mobility specialist." },
      { name: "Arnav Gupta", role: "Nutrition coach", bio: "Simple plans that last." },
    ],
    stats: [{ value: "1,200+", label: "Members" }, { value: "40+", label: "Classes a week" }, { value: "8", label: "Certified coaches" }],
    highlights: [
      { title: "Coached, not crowded", text: "Small groups so every rep gets attention." },
      { title: "Progress you can see", text: "Monthly check-ins and measurable goals." },
      { title: "Open early, close late", text: "Train before work or after dinner." },
    ],
    ctaLabel: "Book a free trial",
    photoCategory: "fitness",
  },
  dance_academy_coaching: {
    businessName: "Rhythm House Academy",
    tagline: "Find your stage",
    about: "Dance and performance classes for kids, teens and adults: Bollywood, contemporary and classical, plus public-speaking workshops that build real confidence.",
    services: [
      { name: "Bollywood batch", shortDescription: "Fun, high-energy choreography for all ages.", priceType: "FIXED", pricePaise: rs(1800), durationMinutes: 60, category: "Dance" },
      { name: "Contemporary", shortDescription: "Technique, flow and expression.", priceType: "FIXED", pricePaise: rs(2200), durationMinutes: 75, category: "Dance" },
      { name: "Kathak foundations", shortDescription: "Classical training with exam preparation.", priceType: "FIXED", pricePaise: rs(2000), durationMinutes: 60, category: "Classical" },
      { name: "Kids' creative movement", shortDescription: "For ages 4 to 8: rhythm, play and confidence.", priceType: "FIXED", pricePaise: rs(1500), durationMinutes: 45, category: "Kids" },
      { name: "Public speaking", shortDescription: "Weekend workshop to speak with confidence.", priceType: "STARTING_FROM", pricePaise: rs(3500), durationMinutes: 180, category: "Workshops" },
      { name: "Wedding choreography", shortDescription: "Sangeet routines for families and couples.", priceType: "ON_REQUEST", pricePaise: null, durationMinutes: null, category: "Events" },
    ],
    testimonials: [
      { authorName: "Nisha A.", rating: 5, text: "My daughter performed on stage for the first time. She hasn't stopped dancing since." },
      { authorName: "Tarun V.", rating: 5, text: "Our sangeet routine was the highlight of the wedding." },
      { authorName: "Gauri S.", rating: 5, text: "The public speaking workshop changed how I present at work." },
    ],
    faqs: [
      { question: "Do I need prior experience?", answer: "No. Every style has a beginner batch." },
      { question: "Can I attend a trial class?", answer: "Yes, your first class is free." },
      { question: "Are there annual shows?", answer: "Students perform at our annual showcase every December." },
      { question: "What should I wear?", answer: "Comfortable clothes you can move in. Dance shoes are optional." },
    ],
    team: [
      { name: "Maya D'Souza", role: "Founder & choreographer", bio: "Trained in contemporary and Bollywood." },
      { name: "Guru Sunil Rao", role: "Kathak teacher", bio: "Thirty years of classical training." },
      { name: "Kabir Sethi", role: "Speaking coach", bio: "TEDx speaker and trainer." },
    ],
    stats: [{ value: "600+", label: "Students trained" }, { value: "25", label: "Batches a week" }, { value: "50+", label: "Stage shows" }],
    highlights: [
      { title: "Every level welcome", text: "Beginner to advanced batches in every style." },
      { title: "Real stages", text: "Perform at showcases and community events." },
      { title: "Small batches", text: "Personal attention from experienced teachers." },
    ],
    ctaLabel: "Book a free class",
    photoCategory: "art",
  },
  events_community: {
    businessName: "Gather Collective",
    tagline: "Events that bring people together",
    about: "We plan and host community events, meetups and celebrations, from intimate workshops to festivals for thousands, with care for every detail.",
    services: [
      { name: "Community meetups", shortDescription: "Venue, hosting and promotion handled.", priceType: "STARTING_FROM", pricePaise: rs(15000), durationMinutes: null, category: "Events" },
      { name: "Corporate offsites", shortDescription: "Team days that people actually enjoy.", priceType: "ON_REQUEST", pricePaise: null, durationMinutes: null, category: "Corporate" },
      { name: "Festival production", shortDescription: "Stages, vendors, artists and safety.", priceType: "ON_REQUEST", pricePaise: null, durationMinutes: null, category: "Production" },
      { name: "Workshops", shortDescription: "Hands-on sessions with expert hosts.", priceType: "STARTING_FROM", pricePaise: rs(999), durationMinutes: 120, category: "Workshops" },
      { name: "Private celebrations", shortDescription: "Birthdays, anniversaries and more.", priceType: "STARTING_FROM", pricePaise: rs(25000), durationMinutes: null, category: "Celebrations" },
      { name: "Event consulting", shortDescription: "Plan your own event with our playbook.", priceType: "FIXED", pricePaise: rs(4999), durationMinutes: 90, category: "Consulting" },
    ],
    testimonials: [
      { authorName: "Ishaan R.", rating: 5, text: "Our 300-person meetup ran like clockwork." },
      { authorName: "Zoya H.", rating: 5, text: "The offsite was the best our team has had." },
      { authorName: "Manav T.", rating: 4, text: "Creative, calm under pressure and great with vendors." },
    ],
    faqs: [
      { question: "How early should we book?", answer: "Four to eight weeks ahead for most events; longer for festivals." },
      { question: "Do you work outside the city?", answer: "Yes, across the country, with travel quoted separately." },
      { question: "Can you work with our venue?", answer: "Of course. We also have partner venues if you need one." },
      { question: "How is pricing worked out?", answer: "A clear quote based on guests, venue and production needs." },
    ],
    team: [
      { name: "Leah Fernandes", role: "Founder", bio: "Ten years in live events." },
      { name: "Aman Bhatt", role: "Production lead", bio: "Stages, sound and logistics." },
      { name: "Sara Qureshi", role: "Community manager", bio: "Brings the right people together." },
    ],
    stats: [{ value: "350+", label: "Events hosted" }, { value: "90k", label: "Guests welcomed" }, { value: "4.8★", label: "Client rating" }],
    highlights: [
      { title: "End-to-end planning", text: "One team from idea to clean-up." },
      { title: "Trusted vendors", text: "Partners we've worked with for years." },
      { title: "Safety first", text: "Permits, crowd plans and backups in place." },
    ],
    ctaLabel: "Plan your event",
    photoCategory: "art",
  },
  interior_design: {
    businessName: "Atelier Nest Interiors",
    tagline: "Homes that feel like you",
    about: "A small studio designing warm, liveable homes and workspaces, from a single room refresh to complete turnkey interiors, with transparent budgets.",
    services: [
      { name: "Design consultation", shortDescription: "A walkthrough of your space and ideas.", priceType: "FIXED", pricePaise: rs(2500), durationMinutes: 90, category: "Consulting" },
      { name: "Room makeover", shortDescription: "Layout, palette, furniture and styling.", priceType: "STARTING_FROM", pricePaise: rs(75000), durationMinutes: null, category: "Residential" },
      { name: "Full home interiors", shortDescription: "Turnkey design and execution.", priceType: "ON_REQUEST", pricePaise: null, durationMinutes: null, category: "Residential" },
      { name: "Modular kitchen", shortDescription: "Functional, beautiful and built to last.", priceType: "STARTING_FROM", pricePaise: rs(150000), durationMinutes: null, category: "Kitchens" },
      { name: "Office design", shortDescription: "Workspaces your team will love.", priceType: "ON_REQUEST", pricePaise: null, durationMinutes: null, category: "Commercial" },
      { name: "3D visualisation", shortDescription: "See your space before it's built.", priceType: "STARTING_FROM", pricePaise: rs(9999), durationMinutes: null, category: "Consulting" },
    ],
    testimonials: [
      { authorName: "Ananya & Rahul", rating: 5, text: "They turned a dull flat into a home we never want to leave." },
      { authorName: "Prakash J.", rating: 5, text: "On budget, on time, and the kitchen is a dream." },
      { authorName: "Simran B.", rating: 4, text: "Thoughtful design and honest about costs from day one." },
    ],
    faqs: [
      { question: "What does a project cost?", answer: "It depends on size and finishes. We share a detailed estimate after the consultation." },
      { question: "How long does a full home take?", answer: "Typically 8 to 14 weeks from final design." },
      { question: "Do you handle execution?", answer: "Yes, with our own site supervisors and trusted craftsmen." },
      { question: "Can I reuse my furniture?", answer: "Of course. We love designing around pieces that matter to you." },
    ],
    team: [
      { name: "Tara Mehra", role: "Principal designer", bio: "Architect turned interior designer." },
      { name: "Ravi Kulkarni", role: "Project manager", bio: "Keeps every site on schedule." },
      { name: "Elena Thomas", role: "Stylist", bio: "Finishing touches and soft furnishings." },
    ],
    stats: [{ value: "180+", label: "Homes designed" }, { value: "9", label: "Years in practice" }, { value: "100%", label: "Transparent pricing" }],
    highlights: [
      { title: "Designed for living", text: "Beautiful spaces that work every day." },
      { title: "Clear budgets", text: "Itemised estimates with no hidden costs." },
      { title: "One team, start to finish", text: "Design and execution under one roof." },
    ],
    ctaLabel: "Book a consultation",
    photoCategory: "furniture",
  },
  personal_brand: {
    businessName: "Aarav Malhotra",
    tagline: "Coach, speaker and author",
    about: "I help professionals find clarity, build habits and lead with confidence, through one-to-one coaching, talks and my weekly newsletter.",
    services: [
      { name: "1:1 coaching", shortDescription: "Twelve weeks to clarity and momentum.", priceType: "STARTING_FROM", pricePaise: rs(24999), durationMinutes: 60, category: "Coaching" },
      { name: "Keynote talks", shortDescription: "On leadership, habits and change.", priceType: "ON_REQUEST", pricePaise: null, durationMinutes: 45, category: "Speaking" },
      { name: "Team workshops", shortDescription: "Half-day sessions for leadership teams.", priceType: "ON_REQUEST", pricePaise: null, durationMinutes: 240, category: "Workshops" },
      { name: "Clarity call", shortDescription: "A focused session on one big decision.", priceType: "FIXED", pricePaise: rs(2999), durationMinutes: 45, category: "Coaching" },
      { name: "Online course", shortDescription: "Self-paced habit-building programme.", priceType: "FIXED", pricePaise: rs(4999), durationMinutes: null, category: "Courses" },
      { name: "Book signing & events", shortDescription: "Bring me to your community or campus.", priceType: "ON_REQUEST", pricePaise: null, durationMinutes: null, category: "Speaking" },
    ],
    testimonials: [
      { authorName: "Ritika S., Product lead", rating: 5, text: "Twelve weeks with Aarav gave me the clarity to lead my team well." },
      { authorName: "Harsh P., Founder", rating: 5, text: "His keynote was the most talked-about session of our summit." },
      { authorName: "Mona L.", rating: 5, text: "Practical, kind and challenging in the best way." },
    ],
    faqs: [
      { question: "Who do you coach?", answer: "Managers, founders and professionals at a career turning point." },
      { question: "Are sessions online?", answer: "Yes, on video, wherever you are." },
      { question: "How do I book a talk?", answer: "Send an enquiry with your date, audience and topic." },
      { question: "Is there a free first call?", answer: "Yes, a 20-minute call to see if we're a good fit." },
    ],
    team: [{ name: "Aarav Malhotra", role: "Coach & speaker", bio: "ICF-certified coach and author of Small Steps." }],
    stats: [{ value: "500+", label: "People coached" }, { value: "120+", label: "Talks given" }, { value: "40k", label: "Newsletter readers" }],
    highlights: [
      { title: "Featured in", text: "The Economic Times, YourStory and TEDx." },
      { title: "Evidence-based", text: "Coaching grounded in behavioural science." },
      { title: "Real results", text: "Clear goals, weekly accountability, lasting change." },
    ],
    ctaLabel: "Book a clarity call",
    photoCategory: "services",
  },
  other: {
    businessName: "Brightline Services",
    tagline: "Reliable service, every time",
    about: "A local team offering dependable, friendly service with clear pricing and on-time appointments.",
    services: [
      { name: "Standard service", shortDescription: "Our most popular option.", priceType: "STARTING_FROM", pricePaise: rs(999), durationMinutes: 60, category: "Services" },
      { name: "Premium service", shortDescription: "Everything in standard, plus extras.", priceType: "STARTING_FROM", pricePaise: rs(1999), durationMinutes: 90, category: "Services" },
      { name: "Consultation", shortDescription: "Talk to us about what you need.", priceType: "FIXED", pricePaise: rs(0), durationMinutes: 30, category: "Advice" },
      { name: "Maintenance plan", shortDescription: "Regular visits, priority support.", priceType: "ON_REQUEST", pricePaise: null, durationMinutes: null, category: "Plans" },
      { name: "Express service", shortDescription: "Same-day help when you need it.", priceType: "STARTING_FROM", pricePaise: rs(1499), durationMinutes: null, category: "Services" },
      { name: "Custom project", shortDescription: "Tailored to your requirements.", priceType: "ON_REQUEST", pricePaise: null, durationMinutes: null, category: "Projects" },
    ],
    testimonials: [
      { authorName: "Asha G.", rating: 5, text: "On time, polite and great work." },
      { authorName: "Nikhil R.", rating: 5, text: "Clear pricing and no surprises. Highly recommend." },
      { authorName: "Fatima Z.", rating: 4, text: "Quick to respond and easy to work with." },
    ],
    faqs: [
      { question: "How do I book?", answer: "Send an enquiry or message us on WhatsApp." },
      { question: "Which areas do you cover?", answer: "We serve the whole city and nearby areas." },
      { question: "How do you charge?", answer: "Clear prices upfront, confirmed before we start." },
      { question: "Do you offer a guarantee?", answer: "Yes, we'll put it right if anything isn't." },
    ],
    team: [
      { name: "Sunita Reddy", role: "Owner", bio: "Runs the team and every booking." },
      { name: "Joseph M.", role: "Lead specialist", bio: "Ten years of experience." },
      { name: "Aditya K.", role: "Customer support", bio: "Always happy to help." },
    ],
    stats: [{ value: "2,000+", label: "Happy customers" }, { value: "4.8★", label: "Average rating" }, { value: "7 days", label: "Open every week" }],
    highlights: [
      { title: "On time", text: "We respect your schedule." },
      { title: "Fair prices", text: "Upfront quotes, no hidden charges." },
      { title: "Trusted team", text: "Verified, trained professionals." },
    ],
    ctaLabel: "Send an enquiry",
    photoCategory: "services",
  },
};

export function demoContent(category: InfoCategory): DemoContent {
  return DEMO_CONTENT[category] ?? DEMO_CONTENT.other;
}

/** The 3 category-appropriate sample services seeded when Step 3 is skipped (flagged is_sample). */
export function sampleServices(category: InfoCategory): DemoService[] {
  return demoContent(category).services.slice(0, 3);
}
