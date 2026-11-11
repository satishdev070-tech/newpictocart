import { beforeEach, describe, expect, it, vi } from "vitest";

/** Minimal chainable fake of the supabase-js query builder for one table. */
type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({ rows: [] as Row[], error: null as null | { code: string; message: string }, writes: [] as { op: string; values: Row; match?: Row }[] }));

function fakeClient() {
  return {
    from: () => {
      const filters: Row = {};
      const q = {
        select: () => q,
        eq: (k: string, v: unknown) => {
          filters[k] = v;
          return q;
        },
        maybeSingle: async () => ({ data: db.rows.find((r) => Object.entries(filters).every(([k, v]) => r[k] === v)) ?? null, error: db.error }),
        then: (resolve: (v: unknown) => void) => resolve({ data: db.rows, error: db.error }),
        upsert: async (values: Row) => {
          db.writes.push({ op: "upsert", values });
          const i = db.rows.findIndex((r) => r.domain === values.domain && r.method === values.method);
          if (i >= 0) db.rows[i] = { ...db.rows[i], ...values };
          else db.rows.push({ id: `id-${db.rows.length}`, ...values });
          return { error: null };
        },
        update: (values: Row) => ({
          eq: async (k: string, v: unknown) => {
            db.writes.push({ op: "update", values, match: { [k]: v } });
            for (const r of db.rows) if (r[k] === v) Object.assign(r, values);
            return { error: null };
          },
        }),
      };
      return q;
    },
  };
}

const auditFn = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => fakeClient() }));
vi.mock("@/lib/supabase/public", () => ({ createSupabasePublicClient: () => ({ rpc: async () => ({ data: null, error: db.error }) }) }));
vi.mock("@/lib/audit", () => ({ audit: auditFn }));
vi.mock("@/lib/observability/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { checkGscDns, findGscFileContent, loadGscState, removeGscFile, saveGscFile } from "@/features/search-console/server/store";
import { PLATFORM_ROLE_PERMISSIONS } from "@/lib/permissions/matrix";
import type { PlatformContext } from "@/lib/platform/access";

const ctx = { user: { id: "u1" }, role: "super_admin", permissions: PLATFORM_ROLE_PERMISSIONS.super_admin } as unknown as PlatformContext;
const support = { user: { id: "u2" }, role: "support", permissions: PLATFORM_ROLE_PERMISSIONS.support } as unknown as PlatformContext;
const A = { filename: "googlea53e7e51ec71d7b4.html", content: "google-site-verification: googlea53e7e51ec71d7b4.html" };
const B = { filename: "google0123456789abcdef.html", content: "google-site-verification: google0123456789abcdef.html" };

beforeEach(() => {
  db.rows = [];
  db.error = null;
  db.writes = [];
  auditFn.mockReset();
});

describe("store", () => {
  it("upload, replace and remove keep one row per domain and audit each step", async () => {
    await saveGscFile(ctx, "production", A);
    await saveGscFile(ctx, "production", B);
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0]).toMatchObject({ domain: "production", method: "html_file", ...B, active: true, last_delivery_status: null });
    expect(auditFn.mock.calls.map((c) => c[0].action)).toEqual(["search_console.file_uploaded", "search_console.file_replaced"]);
    expect(auditFn.mock.calls[1]![0].metadata).toMatchObject({ filename: B.filename, previous: A.filename });

    await removeGscFile(ctx, "production");
    expect(db.rows[0]).toMatchObject({ active: false });
    expect(auditFn.mock.calls.at(-1)![0]).toMatchObject({ action: "search_console.file_removed", entityId: "production" });
    await expect(removeGscFile(ctx, "production")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("production and staging rows are independent", async () => {
    await saveGscFile(ctx, "production", A);
    await saveGscFile(ctx, "staging", B);
    const state = await loadGscState();
    expect(state.ready).toBe(true);
    if (state.ready) {
      expect(state.domains.production.html?.filename).toBe(A.filename);
      expect(state.domains.staging.html?.filename).toBe(B.filename);
    }
    await removeGscFile(ctx, "staging");
    expect(db.rows.find((r) => r.domain === "production")?.active).toBe(true);
  });

  it("rejects non-super-admins", async () => {
    await expect(saveGscFile(support, "production", A)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.writes).toHaveLength(0);
  });

  it("records the DNS check result", async () => {
    db.rows.push({ id: "d1", domain: "production", method: "dns_txt", dns_value: "google-site-verification=abcdefghijkl", active: true });
    const fetchImpl = (async () => new Response(JSON.stringify({ Status: 0, Answer: [{ name: "pictocart.in.", type: 16, data: '"google-site-verification=abcdefghijkl"' }] }))) as unknown as typeof fetch;
    expect(await checkGscDns(ctx, "production", { fetchImpl })).toBe("found");
    expect(db.rows[0]).toMatchObject({ last_dns_status: "found" });
  });

  it("fails soft when the migration hasn't been applied", async () => {
    db.error = { code: "PGRST205", message: "Could not find the table" };
    expect(await loadGscState()).toEqual({ ready: false });
    expect(await findGscFileContent("production", A.filename)).toBeNull();
    await expect(saveGscFile(ctx, "production", A)).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("20261111007200") });
  });
});
