-- Informative Website M7 enquiries (docs/informative/PLAN.md). Additive: two functions. Visitors
-- cannot insert into info_enquiries (no grant); these SECURITY DEFINER functions are the only
-- write paths (pattern of submit_contact_message).
--
-- submit_info_enquiry: the public enquiry form. Only for a PUBLISHED site of an open tenant; consent
--   required; a service must be an active service of the same site; per-site flood cap (a backstop:
--   the server action also applies the plan's 5 per 10 minutes per IP + site). Returns the new id and
--   the site's notification target, so the server can email the owner without the secret-key client.
-- record_info_whatsapp_click: a visitor tapped "WhatsApp us" (source WHATSAPP_CLICK). Stores no
--   visitor data; capped per site. The route handler adds a per-IP limit.
--
-- DOWN (manual): drop function if exists public.submit_info_enquiry(uuid, text, text, text, text, uuid, date, text, text, boolean);
--                drop function if exists public.record_info_whatsapp_click(uuid, uuid);

create or replace function public.submit_info_enquiry(
  p_tenant uuid,
  p_name text,
  p_phone text,
  p_email text,
  p_message text,
  p_service uuid,
  p_preferred_date date,
  p_preferred_time text,
  p_source text,
  p_consent boolean
)
returns table (enquiry_id uuid, notify_email text, notify_email_enabled boolean, business_name text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_source text := coalesce(nullif(p_source, ''), 'CONTACT_FORM');
begin
  if not app.info_site_is_public(p_tenant) then
    raise exception 'site unavailable' using errcode = 'P0001', hint = 'TENANT_UNAVAILABLE';
  end if;
  if v_source not in ('CONTACT_FORM', 'SERVICE_PAGE') then
    raise exception 'invalid source' using errcode = '22023';
  end if;
  if p_consent is not true then
    raise exception 'consent required' using errcode = '22023', hint = 'CONSENT_REQUIRED';
  end if;
  if p_service is not null and not exists (
    select 1 from public.info_services s
    where s.tenant_id = p_tenant and s.id = p_service and s.is_active and s.deleted_at is null
  ) then
    raise exception 'invalid service' using errcode = '22023';
  end if;
  if (select count(*) from public.info_enquiries e where e.tenant_id = p_tenant and e.created_at > now() - interval '10 minutes') >= 50 then
    raise exception 'too many enquiries' using errcode = 'P0001', hint = 'RATE_LIMITED';
  end if;

  insert into public.info_enquiries (tenant_id, name, phone, email, message, service_id, preferred_date, preferred_time, source, consent_at)
  values (
    p_tenant,
    btrim(p_name),
    btrim(p_phone),
    nullif(btrim(coalesce(p_email, '')), ''),
    nullif(btrim(coalesce(p_message, '')), ''),
    p_service,
    p_preferred_date,
    nullif(btrim(coalesce(p_preferred_time, '')), ''),
    v_source,
    now()
  )
  returning id into v_id;

  return query
    select v_id, p.notify_email, coalesce(p.notify_email_enabled, true), s.business_name
    from public.info_sites s
    left join public.info_site_private p on p.tenant_id = s.tenant_id
    where s.tenant_id = p_tenant;
end;
$$;

create or replace function public.record_info_whatsapp_click(p_tenant uuid, p_service uuid default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_service_name text;
begin
  if not app.info_site_is_public(p_tenant) then
    return;
  end if;
  if (select count(*) from public.info_enquiries e where e.tenant_id = p_tenant and e.source = 'WHATSAPP_CLICK' and e.created_at > now() - interval '10 minutes') >= 30 then
    return;
  end if;
  if p_service is not null then
    select s.name into v_service_name from public.info_services s where s.tenant_id = p_tenant and s.id = p_service and s.is_active and s.deleted_at is null;
  end if;
  insert into public.info_enquiries (tenant_id, name, phone, message, service_id, source)
  values (
    p_tenant,
    'WhatsApp chat',
    'via WhatsApp',
    case when v_service_name is null then 'A visitor opened WhatsApp from your website.' else 'A visitor opened WhatsApp from the "' || v_service_name || '" page.' end,
    case when v_service_name is null then null else p_service end,
    'WHATSAPP_CLICK'
  );
end;
$$;

revoke all on function public.submit_info_enquiry(uuid, text, text, text, text, uuid, date, text, text, boolean) from public;
grant execute on function public.submit_info_enquiry(uuid, text, text, text, text, uuid, date, text, text, boolean) to anon, authenticated, service_role;
revoke all on function public.record_info_whatsapp_click(uuid, uuid) from public;
grant execute on function public.record_info_whatsapp_click(uuid, uuid) to anon, authenticated, service_role;
