create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null default 'New chat',
  created_at timestamptz not null default now()
);
create index if not exists conversations_user_idx on conversations (user_id, created_at desc);

create table if not exists messages (
  id serial primary key,
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);
create index if not exists messages_conv_idx on messages (conversation_id, created_at);

-- the app connects as the table owner and skips RLS; RLS with no policies blocks Supabase's public API
alter table conversations enable row level security;
alter table messages enable row level security;