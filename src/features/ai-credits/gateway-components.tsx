"use client";

import { useActionState } from "react";
import { Badge, Card } from "@/components/ui/layout";
import { TextField, SelectField } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { ActionForm, InlineAction } from "@/features/settings/ui/action-controls";
import type { ActionResult } from "@/lib/actions/result";
import {
  clearPlatformCashfreeAction,
  clearPlatformPayuAction,
  clearPlatformRazorpayAction,
  savePlatformCashfreeAction,
  savePlatformPayuAction,
  savePlatformRazorpayAction,
  testPlatformCashfreeAction,
  testPlatformPayuAction,
  testPlatformRazorpayAction,
} from "./gateway-actions";
import type { PlatformGatewayId, PlatformGatewayStatus } from "./gateway-schemas";

type Msg = ActionResult<{ message: string }> | null;

const ACTIVE_LABEL: Record<PlatformGatewayId, string> = {
  razorpay: "Razorpay",
  cashfree: "Cashfree",
  payu: "PayU",
};

function TestButton({ action, label }: { action: (prev: Msg, fd: FormData) => Promise<ActionResult<{ message: string }>>; label: string }) {
  const [state, formAction] = useActionState(action, null as Msg);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <SubmitButton variant="secondary">{label}</SubmitButton>
      {state?.ok ? <p className="text-small text-success">{state.data.message}</p> : null}
      {state && !state.ok ? <FormMessage state={state} /> : null}
    </form>
  );
}

export function PlatformPaymentsPanel({
  status,
  webhookUrls,
  razorpaySavedInDb,
  cashfreeSavedInDb,
  payuSavedInDb,
}: {
  status: PlatformGatewayStatus;
  webhookUrls: { razorpay: string; cashfree: string; payu: string };
  razorpaySavedInDb: boolean;
  cashfreeSavedInDb: boolean;
  payuSavedInDb: boolean;
}) {
  return (
    <div className="space-y-6">
      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            Platform payments{" "}
            {status.active ? (
              <Badge tone="success">Live via {ACTIVE_LABEL[status.active]}</Badge>
            ) : (
              <Badge tone="neutral">Offline requests only</Badge>
            )}
          </span>
        }
        description="Keys used to collect AI credit recharges and plan upgrades for the platform. Store checkout still uses each merchant's own Razorpay / Cashfree / PayU integration."
      >
        <p className="text-small text-muted">
          When a gateway is configured, sellers pay online and credits or plan changes apply automatically after the webhook. Otherwise they send a request for manual approval.
          {status.active === "razorpay" && (status.cashfree.configured || status.payu.configured)
            ? " Razorpay is preferred while multiple gateways are configured."
            : null}
          {status.active === "cashfree" && status.payu.configured ? " Cashfree is preferred over PayU while both are configured." : null}
        </p>
      </Card>

      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            Razorpay {status.razorpay.configured ? <Badge tone="success">{status.razorpay.mode === "live" ? "Live" : "Test"}</Badge> : <Badge tone="neutral">Not set</Badge>}
          </span>
        }
        description="Key ID, Key Secret and webhook secret from the Razorpay dashboard. Webhook events: payment.captured."
      >
        <div className="space-y-4">
          <ActionForm action={savePlatformRazorpayAction} submitLabel="Save & test" success="Saved." className="space-y-3">
            {(e) => (
              <>
                <TextField
                  label="Key ID"
                  name="keyId"
                  defaultValue={status.razorpay.clientId ?? ""}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="rzp_test_…"
                  errors={e.keyId}
                />
                <TextField
                  label="Key Secret"
                  name="keySecret"
                  type="password"
                  autoComplete="new-password"
                  spellCheck={false}
                  placeholder={status.razorpay.keyHint ? `Saved • ending ${status.razorpay.keyHint}` : "••••"}
                  hint="Stored encrypted. It can't be viewed again after saving."
                  errors={e.keySecret ?? e._form}
                />
                <TextField
                  label="Webhook secret"
                  name="webhookSecret"
                  type="password"
                  autoComplete="new-password"
                  spellCheck={false}
                  optional
                  placeholder={status.razorpay.hasWebhookSecret ? "Saved • leave blank to keep" : "From Razorpay → Webhooks"}
                  hint={`Callback URL: ${webhookUrls.razorpay}`}
                  errors={e.webhookSecret}
                />
              </>
            )}
          </ActionForm>
          <div className="flex flex-wrap items-center gap-2">
            {status.razorpay.configured ? <TestButton action={testPlatformRazorpayAction} label="Test connection" /> : null}
            {razorpaySavedInDb ? <InlineAction action={clearPlatformRazorpayAction} label="Remove Razorpay keys" variant="ghost" success="Removed." /> : null}
          </div>
        </div>
      </Card>

      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            Cashfree {status.cashfree.configured ? <Badge tone="success">{status.cashfree.environment === "live" ? "Production" : "Sandbox"}</Badge> : <Badge tone="neutral">Not set</Badge>}
          </span>
        }
        description="App ID, Secret Key and environment. Used when Razorpay is not configured."
      >
        <div className="space-y-4">
          <ActionForm action={savePlatformCashfreeAction} submitLabel="Save & test" success="Saved." className="space-y-3">
            {(e) => (
              <>
                <TextField label="App ID" name="appId" defaultValue={status.cashfree.clientId ?? ""} autoComplete="off" spellCheck={false} errors={e.appId} />
                <TextField
                  label="Secret Key"
                  name="secretKey"
                  type="password"
                  autoComplete="new-password"
                  spellCheck={false}
                  placeholder={status.cashfree.keyHint ? `Saved • ending ${status.cashfree.keyHint}` : "••••"}
                  hint="Stored encrypted. It can't be viewed again after saving."
                  errors={e.secretKey ?? e._form}
                />
                <SelectField
                  label="Environment"
                  name="environment"
                  defaultValue={status.cashfree.environment ?? "test"}
                  options={[
                    { value: "test", label: "Sandbox" },
                    { value: "live", label: "Production" },
                  ]}
                  hint={`Notify URL: ${webhookUrls.cashfree}`}
                  errors={e.environment}
                />
              </>
            )}
          </ActionForm>
          <div className="flex flex-wrap items-center gap-2">
            {status.cashfree.configured ? <TestButton action={testPlatformCashfreeAction} label="Test connection" /> : null}
            {cashfreeSavedInDb ? <InlineAction action={clearPlatformCashfreeAction} label="Remove Cashfree keys" variant="ghost" success="Removed." /> : null}
          </div>
        </div>
      </Card>

      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            PayU {status.payu.configured ? <Badge tone="success">{status.payu.environment === "live" ? "Production" : "Test"}</Badge> : <Badge tone="neutral">Not set</Badge>}
          </span>
        }
        description="Merchant Key, Salt and environment from PayU Dashboard → Developers. Used when Razorpay and Cashfree are not configured."
      >
        <div className="space-y-4">
          <ActionForm action={savePlatformPayuAction} submitLabel="Save & test" success="Saved." className="space-y-3">
            {(e) => (
              <>
                <TextField
                  label="Merchant Key"
                  name="merchantKey"
                  defaultValue={status.payu.clientId ?? ""}
                  autoComplete="off"
                  spellCheck={false}
                  errors={e.merchantKey}
                />
                <TextField
                  label="Merchant Salt"
                  name="salt"
                  type="password"
                  autoComplete="new-password"
                  spellCheck={false}
                  placeholder={status.payu.keyHint ? `Saved • ending ${status.payu.keyHint}` : "••••"}
                  hint="Stored encrypted. It can't be viewed again after saving."
                  errors={e.salt ?? e._form}
                />
                <SelectField
                  label="Environment"
                  name="environment"
                  defaultValue={status.payu.environment ?? "test"}
                  options={[
                    { value: "test", label: "Test" },
                    { value: "live", label: "Production" },
                  ]}
                  hint={`Webhook URL: ${webhookUrls.payu}`}
                  errors={e.environment}
                />
              </>
            )}
          </ActionForm>
          <div className="flex flex-wrap items-center gap-2">
            {status.payu.configured ? <TestButton action={testPlatformPayuAction} label="Test connection" /> : null}
            {payuSavedInDb ? <InlineAction action={clearPlatformPayuAction} label="Remove PayU keys" variant="ghost" success="Removed." /> : null}
          </div>
        </div>
      </Card>
    </div>
  );
}
