"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { parseInput } from "@/lib/validation/common";
import { updateObservabilitySetting } from "./server/queries";
import {
  acknowledgeIncident,
  listAlertRules,
  toggleAlertRule,
  upsertAlertRule,
} from "./server/alerts";

const ALERTS_PATH = "/admin/performance/alerts";
const SETTINGS_PATH = "/admin/performance/settings";

export async function saveObservabilitySettingAction(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const key = String(formData.get("key") ?? "").trim();
  const raw = String(formData.get("value") ?? "").trim();
  if (!key) return { ok: false, error: "Key is required" };

  let value: string | number | boolean;
  if (raw === "true" || raw === "false") value = raw === "true";
  else if (raw !== "" && Number.isFinite(Number(raw))) value = Number(raw);
  else {
    try {
      value = JSON.parse(raw) as string | number | boolean;
    } catch {
      value = raw;
    }
  }

  const result = await updateObservabilitySetting(key, value);
  if (result.ok) revalidatePath(SETTINGS_PATH);
  return result;
}

/** List rules — gated inside server helper by platform.observability.manage. */
export async function listAlertRulesAction(): Promise<ActionResult<Awaited<ReturnType<typeof listAlertRules>>>> {
  return runAction("observability.alerts.list", () => listAlertRules());
}

export async function upsertAlertRuleAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  return runAction("observability.alerts.upsert", async () => {
    const raw = formToObject(fd);
    const enabledRaw = raw.enabled;
    const enabled =
      enabledRaw === true ||
      enabledRaw === "true" ||
      enabledRaw === "on" ||
      enabledRaw === "1" ||
      enabledRaw === undefined;
    const thresholdMs = raw.thresholdMs === "" || raw.thresholdMs == null ? undefined : Number(raw.thresholdMs);
    const thresholdRate =
      raw.thresholdRate === "" || raw.thresholdRate == null ? undefined : Number(raw.thresholdRate);
    const input = parseInput(
      z.object({
        id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
        name: z.string().trim().min(1).max(120),
        enabled: z.boolean().optional(),
        ruleType: z.enum(["p95", "error_rate", "p95_or_error_rate"]),
        thresholdMs: z.number().positive().optional(),
        thresholdRate: z.number().min(0).max(1).optional(),
        routeTemplate: z.string().max(300).optional(),
        cooldownMinutes: z.coerce.number().int().min(0).max(24 * 60).optional(),
        severity: z.enum(["info", "warning", "critical"]).optional(),
      }),
      {
        ...raw,
        id: typeof raw.id === "string" && raw.id.length > 0 ? raw.id : undefined,
        enabled,
        thresholdMs: Number.isFinite(thresholdMs) ? thresholdMs : undefined,
        thresholdRate: Number.isFinite(thresholdRate) ? thresholdRate : undefined,
      },
    );
    await upsertAlertRule({
      id: input.id,
      name: input.name,
      enabled: input.enabled ?? true,
      ruleType: input.ruleType,
      config: {
        thresholdMs: input.thresholdMs,
        thresholdRate: input.thresholdRate,
        routeTemplate: input.routeTemplate || null,
        cooldownMinutes: input.cooldownMinutes,
        severity: input.severity,
      },
    });
    revalidatePath(ALERTS_PATH);
  });
}

export async function toggleAlertRuleAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  return runAction("observability.alerts.toggle", async () => {
    const raw = formToObject(fd);
    const { id, enabled } = parseInput(
      z.object({
        id: z.string().uuid(),
        enabled: z.enum(["true", "false"]).transform((v) => v === "true"),
      }),
      {
        id: raw.id,
        enabled: String(raw.enabled ?? "false"),
      },
    );
    await toggleAlertRule({ id, enabled });
    revalidatePath(ALERTS_PATH);
  });
}

export async function acknowledgeIncidentAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  return runAction("observability.incidents.ack", async () => {
    const { incidentId } = parseInput(z.object({ incidentId: z.string().uuid() }), formToObject(fd));
    await acknowledgeIncident({ incidentId });
    revalidatePath(ALERTS_PATH);
  });
}
