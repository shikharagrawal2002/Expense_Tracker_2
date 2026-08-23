# Personal Finance & Expense Tracker — Ledger

Phase 1 (architecture) + Phase 2 (dashboard shell) + Phase 3 (E2E Encryption + Android App)
of an incrementally-built finance tracker. See `ARCHITECTURE.md` for the full design doc.

## What's implemented

- Vite + React + TypeScript + Tailwind v4 project scaffold, path-aliased (`@/*`)
- Design tokens (light/dark, class-based theme switching, system-theme aware)
- App shell: Sidebar, Topbar, MobileNav / bottom-sheet "More" — fully responsive
- Dashboard: KPI row, cashflow chart (Recharts), budget ring, upcoming bills,
  recent activity, AI insights panel
- Full routes + pages: Transactions, Accounts, Categories, Credit Cards, Budgets,
  Goals, Subscriptions, Bills, Investments, Debts, Splits, SMS Tracking, Imports,
  Reports, Settings (profile / data / automation)
- Supabase client + full Postgres schema + RLS policies in `supabase/migrations/`
- **Phase 3: End-to-end encryption (lib/crypto)**
  - AES-256-GCM field-level encryption via Web Crypto
  - PBKDF2 (210k iterations) KEK derivation + wrapped 32-byte DEK vault
    (`encryption_keys` table, migration `0022_e2e_encryption.sql`)
  - Account names / balances / credit limits / transaction amounts / notes /
    locations are encrypted client-side before hitting Supabase
  - App-lock screen (PIN + biometric) gates access after session restore
  - Recovery-phrase export + security-PIN rotation in Settings → Encryption
- **Android app (Capacitor hybrid)**
  - `capacitor.config.ts` — appId `com.ledger.finance`, webDir `dist`
  - Native Android project in `android/` + companion SMS forwarder in
    `android/SmsForwarder/` with **Android Keystore AES-GCM** secret storage
    (`SecretStore.kt`)
  - **Native plugins wired in:**
    - `@aparajita/capacitor-biometric-auth` — native BiometricPrompt app-lock
      (`src/lib/native/biometric.ts`); WebAuthn fallback on web
    - `@capacitor/preferences` + DEK encryption — secure local storage for
      tokens/API keys (`src/lib/native/secure-storage.ts`)
    - `@capacitor/camera` — receipt capture for transactions
      (`src/features/transactions/receipt-capture.tsx`)

## Run it

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project URL + anon key
npm run dev
```

## Deploy the database

```bash
supabase link --project-ref <your-project-ref>
supabase db push            # applies migrations incl. 0022 encryption vault
supabase functions deploy ingest-sms --no-verify-jwt
```

## Build the Android APK

```bash
npm run build                      # builds dist/
npx cap sync android               # copies web build + registers plugins
npx cap open android               # opens Android Studio → Build → Build APK(s)
```

The native `android/` folder contains:
- `app/` — the Capacitor-wrapped Ledger app (com.ledger.finance)
- `SmsForwarder/` — the companion SMS forwarder app (com.ledger.smsforwarder)
  which stores its API key / server URL in Android Keystore-backed AES-GCM.

## Next steps (in order)

1. Wire the remaining feature APIs (budgets/goals/subscriptions/bills) to the
   `encryptedSelect` / `encryptInsert` adapter for per-field E2E.
2. Optional offline cache with SQLite + encrypted-at-rest.
3. Push notifications (FCM) + home-screen widgets.