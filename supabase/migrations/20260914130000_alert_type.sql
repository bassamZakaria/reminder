alter table public.items add column alert_type text not null default 'notification' check (alert_type in ('notification','alarm'));
