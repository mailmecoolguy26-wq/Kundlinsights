-- One-time, operator-controlled cryptographic re-encryption exception.
-- This role is intentionally not granted to the application runtime. A recovery
-- operator must explicitly assume it from a controlled database connection.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_legacy_encryption_recovery') then
    create role app_legacy_encryption_recovery nologin nosuperuser nobypassrls nocreatedb nocreaterole noinherit;
  end if;
end;
$$;

grant usage on schema app, security to app_legacy_encryption_recovery;
grant select, update on app.birth_profiles, app.reading_records to app_legacy_encryption_recovery;
grant execute on function security.current_auth_subject(), security.current_app_user_id() to app_legacy_encryption_recovery;

create policy app_legacy_encryption_recovery_select_profiles on app.birth_profiles
  for select to app_legacy_encryption_recovery
  using (user_id = (select security.current_app_user_id()));

create policy app_legacy_encryption_recovery_update_profiles on app.birth_profiles
  for update to app_legacy_encryption_recovery
  using (user_id = (select security.current_app_user_id()))
  with check (user_id = (select security.current_app_user_id()));

create policy app_legacy_encryption_recovery_select_readings on app.reading_records
  for select to app_legacy_encryption_recovery
  using (user_id = (select security.current_app_user_id()));

create policy app_legacy_encryption_recovery_update_readings on app.reading_records
  for update to app_legacy_encryption_recovery
  using (user_id = (select security.current_app_user_id()))
  with check (user_id = (select security.current_app_user_id()));

-- It permits only ciphertext/key-version replacement, never a semantic reading change.
create or replace function app.enforce_reading_record_immutability()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'app_legacy_encryption_recovery'
    and current_setting('app.legacy_encryption_recovery', true) = 'v1'
    and new.id is not distinct from old.id
    and new.user_id is not distinct from old.user_id
    and new.birth_profile_id is not distinct from old.birth_profile_id
    and new.domain is not distinct from old.domain
    and new.engine_profile_id is not distinct from old.engine_profile_id
    and new.engine_profile_fingerprint is not distinct from old.engine_profile_fingerprint
    and new.record_schema_version is not distinct from old.record_schema_version
    and new.integrity_metadata is not distinct from old.integrity_metadata
    and new.calculation_digest is not distinct from old.calculation_digest
    and new.output_digest is not distinct from old.output_digest
    and new.rendered_output_digest is not distinct from old.rendered_output_digest
    and new.created_at is not distinct from old.created_at
    and new.idempotency_key is not distinct from old.idempotency_key
    and new.archived_at is not distinct from old.archived_at then
    return new;
  end if;

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
