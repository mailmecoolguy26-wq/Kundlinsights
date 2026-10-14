-- Persistent, profile-scoped Ask Tara threads. Content is application data;
-- access is always enforced by the authenticated service layer.
create table if not exists app.tara_conversations (
  id text primary key check (id <> ''),
  user_id text not null references app.users(id) on delete restrict,
  birth_profile_id text not null references app.birth_profiles(id) on delete restrict,
  title text not null check (title <> ''),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists app.tara_conversation_messages (
  id text primary key check (id <> ''),
  conversation_id text not null references app.tara_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (content <> '' and length(content) <= 4000),
  created_at timestamptz not null
);

create index if not exists tara_conversations_profile_updated_idx
  on app.tara_conversations (user_id, birth_profile_id, updated_at desc, id asc);
create index if not exists tara_conversation_messages_conversation_created_idx
  on app.tara_conversation_messages (conversation_id, created_at asc, id asc);

alter table app.tara_conversations enable row level security;
alter table app.tara_conversation_messages enable row level security;
alter table app.tara_conversations force row level security;
alter table app.tara_conversation_messages force row level security;

create policy app_runtime_manage_own_tara_conversations
  on app.tara_conversations
  for all to app_runtime
  using (
    user_id = (select security.current_app_user_id())
    and exists (
      select 1 from app.birth_profiles
      where app.birth_profiles.id = tara_conversations.birth_profile_id
        and app.birth_profiles.user_id = (select security.current_app_user_id())
    )
  )
  with check (
    user_id = (select security.current_app_user_id())
    and exists (
      select 1 from app.birth_profiles
      where app.birth_profiles.id = tara_conversations.birth_profile_id
        and app.birth_profiles.user_id = (select security.current_app_user_id())
    )
  );

create policy app_runtime_manage_own_tara_conversation_messages
  on app.tara_conversation_messages
  for all to app_runtime
  using (
    exists (
      select 1 from app.tara_conversations
      where app.tara_conversations.id = tara_conversation_messages.conversation_id
        and app.tara_conversations.user_id = (select security.current_app_user_id())
    )
  )
  with check (
    exists (
      select 1 from app.tara_conversations
      where app.tara_conversations.id = tara_conversation_messages.conversation_id
        and app.tara_conversations.user_id = (select security.current_app_user_id())
    )
  );

revoke all on app.tara_conversations, app.tara_conversation_messages from public;
grant select, insert, update on app.tara_conversations, app.tara_conversation_messages to app_runtime;
