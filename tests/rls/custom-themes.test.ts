import { afterAll, describe, expect, it } from "vitest";
import { USERS, anon, as, closePool, rejects, superuser, user } from "./db";

afterAll(closePool);

const insert = "insert into themes (key, name, category, config, active, style, source, source_url, created_by) values ($1, $2, 'fashion', '{\"preset\":{}}', $3, 'modern', 'ai', 'https://example.com', $4) returning key";

describe("custom marketplace themes (migration 3100)", () => {
  it("platform admins create, publish and delete themes; drafts stay hidden from sellers and shoppers", async () => {
    await as(user(USERS.platformAdmin), async (q) => {
      expect(await q(insert, ["ai-draft", "AI draft", false, USERS.platformAdmin])).toHaveLength(1);
      expect(await q(insert, ["ai-live", "AI live", true, USERS.platformAdmin])).toHaveLength(1);
      expect(await q("select key from themes where key like 'ai-%' order by key")).toHaveLength(2);
      expect(await q("update themes set active = true, published_at = now() where key = 'ai-draft' returning key")).toHaveLength(1);
      expect(await q("delete from themes where key = 'ai-live' returning key")).toHaveLength(1);
    });
  });

  it("sellers and anonymous visitors see published themes only and can't write", async () => {
    await as(superuser, async (q) => {
      await q(insert, ["ai-draft", "AI draft", false, null]);
      await q(insert, ["ai-live", "AI live", true, null]);
      for (const caller of [{ sub: USERS.aanganOwner, role: "authenticated" }, { role: "anon" }]) {
        await q("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(caller)]);
        await q(`set local role ${caller.role}`);
        expect((await q<{ key: string }>("select key from themes where key like 'ai-%'")).map((r) => r.key)).toEqual(["ai-live"]);
        await rejects(q(insert, ["ai-evil", "Evil", true, null]), /row-level security|permission denied/);
        expect(await q("update themes set name = 'x' where key = 'ai-live' returning key").catch(() => [])).toHaveLength(0);
        await q("reset role");
      }
    });
  });

  it("checks source, source URL scheme and document size", async () => {
    await as(superuser, async (q) => {
      await rejects(q("insert into themes (key, name, category, config, source) values ('bad-src', 'Bad', 'fashion', '{}', 'scraped')"), /check constraint/);
      await rejects(q("insert into themes (key, name, category, config, source_url) values ('bad-url', 'Bad', 'fashion', '{}', 'http://example.com')"), /check constraint/);
      await rejects(q("insert into themes (key, name, category, config) values ('too-big', 'Big', 'fashion', jsonb_build_object('x', repeat('a', 300000)))"), /check constraint/);
    });
    await as(anon, async (q) => expect(await q("select 1 from themes where key = 'bad-src'")).toHaveLength(0));
  });
});
