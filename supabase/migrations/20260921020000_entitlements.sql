-- Premium status reported by the store-backed apps so other platforms (web, the other store) can honour it.
-- Written by the client after StoreKit / Play Billing verification; not a server-verified receipt.
create table public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default false,
  product_id text,
  platform text not null check (platform in ('ios','macos','android')),
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger entitlements_updated_at before update on public.entitlements for each row execute function public.set_updated_at();

alter table public.entitlements enable row level security;
create policy "own entitlement" on public.entitlements for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
