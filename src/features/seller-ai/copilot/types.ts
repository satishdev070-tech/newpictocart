/**
 * View model shared by the "Ask Pictocart AI" drawer and both panels' server actions (pure).
 * The drawer never interprets a proposal: it shows `fields` as a before/after diff and sends
 * `payload` back to the panel's apply action, which re-validates it and re-checks tenant and
 * permission on the server.
 */
import type { ActionResult } from "@/lib/actions/result";
import type { CopilotIntent, CopilotSiteType } from "./quick-actions";
import type { CopilotLanguage } from "./languages";

export type CopilotField = { label: string; before: string | null; after: string };

export type CopilotProposalView = {
  /** Stable within one reply (used as a React key). */
  id: string;
  title: string;
  fields: CopilotField[];
  /** Credits Apply will spend (0 = free). Shown on the Apply button before anything is spent. */
  applyCredits: number;
  /** Opaque to the client; the apply action re-validates it. */
  payload: unknown;
};

export type CopilotLink = { label: string; href: string };

export type CopilotReply = { answer: string; links: CopilotLink[]; proposals: CopilotProposalView[] };

export type CopilotCosts = { ask: number | null; balance: number | null };

/** Result of one executed plan step (`href` opens what changed). */
export type CopilotApplied = { message: string; href?: string };

export type CopilotChatMessage = { role: "user" | "assistant"; content: string };

export type CopilotAskInput = { messages: CopilotChatMessage[]; language: CopilotLanguage; intent?: CopilotIntent | null };

/** Server actions a panel hands to the shared drawer. */
export type CopilotAdapter = {
  siteType: CopilotSiteType;
  ask: (input: CopilotAskInput) => Promise<ActionResult<CopilotReply>>;
  apply: (payload: unknown) => Promise<ActionResult<{ message: string; href?: string }>>;
  costs: () => Promise<ActionResult<CopilotCosts>>;
  transcribe: (fd: FormData) => Promise<ActionResult<{ transcript: string }>>;
  speak: (input: { text: string; language: CopilotLanguage }) => Promise<ActionResult<{ audioBase64: string; mimeType: string } | null>>;
};
