# Recall

Notes + Reminders in one app for iPhone and Mac. One React Native codebase (`react-native-macos` for desktop), Supabase free tier for sync, native alarm-style notifications on both platforms.

## One-time setup

1. `yarn install`
2. Create a Supabase access token at https://supabase.com/dashboard/account/tokens
3. `SUPABASE_ACCESS_TOKEN=sbp_... USER_EMAIL=you@example.com USER_PASSWORD='choose-a-password' ./scripts/setup-supabase.sh`
   Creates the free project, applies the schema, creates your only login, disables public sign-ups, writes `app.config.json`, and sets the GitHub secrets for the keep-alive workflow when run inside a GitHub-backed checkout.
4. iOS: `cd ios && bundle exec pod install`; macOS: `cd macos && bundle exec pod install`
5. Rebuild both apps so they embed the new `app.config.json`.

## Install on your devices

The JavaScript bundle and `app.config.json` are baked into Release builds, so the apps run without Metro.

- **iPhone**: connect the phone, enable Developer Mode (Settings › Privacy & Security), open `ios/Recall.xcworkspace`, pick your team under Signing & Capabilities, select the phone and run with the **Release** scheme configuration (Product › Scheme › Edit Scheme › Run › Build Configuration). Or: `yarn ios --mode Release --device`.
  With a free Apple ID the install expires after 7 days; re-run to renew. A paid developer account lasts a year.
- **Mac**: `xcodebuild -workspace macos/Recall.xcworkspace -scheme Recall-macOS -configuration Release -derivedDataPath build/mac build`, then copy `build/mac/Build/Products/Release/Recall.app` to `/Applications`.

After the first launch, open Settings in the app and tap **Send a test notification** to confirm alerts work on that device.

## Sync

Supabase (Postgres + Realtime) is the single source of truth. Every change is written straight to the database and pushed to the other device over Realtime; each device also reloads when it comes to the foreground.

Free Supabase projects pause after 7 days without database activity. `.github/workflows/supabase-keepalive.yml` queries the database twice a week so the project never pauses. It needs the `SUPABASE_URL` and `SUPABASE_ANON_KEY` repo secrets. If a project does pause, restore it from the Supabase dashboard.

## Run (development)

- iPhone simulator: `yarn ios`
- Mac: `yarn macos`
- Metro only: `yarn start`

## Tests

- Unit: `yarn test` (scheduling, grouping, store behaviour)
- Types and lint: `yarn typecheck && yarn lint`
- UI (iOS simulator): install [Maestro](https://maestro.mobile.dev), `npx supabase start`, point `app.config.json` at `http://127.0.0.1:54321` with the local anon key, build the app onto a booted simulator, then `yarn test:ui`. The script resets the local database, creates a test user and runs `.maestro/flows`.

## Notes

- Every item is a note; switching on “Remind me” makes it a reminder. Completing a repeating reminder advances it to the next occurrence.
- Long-press a note to pin, complete, snooze or delete it; long-press a folder to rename or delete it. Deleting a note can be undone from the toast.
- Notifications are scheduled locally on each signed-in device from the synced data, with Complete / Snooze 10 min / Snooze 1 hour actions. On iOS 26+ an “Alarm” reminder uses AlarmKit and rings like the Clock app.
- Native module lives in `native/` (CocoaPod shared by the iOS and macOS projects).
