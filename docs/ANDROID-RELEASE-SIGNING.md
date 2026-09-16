# Android release signing

Create and retain the TaraVerse upload keystore outside this repository. Do not
commit the keystore or its passwords.

For local builds or CI, provide these Gradle properties or environment
variables:

- `TARAVERSE_RELEASE_STORE_FILE`
- `TARAVERSE_RELEASE_STORE_PASSWORD`
- `TARAVERSE_RELEASE_KEY_ALIAS`
- `TARAVERSE_RELEASE_KEY_PASSWORD`

Build a release artifact with `flutter build appbundle --release`. The build
fails before signing if any required value is absent. Verify the resulting
artifact with `apksigner verify --print-certs` for APKs, or upload the AAB to
the Play Console and verify its upload certificate there. Configure Play App
Signing with the same upload-key lineage.
