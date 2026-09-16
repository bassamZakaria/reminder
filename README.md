# Recall

Notes + Reminders in one app for iPhone and Mac. One React Native codebase (`react-native-macos` for desktop), Supabase free tier for sync, native alarm-style notifications on both platforms.

## One-time setup

1. `yarn install`
2. Create a Supabase access token at https://supabase.com/dashboard/account/tokens
3. `SUPABASE_ACCESS_TOKEN=sbp_... USER_EMAIL=you@example.com USER_PASSWORD='choose-a-password' ./scripts/setup-supabase.sh`
   Creates the free project, applies the schema, creates your only login, disables public sign-ups, writes `app.config.json`, and sets the GitHub secrets for the keep-alive workflow when run inside a GitHub-backed checkout.
4. iOS: `cd ios && bundle exec pod install`; macOS: `cd macos && bundle exec pod install`
5. Rebuild both apps so they embed the new `app.config.json`.

## Sync

Supabase (Postgres + Realtime) is the single source of truth. Every change is written straight to the database and pushed to the other device over Realtime; each device also reloads when it comes to the foreground.

Free Supabase projects pause after 7 days without database activity. `.github/workflows/supabase-keepalive.yml` queries the database twice a week so the project never pauses. It needs the `SUPABASE_URL` and `SUPABASE_ANON_KEY` repo secrets. If a project does pause, restore it from the Supabase dashboard.

## Run

- iPhone simulator: `yarn ios`
- Mac: `yarn macos`
- Metro only: `yarn start`

## Notes

- Every item is a note; adding a date makes it a reminder. Completing a repeating reminder advances it to the next occurrence.
- Notifications are scheduled locally on each signed-in device from the synced data, with Complete / Snooze 10 min / Snooze 1 hour actions.
- Native module lives in `native/` (CocoaPod shared by the iOS and macOS projects).
