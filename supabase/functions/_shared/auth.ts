/** Server-only invoke gate: Next calls with the Supabase secret key as Bearer. */

export function assertServerInvoke(req: Request): Response | null {
  const expected = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY") ?? "";
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const invoke = req.headers.get("x-seller-ai-invoke")?.trim() ?? "";
  const shared = Deno.env.get("AI_EDGE_INVOKE_SECRET") ?? "";
  const okSecret = Boolean(expected) && bearer === expected;
  const okShared = Boolean(shared) && shared.length >= 32 && (invoke === shared || bearer === shared);
  if (!okSecret && !okShared) {
    return json({ error: "unauthorized" }, 401);
  }
  return null;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

export async function readJson<T>(req: Request): Promise<T> {
  return (await req.json()) as T;
}
