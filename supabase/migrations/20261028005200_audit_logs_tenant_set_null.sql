-- =============================================================================
-- 5200 AUDIT LOGS ON STORE DELETE: deleting a tenant used ON DELETE CASCADE into
-- append-only audit_logs, which the append-only trigger blocked → Admin → Users
-- "Delete user" failed with INTERNAL when the person owned a store.
-- Keep historical rows: SET NULL tenant_id on store delete, and allow that FK
-- action (trigger depth > 0) while still blocking direct UPDATE/DELETE.
--
-- Down:
--   drop trigger if exists audit_logs_append_only on public.audit_logs;
--   create trigger audit_logs_append_only before update or delete on public.audit_logs
--     for each row execute function app.block_mutation();
--   alter table public.audit_logs drop constraint audit_logs_tenant_id_fkey;
--   alter table public.audit_logs
--     add constraint audit_logs_tenant_id_fkey
--     foreign key (tenant_id) references public.tenants (id) on delete cascade;
-- =============================================================================

drop trigger if exists audit_logs_append_only on public.audit_logs;

create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row
  when (pg_trigger_depth() = 0)
  execute function app.block_mutation();

alter table public.audit_logs drop constraint if exists audit_logs_tenant_id_fkey;

alter table public.audit_logs
  add constraint audit_logs_tenant_id_fkey
  foreign key (tenant_id) references public.tenants (id) on delete set null;
