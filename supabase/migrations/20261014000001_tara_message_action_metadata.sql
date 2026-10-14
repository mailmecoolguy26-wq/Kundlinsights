-- Server-authored, optional presentation metadata for persisted Ask Tara messages.
-- It is deliberately generic: only the service exposes allowlisted actions.
alter table app.tara_conversation_messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;
