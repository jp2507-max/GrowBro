// Load .env only in local/dev; CI may set EXPO_NO_DOTENV=1
import type { AppIconBadgeConfig } from 'app-icon-badge/types';
import { config } from 'dotenv';
// IMPORTANT: Do not import from '@env' here because the Expo config is evaluated
// directly by Node (no Babel module resolver / TS path mapping). Use the root
// env.js exports instead which are plain Node (CommonJS) modules.
// Use Node's createRequire so we can load the CommonJS file safely when
// this TS/ES module is evaluated by Node. If loading the project's `env.js`
// fails (missing .env or zod validation), fall back to a minimal Env so
// tooling such as `expo doctor` can still read the config.
import { createRequire } from 'module';

import applePrivacyManifest from './apple-privacy-manifest.json';
const require = createRequire(import.meta.url);

let Env: any;
try {
  Env = require('./env').Env;
} catch {
  // Fallback minimal Env. This mirrors the important fields used below and
  // avoids crashing when .env files are not present during doctor/CI runs.
  const packageJSON = require('./package.json');
  const APP_ENV = process.env.APP_ENV ?? 'development';
  const withEnvSuffix = (name: string) =>
    APP_ENV === 'production' ? name : `${name}.${APP_ENV}`;

  Env = {
    APP_ENV,
    NAME: process.env.NAME ?? 'GrowBro',
    SCHEME: process.env.SCHEME ?? 'GrowBro',
    BUNDLE_ID: withEnvSuffix(process.env.BUNDLE_ID ?? 'com.growbro'),
    PACKAGE: withEnvSuffix(process.env.PACKAGE ?? 'com.growbro'),
    VERSION: packageJSON.version,
    EXPO_ACCOUNT_OWNER: process.env.EXPO_ACCOUNT_OWNER ?? 'jan_100',
    EAS_PROJECT_ID:
      process.env.EAS_PROJECT_ID ?? '0ce1e1fc-7b61-4a2f-ae2b-790c097ced82',
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    ACCOUNT_DELETION_URL:
      process.env.ACCOUNT_DELETION_URL || 'https://growbro.app/delete-account',
  } as const;
}

if (process.env.EXPO_NO_DOTENV !== '1') {
  config();
}

const appIconBadgeConfig: AppIconBadgeConfig = {
  enabled: Env.APP_ENV !== 'production',
  badges: [
    {
      text: Env.APP_ENV,
      type: 'banner',
      color: 'white',
    },
    {
      text: Env.VERSION.toString(),
      type: 'ribbon',
      color: 'white',
    },
  ],
};

// eslint-disable-next-line max-lines-per-function
function createExpoConfig(config: any): any {
  const publicExtra = Object.fromEntries(
    Object.entries(process.env ?? {}).filter(
      ([key, value]) => key.startsWith('EXPO_PUBLIC_') && value != null
    )
  );
  return {
    ...config,
    name: Env.NAME,
    description: `${Env.NAME} Mobile App`,
    owner: Env.EXPO_ACCOUNT_OWNER,
    scheme: Env.SCHEME,
    slug: 'growbro',
    version: Env.VERSION.toString(),
    // Ensure runtimeVersion is set to a stable policy to prevent mismatched
    // JS/native bundles when performing OTA updates. Using the 'sdkVersion'
    // policy ties runtimeVersion to the Expo SDK and is a safe default.
    runtimeVersion: { policy: 'sdkVersion' },
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    updates: {
      fallbackToCacheTimeout: 0,
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: Env.BUNDLE_ID,
      privacyManifests: applePrivacyManifest,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    experiments: {
      typedRoutes: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#2E3C4B',
      },
      package: Env.PACKAGE,
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
    },
    plugins: [
      [
        'expo-splash-screen',
        {
          backgroundColor: '#2E3C4B',
          image: './assets/splash-icon.png',
          imageWidth: 150,
        },
      ],
      [
        'expo-font',
        {
          fonts: ['./assets/fonts/Inter.ttf'],
        },
      ],
      'expo-localization',
      'expo-router',
      [
        'expo-build-properties',
        {
          android: {
            compileSdkVersion: 35,
            targetSdkVersion: 35,
          },
        },
      ],
      ['app-icon-badge', appIconBadgeConfig],
      ['react-native-edge-to-edge'],
      [
        '@sentry/react-native/expo',
        {
          url: 'https://sentry.io/',
          project: process.env.SENTRY_PROJECT || 'growbro',
          organization: process.env.SENTRY_ORG || 'canabro',
        },
      ],
      // Background tasks (BGTaskScheduler on iOS, WorkManager on Android)
      'expo-background-task',
      // WatermelonDB config plugin to enable JSI adapter in Expo managed workflow
      '@morrowdigital/watermelondb-expo-plugin',
    ],
    extra: {
      // Expose only public vars; keep secrets out of the bundle.
      ...publicExtra,
      // Ensure client env is available at runtime (normalize in src/lib/env.js)
      EXPO_PUBLIC_SUPABASE_URL: Env.SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: Env.SUPABASE_ANON_KEY,
      EXPO_PUBLIC_ACCOUNT_DELETION_URL: Env.ACCOUNT_DELETION_URL,
      eas: {
        projectId: Env.EAS_PROJECT_ID,
      },
    },
  };
}

export default ({ config }: any): any => createExpoConfig(config);
