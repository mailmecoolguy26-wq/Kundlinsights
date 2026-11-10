-- Tarot V1 is account-scoped and deliberately independent of birth profiles.
create table app.tarot_readings (
  id text primary key check (id <> ''),
  user_id text not null references app.users(id) on delete restrict,
  question text not null check (char_length(question) between 1 and 1000),
  category text not null check (category in ('CAREER','RELATIONSHIP','MONEY','PERSONAL_GROWTH','DECISION','GENERAL_GUIDANCE')),
  spread_type text not null check (spread_type in ('CAREER','RELATIONSHIP','MONEY','PERSONAL_GROWTH','DECISION','GENERAL_GUIDANCE')),
  status text not null check (status in ('DRAWING','INTERPRETING','INTERPRETATION_RETRYABLE','COMPLETED','CANCELLED')),
  rules_version text not null check (rules_version = 'tarot-rules-v1'),
  entitlement_source text not null check (entitlement_source in ('FREE_DAILY','PAID_CREDIT')),
  language text not null check (language in ('ENGLISH','HINGLISH')),
  quota_day date not null,
  creation_idempotency_key text not null,
  final_interpretation jsonb null check (final_interpretation is null or jsonb_typeof(final_interpretation)='object'),
  interpretation_version text null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  completed_at timestamptz null,
  deleted_at timestamptz null,
  unique (user_id, creation_idempotency_key)
);
create unique index tarot_one_free_per_user_utc_day on app.tarot_readings(user_id,quota_day) where entitlement_source='FREE_DAILY';
create index tarot_readings_history_idx on app.tarot_readings(user_id,created_at desc,id desc) where deleted_at is null;

-- Server-private. No client/authenticated role is granted access to this table.
create table app.tarot_reading_decks (
  reading_id text primary key references app.tarot_readings(id) on delete cascade,
  deck_json jsonb not null check (jsonb_typeof(deck_json)='array' and jsonb_array_length(deck_json)=78),
  created_at timestamptz not null
);
create table app.tarot_reading_cards (
  reading_id text not null references app.tarot_readings(id) on delete restrict,
  position smallint not null check (position between 1 and 3),
  card_id text not null,
  selection_token text not null,
  orientation text not null check (orientation='UPRIGHT'),
  selected_at timestamptz not null,
  primary key(reading_id,position), unique(reading_id,card_id), unique(reading_id,selection_token)
);
create table app.tarot_selection_requests (
  reading_id text not null references app.tarot_readings(id) on delete cascade,
  idempotency_key text not null,
  response_json jsonb not null check (jsonb_typeof(response_json)='object'),
  created_at timestamptz not null,
  primary key(reading_id,idempotency_key)
);
create table app.tarot_credit_grants (
  id text primary key,
  user_id text not null references app.users(id) on delete restrict,
  product_key text not null check (product_key in ('TAROT_3_READINGS','TAROT_5_READINGS','TAROT_10_READINGS')),
  granted_quantity integer not null check (granted_quantity in (3,5,10)),
  consumed_quantity integer not null default 0 check (consumed_quantity between 0 and granted_quantity),
  provider text null,
  provider_transaction_id text null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(provider,provider_transaction_id)
);
create index tarot_credit_grants_available_idx on app.tarot_credit_grants(user_id,created_at,id) where consumed_quantity < granted_quantity;
create table app.tarot_credit_ledger (
  id text primary key,
  user_id text not null references app.users(id) on delete restrict,
  reading_id text not null unique references app.tarot_readings(id) on delete restrict,
  grant_id text not null references app.tarot_credit_grants(id) on delete restrict,
  entry_type text not null check(entry_type='CONSUMPTION'),
  quantity integer not null check(quantity=-1),
  created_at timestamptz not null
);

alter table app.tarot_readings enable row level security; alter table app.tarot_readings force row level security;
alter table app.tarot_reading_decks enable row level security; alter table app.tarot_reading_decks force row level security;
alter table app.tarot_reading_cards enable row level security; alter table app.tarot_reading_cards force row level security;
alter table app.tarot_selection_requests enable row level security; alter table app.tarot_selection_requests force row level security;
alter table app.tarot_credit_grants enable row level security; alter table app.tarot_credit_grants force row level security;
alter table app.tarot_credit_ledger enable row level security; alter table app.tarot_credit_ledger force row level security;

create policy tarot_readings_own on app.tarot_readings for all to app_runtime using(user_id=(select security.current_app_user_id())) with check(user_id=(select security.current_app_user_id()));
create policy tarot_decks_own on app.tarot_reading_decks for all to app_runtime using(exists(select 1 from app.tarot_readings r where r.id=reading_id and r.user_id=(select security.current_app_user_id()))) with check(exists(select 1 from app.tarot_readings r where r.id=reading_id and r.user_id=(select security.current_app_user_id())));
create policy tarot_cards_own on app.tarot_reading_cards for all to app_runtime using(exists(select 1 from app.tarot_readings r where r.id=reading_id and r.user_id=(select security.current_app_user_id()))) with check(exists(select 1 from app.tarot_readings r where r.id=reading_id and r.user_id=(select security.current_app_user_id())));
create policy tarot_selection_own on app.tarot_selection_requests for all to app_runtime using(exists(select 1 from app.tarot_readings r where r.id=reading_id and r.user_id=(select security.current_app_user_id()))) with check(exists(select 1 from app.tarot_readings r where r.id=reading_id and r.user_id=(select security.current_app_user_id())));
create policy tarot_grants_own on app.tarot_credit_grants for all to app_runtime using(user_id=(select security.current_app_user_id())) with check(user_id=(select security.current_app_user_id()));
create policy tarot_ledger_own on app.tarot_credit_ledger for all to app_runtime using(user_id=(select security.current_app_user_id())) with check(user_id=(select security.current_app_user_id()));

revoke all on app.tarot_readings,app.tarot_reading_decks,app.tarot_reading_cards,app.tarot_selection_requests,app.tarot_credit_grants,app.tarot_credit_ledger from public;
grant select,insert,update on app.tarot_readings,app.tarot_reading_decks,app.tarot_reading_cards,app.tarot_selection_requests,app.tarot_credit_grants,app.tarot_credit_ledger to app_runtime;
