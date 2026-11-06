# Velocity phone app

Expo (React Native) app for iPhone and Android. Same accounts and data as velocityathletes.com.
Kept apart from the website: own packages, own checks; the website's build ignores this folder.

## Run it on your phone
1. `cd mobile && npm install`
2. Copy `.env.example` to `.env.local` and fill in the public Supabase key (same value as the website's `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
3. `npx expo start`, then scan the QR code with the Expo Go app.

## Open the latest version (no computer needed)
Every change to `mobile/` on main or a `mobile-…` branch is published to Expo (channel `preview`) by the
`mobile-preview` GitHub step. Scan this QR code with the iPhone camera and it opens in Expo Go:
https://qr.expo.dev/eas-update?projectId=3a01a5d1-31c6-4f50-8cee-70b2ee78164c&runtimeVersion=exposdk:58.0.0&channel=preview

## Checks
`npm run typecheck`

## Shared maths
The app reads the website's plain logic from `../src/lib` as `@shared/...` (dates, units, plan weeks).
It never edits those files; they change only in a website pull request.
