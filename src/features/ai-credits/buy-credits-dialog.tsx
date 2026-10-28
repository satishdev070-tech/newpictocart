"use client";

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormMessage, SubmitButton, fieldErrors } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { HiddenFields } from "@/features/settings/ui/action-controls";
import { requestAiCreditPurchaseAction, type AiCreditPurchaseResult } from "./actions";
import type { ActionResult } from "@/lib/actions/result";

type RazorpayOptions = Record<string, unknown> & {
  handler: (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
};
declare global {
  interface Window {
    Razorpay?: new (o: RazorpayOptions) => { open: () => void; on: (e: string, cb: (r: { error?: { description?: string } }) => void) => void };
    Cashfree?: (o: { mode: "sandbox" | "production" }) => { checkout: (o: { paymentSessionId: string; redirectTarget: "_self" }) => Promise<unknown> };
  }
}

function loadExternal(src: string, ready: () => boolean): Promise<boolean> {
  if (ready()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve(ready());
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

async function openCheckout(checkout: NonNullable<AiCreditPurchaseResult["checkout"]>, meta: { storeName: string; amountMinor: number; description: string }) {
  if (checkout.kind === "cashfree") {
    if (!(await loadExternal("https://sdk.cashfree.com/js/v3/cashfree.js", () => Boolean(window.Cashfree))) || !window.Cashfree) {
      throw new Error("Couldn't load Cashfree. Check your connection and try again.");
    }
    await window.Cashfree({ mode: checkout.mode }).checkout({ paymentSessionId: checkout.paymentSessionId, redirectTarget: "_self" });
    return;
  }
  if (!(await loadExternal("https://checkout.razorpay.com/v1/checkout.js", () => Boolean(window.Razorpay))) || !window.Razorpay) {
    throw new Error("Couldn't load the payment window. Check your connection and try again.");
  }
  await new Promise<void>((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: checkout.keyId,
      order_id: checkout.providerOrderId,
      amount: meta.amountMinor || checkout.amountMinor,
      currency: "INR",
      name: meta.storeName,
      description: meta.description,
      modal: { ondismiss: () => resolve() },
      handler: () => {
        // Credits are added by the platform webhook; refresh so the seller sees the pending → approved transition.
        resolve();
      },
    });
    rzp.on("payment.failed", (r) => reject(new Error(r.error?.description ?? "Payment failed.")));
    rzp.open();
  });
}

/**
 * Buy-credits dialog: records the purchase request, then opens platform Razorpay/Cashfree
 * checkout when configured; otherwise leaves the request for admin review.
 */
export function BuyCreditsDialog({
  fields,
  title,
  description,
  triggerLabel,
  confirmLabel = "Continue",
  disabled,
  storeName,
  amountMinor,
  packLabel,
  children,
}: {
  fields: Record<string, string>;
  title: string;
  description?: ReactNode;
  triggerLabel: ReactNode;
  confirmLabel?: string;
  disabled?: boolean;
  storeName: string;
  amountMinor: number;
  packLabel: string;
  children?: ReactNode | ((errors: Record<string, string[]>) => ReactNode);
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const titleId = useId();
  const router = useRouter();
  const { show } = useToast();
  const [state, formAction] = useActionState(requestAiCreditPurchaseAction, null as ActionResult<AiCreditPurchaseResult> | null);
  const [dismissed, setDismissed] = useState<unknown>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!state?.ok || state === dismissed) return;
    const checkout = state.data.checkout;
    if (!checkout) {
      ref.current?.close();
      formRef.current?.reset();
      show({ tone: "success", message: "Purchase request sent. Credits are added after payment is verified." });
      setDismissed(state);
      return;
    }
    setPaying(true);
    void openCheckout(checkout, { storeName, amountMinor: checkout.kind === "razorpay" ? checkout.amountMinor : amountMinor, description: `AI credits · ${packLabel}` })
      .then(() => {
        ref.current?.close();
        formRef.current?.reset();
        show({ tone: "success", message: "Payment submitted. Credits appear once the payment is confirmed." });
        router.refresh();
      })
      .catch((err: unknown) => {
        show({ tone: "error", message: err instanceof Error ? err.message : "Payment couldn't be started." });
      })
      .finally(() => {
        setPaying(false);
        setDismissed(state);
      });
  }, [state, dismissed, show, storeName, amountMinor, packLabel, router]);

  useEffect(() => {
    if (state && !state.ok) {
      show({ tone: "error", message: state.error.fieldErrors?._form?.[0] ?? state.error.message });
    }
  }, [state, show]);

  const errors = fieldErrors(state);
  return (
    <>
      <Button
        variant="primary"
        size="sm"
        disabled={disabled}
        onClick={() => {
          setDismissed(state);
          ref.current?.showModal();
        }}
      >
        {triggerLabel}
      </Button>
      <dialog ref={ref} aria-labelledby={titleId} className="m-auto w-[min(92vw,480px)] rounded-lg border border-border bg-surface p-0 text-foreground backdrop:bg-black/40">
        <form ref={formRef} action={formAction} className="space-y-4 p-5">
          <HiddenFields fields={fields} />
          <div>
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            {description ? <div className="mt-2 text-sm text-muted">{description}</div> : null}
          </div>
          {state && !state.ok ? <FormMessage state={state} /> : null}
          {typeof children === "function" ? children(errors) : children}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => ref.current?.close()} disabled={paying}>
              Cancel
            </Button>
            <SubmitButton variant="primary" disabled={paying}>
              {paying ? "Opening payment…" : confirmLabel}
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
