import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export type SpanRecord = {
  name: string;
  startMs: number;
  endMs?: number;
  status: "ok" | "error";
  attrs?: Record<string, unknown>;
};

export type RequestObservabilityContext = {
  requestId: string;
  traceId: string;
  spans: SpanRecord[];
  route?: string;
  method?: string;
  tenantId?: string | null;
  attrs?: Record<string, unknown>;
};

const storage = new AsyncLocalStorage<RequestObservabilityContext>();

export function generateId(): string {
  return randomUUID();
}

export function getRequestContext(): RequestObservabilityContext | undefined {
  return storage.getStore();
}

export function setRequestContext(patch: Partial<RequestObservabilityContext>): void {
  const current = storage.getStore();
  if (!current) return;
  Object.assign(current, patch);
}

/** Run `fn` with a fresh (or provided) request context bound via AsyncLocalStorage. */
export function runWithRequestContext<T>(ctx: Partial<RequestObservabilityContext> | undefined, fn: () => T): T {
  const base: RequestObservabilityContext = {
    requestId: ctx?.requestId ?? generateId(),
    traceId: ctx?.traceId ?? ctx?.requestId ?? generateId(),
    spans: ctx?.spans ?? [],
    route: ctx?.route,
    method: ctx?.method,
    tenantId: ctx?.tenantId,
    attrs: ctx?.attrs,
  };
  return storage.run(base, fn);
}

/** Fields safe to merge into structured log lines when a request is in flight. */
export function getRequestLogFields(): Record<string, string> | undefined {
  const ctx = storage.getStore();
  if (!ctx) return undefined;
  return { requestId: ctx.requestId, traceId: ctx.traceId };
}
