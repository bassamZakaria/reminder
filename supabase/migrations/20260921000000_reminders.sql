-- A note can now carry several reminders. Reminder fields move off the note into their own table.
alter table public.items rename to notes;

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  due_at timestamptz not null,
  repeat_rule text not null default 'none' check (repeat_rule in ('none','hourly','daily','weekly','monthly','yearly')),
  alert_type text not null default 'notification' check (alert_type in ('notification','alarm')),
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.reminders (user_id, note_id, due_at, repeat_rule, alert_type, is_completed, completed_at)
select user_id, id, due_at, repeat_rule, alert_type, is_completed, completed_at
from public.notes
where due_at is not null;

drop index if exists public.items_user_due_idx;
alter table public.notes
  drop column due_at,
  drop column repeat_rule,
  drop column alert_type,
  drop column is_completed,
  drop column completed_at,
  drop column priority;

create index reminders_user_due_idx on public.reminders(user_id, due_at);
create index reminders_note_idx on public.reminders(note_id);

create trigger reminders_updated_at before update on public.reminders for each row execute function public.set_updated_at();

alter table public.reminders enable row level security;
create policy "own reminders" on public.reminders for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and exists (select 1 from public.notes n where n.id = note_id and n.user_id = auth.uid()));

alter table public.reminders replica identity full;
alter publication supabase_realtime add table public.reminders;
