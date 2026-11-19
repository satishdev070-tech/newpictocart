import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_INFO_FACTS,
  infoFactsReady,
  matchServiceType,
  mergeInfoFacts,
  missingInfoFacts,
  normalizeEmail,
  normalizeInfoFacts,
  normalizePhone,
  toBasicPatch,
  toDraftServices,
  toInfoCategory,
} from "@/features/informative/onboarding/tara/facts";
import { infoTaraGreeting, nextInfoStep, wasAsked } from "@/features/informative/onboarding/tara/lines";
import { infoTaraSystemPrompt, infoTaraUserPrompt } from "@/features/informative/onboarding/tara/prompt";
import { basicInfoStepSchema } from "@/features/informative/onboarding/draft";

const sarvam = vi.hoisted(() => ({ configured: false, chat: vi.fn(), tts: vi.fn() }));
const llm = vi.hoisted(() => ({ providers: [] as { id: string; apiKey: string; model: string }[], generate: vi.fn() }));
vi.mock("@/lib/sarvam/client", () => ({ isSarvamConfigured: () => sarvam.configured, chatTurn: sarvam.chat, synthesizeSpeech: sarvam.tts }));
vi.mock("@/features/neural-pulse/server/generate", () => ({ loadProviders: async () => llm.providers }));
vi.mock("@/features/neural-pulse/server/llm", () => ({ generateJson: llm.generate }));
vi.mock("@/lib/observability/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { runInfoTaraTurn, extractInfoFacts } = await import("@/features/informative/onboarding/tara/turn");

describe("informative Tara facts", () => {
  it("normalises spoken phone numbers and emails", () => {
    expect(normalizePhone("+91 98765-43210")).toBe("9876543210");
    expect(normalizePhone("098765 43210")).toBe("9876543210");
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("5876543210")).toBeNull();
    expect(normalizeEmail("ramesh at gmail dot com")).toBe("ramesh@gmail.com");
    expect(normalizeEmail("Smile.Dental at the rate yahoo dot co dot in")).toBe("smile.dental@yahoo.co.in");
    expect(normalizeEmail("kathryn@clinic.in")).toBe("kathryn@clinic.in");
    expect(normalizeEmail("not an email")).toBeNull();
  });

  it("maps what they do to a category and a known service type", () => {
    expect(toInfoCategory("dental clinic")).toBe("clinic_healthcare");
    expect(toInfoCategory("beauty parlour")).toBe("salon_beauty");
    expect(toInfoCategory("yoga classes")).toBe("gym_fitness");
    expect(toInfoCategory("CA firm")).toBe("consultancy");
    expect(toInfoCategory("salon_beauty")).toBe("salon_beauty");
    expect(matchServiceType("dentist", "clinic_healthcare")?.family).toBe("clinic_healthcare");
    const f = normalizeInfoFacts({ serviceType: "dental clinic", businessName: "Smile Dental" });
    expect(f.category).toBe("clinic_healthcare");
    expect(f.serviceTypeId).toBeTruthy();
  });

  it("keeps known facts on merge and lets corrections win", () => {
    const a = mergeInfoFacts({ ...EMPTY_INFO_FACTS }, { businessName: "Glow", city: "Indore" });
    const b = mergeInfoFacts(a, { businessName: "Glow Studio", city: null });
    expect(b).toMatchObject({ businessName: "Glow Studio", city: "Indore" });
  });

  it("knows what's still needed, in asking order", () => {
    expect(missingInfoFacts(EMPTY_INFO_FACTS)).toEqual(["businessName", "serviceType", "city", "phone", "email", "services"]);
    const ready = normalizeInfoFacts({ businessName: "Smile Dental", serviceType: "dentist", city: "Pune", phone: "9876543210" });
    expect(infoFactsReady(ready)).toBe(true);
    expect(nextInfoStep(ready, { email: true, services: true })).toBe("ready");
    expect(nextInfoStep(ready, { email: false, services: true })).toBe("email");
  });

  it("produces a Step 1 patch the real form schema accepts (with the remaining fields filled)", () => {
    const f = normalizeInfoFacts({ businessName: "Smile Dental", serviceType: "dentist", city: "Pune", phone: "98765 43210", email: "smile at gmail dot com" });
    const patch = toBasicPatch(f);
    expect(patch).toMatchObject({ businessName: "Smile Dental", category: "clinic_healthcare", phone: "9876543210", email: "smile@gmail.com", city: "Pune" });
    expect(basicInfoStepSchema.safeParse({ ...patch, slug: "smile-dental" }).success).toBe(true);
    // Their own label when nothing is known.
    expect(toBasicPatch(normalizeInfoFacts({ category: "other", serviceType: "Kite making workshops" }))).toMatchObject({ serviceTypeId: "custom", serviceType: "Kite making workshops" });
  });

  it("turns services into starter services (price → starting from, else on request)", () => {
    const f = normalizeInfoFacts({ services: [{ name: "Root canal", priceRupees: "₹3,500" }, "Teeth cleaning", "teeth cleaning", { name: "x" }] });
    expect(toDraftServices(f)).toEqual([
      { name: "Root canal", shortDescription: "", priceType: "STARTING_FROM", pricePaise: 350000, durationMinutes: null },
      { name: "Teeth cleaning", shortDescription: "", priceType: "ON_REQUEST", pricePaise: null, durationMinutes: null },
    ]);
  });
});

describe("informative Tara lines and prompt", () => {
  it("greets in every onboarding language and falls back to English", () => {
    for (const l of ["en-IN", "hi-IN", "bn-IN", "ta-IN", "te-IN", "mr-IN", "gu-IN", "kn-IN", "ml-IN", "pa-IN"]) expect(infoTaraGreeting(l).length).toBeGreaterThan(20);
    expect(infoTaraGreeting("xx-IN")).toBe(infoTaraGreeting("en-IN"));
  });

  it("persona prompt: informative website, one question, examples, native reply", () => {
    const p = infoTaraSystemPrompt("hi-IN", { nativeReply: true });
    expect(p).toMatch(/You are Tara/);
    expect(p).toMatch(/INFORMATIVE WEBSITE/);
    expect(p).toMatch(/exactly ONE question/);
    expect(p).toMatch(/Reply in Hindi/);
    expect(infoTaraSystemPrompt("en-IN")).toMatch(/Hinglish \(Roman script\) if they mix/);
    const u = infoTaraUserPrompt({ transcript: "hi", facts: EMPTY_INFO_FACTS, locale: "en-IN", emailAsked: true, servicesAsked: false });
    const need = u.split("\n").find((l) => l.startsWith("Still need")) ?? "";
    expect(need).toMatch(/business name/);
    expect(need).toMatch(/main services/);
    expect(need).not.toMatch(/email/);
  });

  it("remembers whether email / services were asked", () => {
    expect(wasAsked([{ role: "tara", text: "What's your email?" }], "email")).toBe(true);
    expect(wasAsked([{ role: "seller", text: "email later" }], "email")).toBe(false);
  });
});

describe("informative Tara turn", () => {
  beforeEach(() => {
    sarvam.configured = false;
    sarvam.chat.mockReset();
    sarvam.tts.mockReset().mockResolvedValue(null);
    llm.generate.mockReset();
    llm.providers = [];
  });

  it("platform AI answers and its facts are normalised + backed by the local extractor", async () => {
    llm.providers = [{ id: "groq", apiKey: "k", model: "m" }];
    llm.generate.mockResolvedValue({
      data: { reply: "Smile Dental, Pune, wonderful! Aapka mobile number?", facts: { businessName: "Smile Dental", category: "clinic_healthcare", serviceType: "Dentist", city: "Pune" }, done: false },
      provider: "groq",
      model: "m",
      tokens: 1,
      attempts: 1,
    });
    const r = await runInfoTaraTurn({ locale: "en-IN", text: "Smile Dental in Pune, dentist, call 98765 43210", facts: EMPTY_INFO_FACTS, history: [] });
    expect(r.via).toBe("groq");
    expect(r.facts).toMatchObject({ businessName: "Smile Dental", category: "clinic_healthcare", city: "Pune", phone: "9876543210" });
    expect(r.done).toBe(false);
  });

  it("scripted fallback fills the slot it asked for and moves on", async () => {
    const r1 = await runInfoTaraTurn({ locale: "en-IN", text: "Glow Studio", facts: EMPTY_INFO_FACTS, history: [] });
    expect(r1.via).toBe("scripted");
    expect(r1.facts.businessName).toBe("Glow Studio");
    expect(r1.reply).toMatch(/What do you do/);
    const r2 = await runInfoTaraTurn({ locale: "en-IN", text: "beauty salon", facts: r1.facts, history: [] });
    expect(r2.facts.category).toBe("salon_beauty");
    expect(r2.reply).toMatch(/city/);
  });

  it("done once the required facts are in and optional ones were asked", async () => {
    const facts = normalizeInfoFacts({ businessName: "Glow Studio", serviceType: "salon", city: "Indore" });
    const history = [
      { role: "tara" as const, text: "What's your email?" },
      { role: "tara" as const, text: "Which services do you offer?" },
    ];
    const r = await runInfoTaraTurn({ locale: "en-IN", text: "9876543210", facts, history });
    expect(r.facts.phone).toBe("9876543210");
    expect(r.done).toBe(true);
  });

  it("local extractor never overwrites with junk", () => {
    expect(extractInfoFacts("my number is 98765 43210", EMPTY_INFO_FACTS, null)).toEqual({ phone: "9876543210" });
    expect(extractInfoFacts("12345", EMPTY_INFO_FACTS, "city")).toEqual({});
    expect(extractInfoFacts("haircut, facial aur bridal makeup", EMPTY_INFO_FACTS, "services").services?.map((s) => s.name)).toEqual(["haircut", "facial", "bridal makeup"]);
    // Display names are capitalised once normalised.
    expect(normalizeInfoFacts({ services: ["haircut"] }).services[0]!.name).toBe("Haircut");
  });
});

describe("informative Tara turn: model can't finish early", () => {
  it("ignores done=true while required facts are missing", async () => {
    sarvam.configured = false;
    sarvam.tts.mockResolvedValue(null);
    llm.providers = [{ id: "groq", apiKey: "k", model: "m" }];
    llm.generate.mockResolvedValue({ data: { reply: "All set!", facts: { businessName: "Glow" }, done: true }, provider: "groq", model: "m", tokens: 1, attempts: 1 });
    const r = await runInfoTaraTurn({ locale: "en-IN", text: "Glow", facts: EMPTY_INFO_FACTS, history: [] });
    expect(r.done).toBe(false);
  });
});
