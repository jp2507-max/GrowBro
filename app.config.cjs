/* eslint-env node */
/* global __dirname */
// Load .env only in local/dev; CI may set EXPO_NO_DOTENV=1
const dotenv = require('dotenv');
const path = require('path');

if (process.env.EXPO_NO_DOTENV !== '1') {
  const APP_ENV = process.env.APP_ENV ?? 'development';
  const envPath = path.resolve(__dirname, `.env.${APP_ENV}`);
  dotenv.config({ path: envPath });

  // Optionally load local overrides (never committed)
  const localEnvPath = path.resolve(__dirname, `.env.local`);
  dotenv.config({ path: localEnvPath, override: true });
}

// IMPORTANT: Do not import from '@env' here because the Expo config is evaluated
// directly by Node (no Babel module resolver / TS path mapping). Use the root
// env.js exports instead which are plain Node (CommonJS) modules.
// If loading the project's `env.js` fails (missing .env or zod validation),
// fall back to a minimal Env so tooling such as `expo doctor` can still read the config.

const applePrivacyManifest = require('./apple-privacy-manifest.json');

let Env;
try {
  Env = require('./env').Env;
} catch {
  // Fallback minimal Env. This mirrors the important fields used below and
  // avoids crashing when .env files are not present during doctor/CI runs.
  const packageJSON = require('./package.json');
  const APP_ENV = process.env.APP_ENV ?? 'development';
  const withEnvSuffix = (name) =>
    APP_ENV === 'production' ? name : `${name}.${APP_ENV}`;

  Env = {
    APP_ENV,
    NAME: process.env.NAME ?? 'GrowBro',
    SCHEME: process.env.SCHEME ?? 'growbro',
    BUNDLE_ID: withEnvSuffix(process.env.BUNDLE_ID ?? 'com.growbro'),
    PACKAGE: withEnvSuffix(process.env.PACKAGE ?? 'com.growbro'),
    VERSION: packageJSON.version,
    EXPO_ACCOUNT_OWNER: process.env.EXPO_ACCOUNT_OWNER ?? 'jan_100',
    EAS_PROJECT_ID:
      process.env.EAS_PROJECT_ID ?? '0ce1e1fc-7b61-4a2f-ae2b-790c097ced82',
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    ACCOUNT_DELETION_URL: process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL,
  };
}

const appIconBadgeConfig = {
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
function createExpoConfig(config) {
  const toList = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }
    return String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const codeSigningCertificate = Env.CODE_SIGNING_CERT_PATH;
  const codeSigningMetadata = codeSigningCertificate
    ? {
        keyId: Env.CODE_SIGNING_KEY_ID ?? 'growbro-main',
        algorithm: Env.CODE_SIGNING_ALG ?? 'rsa-v1_5-sha256',
      }
    : undefined;

  const pinningDomains = toList(Env.SECURITY_PIN_DOMAINS);
  const pinningHashes = toList(Env.SECURITY_PIN_HASHES);
  const ALLOWED_PUBLIC_KEYS = new Set([
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_ACCOUNT_DELETION_URL',
    'EXPO_PUBLIC_STRAINS_USE_PROXY',
    'EXPO_PUBLIC_FEATURE_STRAINS_ENABLED',
    'EXPO_PUBLIC_FEATURE_STRAINS_FAVORITES_SYNC',
    'EXPO_PUBLIC_FEATURE_STRAINS_OFFLINE_CACHE',
    // AI adjustments / calendar
    'EXPO_PUBLIC_FEATURE_AI_ADJUSTMENTS_ENABLED',
    'EXPO_PUBLIC_FEATURE_AI_ADJUSTMENTS_MIN_SKIPPED_TASKS',
    'EXPO_PUBLIC_FEATURE_AI_ADJUSTMENTS_MIN_CONFIDENCE',
    'EXPO_PUBLIC_ENABLE_SORTABLES_CALENDAR',
    // Sentry
    'EXPO_PUBLIC_SENTRY_DSN',
    'EXPO_PUBLIC_SENTRY_SEND_DEFAULT_PII',
    'EXPO_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE',
    'EXPO_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE',
    'EXPO_PUBLIC_SENTRY_ENABLE_REPLAY',
    'EXPO_PUBLIC_SENTRY_ORG',
    'EXPO_PUBLIC_SENTRY_PROJECT',
    // API + misc
    'EXPO_PUBLIC_API_URL',
    'EXPO_PUBLIC_VAR_NUMBER',
    'EXPO_PUBLIC_VAR_BOOL',
    // OAuth / Google
    'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
    'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
    // DSA / compliance - DSA_TRANSPARENCY_DB_API_KEY is intentionally public:
    // it's a publishable key for EU Commission Transparency Database submissions
    // (DSA Art. 24(5)) and does not grant sensitive access.
    'EXPO_PUBLIC_DSA_TRANSPARENCY_DB_URL',
    'EXPO_PUBLIC_DSA_TRANSPARENCY_DB_API_KEY',
    'EXPO_PUBLIC_LEGAL_ENTITY_ADDRESS',
    'EXPO_PUBLIC_DPO_EMAIL',
    'EXPO_PUBLIC_DPO_NAME',
    'EXPO_PUBLIC_EU_REPRESENTATIVE_ADDRESS',
    // PII / security - NOTE: PII_SCRUBBING_SALT is intentionally NOT exposed
    // to the client; it's server-only for HMAC pseudonymization in pii-scrubber.ts
    'EXPO_PUBLIC_PII_SALT_VERSION',
    'EXPO_PUBLIC_FEATURE_SECURITY_ENCRYPTION',
    'EXPO_PUBLIC_FEATURE_SECURITY_INTEGRITY_DETECTION',
    'EXPO_PUBLIC_FEATURE_SECURITY_ATTESTATION',
    'EXPO_PUBLIC_FEATURE_SECURITY_CERTIFICATE_PINNING',
    'EXPO_PUBLIC_FEATURE_SECURITY_BLOCK_ON_COMPROMISE',
    'EXPO_PUBLIC_FEATURE_SECURITY_THREAT_MONITORING',
    'EXPO_PUBLIC_FEATURE_SECURITY_SENTRY_SAMPLING_RATE',
    'EXPO_PUBLIC_FEATURE_SECURITY_VULNERABILITY_SCANNING',
    'EXPO_PUBLIC_FEATURE_SECURITY_AUTO_ISSUE_CREATION',
    'EXPO_PUBLIC_FEATURE_SECURITY_BYPASS_PINNING',
    'EXPO_PUBLIC_SECURITY_PIN_DOMAINS',
    'EXPO_PUBLIC_SECURITY_PIN_HASHES',
    // Reviewer creds (non-prod only)
    'EXPO_PUBLIC_APP_ACCESS_REVIEWER_EMAIL',
    'EXPO_PUBLIC_APP_ACCESS_REVIEWER_PASSWORD',
  ]);
  // Strains API credentials - only allow in non-production builds for local testing
  // SECURITY: Production builds always use proxy and never expose API keys
  if (process.env.APP_ENV !== 'production') {
    ALLOWED_PUBLIC_KEYS.add('EXPO_PUBLIC_STRAINS_API_KEY');
    ALLOWED_PUBLIC_KEYS.add('EXPO_PUBLIC_STRAINS_API_HOST');
    ALLOWED_PUBLIC_KEYS.add('EXPO_PUBLIC_STRAINS_API_URL');
  }
  const publicExtra = Object.fromEntries(
    Object.entries(process.env ?? {}).filter(
      ([key, value]) => ALLOWED_PUBLIC_KEYS.has(key) && value != null
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
    // JS/native bundles when performing OTA updates. Using the 'appVersion'
    // policy ties runtimeVersion to the native version we ship to stores so
    // every store submission automatically gets its own runtime.
    runtimeVersion: { policy: 'appVersion' },
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    updates: {
      fallbackToCacheTimeout: 0,
      ...(codeSigningCertificate
        ? {
            codeSigningCertificate,
            codeSigningMetadata,
          }
        : {}),
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      usesAppleSignIn: true,
      userInterfaceStyle: 'automatic',
      bundleIdentifier: Env.BUNDLE_ID,
      privacyManifests: applePrivacyManifest,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        UIBackgroundModes: ['fetch', 'processing'],
        // Required for expo-background-task BGTaskScheduler registration
        BGTaskSchedulerPermittedIdentifiers: [
          'com.expo.modules.backgroundtask.processing',
        ],
        // Enable iOS 26 liquid glass effect (false = use new design system)
        UIDesignRequiresCompatibility: false,
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
      userInterfaceStyle: 'automatic',
      package: Env.PACKAGE,
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: Env.SCHEME,
              host: '*',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
    },
    plugins: [
      // Fix CocoaPods CDN source issue on EAS builds
      './plugins/with-podfile-source.js',
      // Added from app.json (merged into this config)
      'expo-web-browser',
      'expo-secure-store',
      [
        'expo-local-authentication',
        {
          faceIDPermission: 'Allow $(PRODUCT_NAME) to use Face ID.',
        },
      ],
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
      'expo-system-ui',
      'expo-router',
      'expo-apple-authentication',
      // Google Sign-In: derive iosUrlScheme from GOOGLE_IOS_CLIENT_ID env var
      // The URL scheme is the reversed client ID: com.googleusercontent.apps.<client-id-prefix>
      ...(() => {
        const rawClientId = Env.GOOGLE_IOS_CLIENT_ID;
        if (!rawClientId) return [];

        // Validate and derive the iOS URL scheme from the client ID
        // Expected format: "<numeric-id>-<hash>.apps.googleusercontent.com"
        // Example: "123456789012-abc123def456.apps.googleusercontent.com"
        const expectedSuffix = '.apps.googleusercontent.com';
        const prefixPattern = /^\d+-[A-Za-z0-9_-]+$/;

        let clientIdPrefix;
        if (rawClientId.endsWith(expectedSuffix)) {
          // Correct format: extract the prefix
          clientIdPrefix = rawClientId.slice(0, -expectedSuffix.length);
          // Validate extracted prefix matches expected pattern: <numeric-id>-<hash>
          if (!prefixPattern.test(clientIdPrefix)) {
            throw new Error(
              `GOOGLE_IOS_CLIENT_ID has invalid prefix: "${clientIdPrefix}". ` +
                `Expected format: "<numeric-id>-<hash>.apps.googleusercontent.com" ` +
                `(e.g., "123456789012-abc123def456.apps.googleusercontent.com")`
            );
          }
        } else if (rawClientId.includes('.apps.googleusercontent.com')) {
          // Suffix exists but not at end - malformed
          throw new Error(
            `GOOGLE_IOS_CLIENT_ID is malformed: "${rawClientId}". ` +
              `Expected format: "<client-id>.apps.googleusercontent.com"`
          );
        } else if (prefixPattern.test(rawClientId)) {
          // Looks like just the prefix (e.g., "123456789012-abc123")
          // Accept it but warn in dev
          clientIdPrefix = rawClientId;
          if (process.env.APP_ENV !== 'production') {
            console.warn(
              `⚠️  GOOGLE_IOS_CLIENT_ID appears to be just the prefix. ` +
                `Full format should be: "${rawClientId}.apps.googleusercontent.com"`
            );
          }
        } else {
          // Completely invalid format
          throw new Error(
            `GOOGLE_IOS_CLIENT_ID has invalid format: "${rawClientId}". ` +
              `Expected: "<numeric-id>-<hash>.apps.googleusercontent.com" ` +
              `(e.g., "123456789012-abc123def456.apps.googleusercontent.com")`
          );
        }

        // Ensure safe scheme format by removing any invalid characters
        const sanitizedPrefix = clientIdPrefix.replace(/[^a-zA-Z0-9_-]/g, '');
        const iosUrlScheme = `com.googleusercontent.apps.${sanitizedPrefix}`;

        return [
          ['@react-native-google-signin/google-signin', { iosUrlScheme }],
        ];
      })(),
      [
        'expo-build-properties',
        {
          android: {
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            packagingOptions: {
              pickFirst: ['**/libc++_shared.so'],
            },
          },
          ios: {
            newArchEnabled: true,
            extraPods: [
              {
                name: 'simdjson',
                path: '../node_modules/@nozbe/simdjson',
                modular_headers: true,
              },
            ],
          },
        },
      ],
      ['app-icon-badge', appIconBadgeConfig],
      ['react-native-edge-to-edge'],
      [
        './plugins/with-security-pinning.js',
        {
          domains: pinningDomains,
          hashes: pinningHashes,
        },
      ],
      [
        'react-native-vision-camera',
        {
          enableFrameProcessors: true,
          cameraPermissionText: '$(PRODUCT_NAME) needs access to your camera.',
        },
      ],
      'onnxruntime-react-native',
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
      // Must run LAST to ensure UIBackgroundModes includes 'processing' after other plugins
      './plugins/with-background-task-config.js',
    ],
    extra: {
      // Expose only public vars; keep secrets out of the bundle.
      ...publicExtra,
      // Ensure client env is available at runtime (normalize in src/lib/env.js)
      ...(Env.SUPABASE_URL && {
        EXPO_PUBLIC_SUPABASE_URL: Env.SUPABASE_URL,
      }),
      ...(Env.SUPABASE_ANON_KEY && {
        EXPO_PUBLIC_SUPABASE_ANON_KEY: Env.SUPABASE_ANON_KEY,
      }),
      ...(Env.ACCOUNT_DELETION_URL && {
        EXPO_PUBLIC_ACCOUNT_DELETION_URL: Env.ACCOUNT_DELETION_URL,
      }),
      ...(Env.API_URL && { EXPO_PUBLIC_API_URL: Env.API_URL }),
      ...(Env.VAR_NUMBER !== undefined && {
        EXPO_PUBLIC_VAR_NUMBER: String(Env.VAR_NUMBER),
      }),
      ...(Env.VAR_BOOL !== undefined && {
        EXPO_PUBLIC_VAR_BOOL: String(Env.VAR_BOOL),
      }),
      // Strains - API credentials for dev fallback only (production always uses proxy)
      // SECURITY: API credentials are only exposed in non-production builds
      ...(Env.APP_ENV !== 'production' &&
        Env.STRAINS_API_URL && {
          EXPO_PUBLIC_STRAINS_API_URL: Env.STRAINS_API_URL,
        }),
      ...(Env.APP_ENV !== 'production' &&
        Env.STRAINS_API_KEY && {
          EXPO_PUBLIC_STRAINS_API_KEY: Env.STRAINS_API_KEY,
        }),
      ...(Env.APP_ENV !== 'production' &&
        Env.STRAINS_API_HOST && {
          EXPO_PUBLIC_STRAINS_API_HOST: Env.STRAINS_API_HOST,
        }),
      ...(Env.STRAINS_USE_PROXY !== undefined && {
        EXPO_PUBLIC_STRAINS_USE_PROXY: String(Env.STRAINS_USE_PROXY),
      }),
      ...(Env.FEATURE_STRAINS_ENABLED !== undefined && {
        EXPO_PUBLIC_FEATURE_STRAINS_ENABLED: String(
          Env.FEATURE_STRAINS_ENABLED
        ),
      }),
      ...(Env.FEATURE_STRAINS_FAVORITES_SYNC !== undefined && {
        EXPO_PUBLIC_FEATURE_STRAINS_FAVORITES_SYNC: String(
          Env.FEATURE_STRAINS_FAVORITES_SYNC
        ),
      }),
      ...(Env.FEATURE_STRAINS_OFFLINE_CACHE !== undefined && {
        EXPO_PUBLIC_FEATURE_STRAINS_OFFLINE_CACHE: String(
          Env.FEATURE_STRAINS_OFFLINE_CACHE
        ),
      }),
      // AI adjustments / calendar
      ...(Env.FEATURE_AI_ADJUSTMENTS_ENABLED !== undefined && {
        EXPO_PUBLIC_FEATURE_AI_ADJUSTMENTS_ENABLED: String(
          Env.FEATURE_AI_ADJUSTMENTS_ENABLED
        ),
      }),
      ...(Env.FEATURE_AI_ADJUSTMENTS_MIN_SKIPPED_TASKS !== undefined && {
        EXPO_PUBLIC_FEATURE_AI_ADJUSTMENTS_MIN_SKIPPED_TASKS: String(
          Env.FEATURE_AI_ADJUSTMENTS_MIN_SKIPPED_TASKS
        ),
      }),
      ...(Env.FEATURE_AI_ADJUSTMENTS_MIN_CONFIDENCE !== undefined && {
        EXPO_PUBLIC_FEATURE_AI_ADJUSTMENTS_MIN_CONFIDENCE: String(
          Env.FEATURE_AI_ADJUSTMENTS_MIN_CONFIDENCE
        ),
      }),
      ...(Env.ENABLE_SORTABLES_CALENDAR !== undefined && {
        EXPO_PUBLIC_ENABLE_SORTABLES_CALENDAR: String(
          Env.ENABLE_SORTABLES_CALENDAR
        ),
      }),
      // Google OAuth
      ...(Env.GOOGLE_WEB_CLIENT_ID && {
        EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: Env.GOOGLE_WEB_CLIENT_ID,
      }),
      ...(Env.GOOGLE_IOS_CLIENT_ID && {
        EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: Env.GOOGLE_IOS_CLIENT_ID,
      }),
      // Sentry
      ...(Env.SENTRY_DSN && { EXPO_PUBLIC_SENTRY_DSN: Env.SENTRY_DSN }),
      ...(Env.SENTRY_SEND_DEFAULT_PII !== undefined && {
        EXPO_PUBLIC_SENTRY_SEND_DEFAULT_PII: String(
          Env.SENTRY_SEND_DEFAULT_PII
        ),
      }),
      ...(Env.SENTRY_REPLAYS_SESSION_SAMPLE_RATE !== undefined && {
        EXPO_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE: String(
          Env.SENTRY_REPLAYS_SESSION_SAMPLE_RATE
        ),
      }),
      ...(Env.SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE !== undefined && {
        EXPO_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: String(
          Env.SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE
        ),
      }),
      ...(Env.SENTRY_ENABLE_REPLAY !== undefined && {
        EXPO_PUBLIC_SENTRY_ENABLE_REPLAY: String(Env.SENTRY_ENABLE_REPLAY),
      }),
      ...(Env.SENTRY_ORG && { EXPO_PUBLIC_SENTRY_ORG: Env.SENTRY_ORG }),
      ...(Env.SENTRY_PROJECT && {
        EXPO_PUBLIC_SENTRY_PROJECT: Env.SENTRY_PROJECT,
      }),
      // DSA / compliance
      ...(Env.DSA_TRANSPARENCY_DB_URL && {
        EXPO_PUBLIC_DSA_TRANSPARENCY_DB_URL: Env.DSA_TRANSPARENCY_DB_URL,
      }),
      ...(Env.DSA_TRANSPARENCY_DB_API_KEY && {
        EXPO_PUBLIC_DSA_TRANSPARENCY_DB_API_KEY:
          Env.DSA_TRANSPARENCY_DB_API_KEY,
      }),
      ...(Env.LEGAL_ENTITY_ADDRESS && {
        EXPO_PUBLIC_LEGAL_ENTITY_ADDRESS: Env.LEGAL_ENTITY_ADDRESS,
      }),
      ...(Env.DPO_EMAIL && { EXPO_PUBLIC_DPO_EMAIL: Env.DPO_EMAIL }),
      ...(Env.DPO_NAME && { EXPO_PUBLIC_DPO_NAME: Env.DPO_NAME }),
      ...(Env.EU_REPRESENTATIVE_ADDRESS && {
        EXPO_PUBLIC_EU_REPRESENTATIVE_ADDRESS: Env.EU_REPRESENTATIVE_ADDRESS,
      }),
      // PII / security - salt is server-only for HMAC pseudonymization
      ...(Env.PII_SALT_VERSION && {
        EXPO_PUBLIC_PII_SALT_VERSION: Env.PII_SALT_VERSION,
      }),
      ...(Env.FEATURE_SECURITY_ENCRYPTION !== undefined && {
        EXPO_PUBLIC_FEATURE_SECURITY_ENCRYPTION: String(
          Env.FEATURE_SECURITY_ENCRYPTION
        ),
      }),
      ...(Env.FEATURE_SECURITY_INTEGRITY_DETECTION !== undefined && {
        EXPO_PUBLIC_FEATURE_SECURITY_INTEGRITY_DETECTION: String(
          Env.FEATURE_SECURITY_INTEGRITY_DETECTION
        ),
      }),
      ...(Env.FEATURE_SECURITY_ATTESTATION !== undefined && {
        EXPO_PUBLIC_FEATURE_SECURITY_ATTESTATION: String(
          Env.FEATURE_SECURITY_ATTESTATION
        ),
      }),
      ...(Env.FEATURE_SECURITY_CERTIFICATE_PINNING !== undefined && {
        EXPO_PUBLIC_FEATURE_SECURITY_CERTIFICATE_PINNING: String(
          Env.FEATURE_SECURITY_CERTIFICATE_PINNING
        ),
      }),
      ...(Env.FEATURE_SECURITY_BLOCK_ON_COMPROMISE !== undefined && {
        EXPO_PUBLIC_FEATURE_SECURITY_BLOCK_ON_COMPROMISE: String(
          Env.FEATURE_SECURITY_BLOCK_ON_COMPROMISE
        ),
      }),
      ...(Env.FEATURE_SECURITY_THREAT_MONITORING !== undefined && {
        EXPO_PUBLIC_FEATURE_SECURITY_THREAT_MONITORING: String(
          Env.FEATURE_SECURITY_THREAT_MONITORING
        ),
      }),
      ...(Env.FEATURE_SECURITY_SENTRY_SAMPLING_RATE !== undefined && {
        EXPO_PUBLIC_FEATURE_SECURITY_SENTRY_SAMPLING_RATE: String(
          Env.FEATURE_SECURITY_SENTRY_SAMPLING_RATE
        ),
      }),
      ...(Env.FEATURE_SECURITY_VULNERABILITY_SCANNING !== undefined && {
        EXPO_PUBLIC_FEATURE_SECURITY_VULNERABILITY_SCANNING: String(
          Env.FEATURE_SECURITY_VULNERABILITY_SCANNING
        ),
      }),
      ...(Env.FEATURE_SECURITY_AUTO_ISSUE_CREATION !== undefined && {
        EXPO_PUBLIC_FEATURE_SECURITY_AUTO_ISSUE_CREATION: String(
          Env.FEATURE_SECURITY_AUTO_ISSUE_CREATION
        ),
      }),
      ...(Env.FEATURE_SECURITY_BYPASS_PINNING !== undefined && {
        EXPO_PUBLIC_FEATURE_SECURITY_BYPASS_PINNING: String(
          Env.FEATURE_SECURITY_BYPASS_PINNING
        ),
      }),
      ...(Env.SECURITY_PIN_DOMAINS && {
        EXPO_PUBLIC_SECURITY_PIN_DOMAINS: Env.SECURITY_PIN_DOMAINS,
      }),
      ...(Env.SECURITY_PIN_HASHES && {
        EXPO_PUBLIC_SECURITY_PIN_HASHES: Env.SECURITY_PIN_HASHES,
      }),
      // App scheme for OAuth redirects
      SCHEME: Env.SCHEME,
      // App Access Reviewer Credentials for Play Store compliance
      // Only expose in non-production builds to prevent secrets in production bundles
      ...(Env.APP_ENV !== 'production' && {
        EXPO_PUBLIC_APP_ACCESS_REVIEWER_EMAIL: Env.APP_ACCESS_REVIEWER_EMAIL,
        EXPO_PUBLIC_APP_ACCESS_REVIEWER_PASSWORD:
          Env.APP_ACCESS_REVIEWER_PASSWORD,
      }),
      eas: {
        projectId: Env.EAS_PROJECT_ID,
      },
    },
  };
}

module.exports = ({ config }) => createExpoConfig(config);
