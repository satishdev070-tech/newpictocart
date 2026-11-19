"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { CopilotLauncher } from "@/features/seller-ai/components/copilot/copilot-launcher";
import type { CopilotAdapter } from "@/features/seller-ai/copilot/types";
import type { CopilotCopy } from "@/features/seller-ai/copilot/copy";
import { buildInformativeSiteWithAiAction } from "./actions";
import {
  applyInformativeCopilotProposalAction,
  askInformativeCopilotAction,
  informativeCopilotCostsAction,
  speakInformativeCopilotAction,
  transcribeInformativeCopilotAudioAction,
} from "./copilot-actions";

const CopilotDrawer = dynamic(() => import("@/features/seller-ai/components/copilot/copilot-drawer").then((m) => m.CopilotDrawer), { ssr: false });

const adapter: CopilotAdapter = {
  siteType: "informative",
  ask: askInformativeCopilotAction,
  apply: applyInformativeCopilotProposalAction,
  costs: informativeCopilotCostsAction,
  transcribe: transcribeInformativeCopilotAudioAction,
  speak: speakInformativeCopilotAction,
};

/** Keeps the old assistant's "Rebuild my whole website" (needs settings.write). */
function RebuildButton({ copy }: { copy: CopilotCopy }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { show } = useToast();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        if (busy || !window.confirm(copy.rebuildConfirm)) return;
        setBusy(true);
        void buildInformativeSiteWithAiAction({ onboarding: false }).then((r) => {
          setBusy(false);
          if (!r.ok) return show({ tone: "error", message: r.error.fieldErrors?._form?.[0] ?? r.error.message ?? copy.errorGeneric });
          show({ tone: r.data.built ? "success" : "warning", message: r.data.built ? "Your website was rewritten. Preview it before you publish." : "AI isn't available right now. Nothing was changed." });
          router.refresh();
        });
      }}
      className="w-full rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-left text-caption font-medium text-accent disabled:opacity-60"
    >
      {busy ? copy.rebuilding : copy.rebuild}
    </button>
  );
}

/** "Ask Pictocart AI" for the informative-website panel (mounted in app/informative/(panel)/layout.tsx). */
export function InformativeCopilot({ canWrite, canRebuild, panelLanguage, scope }: { canWrite: boolean; canRebuild: boolean; panelLanguage?: string | null; scope: string }) {
  const router = useRouter();
  const withRefresh = useMemo<CopilotAdapter>(
    () => ({
      ...adapter,
      apply: async (payload) => {
        const r = await adapter.apply(payload);
        if (r.ok) router.refresh();
        return r;
      },
    }),
    [router],
  );
  if (!canWrite) return null;
  return (
    <CopilotLauncher key={scope} panelLanguage={panelLanguage}>
      {(open, close) => (
        <CopilotDrawer adapter={withRefresh} open={open} onClose={close} panelLanguage={panelLanguage} scope={scope} footerExtra={canRebuild ? (copy) => <RebuildButton copy={copy} /> : undefined} />
      )}
    </CopilotLauncher>
  );
}
