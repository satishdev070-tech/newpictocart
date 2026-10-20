-- Storefront contact form submissions. Visitors cannot insert directly: the security-definer
-- function below is the only write path. Staff read messages with content.write.

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (char_length(email) between 3 and 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (phone is null or char_length(phone) between 1 and 20),
  subject text check (subject is null or char_length(subject) between 1 and 150),
  message text not null check (char_length(message) between 10 and 5000),
  created_at timestamptz not null default now()
);
create index contact_messages_tenant_created_idx on public.contact_messages (tenant_id, created_at desc);

alter table public.contact_messages enable row level security;

create policy contact_messages_staff_select on public.contact_messages
  for select to authenticated
  using (app.has_tenant_permission(tenant_id, 'content.write'));

revoke all on public.contact_messages from public, anon, authenticated;
grant select on public.contact_messages to authenticated;
grant all on public.contact_messages to service_role;

create or replace function public.submit_contact_message(
  p_tenant uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_subject text,
  p_message text
) returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := btrim(coalesce(p_email, ''));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_subject text := nullif(btrim(coalesce(p_subject, '')), '');
  v_message text := btrim(coalesce(p_message, ''));
  v_id uuid;
begin
  if not app.tenant_is_open(p_tenant) then
    raise exception 'store unavailable' using errcode = 'P0001', hint = 'TENANT_UNAVAILABLE';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 100 then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  if char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  if v_phone is not null and char_length(v_phone) > 20 then
    raise exception 'invalid phone' using errcode = '22023';
  end if;
  if v_subject is not null and char_length(v_subject) > 150 then
    raise exception 'invalid subject' using errcode = '22023';
  end if;
  if char_length(v_message) < 10 or char_length(v_message) > 5000 then
    raise exception 'invalid message' using errcode = '22023';
  end if;

  insert into public.contact_messages (tenant_id, name, email, phone, subject, message)
  values (p_tenant, v_name, v_email, v_phone, v_subject, v_message)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.submit_contact_message(uuid, text, text, text, text, text) from public;
grant execute on function public.submit_contact_message(uuid, text, text, text, text, text) to anon, authenticated, service_role;
