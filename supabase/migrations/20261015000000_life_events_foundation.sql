-- Generic, profile-scoped historical facts.  Career tables remain the
-- compatibility source for existing calibration while this becomes the
-- canonical product timeline.
create table app.life_events (
  id text primary key check (id <> ''),
  user_id text not null references app.users(id) on delete restrict,
  birth_profile_id text not null references app.birth_profiles(id) on delete restrict,
  category text not null check (category in ('CAREER_BUSINESS','PROPERTY','VEHICLE','RELATIONSHIPS_FAMILY')),
  event_type text not null check (event_type in ('JOB_JOINED','JOB_CHANGED','PROMOTION','ROLE_CHANGED','SALARY_CHANGED','JOB_LOSS','BUSINESS_STARTED','CAREER_BREAKTHROUGH','CAREER_SETBACK','OTHER','PROPERTY_PURCHASE','PROPERTY_SALE','VEHICLE_PURCHASE','VEHICLE_SALE','MARRIAGE','ENGAGEMENT','CHILD_BIRTH')),
  event_date_precision text not null check (event_date_precision in ('DAY','MONTH','YEAR')),
  event_year integer not null check (event_year between 1 and 9999),
  event_month smallint null check (event_month between 1 and 12),
  event_day smallint null check (event_day between 1 and 31),
  title text null,
  note text null,
  legacy_source_type text null,
  legacy_source_id text null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz null,
  unique (legacy_source_type, legacy_source_id),
  check ((event_date_precision = 'YEAR' and event_month is null and event_day is null) or (event_date_precision = 'MONTH' and event_month is not null and event_day is null) or (event_date_precision = 'DAY' and event_month is not null and event_day is not null))
);

create table app.life_event_observations (
  id text primary key,
  user_id text not null references app.users(id) on delete restrict,
  birth_profile_id text not null references app.birth_profiles(id) on delete restrict,
  life_event_id text not null references app.life_events(id) on delete cascade,
  observation_type text not null check (observation_type in ('OFFER','JOINING','PROMOTION','EXIT','TERMINATION','BUSINESS_START','ROLE_CHANGE','SALARY_CHANGE')),
  event_date_precision text not null check (event_date_precision in ('DAY','MONTH','YEAR')),
  event_year integer not null check (event_year between 1 and 9999),
  event_month smallint null check (event_month between 1 and 12),
  event_day smallint null check (event_day between 1 and 31),
  legacy_source_type text null,
  legacy_source_id text null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (legacy_source_type, legacy_source_id),
  unique (life_event_id, observation_type, event_date_precision, event_year, event_month, event_day),
  check ((event_date_precision = 'YEAR' and event_month is null and event_day is null) or (event_date_precision = 'MONTH' and event_month is not null and event_day is null) or (event_date_precision = 'DAY' and event_month is not null and event_day is not null))
);

create index life_events_profile_chronology_idx on app.life_events (birth_profile_id,event_year,event_month asc nulls first,event_day asc nulls first,created_at,id) where deleted_at is null;
create index life_events_user_profile_category_idx on app.life_events (user_id,birth_profile_id,category) where deleted_at is null;
create index life_event_observations_event_idx on app.life_event_observations (life_event_id,event_year,event_month asc nulls first,event_day asc nulls first);

alter table app.life_events enable row level security;
alter table app.life_events force row level security;
alter table app.life_event_observations enable row level security;
alter table app.life_event_observations force row level security;
create policy app_runtime_select_own_life_events on app.life_events for select to app_runtime using (user_id = (select security.current_app_user_id()));
create policy app_runtime_insert_own_life_events on app.life_events for insert to app_runtime with check (user_id = (select security.current_app_user_id()) and exists (select 1 from app.birth_profiles p where p.id = life_events.birth_profile_id and p.user_id = (select security.current_app_user_id())));
create policy app_runtime_update_own_life_events on app.life_events for update to app_runtime using (user_id = (select security.current_app_user_id())) with check (user_id = (select security.current_app_user_id()));
create policy app_runtime_select_own_life_event_observations on app.life_event_observations for select to app_runtime using (user_id = (select security.current_app_user_id()));
create policy app_runtime_insert_own_life_event_observations on app.life_event_observations for insert to app_runtime with check (user_id = (select security.current_app_user_id()) and exists (select 1 from app.life_events e where e.id = life_event_observations.life_event_id and e.user_id = (select security.current_app_user_id()) and e.birth_profile_id = life_event_observations.birth_profile_id));
create policy app_runtime_update_own_life_event_observations on app.life_event_observations for update to app_runtime using (user_id = (select security.current_app_user_id())) with check (user_id = (select security.current_app_user_id()));
create policy app_runtime_delete_own_life_event_observations on app.life_event_observations for delete to app_runtime using (user_id = (select security.current_app_user_id()));
grant select,insert,update on app.life_events to app_runtime;
grant select,insert,update,delete on app.life_event_observations to app_runtime;

-- Same identifiers make the mapping auditable; source keys make this safe to
-- re-run and leave the legacy Career records untouched.
insert into app.life_events (id,user_id,birth_profile_id,category,event_type,event_date_precision,event_year,event_month,event_day,title,note,legacy_source_type,legacy_source_id,created_at,updated_at,deleted_at)
select id,user_id,birth_profile_id,'CAREER_BUSINESS',
  case event_type when 'FIRST_JOB' then 'JOB_JOINED' when 'JOB_SWITCH' then 'JOB_CHANGED' when 'ROLE_CHANGE' then 'ROLE_CHANGED' when 'SALARY_GROWTH' then 'SALARY_CHANGED' else event_type end,
  event_date_precision,event_year,event_month,event_day,title,notes,'CAREER_EVENT',id,created_at,updated_at,deleted_at
from app.career_events
on conflict (legacy_source_type,legacy_source_id) do nothing;

insert into app.life_event_observations (id,user_id,birth_profile_id,life_event_id,observation_type,event_date_precision,event_year,event_month,event_day,legacy_source_type,legacy_source_id,created_at,updated_at)
select o.id,o.user_id,o.birth_profile_id,o.career_event_id,o.observation_type,o.event_date_precision,o.event_year,o.event_month,o.event_day,'CAREER_EVENT_OBSERVATION',o.id,o.created_at,o.updated_at
from app.career_event_observations o
join app.life_events e on e.legacy_source_type='CAREER_EVENT' and e.legacy_source_id=o.career_event_id
on conflict (legacy_source_type,legacy_source_id) do nothing;
