import { getRequestContext, type SpanRecord } from "./request-context";

export type SpanStatus = "ok" | "error";

export type Span = SpanRecord;

/** Start a span and attach it to the current request context when present. */
export function startSpan(name: string, attrs?: Record<string, unknown>): Span {
  const span: Span = {
    name,
    startMs: Date.now(),
    status: "ok",
    attrs: attrs && Object.keys(attrs).length ? { ...attrs } : undefined,
  };
  const ctx = getRequestContext();
  if (ctx) ctx.spans.push(span);
  return span;
}

export function endSpan(span: Span, status: SpanStatus = "ok", attrs?: Record<string, unknown>): Span {
  span.endMs = Date.now();
  span.status = status;
  if (attrs && Object.keys(attrs).length) {
    span.attrs = { ...(span.attrs ?? {}), ...attrs };
  }
  return span;
}

/** Run `fn` inside a span; marks error status if it throws. */
export async function withSpan<T>(name: string, fn: () => Promise<T> | T, attrs?: Record<string, unknown>): Promise<T> {
  const span = startSpan(name, attrs);
  try {
    const result = await fn();
    endSpan(span, "ok");
    return result;
  } catch (err) {
    endSpan(span, "error", { error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}
