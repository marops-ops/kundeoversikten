-- ============================================================
-- AMIDAYS KUNDEREGISTER — Supabase schema
-- Kjør denne hele filen i Supabase → SQL Editor → New query → Run
-- Idempotent: trygg å kjøre flere ganger (bruker IF NOT EXISTS / OR REPLACE)
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---------- ENUMS ----------
do $$ begin
  create type kundestatus as enum ('Aktiv','Pause','Prospect','Avsluttet');
exception when duplicate_object then null; end $$;

do $$ begin
  create type segment as enum ('Retainer','Prosjekt','Retainer + prosjekt','Prospect','Sovende');
exception when duplicate_object then null; end $$;

do $$ begin
  create type retainerstatus as enum ('Aktiv','Pause','Oppsagt','Avsluttet');
exception when duplicate_object then null; end $$;

do $$ begin
  create type timetype as enum ('Retainer','Mersalg','Prosjekt','Internt','Ikke fakturerbart');
exception when duplicate_object then null; end $$;

do $$ begin
  create type mersalgsstatus as enum ('Idé','Sendt tilbud','I dialog','Vunnet','Tapt','Utsatt');
exception when duplicate_object then null; end $$;

do $$ begin
  create type prosjektstatus as enum ('Planlagt','Pågår','Venter på kunde','Levert','Stoppet');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tjenestestatus as enum ('Implementert','Pågår','Blokkert','Ikke aktuelt','Mangler');
exception when duplicate_object then null; end $$;

-- ---------- CUSTOMERS ----------
create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  segment segment not null default 'Retainer',
  status kundestatus not null default 'Aktiv',
  health smallint check (health between 1 and 5) default 5,
  contact_name text,
  contact_email text,
  customer_since date,
  logo_url text,
  brand_color text default '#31353D',
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- RETAINERS ----------
create table if not exists retainers (
  id uuid primary key default uuid_generate_v4(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  monthly_price numeric(12,2) not null default 0,
  hour_budget numeric(6,1) not null default 0,
  start_date date,
  renewal_date date,
  commitment_months smallint,
  invoice_day smallint,
  status retainerstatus not null default 'Aktiv',
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- TIME ENTRIES ----------
create table if not exists time_entries (
  id uuid primary key default uuid_generate_v4(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_date date not null default current_date,
  customer_id uuid references customers(id) on delete set null,
  type timetype not null default 'Retainer',
  task text,
  hours numeric(5,2) not null check (hours > 0),
  billable boolean not null default true,
  source text default 'Manuelt',
  comment text,
  created_at timestamptz not null default now()
);

-- ---------- UPSELL PIPELINE (Mersalg) ----------
create table if not exists upsell_opportunities (
  id uuid primary key default uuid_generate_v4(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  title text not null,
  service text,
  value numeric(12,2) default 0,
  deal_type text default 'Engangs',
  probability numeric(4,2) default 0.5,
  status mersalgsstatus not null default 'Idé',
  next_step text,
  deadline date,
  notes text,
  auto_generated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- PROJECTS ----------
create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  name text not null,
  type text,
  budget numeric(12,2) default 0,
  hour_budget numeric(6,1),
  status prosjektstatus not null default 'Planlagt',
  start_date date,
  deadline date,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- SERVICES MATRIX (Tjenester) ----------
-- Ett rad per kunde+tjeneste. Auto-opprettes for nye kunder via trigger under.
-- Listen over tjenester er hardkodet i triggeren ensure_service_rows_for_customer()
-- og i lib/types.ts (ALLE_TJENESTER) — hold de to i sync om du legger til flere.
create table if not exists customer_services (
  id uuid primary key default uuid_generate_v4(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  service_name text not null,
  status tjenestestatus not null default 'Mangler',
  updated_at timestamptz not null default now(),
  unique (customer_id, service_name)
);

-- ---------- INVOICING (Fakturering) — fase 2, men tabellen ligger klar ----------
create table if not exists invoices (
  id uuid primary key default uuid_generate_v4(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month date not null, -- lagres som 1. i måneden
  customer_id uuid not null references customers(id) on delete cascade,
  retainer_amount numeric(12,2) default 0,
  upsell_amount numeric(12,2) default 0,
  project_amount numeric(12,2) default 0,
  status text default 'Utkast',
  invoice_number text,
  sent_date date,
  due_date date,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- TRIGGER: Når en tjeneste mangler helt for en kunde, opprett en rad
-- automatisk i services matrix + mersalg pipeline (auto_generated=true)
-- ============================================================
create or replace function ensure_service_rows_for_customer()
returns trigger as $$
declare svc text;
begin
  foreach svc in array array[
    'Enhanced Conversions','Consent Mode v2','Cookiebanner','Server side (GA4+FB)',
    'FB CAPI','Snap CAPI','GA4','BigQuery','Looker Studio','Google Ads','Meta Ads','SEO'
  ] loop
    insert into customer_services (owner, customer_id, service_name, status)
    values (new.owner, new.id, svc, 'Mangler')
    on conflict (customer_id, service_name) do nothing;
  end loop;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_new_customer_services on customers;
create trigger trg_new_customer_services
  after insert on customers
  for each row execute function ensure_service_rows_for_customer();

-- Når en tjeneste settes til 'Mangler', opprett automatisk et mersalgsforslag
-- (kun hvis det ikke allerede finnes et åpent forslag for samme kunde+tjeneste)
create or replace function auto_create_upsell_on_missing_service()
returns trigger as $$
begin
  if new.status = 'Mangler' then
    insert into upsell_opportunities (owner, customer_id, title, service, status, deal_type, auto_generated, next_step)
    select new.owner, new.customer_id,
           new.service_name || ' — mangler oppsett',
           new.service_name, 'Idé', 'Engangs', true,
           'Send forslag til kunde'
    where not exists (
      select 1 from upsell_opportunities
      where customer_id = new.customer_id and service = new.service_name
        and status not in ('Tapt','Utsatt')
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_missing_service_upsell on customer_services;
create trigger trg_missing_service_upsell
  after insert or update of status on customer_services
  for each row execute function auto_create_upsell_on_missing_service();

-- Når et mersalg går til status 'Vunnet' og har en 'service' knyttet til seg,
-- huk automatisk av tjenesten i matrisen.
create or replace function check_off_service_on_won()
returns trigger as $$
begin
  if new.status = 'Vunnet' and new.service is not null then
    update customer_services
    set status = 'Implementert', updated_at = now()
    where customer_id = new.customer_id and service_name = new.service;
  end if;
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_upsell_won_checkoff on upsell_opportunities;
create trigger trg_upsell_won_checkoff
  before update of status on upsell_opportunities
  for each row execute function check_off_service_on_won();

-- ============================================================
-- ROW LEVEL SECURITY — én bruker (deg), men trygt om du legger til flere senere
-- ============================================================
alter table customers enable row level security;
alter table retainers enable row level security;
alter table time_entries enable row level security;
alter table upsell_opportunities enable row level security;
alter table projects enable row level security;
alter table customer_services enable row level security;
alter table invoices enable row level security;

do $$
declare t text;
begin
  foreach t in array array['customers','retainers','time_entries','upsell_opportunities','projects','customer_services','invoices'] loop
    execute format('drop policy if exists "owner_all" on %I', t);
    execute format(
      'create policy "owner_all" on %I for all using (owner = auth.uid()) with check (owner = auth.uid())', t
    );
  end loop;
end $$;

-- ============================================================
-- STORAGE — bucket for kundelogoer
-- ============================================================
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

drop policy if exists "logos_read" on storage.objects;
create policy "logos_read" on storage.objects for select
  using (bucket_id = 'logos');

drop policy if exists "logos_write" on storage.objects;
create policy "logos_write" on storage.objects for insert
  with check (bucket_id = 'logos' and auth.role() = 'authenticated');

drop policy if exists "logos_update" on storage.objects;
create policy "logos_update" on storage.objects for update
  using (bucket_id = 'logos' and auth.role() = 'authenticated');

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_time_entries_customer on time_entries(customer_id);
create index if not exists idx_time_entries_date on time_entries(entry_date);
create index if not exists idx_retainers_customer on retainers(customer_id);
create index if not exists idx_upsell_customer on upsell_opportunities(customer_id);
create index if not exists idx_customer_services_customer on customer_services(customer_id);
