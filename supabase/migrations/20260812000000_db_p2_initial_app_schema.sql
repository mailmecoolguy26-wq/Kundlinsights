-- DB-P2: portable PostgreSQL schema only. No application encryption or RLS policy is implemented here.

create schema if not exists app;
revoke all on schema app from public;

create table app.users (
  id text primary key check (id <> ''),
  auth_subject text not null unique check (auth_subject <> ''),
  status text not null default 'active' check (status <> ''),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz null
);

create table app.birth_profiles (
  id text primary key check (id <> ''),
  user_id text not null references app.users(id) on delete restrict,
  display_label text null,
  birth_payload_ciphertext bytea not null,
  birth_payload_encryption_version smallint not null check (birth_payload_encryption_version > 0),
  birth_payload_key_version text not null check (birth_payload_key_version <> ''),
  birth_payload_algorithm text not null check (birth_payload_algorithm <> ''),
  birth_payload_nonce bytea not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  archived_at timestamptz null
);

create table app.payment_transactions (
  id text primary key check (id <> ''),
  user_id text not null references app.users(id) on delete restrict,
  provider text not null check (provider <> ''),
  provider_transaction_id text not null check (provider_transaction_id <> ''),
  status text not null check (status <> ''),
  amount_minor bigint not null check (amount_minor >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  provider_metadata jsonb null,
  unique (provider, provider_transaction_id)
);

create table app.entitlements (
  id text primary key check (id <> ''),
  user_id text not null references app.users(id) on delete restrict,
  product_key text not null check (product_key <> ''),
  status text not null check (status <> ''),
  quantity integer not null check (quantity >= 0),
  valid_from timestamptz not null,
  valid_until timestamptz null check (valid_until is null or valid_until > valid_from),
  source_payment_transaction_id text null references app.payment_transactions(id) on delete restrict,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table app.reading_records (
  id text primary key check (id <> ''),
  user_id text not null references app.users(id) on delete restrict,
  birth_profile_id text null references app.birth_profiles(id) on delete restrict,
  domain text not null check (domain <> ''),
  engine_profile_id text not null check (engine_profile_id <> ''),
  engine_profile_fingerprint char(64) not null check (engine_profile_fingerprint ~ '^[0-9a-f]{64}$'),
  record_schema_version text not null check (record_schema_version <> ''),
  input_snapshot_ciphertext bytea not null,
  provenance_ciphertext bytea not null,
  structured_reading_ciphertext bytea not null,
  rendered_reading_ciphertext bytea null,
  payload_encryption_version smallint not null check (payload_encryption_version > 0),
  payload_key_version text not null check (payload_key_version <> ''),
  payload_algorithm text not null check (payload_algorithm <> ''),
  input_snapshot_nonce bytea not null,
  provenance_nonce bytea not null,
  structured_reading_nonce bytea not null,
  rendered_reading_nonce bytea null,
  integrity_metadata jsonb not null,
  calculation_digest char(64) not null check (calculation_digest ~ '^[0-9a-f]{64}$'),
  output_digest char(64) not null check (output_digest ~ '^[0-9a-f]{64}$'),
  rendered_output_digest char(64) null check (rendered_output_digest is null or rendered_output_digest ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null,
  archived_at timestamptz null,
  deleted_at timestamptz null,
  idempotency_key text null check (idempotency_key is null or idempotency_key <> ''),
  check (
    (rendered_reading_ciphertext is null and rendered_reading_nonce is null and rendered_output_digest is null)
    or
    (rendered_reading_ciphertext is not null and rendered_reading_nonce is not null and rendered_output_digest is not null)
  )
);

create index birth_profiles_user_created_idx on app.birth_profiles (user_id, created_at, id);
create index reading_records_user_created_idx on app.reading_records (user_id, created_at desc, id);
create index reading_records_birth_profile_created_idx on app.reading_records (birth_profile_id, created_at desc, id);
create index reading_records_engine_profile_idx on app.reading_records (engine_profile_id);
create index reading_records_calculation_digest_idx on app.reading_records (calculation_digest);
create unique index reading_records_user_idempotency_key_idx on app.reading_records (user_id, idempotency_key) where idempotency_key is not null;
create index entitlements_user_product_status_validity_idx on app.entitlements (user_id, product_key, status, valid_from, id);

create function app.enforce_reading_record_immutability()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.birth_profile_id is distinct from old.birth_profile_id
    or new.domain is distinct from old.domain
    or new.engine_profile_id is distinct from old.engine_profile_id
    or new.engine_profile_fingerprint is distinct from old.engine_profile_fingerprint
    or new.record_schema_version is distinct from old.record_schema_version
    or new.input_snapshot_ciphertext is distinct from old.input_snapshot_ciphertext
    or new.provenance_ciphertext is distinct from old.provenance_ciphertext
    or new.structured_reading_ciphertext is distinct from old.structured_reading_ciphertext
    or new.rendered_reading_ciphertext is distinct from old.rendered_reading_ciphertext
    or new.payload_encryption_version is distinct from old.payload_encryption_version
    or new.payload_key_version is distinct from old.payload_key_version
    or new.payload_algorithm is distinct from old.payload_algorithm
    or new.input_snapshot_nonce is distinct from old.input_snapshot_nonce
    or new.provenance_nonce is distinct from old.provenance_nonce
    or new.structured_reading_nonce is distinct from old.structured_reading_nonce
    or new.rendered_reading_nonce is distinct from old.rendered_reading_nonce
    or new.integrity_metadata is distinct from old.integrity_metadata
    or new.calculation_digest is distinct from old.calculation_digest
    or new.output_digest is distinct from old.output_digest
    or new.rendered_output_digest is distinct from old.rendered_output_digest
    or new.created_at is distinct from old.created_at
    or new.idempotency_key is distinct from old.idempotency_key then
    raise exception 'READING_RECORD_SEMANTIC_IMMUTABLE';
  end if;
  return new;
end;
$$;

create trigger reading_records_enforce_immutability
before update on app.reading_records
for each row execute function app.enforce_reading_record_immutability();

comment on column app.birth_profiles.birth_payload_ciphertext is 'Opaque encrypted birth payload; application/KMS encryption is deferred.';
comment on table app.reading_records is 'Historical reading snapshots; semantic fields are immutable after insert.';
comment on column app.reading_records.input_snapshot_ciphertext is 'Opaque encrypted replay input snapshot; never resolve from current birth profile.';
comment on column app.reading_records.calculation_digest is 'SHA-256 calculation identity; intentionally non-unique.';
comment on column app.reading_records.engine_profile_fingerprint is 'SHA-256 fingerprint of the immutable engine profile definition.';

revoke all on all tables in schema app from public;
