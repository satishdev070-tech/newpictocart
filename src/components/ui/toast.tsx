"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type ToastTone = "success" | "error" | "warning" | "info";

type Toast = { id: number; message: ReactNode; tone: ToastTone };
type ToastInput = { message: ReactNode; tone?: ToastTone; duration?: number };
type ToastApi = { show: (input: ToastInput) => void };

const ToastContext = createContext<ToastApi | null>(null);

const look: Record<ToastTone, { icon: typeof CheckCircle2; label: string; className: string }> = {
  success: { icon: CheckCircle2, label: "Success", className: "border-success/25 bg-success/12 text-success" },
  error: { icon: CircleAlert, label: "Something went wrong", className: "border-error/25 bg-error/12 text-error" },
  warning: { icon: TriangleAlert, label: "Attention", className: "border-warning/30 bg-warning/12 text-warning" },
  info: { icon: Info, label: "Update", className: "border-info/25 bg-info/12 text-info" },
};

/**
 * Shared, accessible toast surface for dashboard and auth actions. It deliberately accepts only
 * React nodes supplied by our UI (never untrusted HTML), lives above modals and removes itself
 * after a short timeout.  Forms retain their inline field errors for correction.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const remove = useCallback((id: number) => setToasts((all) => all.filter((toast) => toast.id !== id)), []);
  const show = useCallback(
    ({ message, tone = "info", duration = tone === "error" ? 7000 : 4500 }: ToastInput) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((all) => [...all.slice(-3), { id, message, tone }]);
      window.setTimeout(() => remove(id), duration);
    },
    [remove],
  );
  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" aria-relevant="additions" className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((toast) => {
          const item = look[toast.tone];
          const Icon = item.icon;
          return (
            <div key={toast.id} role={toast.tone === "error" ? "alert" : "status"} className={cn("pointer-events-auto flex items-start gap-3 rounded-2xl border px-3.5 py-3 shadow-xl backdrop-blur-xl", item.className)}>
              <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.label}</p>
                <div className="mt-0.5 text-sm leading-5 text-foreground/80">{toast.message}</div>
              </div>
              <button type="button" onClick={() => remove(toast.id)} className="rounded-md p-1 text-foreground/55 transition hover:bg-black/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-current" aria-label="Dismiss notification">
                <X aria-hidden className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/** Safe no-op outside the app shell, which keeps isolated component tests simple. */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? { show: () => undefined };
}
