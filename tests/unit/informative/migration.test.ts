import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20261111008000_informative_website_type.sql", "utf8");

describe("website_type migration (static)", () => {
  it("adds a NOT NULL column defaulting to ONLINE_STORE with the two allowed values", () => {
    expect(sql).toMatch(/add column if not exists website_type text not null default 'ONLINE_STORE'/);
    expect(sql).toMatch(/check \(website_type in \('ONLINE_STORE', 'INFORMATIVE'\)\)/);
  });

  it("freezes the type after creation", () => {
    expect(sql).toMatch(/before update of website_type on public\.tenants/);
  });

  it("create_tenant keeps the 3 original arguments and defaults the new one to ONLINE_STORE", () => {
    expect(sql).toMatch(/p_name text,\s*p_slug text,\s*p_root_domain text,\s*p_website_type text default 'ONLINE_STORE'/);
    expect(sql).toMatch(/grant execute on function public\.create_tenant\(text, text, text, text\) to authenticated/);
  });

  it("only Online Stores get the store-only inventory location", () => {
    expect(sql).toMatch(/if v_type = 'ONLINE_STORE' then\s*insert into public\.inventory_locations/);
  });

  it("documents the down path", () => {
    expect(sql).toMatch(/DOWN/);
    expect(sql).toMatch(/drop column if exists website_type/);
  });
});
