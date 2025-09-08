// Load environment variables before any Env usage (Option A)
// This ensures process.env is populated for zod validation in ./env during prebuild
import 'dotenv/config';

import { Env as ClientEnv } from '@env';
import type { ConfigContext, ExpoConfig } from '@expo/config';
import type { AppIconBadgeConfig } from 'app-icon-badge/types';

import applePrivacyManifest from './apple-privacy-manifest.json';
import { Env } from './env';

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
function createExpoConfig(config: Partial<ExpoConfig>): ExpoConfig {
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
      ...ClientEnv,
      eas: {
        projectId: Env.EAS_PROJECT_ID,
      },
    },
  };
}

export default ({ config }: ConfigContext): ExpoConfig =>
  createExpoConfig(config);
