# Ledger SMS Forwarder (Android)

A simple Android app that listens for incoming SMS messages, filters for bank/UPI transaction alerts, and forwards them to your Ledger expense tracker's Supabase Edge Function.

## How it works

1. The app registers a BroadcastReceiver for SMS_RECEIVED intents
2. When a bank/UPI SMS arrives, it forwards the raw text to your Supabase ingest-sms Edge Function
3. The Edge Function parses the SMS and stores it in the sms_transactions table
4. You review and confirm the parsed SMS in the Ledger web app (SMS Tracking page)

## Security

- Android Keystore-backed AES-GCM (SecretStore.kt) encrypts the API key and server URL before they touch disk. The 256-bit key never leaves the hardware-backed Keystore.
- OTP / one-time password / verification code messages are always skipped.
- Only SMS containing both a monetary value AND a transaction keyword are forwarded.

## Build the APK

### Prerequisites
- Android Studio (latest stable)
- Android SDK 34+

### Steps
1. Open Android Studio
2. Click Open and select the android/SmsForwarder folder
3. Wait for Gradle sync to complete
4. Go to Build - Build Bundle(s) / APK(s) - Build APK(s)
5. The APK will be at app/build/outputs/apk/debug/app-debug.apk
6. Transfer the APK to your phone and install it

## Setup on your phone

1. Open the Ledger SMS app
2. Tap Grant SMS Permission and allow both SMS permissions
3. Tap Open Settings and enter:
   - Server URL: https://your-project.supabase.co/functions/v1/ingest-sms
   - API Key: Generate one in the Ledger web app under SMS Tracking - Generate API key
4. The app will now automatically forward bank/UPI SMS to your Ledger

## Backend Setup (REQUIRED)

You MUST use the Supabase CLI to apply the migration.

```bash
npm install -g supabase
supabase login
supabase link --project-id YOUR_PROJECT_ID
supabase db push
supabase functions deploy ingest-sms --no-verify-jwt