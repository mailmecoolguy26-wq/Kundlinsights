-- SEC-P5: persistent wrapped per-user DEK envelopes. Raw DEKs and KMS master keys never enter PostgreSQL.
create table app.user_key_envelopes (
  id text primary key,
  user_id text not null references app.users(id) on delete restrict,
  key_version text not null,
  wrapped_dek bytea not null,
  kms_key_ref text not null,
  wrapping_algorithm text not null,
  created_at timestamptz not null,
  retired_at timestamptz null,
  status text not null check (status in ('active', 'retired')),
  metadata jsonb null,
  unique (user_id, key_version),
  check ((status = 'active' and retired_at is null) or (status = 'retired' and retired_at is not null))
);
create unique index user_key_envelopes_one_active_per_user on app.user_key_envelopes (user_id) where status = 'active';

create or replace function app.prevent_user_key_envelope_mutation()
returns trigger language plpgsql set search_path = pg_catalog, app as $$
begin
  if old.user_id is distinct from new.user_id or old.key_version is distinct from new.key_version or old.wrapped_dek is distinct from new.wrapped_dek or old.kms_key_ref is distinct from new.kms_key_ref or old.wrapping_algorithm is distinct from new.wrapping_algorithm or old.created_at is distinct from new.created_at then
    raise exception 'KEY_ENVELOPE_IMMUTABLE';
  end if;
  if new.status = old.status then raise exception 'KEY_ENVELOPE_STATUS_IMMUTABLE'; end if;
  if old.status <> 'active' or new.status <> 'retired' or new.retired_at is null then raise exception 'INVALID_KEY_ENVELOPE_RETIREMENT'; end if;
  return new;
end;
$$;
create trigger user_key_envelopes_immutable before update on app.user_key_envelopes for each row execute function app.prevent_user_key_envelope_mutation();

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_crypto') then create role app_crypto nologin nosuperuser nobypassrls nocreatedb nocreaterole noinherit; end if;
end $$;
revoke all on app.user_key_envelopes from public, app_runtime, app_worker;
grant usage on schema app, security to app_crypto;
grant execute on function security.current_auth_subject(), security.current_app_user_id() to app_crypto;
grant select, insert, update on app.user_key_envelopes to app_crypto;
alter table app.user_key_envelopes enable row level security;
alter table app.user_key_envelopes force row level security;
create policy app_crypto_select_own_key_envelopes on app.user_key_envelopes for select to app_crypto using (user_id = (select security.current_app_user_id()));
create policy app_crypto_insert_own_key_envelopes on app.user_key_envelopes for insert to app_crypto with check (user_id = (select security.current_app_user_id()) and status = 'active' and retired_at is null);
create policy app_crypto_retire_own_key_envelopes on app.user_key_envelopes for update to app_crypto using (user_id = (select security.current_app_user_id()) and status = 'active') with check (user_id = (select security.current_app_user_id()) and status = 'retired' and retired_at is not null);
comment on table app.user_key_envelopes is 'SEC-P5 wrapped per-user DEK envelopes only. PostgreSQL never stores a raw DEK or KMS master key.';
