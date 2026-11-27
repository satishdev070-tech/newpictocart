/**
 * Tara stays on the seller's business (pure, unit tested). The model labels every reply with a
 * `topic`; an "off_topic" reply is a short, polite "that's outside what I can help with" and the
 * server then returns no links and no plan steps (nothing can run) and refunds the question's credit.
 */
import { z } from "zod";
import type { CopilotSiteType } from "./quick-actions";

export const COPILOT_TOPICS = ["business", "off_topic"] as const;
export type CopilotTopic = (typeof COPILOT_TOPICS)[number];

/** Lenient: a missing or unknown label counts as on topic (the old behaviour). */
export const copilotTopicSchema = z.enum(COPILOT_TOPICS).catch("business").default("business");

/** JSON field added to the reply shape in both panels' prompts. */
export const COPILOT_TOPIC_FIELD = '"topic":"business"|"off_topic"';

export function copilotScopeRule(site: CopilotSiteType): string {
  const place = site === "store" ? "this online store" : "this business and its website";
  const inScope =
    site === "store"
      ? "its products, stock, prices, orders, customers, sales, marketing, blog, FAQs, settings, AI credits or plan, how to use Pictocart, or advice on running and growing this kind of online shop in India"
      : "its services, prices, website pages and text, enquiries, SEO, marketing, settings, AI credits or plan, how to use Pictocart, or advice on running and growing this kind of business in India";
  return [
    "Scope (decide this first, every time):",
    `- topic "business": the question is about ${place}: ${inScope}. Greetings, thanks and small talk are "business" too: reply warmly in one line and offer help.`,
    '- topic "off_topic": anything else, e.g. general knowledge, news, politics, sports, celebrities, weather, maths or homework, coding, translations unrelated to the business, jokes, stories or poems, health, legal, tax or investment advice, other companies or stores, or personal matters.',
    `- For "off_topic": reply in 1-2 short, kind sentences: you are Tara, the assistant for ${place}, so that's outside what you can help with; then offer one or two things you can do here. Do not answer the off-topic question, not even partly, and never guess. links [] and proposals [].`,
    "- When unsure, think: does answering help the seller run or grow this business? Yes = business, no = off_topic.",
  ].join("\n");
}

