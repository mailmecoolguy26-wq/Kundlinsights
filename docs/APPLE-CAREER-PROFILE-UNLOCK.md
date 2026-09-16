# Apple Career Profile Unlock

New TaraVerse Apple Career purchases use a configured consumable StoreKit IAP,
not the legacy annual subscription. The verified transaction is bound to the
selected birth profile by the backend and creates exactly one profile
entitlement. Consumables are intentionally not restored through StoreKit;
access is restored from TaraVerse's backend profile-entitlement record.

Required production configuration names:

- `APPLE_BUNDLE_ID`
- `APPLE_APP_ID`
- `APPLE_ROOT_CERTIFICATE_PATHS`
- `APPLE_CAREER_PROFILE_UNLOCK_PRODUCT_ID` (mandatory whenever Apple purchasing is enabled)

`APPLE_CAREER_PREMIUM_ANNUAL_PRODUCT_ID` remains optional and compatibility
only. It cannot by itself enable Apple purchasing in production, and its legacy
subscription notifications do not create profile unlocks.
Apple root certificates are public trust material supplied as deployment files;
no Apple private keys are read by this verifier.
