-- Career Premium subscriptions are scoped to one owned birth profile.
-- Legacy records intentionally remain unassigned until explicit reconciliation.
alter table app.subscription_records
  add column if not exists birth_profile_id text null references app.birth_profiles(id) on delete restrict;

create index if not exists subscription_records_user_profile_validity_idx
  on app.subscription_records (user_id, birth_profile_id, status, valid_until desc, id);

create or replace function app.prevent_subscription_profile_transfer()
returns trigger
language plpgsql
as $$
begin
  if old.birth_profile_id is not null
     and new.birth_profile_id is distinct from old.birth_profile_id then
    raise exception 'subscription birth profile is immutable'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists subscription_records_prevent_profile_transfer on app.subscription_records;
create trigger subscription_records_prevent_profile_transfer
before update on app.subscription_records
for each row execute function app.prevent_subscription_profile_transfer();

comment on column app.subscription_records.birth_profile_id is 'Immutable owned profile linked to this Career Premium subscription; null legacy rows require reconciliation.';
