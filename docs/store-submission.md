# Store submission checklist

What the code already covers, and what you fill in on App Store Connect and Google Play Console.

## Built into the app

| Requirement | Where |
| --- | --- |
| In-app account creation | Sign-in screen › "Create an account" |
| In-app account deletion (App Store 5.1.1(v), Play account deletion policy) | Settings › Delete Account (`delete_account()` in `supabase/migrations/20260921010000_delete_account.sql`) |
| Privacy policy and terms links in the app | Settings › About, sign-up screen, paywall (`privacyPolicyUrl`, `termsUrl` in `app.config.json`) |
| Password reset | Sign-in screen › "Forgot password?" (link opens the web app, `webUrl`) |
| Permissions asked in context | Notifications: when the first reminder is created. Alarms/exact alarms: when a reminder is set to Alarm, or from Settings |
| Purpose strings | `NSAlarmKitUsageDescription` (iOS). Android runtime permissions are requested with an in-app explanation in Settings |
| Entitlements | `ios/Recall/Recall.entitlements` and `macos/Recall-macOS/Recall.entitlements` (time-sensitive notifications; the Mac app is also sandboxed with outgoing network only) |
| Privacy manifest | `ios/Recall/PrivacyInfo.xcprivacy`, `macos/PrivacyInfo.xcprivacy` (email + user content, app functionality, no tracking) |
| Export compliance | `ITSAppUsesNonExemptEncryption = NO` (HTTPS only) |
| App icons | `scripts/generate-icons.py` → iOS, macOS, Android adaptive + Play 512 px |
| Launch screen without branding text | `ios/Recall/LaunchScreen.storyboard` |
| Accessibility | 44 pt touch targets, WCAG AA text contrast in light and dark, VoiceOver/TalkBack labels, Dynamic Type |
| Android target SDK | 36 (required for new apps and updates since 31 August 2026) |
| Release preflight | `yarn release:check` fails if the build points at a local server, has `forcePremium`, or is missing a legal link |
| Exact alarms | `SCHEDULE_EXACT_ALARM` (user-granted). `USE_EXACT_ALARM` and full-screen intents are not used, so no Play declaration is needed |

## Subscriptions (free trial + Premium)

Recall uses the stores' own billing: StoreKit on iPhone and Mac, Google Play Billing on Android. Customers pay with whatever their store account uses (including Apple Pay and Google Pay). Nothing else is needed on your side, and the web app sells nothing.

- **Free:** unlimited notes, up to 10 active reminders, notification alerts. **Premium:** unlimited reminders, ringing alarms, repeating reminders, folders.
- **App Store Connect:** accept the Paid Apps agreement and add banking/tax. Create a subscription group "Recall Premium" with two auto-renewable subscriptions, `recall_premium_monthly` and `recall_premium_yearly`. Give each an introductory offer: *Free*, 2 weeks, new subscribers. Add the review screenshot of the paywall. Put both subscriptions on the same app record for iPhone and Mac (Universal Purchase shares the bundle id `com.bassamsalah.recall`).
- **Play Console:** set up a payments profile. Create two subscriptions `recall_premium_monthly` and `recall_premium_yearly`, each with a base plan (monthly / yearly auto-renewing) and an offer with a 14-day free-trial phase for new customers. Products only load once the app is installed from a Play test track (internal testing is enough).
- **Testing:** on the iOS simulator, run from Xcode; the scheme uses `ios/Recall/Recall.storekit`. On Android, add yourself as a license tester in Play Console.
- **Cross-platform:** after a purchase the app records Premium on the account (`entitlements` table). Your other devices and the web app unlock from that record. Apple guideline 3.1.3(b) allows this because every app also offers the subscription.
- **Follow-up once money is involved:** entitlement rows are written by the app after a successful purchase, which is enough for the stores but is client-asserted. Before the subscription has real revenue, move that write into a Supabase Edge Function that verifies the App Store Server API receipt or the Play Developer API purchase token with the service role, and revoke client writes on the `entitlements` table.
- **Paywall disclosures (3.1.2):** price and period, trial length, auto-renewal terms, Restore Purchases, Terms of Use (Apple's standard EULA unless you set `termsUrl`) and Privacy Policy.

## Before you submit

1. **Host the legal pages.** Publish `docs/privacy-policy.md`, `docs/terms.md` and `docs/support.md` (GitHub Pages works). They are already addressed to bassam.s.zakaria@gmail.com.
2. **Deploy the web app** (`yarn web:build`, upload `dist-web/`). Password reset links open it, so it must be live before sign-ups are.
3. **Set up email delivery.** Supabase's built-in mailer only writes to project members, so real sign-ups and password resets never arrive without it. Re-run the setup script with the links and an SMTP provider:
   `PRIVACY_POLICY_URL=… SUPPORT_URL=… TERMS_URL=… WEB_URL=… SMTP_HOST=… SMTP_PORT=587 SMTP_USER=… SMTP_PASS=… SMTP_SENDER=support@yourdomain.com ./scripts/setup-supabase.sh`
   Then create an account from a real address and confirm the email arrives.
4. **Create the demo account** for reviewers: `DEMO_EMAIL=review@yourdomain.com DEMO_PASSWORD=… ./scripts/setup-supabase.sh`. Add a few notes and reminders to it.
5. **Run `yarn release:check`** and rebuild the apps so they embed the final `app.config.json`.
6. **Apple Developer Program** membership (paid) and **Google Play Console** account.
7. **Sign the Mac app.** The macOS target is sandboxed, so it needs a Mac provisioning profile: open `macos/Recall.xcworkspace`, sign in under Signing & Capabilities (team `78VKP3FU63`), or build once with `xcodebuild … -allowProvisioningUpdates`. Without a profile the Mac build fails with "has entitlements that require signing with a development certificate".
8. In Xcode, enable the **Time Sensitive Notifications** capability for the app id (the entitlement files are already wired) so alarm notifications keep their interruption level on iOS 25 and earlier.

## App Store Connect

- **App Privacy › Data types:** Contact Info › Email Address; User Content › Other User Content; Purchases › Purchase History (subscription status). Both: *App Functionality*, *Linked to the user*, *Not used for tracking*.
- **Privacy Policy URL / Support URL:** the pages from step 1.
- **Sign-in required:** Yes. Enter the demo account from step 2 under *App Review Information*.
- **Review notes:** "Recall is a notes and reminders app. Sign in with the demo account. An account is required because every note, reminder and subscription follows the user across iPhone, iPad, Mac, Android and the web — there is no device-only mode. Alarms ring through AlarmKit on iOS 26+. Account deletion: Settings › Delete Account."
- **Category:** Productivity. **Age rating:** 4+.
- **Screenshots:** iPhone 6.9" and 6.5", and iPad 13" (the app ships for iPhone and iPad, `TARGETED_DEVICE_FAMILY = "1,2"`, all four orientations). Mac: 1280×800 or larger.
- **Mac App Store:** the macOS app is sandboxed with outgoing network only; category is set in `Info.plist`.

## Google Play Console

- **Data safety:** Collects *Email address*, *Other in-app content* (notes) and *Purchase history* (subscription status, handled by Google Play). Purpose: *App functionality*, *Account management*. Encrypted in transit: Yes. Users can request deletion: Yes (in app, and via the support email). Not shared with third parties.
- **Account deletion URL** (required when the app has accounts): link to the "Delete your account" section of the support page.
- **App access:** provide the demo account.
- **Ads:** No. **Target audience:** 13+ (matching the privacy policy and the 4+ / "no objectionable content" App Store rating, which is about content, not the minimum age of the terms). **Content rating:** complete the questionnaire (no objectionable content).
- **Upload key:** create one with `keytool -genkeypair -v -keystore recall-upload.keystore -alias recall -keyalg RSA -keysize 2048 -validity 10000`, keep it out of git, and put `RECALL_UPLOAD_STORE_FILE`, `RECALL_UPLOAD_STORE_PASSWORD`, `RECALL_UPLOAD_KEY_ALIAS`, `RECALL_UPLOAD_KEY_PASSWORD` in `~/.gradle/gradle.properties`. Build with `cd android && ./gradlew bundleRelease` and upload `app/build/outputs/bundle/release/app-release.aab`. Enrol in Play App Signing.
- **Store listing:** 512 px icon at `assets/icon/play-store-512.png`, a 1024×500 feature graphic, and phone screenshots.
