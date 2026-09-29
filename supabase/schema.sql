-- Friends Included Ltd: source-of-truth schema
create extension if not exists pgcrypto;

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  role text not null check (role in ('salesperson','expense_reporter','manager')),
  telegram_user_id text unique,
  linked_telegram_chat_id text,
  created_at timestamptz not null default now()
);

insert into employees (code, name, role) values
 ('richard','Richard Call Me Dick Darling','salesperson'),
 ('anastasia','Anastasia Ferrari','salesperson'),
 ('jean-claude','Jean Claude Berzins','salesperson'),
 ('kevin','Kevin von Whatever','expense_reporter'),
 ('svetlana','Svetlana de Monte Carlo','manager')
on conflict (code) do update set name = excluded.name, role = excluded.role;

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null check (reference ~ '^S[0-9]+$'),
  submitted_at timestamptz not null default now(),
  salesperson_code text not null references employees(code),
  customer text not null,
  project text not null check (project in ('A','B')),
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  proposed_richard numeric(5,2) not null,
  proposed_anastasia numeric(5,2) not null,
  proposed_jean_claude numeric(5,2) not null,
  approved_richard numeric(5,2),
  approved_anastasia numeric(5,2),
  approved_jean_claude numeric(5,2),
  commission_pool numeric(12,2) not null default 0,
  commission_richard numeric(12,2) not null default 0,
  commission_anastasia numeric(12,2) not null default 0,
  commission_jean_claude numeric(12,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','approved')),
  source text not null check (source in ('website','telegram')),
  originating_telegram_chat_id text,
  sync_status text not null default 'pending' check (sync_status in ('pending','synced','failed')),
  sync_error text,
  notified_at timestamptz,
  notification_error text,
  decided_at timestamptz,
  manager_code text references employees(code)
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null check (reference ~ '^E[0-9]+$'),
  submitted_at timestamptz not null default now(),
  reporter_code text not null references employees(code),
  description text not null,
  category text not null check (category in ('Materials','Travel','Other')),
  amount numeric(12,2) not null check (amount > 0),
  proposed_allocation text not null check (proposed_allocation in ('A','B','overhead')),
  final_allocation text check (final_allocation in ('A','B','overhead')),
  status text not null check (status in ('awaiting_allocation','allocated')),
  source text not null check (source in ('website','telegram')),
  originating_telegram_chat_id text,
  sync_status text not null default 'pending' check (sync_status in ('pending','synced','failed')),
  sync_error text,
  notified_at timestamptz,
  notification_error text,
  decided_at timestamptz,
  manager_code text references employees(code)
);

alter table sales enable row level security;
alter table expenses enable row level security;
alter table employees enable row level security;
-- Browser clients never access Supabase directly. Vercel uses the service role.
