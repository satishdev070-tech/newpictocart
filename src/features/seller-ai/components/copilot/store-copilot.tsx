"use client";

import dynamic from "next/dynamic";
import {
  applyStoreCopilotProposalAction,
  askStoreCopilotAction,
  speakStoreCopilotAction,
  storeCopilotCostsAction,
  transcribeStoreCopilotAudioAction,
} from "@/features/seller-ai/copilot/actions";
import type { CopilotAdapter } from "@/features/seller-ai/copilot/types";
import { CopilotLauncher } from "./copilot-launcher";

const CopilotDrawer = dynamic(() => import("./copilot-drawer").then((m) => m.CopilotDrawer), { ssr: false });

const adapter: CopilotAdapter = {
  siteType: "store",
  ask: askStoreCopilotAction,
  apply: applyStoreCopilotProposalAction,
  costs: storeCopilotCostsAction,
  transcribe: transcribeStoreCopilotAudioAction,
  speak: speakStoreCopilotAction,
};

/** "Ask Pictocart AI" for the online-store dashboard (mounted in app/dashboard/layout.tsx). */
export function StoreCopilot({ panelLanguage }: { panelLanguage?: string | null }) {
  return (
    <CopilotLauncher panelLanguage={panelLanguage}>
      {(open, close) => <CopilotDrawer adapter={adapter} open={open} onClose={close} panelLanguage={panelLanguage} />}
    </CopilotLauncher>
  );
}
