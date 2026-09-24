-- Phase 1 keeps the original event date intact for backwards compatibility.
-- New, typed observation points belong to the same user-owned transition.
create table app.career_event_observations (
  id text primary key,
  user_id text not null references app.users(id) on delete restrict,
  birth_profile_id text not null references app.birth_profiles(id) on delete restrict,
  career_event_id text not null references app.career_events(id) on delete cascade,
  observation_type text not null check (observation_type in ('OFFER','JOINING','PROMOTION','EXIT','TERMINATION','BUSINESS_START','ROLE_CHANGE','SALARY_CHANGE')),
  event_date_precision text not null check (event_date_precision in ('DAY','MONTH','YEAR')),
  event_year integer not null check (event_year between 1 and 9999),
  event_month integer null check (event_month between 1 and 12),
  event_day integer null check (event_day between 1 and 31),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (career_event_id, observation_type, event_date_precision, event_year, event_month, event_day),
  check (
    (event_date_precision = 'YEAR' and event_month is null and event_day is null)
    or (event_date_precision = 'MONTH' and event_month is not null and event_day is null)
    or (event_date_precision = 'DAY' and event_month is not null and event_day is not null)
  )
);

create index career_event_observations_event_chronology_idx
  on app.career_event_observations (career_event_id, event_year, event_month asc nulls first, event_day asc nulls first, observation_type, id);
create index career_event_observations_user_profile_idx
  on app.career_event_observations (user_id, birth_profile_id, career_event_id);

alter table app.career_event_observations enable row level security;
alter table app.career_event_observations force row level security;
create policy app_runtime_select_own_career_event_observations on app.career_event_observations for select to app_runtime using (user_id = (select security.current_app_user_id()));
create policy app_runtime_insert_own_career_event_observations on app.career_event_observations for insert to app_runtime with check (user_id = (select security.current_app_user_id()) and exists (select 1 from app.career_events where app.career_events.id = career_event_observations.career_event_id and app.career_events.user_id = (select security.current_app_user_id()) and app.career_events.birth_profile_id = career_event_observations.birth_profile_id));
create policy app_runtime_update_own_career_event_observations on app.career_event_observations for update to app_runtime using (user_id = (select security.current_app_user_id())) with check (user_id = (select security.current_app_user_id()));
create policy app_runtime_delete_own_career_event_observations on app.career_event_observations for delete to app_runtime using (user_id = (select security.current_app_user_id()));
grant select, insert, update, delete on app.career_event_observations to app_runtime;
