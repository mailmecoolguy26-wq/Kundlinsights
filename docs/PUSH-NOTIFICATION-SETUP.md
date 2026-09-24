# TaraVerse push notification setup

Push campaigns are disabled by default. This document prepares manual delivery validation only.

## Android Firebase

1. Create or select the Firebase project.
2. Add the Android application using TaraVerse's existing package identifier.
3. Download `google-services.json` and place it at `mobile/android/app/google-services.json` locally or through secure CI provisioning. Do not commit it.
4. Apply the standard Google Services Gradle plugin configuration required by the selected Firebase Flutter packages.
5. Test on an Android 13+ physical device and grant the notification permission from the contextual prompt.

## iOS — pending Apple Developer Program / APNs setup

The Flutter Firebase Messaging integration is present, but remote iOS delivery is pending:

1. Add the iOS Firebase application using the existing bundle identifier and place `GoogleService-Info.plist` in Runner without committing it.
2. Enable Push Notifications and Background Modes / Remote notifications in Apple Developer and Xcode.
3. Create an APNs authentication key and upload its Key ID and Team ID to Firebase.
4. Validate foreground, background and terminated notification taps on a physical device.

## Backend Firebase Admin

Provide Firebase Admin credentials only through deployment secrets or workload identity. The optional `FIREBASE_SERVICE_ACCOUNT_JSON` environment value is parsed only at provider construction; absent or invalid configuration makes the provider unavailable. Never log or commit the credential JSON.

## Validation boundaries

No Career timing notification is defined or enabled. No campaign may be enabled until physical-device delivery, account switching, logout revocation, preferences, and destination authorization are validated.

## Local development test

There is no public test-send endpoint. With Firebase Admin credentials configured locally, use `DEV_PUSH_USER_ID`, `DEV_PUSH_TOKEN`, `DEV_PUSH_TYPE`, and `DEV_PUSH_DESTINATION`, then run `npm run dev:test-push`. The script rejects `CAREER_TIMING_SIGNAL`, accepts only declared notification/destination enums, and emits only neutral fixed copy.
