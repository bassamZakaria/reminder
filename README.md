# Recall

Notes + Reminders in one app for iPhone, Mac and Android. One React Native codebase (`react-native-macos` for desktop), Supabase for sync, native notifications and alarms on every platform.

## One-time setup

1. `yarn install`
2. Create a Supabase access token at https://supabase.com/dashboard/account/tokens
3. `SUPABASE_ACCESS_TOKEN=sbp_... PRIVACY_POLICY_URL=https://… SUPPORT_URL=https://… DEMO_EMAIL=review@… DEMO_PASSWORD=… ./scripts/setup-supabase.sh`
   Creates the free project, applies the schema, turns on email-confirmed sign-ups, optionally creates a demo account for app reviewers, writes `app.config.json`, and sets the GitHub secrets for the keep-alive workflow when run inside a GitHub-backed checkout.
4. iOS: `cd ios && bundle exec pod install`; macOS: `cd macos && bundle exec pod install`
5. Rebuild both apps so they embed the new `app.config.json`.

## Install on your devices

The JavaScript bundle and `app.config.json` are baked into Release builds, so the apps run without Metro.

- **iPhone**: connect the phone, enable Developer Mode (Settings › Privacy & Security), open `ios/Recall.xcworkspace`, pick your team under Signing & Capabilities, select the phone and run with the **Release** scheme configuration (Product › Scheme › Edit Scheme › Run › Build Configuration). Or: `yarn ios --mode Release --device`.
  With a free Apple ID the install expires after 7 days; re-run to renew. A paid developer account lasts a year.
- **Android**: `cd android && ./gradlew assembleRelease`, then `adb install app/build/outputs/apk/release/app-release.apk`. For Google Play, build `./gradlew bundleRelease` with your upload key (see `docs/store-submission.md`).
- **Mac**: `xcodebuild -workspace macos/Recall.xcworkspace -scheme Recall-macOS -configuration Release -derivedDataPath build/mac build`, then copy `build/mac/Build/Products/Release/Recall.app` to `/Applications`.

After the first launch, open Settings in the app and tap **Send a test notification** to confirm alerts work on that device.

## Sync

Supabase (Postgres + Realtime) is the single source of truth. Every change is written straight to the database and pushed to the other device over Realtime; each device also reloads when it comes to the foreground.

Free Supabase projects pause after 7 days without database activity. `.github/workflows/supabase-keepalive.yml` queries the database twice a week so the project never pauses. It needs the `SUPABASE_URL` and `SUPABASE_ANON_KEY` repo secrets. If a project does pause, restore it from the Supabase dashboard.

## Run (development)

- iPhone simulator: `yarn ios`
- Android emulator: `yarn android`
- Mac: `yarn macos`
- Metro only: `yarn start`

## Publishing

See [`docs/store-submission.md`](docs/store-submission.md) for the App Store and Google Play checklist, and host [`docs/privacy-policy.md`](docs/privacy-policy.md) and [`docs/support.md`](docs/support.md).

## Tests

- Unit: `yarn test` (scheduling, grouping, store behaviour)
- Types and lint: `yarn typecheck && yarn lint`
- UI (iOS simulator or Android emulator): install [Maestro](https://maestro.mobile.dev), `yarn supabase start`, point `app.config.json` at `http://127.0.0.1:54321` with the local anon key, install a Release build, then `DEVICE=<simulator UDID or emulator-5554> yarn test:ui`. On Android run `adb reverse tcp:54321 tcp:54321` first. The script resets the local database, creates a test user and runs `.maestro/flows`.

## How it works

- **Reminders** tab: every reminder, grouped Overdue / Today / Tomorrow / Next 7 Days / Later, with its note's title and first line. Tap a reminder to see the full note, snooze it, or mark it done. Long-press for more.
- **Notes** tab: every note, with its upcoming reminders shown under it. Filter by folder with the chips at the top; long-press a folder chip to rename or delete it.
- A note can have any number of reminders. Each one has its own time, repeat, and notification or alarm style, edited from the note.
- Completing a repeating reminder moves it to the next occurrence. Deleting a note can be undone from the toast.
- Notifications are scheduled locally on each signed-in device from the synced data, with Complete / Snooze 10 min / Snooze 1 hour actions. On iOS 26+ an alarm reminder uses AlarmKit and rings like the Clock app.
- Native module lives in `native/` (CocoaPod shared by the iOS and macOS projects). `.yarn/patches/` carries a react-native-macos fix for password fields.
