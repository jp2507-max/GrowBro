# iOS Privacy Manifest

This app declares an Apple Privacy Manifest and Required-Reason API usage per App Store requirements.

- Manifest source: `apple-privacy-manifest.json`
- Wired via `ios.privacyManifests` in `app.config.ts`
- Validation: `pnpm run privacy:validate`
- Snapshot for dependency changes: `docs/privacy-manifest-deps.json` (update via `pnpm run privacy:snapshot`)

Required-Reason API categories currently declared:

- `NSPrivacyAccessedAPICategoryUserDefaults` → `CA92.1`
- `NSPrivacyAccessedAPICategorySystemBootTime` → `35F9.1`
- `NSPrivacyAccessedAPICategoryFileTimestamp` → `C617.1`

If adding SDKs that access additional restricted APIs, update `apple-privacy-manifest.json` accordingly and regenerate the dependency snapshot.
