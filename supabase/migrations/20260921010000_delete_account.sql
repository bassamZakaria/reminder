-- App Store guideline 5.1.1(v): users must be able to delete their account from inside the app.
-- Runs as the owner so it can remove the caller's auth.users row; every table cascades from it.
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
