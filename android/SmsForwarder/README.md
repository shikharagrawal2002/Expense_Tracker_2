# Ledger SMS Forwarder (Android)

A simple Android app that listens for incoming SMS messages, filters for bank/UPI transaction alerts, and forwards them to your Ledger expense tracker's Supabase Edge Function.

## How it works

1. The app registers a `BroadcastReceiver` for `SMS_RECEIVED` intents
2. When a bank/UPI SMS arrives (e.g., "Rs 500 debited from HDFC..."), it forwards the raw text to your Supabase `ingest-sms` Edge Function
3. The Edge Function parses the SMS (amount, merchant, debit/credit) and stores it in the `sms_transactions` table
4. You review and confirm the parsed SMS in the Ledger web app (SMS Tracking page)

## Build the APK

### Prerequisites
- [Android Studio](https://developer.android.com/studio) (latest stable)
- Android SDK 34+

### Steps
1. Open Android Studio
2. Click **Open** and select the `android/SmsForwarder` folder
3. Wait for Gradle sync to complete
4. Go to **Build → Build Bundle(s) / APK(s) → Build APK(s)**
5. The APK will be at `app/build/outputs/apk/debug/app-debug.apk`
6. Transfer the APK to your phone and install it (enable "Install unknown apps" for your file manager)

## Setup on your phone

1. Open the **Ledger SMS** app
2. Tap **Grant SMS Permission** and allow both SMS permissions
3. Tap **Open Settings** and enter:
   - **Server URL**: `https://your-project.supabase.co/functions/v1/ingest-sms`
   - **API Key**: Generate one in the Ledger web app under **SMS Tracking → Generate API key**
4. The app will now automatically forward bank/UPI SMS to your Ledger

## Backend Setup (REQUIRED)

**You MUST use the Supabase CLI** to apply the migration. The Dashboard SQL Editor cannot run the PL/pgSQL functions.

```bash
# Install the CLI
npm install -g supabase

# Login and link to your project
supabase login
supabase link --project-id YOUR_PROJECT_ID

# Apply migration and deploy function
supabase db push
supabase functions deploy ingest-sms --no-verify-jwt
```

## Privacy

- The app only reads SMS broadcasts — it does NOT become your default SMS app
- Only SMS messages containing bank/UPI keywords (debited, credited, UPI, etc.) are forwarded
- Raw SMS text is stored in your Supabase database for review
- You can disable forwarding at any time by uninstalling the app or revoking SMS permission