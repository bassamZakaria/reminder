alter table public.items add column priority smallint not null default 0 check (priority between 0 and 3);
