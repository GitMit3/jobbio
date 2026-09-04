-- Jobbio – databasschema.
--
-- Kör en gång i Supabase: SQL Editor → New query → klistra in → Run.
-- Skriptet går att köra om utan att förstöra befintlig data.

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company text not null,
  role_title text not null,
  job_ad_url text,
  status text not null default 'skickad',
  applied_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Statusvärdena speglar src/lib/applications.js. Håll dem i synk.
alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications
  add constraint applications_status_check
  check (status in ('skickad', 'svar', 'intervju', 'avslag'));

create index if not exists applications_user_id_applied_at_idx
  on public.applications (user_id, applied_at desc);

-- Row Level Security: varje rad är låst till sin ägare. Utan de här reglerna
-- skulle anon-nyckeln i webbläsaren kunna läsa allas ansökningar.
alter table public.applications enable row level security;

drop policy if exists "Egna ansökningar kan läsas" on public.applications;
create policy "Egna ansökningar kan läsas"
  on public.applications for select
  using (auth.uid() = user_id);

drop policy if exists "Egna ansökningar kan skapas" on public.applications;
create policy "Egna ansökningar kan skapas"
  on public.applications for insert
  with check (auth.uid() = user_id);

drop policy if exists "Egna ansökningar kan ändras" on public.applications;
create policy "Egna ansökningar kan ändras"
  on public.applications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Egna ansökningar kan raderas" on public.applications;
create policy "Egna ansökningar kan raderas"
  on public.applications for delete
  using (auth.uid() = user_id);

-- updated_at ska följa med vid ändringar utan att klienten behöver tänka på det.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists applications_touch_updated_at on public.applications;
create trigger applications_touch_updated_at
  before update on public.applications
  for each row execute function public.touch_updated_at();
