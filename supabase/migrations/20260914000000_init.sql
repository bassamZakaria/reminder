create extension if not exists "pgcrypto";

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#3b82f6',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  list_id uuid references public.lists(id) on delete set null,
  title text not null default '',
  body text not null default '',
  due_at timestamptz,
  repeat_rule text not null default 'none' check (repeat_rule in ('none','hourly','daily','weekly','monthly','yearly')),
  is_completed boolean not null default false,
  completed_at timestamptz,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index items_user_due_idx on public.items(user_id, due_at);
create index items_user_updated_idx on public.items(user_id, updated_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger lists_updated_at before update on public.lists for each row execute function public.set_updated_at();
create trigger items_updated_at before update on public.items for each row execute function public.set_updated_at();

alter table public.lists enable row level security;
alter table public.items enable row level security;

create policy "own lists" on public.lists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own items" on public.items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.lists replica identity full;
alter table public.items replica identity full;
alter publication supabase_realtime add table public.lists, public.items;
