-- Phase 5B-1. Provider-neutral notification state only; no scheduler or provider is enabled here.
create table if not exists app.device_notification_registrations (
  id text primary key check (id <> ''),
  user_id text not null references app.users(id),
  device_id text not null,
  platform text not null,
  push_provider text not null,
  push_token text not null,
  app_version text,
  environment text not null,
  notifications_enabled boolean not null default true,
  created_at timestamptz not null,
  last_registered_at timestamptz not null,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  unique (user_id, device_id)
);
create unique index if not exists device_notification_registrations_active_device_idx on app.device_notification_registrations(device_id) where revoked_at is null;

create table if not exists app.notification_preferences (
  user_id text primary key references app.users(id),
  reading_updates boolean not null default true,
  career_reminders boolean not null default true,
  offers_and_updates boolean not null default false,
  updated_at timestamptz not null
);

create table if not exists app.notification_campaigns (
  id text primary key, name text not null unique, type text not null, enabled boolean not null default false,
  priority integer not null, audience_rules_json jsonb not null, trigger_type text not null, trigger_config_json jsonb not null,
  title_template text not null, body_template text not null, destination_type text not null, destination_config_json jsonb not null,
  cooldown_hours integer, max_sends_per_user integer, max_sends_per_period integer, max_period_hours integer,
  goal_type text, starts_at timestamptz, ends_at timestamptz, created_at timestamptz not null, updated_at timestamptz not null,
  check (type <> 'CAREER_TIMING_SIGNAL'), check (priority > 0), check (cooldown_hours is null or cooldown_hours >= 0),
  check (max_sends_per_user is null or max_sends_per_user > 0), check (max_sends_per_period is null or max_sends_per_period > 0),
  check (max_period_hours is null or max_period_hours > 0)
);

create table if not exists app.notification_delivery_events (
  id text primary key check (id <> ''), notification_event_id text, campaign_id text not null references app.notification_campaigns(id), notification_type text not null,
  user_id text not null references app.users(id), device_registration_id text references app.device_notification_registrations(id),
  trigger_occurrence_key text not null, idempotency_key text not null unique, requested_at timestamptz not null,
  delivery_attempted_at timestamptz, delivered_at timestamptz, opened_at timestamptz, provider text,
  provider_message_id text, provider_result text, failure_reason_code text, goal_completed_at timestamptz
);
create index if not exists notification_delivery_events_user_requested_idx on app.notification_delivery_events(user_id, requested_at desc);
create index if not exists notification_delivery_events_campaign_user_idx on app.notification_delivery_events(campaign_id, user_id, delivered_at desc);

create table if not exists app.user_notification_activity (
  user_id text primary key references app.users(id), last_app_active_at timestamptz, last_reading_opened_at timestamptz, updated_at timestamptz not null
);
create table if not exists app.reading_views (
  user_id text not null references app.users(id), reading_id text not null references app.reading_records(id),
  first_viewed_at timestamptz not null, last_viewed_at timestamptz not null, view_count integer not null default 1 check (view_count > 0), primary key(user_id, reading_id)
);
create table if not exists app.career_paywall_interactions (
  user_id text not null references app.users(id), birth_profile_id text not null references app.birth_profiles(id),
  first_viewed_at timestamptz not null, last_viewed_at timestamptz not null, view_count integer not null default 1 check (view_count > 0), primary key(user_id, birth_profile_id)
);

alter table app.device_notification_registrations enable row level security;
alter table app.notification_preferences enable row level security;
alter table app.user_notification_activity enable row level security;
alter table app.reading_views enable row level security;
alter table app.career_paywall_interactions enable row level security;
alter table app.notification_campaigns enable row level security;
alter table app.notification_delivery_events enable row level security;
alter table app.device_notification_registrations force row level security;
alter table app.notification_preferences force row level security;
alter table app.user_notification_activity force row level security;
alter table app.reading_views force row level security;
alter table app.career_paywall_interactions force row level security;
alter table app.notification_campaigns force row level security;
alter table app.notification_delivery_events force row level security;

create policy app_runtime_select_own_device_notification_registrations on app.device_notification_registrations for select to app_runtime using (user_id = (select security.current_app_user_id()));
create policy app_runtime_insert_own_device_notification_registrations on app.device_notification_registrations for insert to app_runtime with check (user_id = (select security.current_app_user_id()));
create policy app_runtime_update_own_device_notification_registrations on app.device_notification_registrations for update to app_runtime using (user_id = (select security.current_app_user_id())) with check (user_id = (select security.current_app_user_id()));
create policy app_runtime_select_own_notification_preferences on app.notification_preferences for select to app_runtime using (user_id = (select security.current_app_user_id()));
create policy app_runtime_insert_own_notification_preferences on app.notification_preferences for insert to app_runtime with check (user_id = (select security.current_app_user_id()));
create policy app_runtime_update_own_notification_preferences on app.notification_preferences for update to app_runtime using (user_id = (select security.current_app_user_id())) with check (user_id = (select security.current_app_user_id()));
create policy app_runtime_select_own_notification_activity on app.user_notification_activity for select to app_runtime using (user_id = (select security.current_app_user_id()));
create policy app_runtime_insert_own_notification_activity on app.user_notification_activity for insert to app_runtime with check (user_id = (select security.current_app_user_id()));
create policy app_runtime_update_own_notification_activity on app.user_notification_activity for update to app_runtime using (user_id = (select security.current_app_user_id())) with check (user_id = (select security.current_app_user_id()));
create policy app_runtime_select_own_reading_views on app.reading_views for select to app_runtime using (user_id = (select security.current_app_user_id()));
create policy app_runtime_insert_own_reading_views on app.reading_views for insert to app_runtime with check (user_id = (select security.current_app_user_id()) and exists (select 1 from app.reading_records where id = reading_views.reading_id and user_id = (select security.current_app_user_id())));
create policy app_runtime_update_own_reading_views on app.reading_views for update to app_runtime using (user_id = (select security.current_app_user_id())) with check (user_id = (select security.current_app_user_id()));
create policy app_runtime_select_own_career_paywall_interactions on app.career_paywall_interactions for select to app_runtime using (user_id = (select security.current_app_user_id()));
create policy app_runtime_insert_own_career_paywall_interactions on app.career_paywall_interactions for insert to app_runtime with check (user_id = (select security.current_app_user_id()) and exists (select 1 from app.birth_profiles where id = career_paywall_interactions.birth_profile_id and user_id = (select security.current_app_user_id())));
create policy app_runtime_update_own_career_paywall_interactions on app.career_paywall_interactions for update to app_runtime using (user_id = (select security.current_app_user_id())) with check (user_id = (select security.current_app_user_id()));
create policy app_worker_manage_notification_campaigns on app.notification_campaigns for all to app_worker using (true) with check (true);
create policy app_worker_manage_notification_delivery_events on app.notification_delivery_events for all to app_worker using (true) with check (true);

grant select, insert, update on app.device_notification_registrations, app.notification_preferences, app.user_notification_activity, app.reading_views, app.career_paywall_interactions to app_runtime;
grant select, insert, update on app.notification_campaigns, app.notification_delivery_events to app_worker;

insert into app.notification_campaigns (id,name,type,enabled,priority,audience_rules_json,trigger_type,trigger_config_json,title_template,body_template,destination_type,destination_config_json,cooldown_hours,max_sends_per_user,max_sends_per_period,max_period_hours,goal_type,starts_at,ends_at,created_at,updated_at) values
('complete-profile-v1','COMPLETE_PROFILE','COMPLETE_PROFILE',false,1,'[{"predicate":"HAS_INCOMPLETE_BIRTH_PROFILE"}]','SCHEDULED_EVALUATION','{}','Complete your TaraVerse profile','Apni birth details complete karein taaki TaraVerse aapke liye personalized insights prepare kar sake.','BIRTH_PROFILE','{}',24,null,null,null,'PROFILE_COMPLETED',null,null,now(),now()),
('add-career-history-v1','ADD_CAREER_HISTORY','ADD_CAREER_HISTORY',false,2,'[{"predicate":"HAS_NO_CAREER_HISTORY"}]','SCHEDULED_EVALUATION','{}','Complete your Career timeline','Apne past Career events add karein. Isse TaraVerse aapke Career patterns ko better understand kar sakta hai.','CAREER_HISTORY','{}',24,2,null,null,'CAREER_HISTORY_ADDED',null,null,now(),now()),
('unlock-career-premium-v1','UNLOCK_CAREER_PREMIUM','UNLOCK_CAREER_PREMIUM',false,4,'[{"predicate":"CAREER_NOT_UNLOCKED"}]','SCHEDULED_EVALUATION','{}','Explore your complete Career Reading','Aapki Career Reading mein aur insights available hain. TaraVerse open karke details explore karein.','CAREER_PAYWALL','{}',24,null,null,null,'CAREER_UNLOCKED',null,null,now(),now()),
('return-to-reading-v1','RETURN_TO_READING','RETURN_TO_READING',false,3,'[{"predicate":"READING_EXISTS"},{"predicate":"READING_NOT_VIEWED"}]','SCHEDULED_EVALUATION','{}','Your Career Reading is ready','Apni Career Reading explore karein aur important insights review karein.','READING_DETAIL','{}',24,null,null,null,'READING_OPENED',null,null,now(),now()),
('inactive-user-reengagement-v1','INACTIVE_USER_REENGAGEMENT','INACTIVE_USER_REENGAGEMENT',false,5,'[{"predicate":"INACTIVE_FOR_N_DAYS","days":7}]','INACTIVITY','{"days":7}','Come back to TaraVerse','Aapke personalized insights TaraVerse mein available hain.','HOME','{}',168,null,null,null,'APP_RETURNED',null,null,now(),now())
on conflict (id) do nothing;
