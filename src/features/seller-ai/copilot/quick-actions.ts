/**
 * Quick-action chips for "Ask Pictocart AI" (pure; client + server, unit tested).
 *
 * A chip either sends a ready question, or (needsSubject) asks the seller for one detail first
 * (which product, the review text…). The visible message comes from quickActionMessage; the
 * server adds the matching task rule (copilotTaskRule) so the model returns the right proposal.
 */
export const STORE_INTENTS = ["product_description", "product_seo", "faqs", "promo", "review_reply", "next_steps"] as const;
export const INFORMATIVE_INTENTS = ["improve_about", "service_description", "faqs", "seo", "enquiry_reply", "whats_missing"] as const;
export type StoreIntent = (typeof STORE_INTENTS)[number];
export type InformativeIntent = (typeof INFORMATIVE_INTENTS)[number];
export type CopilotIntent = StoreIntent | InformativeIntent;
export type CopilotSiteType = "store" | "informative";

export type QuickAction = {
  id: CopilotIntent;
  /** Chip text (English; the drawer copy may localise by id). */
  label: string;
  /** When set, the composer asks for this detail before sending. */
  subject?: { placeholder: string; max: number };
};

export const QUICK_ACTIONS: Record<CopilotSiteType, QuickAction[]> = {
  store: [
    { id: "product_description", label: "Improve a product description", subject: { placeholder: "Which product? e.g. Cotton kurta", max: 200 } },
    { id: "product_seo", label: "SEO title for a product", subject: { placeholder: "Which product?", max: 200 } },
    { id: "faqs", label: "Write store FAQs" },
    { id: "promo", label: "Write an offer message", subject: { placeholder: "The offer, e.g. 10% off this weekend", max: 300 } },
    { id: "review_reply", label: "Reply to a review", subject: { placeholder: "Paste the customer's review", max: 1500 } },
    { id: "next_steps", label: "What should I do next to get sales?" },
  ],
  informative: [
    { id: "improve_about", label: "Improve my About text" },
    { id: "service_description", label: "Write a service description", subject: { placeholder: "Which service?", max: 200 } },
    { id: "faqs", label: "Write FAQs" },
    { id: "seo", label: "Improve my Google title" },
    { id: "enquiry_reply", label: "Reply to an enquiry", subject: { placeholder: "Paste the customer's message", max: 1500 } },
    { id: "whats_missing", label: "What's missing on my site?" },
  ],
};

export function isIntentFor(siteType: CopilotSiteType, id: unknown): id is CopilotIntent {
  return QUICK_ACTIONS[siteType].some((a) => a.id === id);
}

export function quickAction(siteType: CopilotSiteType, id: CopilotIntent): QuickAction | undefined {
  return QUICK_ACTIONS[siteType].find((a) => a.id === id);
}

const oneLine = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);
const block = (s: string, max: number) => s.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);

/**
 * The seller's visible message for a chip. Returns null when the chip needs a detail that is
 * missing, so the composer keeps asking instead of sending an empty request.
 */
export function quickActionMessage(siteType: CopilotSiteType, id: CopilotIntent, subject?: string | null): string | null {
  const action = quickAction(siteType, id);
  if (!action) return null;
  const s = action.subject ? (id === "review_reply" || id === "enquiry_reply" ? block(subject ?? "", action.subject.max) : oneLine(subject ?? "", action.subject.max)) : "";
  if (action.subject && !s) return null;
  switch (id) {
    case "product_description":
      return `Write a better description for my product "${s}".`;
    case "product_seo":
      return `Write an SEO title and description for my product "${s}".`;
    case "faqs":
      return siteType === "store" ? "Write 5 FAQs for my store." : "Write FAQs my customers ask.";
    case "promo":
      return `Write a short offer message I can share on WhatsApp and Instagram: ${s}`;
    case "review_reply":
      return `Write a polite reply to this customer review:\n${s}`;
    case "next_steps":
      return "What should I do next to get more sales?";
    case "improve_about":
      return "Improve my About text and tagline.";
    case "service_description":
      return `Write a better description for my service "${s}".`;
    case "seo":
      return "Improve my Google search title and description.";
    case "enquiry_reply":
      return `Write a reply to this customer enquiry:\n${s}`;
    case "whats_missing":
      return "What's missing on my website?";
  }
}

/** Extra system-prompt lines for a chip, so the model returns the right kind of proposal. */
export function copilotTaskRule(siteType: CopilotSiteType, id: CopilotIntent | null | undefined): string | null {
  if (!id || !isIntentFor(siteType, id)) return null;
  if (siteType === "store") {
    switch (id) {
      case "product_description":
        return 'Task: the seller wants a better description for the product named in their message. Find it in the Catalogue in <store_data>. Return ONE proposal {"type":"product_copy","productTitle":<title exactly as listed>,"description":<plain text, short paragraphs and "- " bullet lines, 80-200 words>,"shortDescription":<max 160 chars>}. Describe only facts that are in the data or the message. If the product is not listed, say so, ask for the exact name and return no proposals.';
      case "product_seo":
        return 'Task: Return ONE proposal {"type":"product_copy","productTitle":<title exactly as listed in the Catalogue>,"seoTitle":<max 60 chars>,"seoDescription":<max 155 chars>} for the product named in the message. If the product is not listed, say so and return no proposals.';
      case "faqs":
        return 'Task: Return ONE proposal {"type":"faq","groupName":"General","items":[5 Q&As]} for this store. Questions customers really ask (delivery, returns, payment, sizes, care). Do not invent policies that contradict <store_data>; keep answers general where the data is silent.';
      case "promo":
        return "Task: write 2 or 3 short offer messages (WhatsApp, Instagram caption, website banner line) for the offer in the message. Put them in the answer as '- ' bullet lines. No proposals. Link the discounts page so they can create the code.";
      case "review_reply":
        return "Task: write one short, polite public reply to the customer review in the message, from the store. Thank them, address any problem calmly, no promises the store can't keep. Put the reply in the answer. No proposals. Link the reviews page.";
      case "next_steps":
        return "Task: give the 3 to 5 most useful next steps to get more sales, ordered by impact, each tied to a fact in <store_data> (pending orders, low stock, unfinished setup, no products live, etc.). Use '- ' bullet lines and add links to the matching dashboard pages. No proposals.";
    }
  } else {
    switch (id) {
      case "improve_about":
        return 'Task: Return ONE proposal {"kind":"site_copy","tagline":<max 80 chars>,"about":<2 short paragraphs>} that improves the current text. No invented facts.';
      case "service_description":
        return 'Task: Return ONE proposal {"kind":"service_update","serviceName":<name exactly as listed in Current services>,"shortDescription":<max 150 chars>,"description":<2-4 sentences>} for the service named in the message. If it is not listed, say so and return no proposals.';
      case "faqs":
        return 'Task: Return ONE proposal {"kind":"faqs","faqs":[4 to 6 NEW questions]} customers of this business really ask.';
      case "seo":
        return 'Task: Return ONE proposal {"kind":"seo","title":<max 60 chars, include the city when known>,"description":<max 155 chars>}.';
      case "enquiry_reply":
        return "Task: write one short, friendly reply (WhatsApp-ready) to the customer enquiry in the message, from the business. Do not quote prices or times that aren't in <site_data>. Put it in the reply. No proposals.";
      case "whats_missing":
        return "Task: list what is missing or weak on the website using 'Missing' in <site_data>, most important first, with where in the dashboard to fix each one. Use '- ' bullet lines. Offer to write any missing text. No proposals.";
    }
  }
  return null;
}
