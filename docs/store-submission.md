# Store submission checklist

What the code already covers, and what you fill in on App Store Connect and Google Play Console.

## Built into the app

| Requirement | Where |
| --- | --- |
| In-app account creation | Sign-in screen › "Create an account" |
| In-app account deletion (App Store 5.1.1(v), Play account deletion policy) | Settings › Delete Account (`delete_account()` in `supabase/migrations/20260921010000_delete_account.sql`) |
| Privacy policy link in the app | Settings › About, sign-up screen (`privacyPolicyUrl` in `app.config.json`) |
| Permissions asked in context | Notifications: when the first reminder is created. Alarms/exact alarms: when a reminder is set to Alarm, or from Settings |
| Purpose strings | `NSAlarmKitUsageDescription` (iOS). Android runtime permissions are requested with an in-app explanation in Settings |
| Privacy manifest | `ios/Recall/PrivacyInfo.xcprivacy`, `macos/PrivacyInfo.xcprivacy` (email + user content, app functionality, no tracking) |
| Export compliance | `ITSAppUsesNonExemptEncryption = NO` (HTTPS only) |
| App icons | `scripts/generate-icons.py` → iOS, macOS, Android adaptive + Play 512 px |
| Launch screen without branding text | `ios/Recall/LaunchScreen.storyboard` |
| Accessibility | 44 pt touch targets, WCAG AA text contrast in light and dark, VoiceOver/TalkBack labels, Dynamic Type |
| Android target SDK | 36 (Play requires 35+) |
| Exact alarms | `SCHEDULE_EXACT_ALARM` (user-granted). `USE_EXACT_ALARM` and full-screen intents are not used, so no Play declaration is needed |

## Subscriptions (free trial + Premium)

Recall uses the stores' own billing: StoreKit on iPhone and Mac, Google Play Billing on Android. Customers pay with whatever their store account uses (including Apple Pay and Google Pay). Nothing else is needed on your side, and the web app sells nothing.

- **Free:** unlimited notes, up to 10 active reminders, notification alerts. **Premium:** unlimited reminders, ringing alarms, repeating reminders, folders.
- **App Store Connect:** accept the Paid Apps agreement and add banking/tax. Create a subscription group "Recall Premium" with two auto-renewable subscriptions, `recall_premium_monthly` and `recall_premium_yearly`. Give each an introductory offer: *Free*, 2 weeks, new subscribers. Add the review screenshot of the paywall. Put both subscriptions on the same app record for iPhone and Mac (Universal Purchase shares the bundle id `com.bassamsalah.recall`).
- **Play Console:** set up a payments profile. Create two subscriptions `recall_premium_monthly` and `recall_premium_yearly`, each with a base plan (monthly / yearly auto-renewing) and an offer with a 14-day free-trial phase for new customers. Products only load once the app is installed from a Play test track (internal testing is enough).
- **Testing:** on the iOS simulator, run from Xcode; the scheme uses `ios/Recall/Recall.storekit`. On Android, add yourself as a license tester in Play Console.
- **Cross-platform:** after a purchase the app records Premium on the account (`entitlements` table). Your other devices and the web app unlock from that record. Apple guideline 3.1.3(b) allows this because every app also offers the subscription.
- **Paywall disclosures (3.1.2):** price and period, trial length, auto-renewal terms, Restore Purchases, Terms of Use (Apple's standard EULA unless you set `termsUrl`) and Privacy Policy.

## Before you submit

1. **Host the privacy policy and support pages.** Publish `docs/privacy-policy.md` and `docs/support.md` (GitHub Pages works), replace `YOUR_CONTACT_EMAIL`, then run the setup script with `PRIVACY_POLICY_URL=… SUPPORT_URL=…` so the app links to them.
2. **Create the demo account** for reviewers: `DEMO_EMAIL=review@yourdomain.com DEMO_PASSWORD=… ./scripts/setup-supabase.sh`. Add a few notes and reminders to it.
3. **Apple Developer Program** membership (paid) and **Google Play Console** account.

## App Store Connect

- **App Privacy › Data types:** Contact Info › Email Address; User Content › Other User Content; Purchases › Purchase History (subscription status). Both: *App Functionality*, *Linked to the user*, *Not used for tracking*.
- **Privacy Policy URL / Support URL:** the pages from step 1.
- **Sign-in required:** Yes. Enter the demo account from step 2 under *App Review Information*.
- **Review notes:** "Recall is a notes and reminders app. Sign in with the demo account. Alarms ring through AlarmKit on iOS 26+. Account deletion: Settings › Delete Account."
- **Category:** Productivity. **Age rating:** 4+.
- **Screenshots:** iPhone 6.9" and 6.5", iPad not required (iPhone-only). Mac: 1280×800 or larger.
- **Mac App Store:** the macOS app is sandboxed with outgoing network only; category is set in `Info.plist`.

## Google Play Console

- **Data safety:** Collects *Email address*, *Other in-app content* (notes) and *Purchase history* (subscription status, handled by Google Play). Purpose: *App functionality*, *Account management*. Encrypted in transit: Yes. Users can request deletion: Yes (in app, and via the support email). Not shared with third parties.
- **Account deletion URL** (required when the app has accounts): link to the "Delete your account" section of the support page.
- **App access:** provide the demo account.
- **Ads:** No. **Target audience:** 13+. **Content rating:** complete the questionnaire (no objectionable content).
- **Upload key:** create one with `keytool -genkeypair -v -keystore recall-upload.keystore -alias recall -keyalg RSA -keysize 2048 -validity 10000`, keep it out of git, and put `RECALL_UPLOAD_STORE_FILE`, `RECALL_UPLOAD_STORE_PASSWORD`, `RECALL_UPLOAD_KEY_ALIAS`, `RECALL_UPLOAD_KEY_PASSWORD` in `~/.gradle/gradle.properties`. Build with `cd android && ./gradlew bundleRelease` and upload `app/build/outputs/bundle/release/app-release.aab`. Enrol in Play App Signing.
- **Store listing:** 512 px icon at `assets/icon/play-store-512.png`, a 1024×500 feature graphic, and phone screenshots.
