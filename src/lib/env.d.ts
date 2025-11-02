declare module '@env' {
  // NOTE: Types only — runtime implementation comes from `src/lib/env.js`.

  export type AppEnv = 'development' | 'staging' | 'production';

  export type ClientEnv = {
    // App environment
    APP_ENV: AppEnv;

    // App identity
    NAME: string;
    SCHEME: string;
    BUNDLE_ID: string;
    PACKAGE: string;
    VERSION: string;

    // API
    API_URL: string;
    EXPO_PUBLIC_API_BASE_URL?: string;

    // Strains API
    STRAINS_API_URL: string;
    STRAINS_API_KEY: string;
    STRAINS_API_HOST: string;
    STRAINS_USE_PROXY?: string;

    // Feature Flags
    FEATURE_STRAINS_ENABLED?: boolean;
    FEATURE_STRAINS_FAVORITES_SYNC?: boolean;
    FEATURE_STRAINS_OFFLINE_CACHE?: boolean;
    FEATURE_AI_ADJUSTMENTS_ENABLED?: boolean;
    FEATURE_AI_ADJUSTMENTS_MIN_SKIPPED_TASKS?: number;
    FEATURE_AI_ADJUSTMENTS_MIN_CONFIDENCE?: number;

    // Misc
    VAR_NUMBER: number;
    VAR_BOOL: boolean;

    // Supabase
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;

    // Google OAuth
    GOOGLE_WEB_CLIENT_ID: string;
    GOOGLE_IOS_CLIENT_ID?: string;

    // Optional public URL for self-serve deletion portal
    ACCOUNT_DELETION_URL?: string;

    // App Access (compliance)
    EXPO_PUBLIC_APP_ACCESS_REVIEWER_EMAIL?: string;
    EXPO_PUBLIC_APP_ACCESS_REVIEWER_PASSWORD?: string;

    // Sentry (client)
    SENTRY_DSN?: string;
    SENTRY_SEND_DEFAULT_PII?: boolean;
    SENTRY_REPLAYS_SESSION_SAMPLE_RATE?: number;
    SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE?: number;
    SENTRY_ENABLE_REPLAY?: boolean;

    // DSA Transparency Database
    DSA_TRANSPARENCY_DB_URL?: string;
    DSA_TRANSPARENCY_DB_API_KEY?: string;

    // PII Scrubbing
    PII_SCRUBBING_SALT?: string;
    PII_SALT_VERSION?: string;

    // Email Hashing
    EMAIL_HASH_SALT?: string;
  };

  // The module exports a single named object `Env` with the above shape.
  export const Env: ClientEnv;
}
