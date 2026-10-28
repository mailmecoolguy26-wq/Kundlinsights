-- Immutable, profile-scoped snapshots of validated Career Decision results.
-- These are deliberately separate from reading_records: a decision records
-- user-provided, allowlisted context alongside the existing reading it used.
create table app.career_decisions (
  id text primary key check (id <> ''),
  user_id text not null references app.users(id) on delete restrict,
  birth_profile_id text not null references app.birth_profiles(id) on delete restrict,
  decision_type text not null check (decision_type in ('JOB_OFFER','SWITCH_JOB','COMPARE_OFFERS','PROMOTION_GROWTH','START_BUSINESS','CAREER_ABROAD')),
  context_json jsonb not null check (jsonb_typeof(context_json) = 'object'),
  result_json jsonb not null check (jsonb_typeof(result_json) = 'object'),
  source_reading_id text null references app.reading_records(id) on delete set null,
  created_at timestamptz not null
);

create index career_decisions_profile_created_idx
  on app.career_decisions (user_id, birth_profile_id, created_at desc, id desc);

alter table app.career_decisions enable row level security;
alter table app.career_decisions force row level security;

create policy app_runtime_select_own_career_decisions
  on app.career_decisions for select to app_runtime
  using (user_id = (select security.current_app_user_id()));

create policy app_runtime_insert_own_career_decisions
  on app.career_decisions for insert to app_runtime
  with check (
    user_id = (select security.current_app_user_id())
    and exists (
      select 1 from app.birth_profiles p
      where p.id = career_decisions.birth_profile_id
        and p.user_id = (select security.current_app_user_id())
    )
  );

revoke all on app.career_decisions from public;
grant select, insert on app.career_decisions to app_runtime;
