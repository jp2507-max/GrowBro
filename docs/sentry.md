Sentry integration and release configuration

Overview

This project uses @sentry/react-native with the Expo plugin (@sentry/react-native/expo) to capture crashes and performance data.

Required environment variables in CI/Build

- SENTRY_ENV - e.g. `production`, `staging`, `development`. This maps to Sentry "environment" and helps group events by deployment environment.
- SENTRY_RELEASE - the release identifier (recommended: the app version or a CI build id). Example: `1.2.3` or `app@1.2.3+123-abc1234`.

How this repo uses them

- The app reads `process.env.SENTRY_ENV` and `process.env.SENTRY_RELEASE` at runtime and passes them into `Sentry.init` as `environment` and `release`. If those aren't set, the app falls back to `Env.APP_ENV` and `Env.VERSION`.

Expo / EAS notes

- For EAS builds, pass `SENTRY_ENV` and `SENTRY_RELEASE` when invoking `eas build` or set them in your EAS/EAS.json profile.
- Example scripts were added to `package.json`:
  - `pnpm run build:production:android:sentry`
  - `pnpm run build:production:ios:sentry`

Source maps / symbol upload (important)

- Ensure the Expo Sentry plugin or an explicit upload step is used to upload JavaScript source maps and native symbols (dSYMs for iOS, ProGuard/R8 mappings for Android).
- If you use the `@sentry/react-native/expo` plugin (already included in `app.config.ts`), configure the plugin in your EAS build pipeline to upload artifacts. See Sentry's Expo docs for details.

Gradle / Xcode (bare/Managed builds)

- Android: ensure `sentry-cli`/Gradle plugin runs during the release build to upload ProGuard mappings.
- iOS: ensure dSYM upload is configured either in the build pipeline or via Sentry's fastlane plugin.

References

- https://docs.sentry.io/platforms/react-native/
- https://docs.sentry.io/platforms/react-native/guides/expo/
