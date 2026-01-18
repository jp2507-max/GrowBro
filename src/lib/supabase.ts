import 'react-native-url-polyfill/auto';

// Import a client-safe env export. We assume the client-only env lives in `src/lib/env.js`
// and is reachable via the project's absolute import aliases. This avoids pulling any
// build-time/server secrets into the client bundle. If your project uses a different
// convention (for example `@env/client`), adjust this import accordingly and ensure
// your bundler alias for `@env` resolves to the client-only export.
import { Env } from '@env';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { AppState } from 'react-native';

import { mmkvAuthStorage } from './auth/auth-storage';

// Determine if we're running in a test environment
const isTestEnvironment =
  typeof process !== 'undefined' &&
  process.env &&
  (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined);

type GlobalWithSupabaseAppState = typeof globalThis & {
  __gbSupabaseAppStateSubscription?: ReturnType<
    typeof AppState.addEventListener
  >;
};

const globalWithSupabaseAppState = globalThis as GlobalWithSupabaseAppState;

// Validate environment variables and set up Supabase configuration
export let supabaseUrl: string;
export let supabaseAnonKey: string;

const runtimeEnv =
  typeof process !== 'undefined' && process.env
    ? process.env
    : ({} as NodeJS.ProcessEnv);

const expoExtra =
  (Constants.expoConfig?.extra as Record<string, unknown> | undefined) ??
  (Constants.manifest2?.extra as Record<string, unknown> | undefined) ??
  {};

const pickFirstString = (...candidates: unknown[]): string | undefined => {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }
  return undefined;
};

if (isTestEnvironment) {
  // Use dummy values for tests
  supabaseUrl = 'http://localhost';
  supabaseAnonKey = 'test-key';
} else {
  // In production/staging/development, require real environment variables
  const resolvedSupabaseUrl = pickFirstString(
    Env?.SUPABASE_URL,
    Env?.EXPO_PUBLIC_SUPABASE_URL,
    expoExtra?.SUPABASE_URL,
    expoExtra?.EXPO_PUBLIC_SUPABASE_URL,
    runtimeEnv?.EXPO_PUBLIC_SUPABASE_URL,
    runtimeEnv?.SUPABASE_URL
  );

  const resolvedSupabaseAnonKey = pickFirstString(
    Env?.SUPABASE_ANON_KEY,
    Env?.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    expoExtra?.SUPABASE_ANON_KEY,
    expoExtra?.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    runtimeEnv?.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    runtimeEnv?.SUPABASE_ANON_KEY
  );

  if (!resolvedSupabaseUrl) {
    throw new Error('Missing required environment variable: SUPABASE_URL');
  }
  if (!resolvedSupabaseAnonKey) {
    throw new Error('Missing required environment variable: SUPABASE_ANON_KEY');
  }
  supabaseUrl = resolvedSupabaseUrl;
  supabaseAnonKey = resolvedSupabaseAnonKey;
}

// Dev-only visibility to ensure correct project is loaded (no secrets logged)
if (__DEV__) {
  console.log('[Supabase] using url:', supabaseUrl);
}

// Create Supabase client with latest best practices
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: mmkvAuthStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'x-gdpr-compliant': 'true',
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    // Reduce spurious disconnects by sending heartbeats more frequently
    // and allowing more time before considering the connection dead
    heartbeatIntervalMs: 25_000, // Send heartbeat every 25s (aligns with server default)
    timeout: 60_000, // Wait 60s before timing out (default is 10s)
    // Custom exponential backoff: 1s, 2s, 4s, 8s, 16s, max 32s
    // Matches RealtimeConnectionManager's backoff strategy
    reconnectAfterMs: (tries: number) => {
      const baseDelay = 1000;
      const maxDelay = 32000;
      return Math.min(baseDelay * Math.pow(2, tries - 1), maxDelay);
    },
  },
});

// React Native AppState handling for auth token refresh
// Per Supabase best practices: stop auto-refresh when backgrounded, restart when foregrounded
// This prevents unnecessary network requests and conserves resources on mobile
if (!isTestEnvironment) {
  // Ensure a single AppState listener even across Fast Refresh in development.
  try {
    globalWithSupabaseAppState.__gbSupabaseAppStateSubscription?.remove?.();
  } catch (e) {
    if (__DEV__) {
      console.warn(
        '[Supabase] failed to remove previous AppState subscription',
        e
      );
    }
  }

  globalWithSupabaseAppState.__gbSupabaseAppStateSubscription =
    AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });
}

// Export types for TypeScript
// TODO: Generate types with `supabase gen types typescript`
export type Database = Record<string, unknown>;
