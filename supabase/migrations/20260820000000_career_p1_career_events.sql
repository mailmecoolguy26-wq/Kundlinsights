create table app.career_events (
  id text primary key check (id <> ''),
  user_id text not null references app.users(id) on delete restrict,
  birth_profile_id text not null references app.birth_profiles(id) on delete restrict,
  event_type text not null check (event_type in ('FIRST_JOB','JOB_SWITCH','PROMOTION','ROLE_CHANGE','SALARY_GROWTH','JOB_LOSS','BUSINESS_STARTED','CAREER_BREAKTHROUGH','CAREER_SETBACK','OTHER')),
  event_date_precision text not null check (event_date_precision in ('DAY','MONTH','YEAR')),
  event_year integer not null check (event_year between 1 and 9999),
  event_month smallint null check (event_month between 1 and 12),
  event_day smallint null check (event_day between 1 and 31),
  title text null,
  notes text null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz null,
  check ((event_date_precision = 'YEAR' and event_month is null and event_day is null) or (event_date_precision = 'MONTH' and event_month is not null and event_day is null) or (event_date_precision = 'DAY' and event_month is not null and event_day is not null))
);
create index career_events_profile_chronology_idx on app.career_events (birth_profile_id, event_year, event_month asc nulls first, event_day asc nulls first, created_at, id) where deleted_at is null;
create index career_events_user_profile_idx on app.career_events (user_id, birth_profile_id) where deleted_at is null;
alter table app.career_events enable row level security;
alter table app.career_events force row level security;
create policy app_runtime_select_own_career_events on app.career_events for select to app_runtime using (user_id = (select security.current_app_user_id()));
create policy app_runtime_insert_own_career_events on app.career_events for insert to app_runtime with check (user_id = (select security.current_app_user_id()) and exists (select 1 from app.birth_profiles where app.birth_profiles.id = career_events.birth_profile_id and app.birth_profiles.user_id = (select security.current_app_user_id())));
create policy app_runtime_update_own_career_events on app.career_events for update to app_runtime using (user_id = (select security.current_app_user_id())) with check (user_id = (select security.current_app_user_id()));
grant select, insert, update on app.career_events to app_runtime;
