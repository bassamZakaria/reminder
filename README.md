# Recall

Notes + Reminders in one app for iPhone and Mac. One React Native codebase (`react-native-macos` for desktop), Supabase free tier for sync, native alarm-style notifications on both platforms.

## One-time setup

1. `yarn install`
2. `npx supabase login` (opens browser once)
3. `USER_EMAIL=you@example.com USER_PASSWORD='choose-a-password' ./scripts/setup-supabase.sh`
   Creates the free project, applies the schema, creates your login, writes `app.config.json`.
4. iOS: `cd ios && bundle exec pod install`; macOS: `cd macos && bundle exec pod install`

## Run

- iPhone simulator: `yarn ios`
- Mac: `yarn macos`
- Metro only: `yarn start`

## Notes

- Every item is a note; adding a date makes it a reminder. Completing a repeating reminder advances it to the next occurrence.
- Notifications are scheduled locally on each signed-in device from the synced data, with Complete / Snooze 10 min / Snooze 1 hour actions.
- Native module lives in `native/` (CocoaPod shared by the iOS and macOS projects).
