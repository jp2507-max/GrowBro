/*
 * This file should not be modified; use `env.js` in the project root to add your client environment variables.
 * If you import `Env` from `@env`, this is the file that will be loaded.
 * You can only access the client environment variables here.
 * NOTE: We use js file so we can load the client env types
 */

import Constants from 'expo-constants';
/**
 *  @type {typeof import('../../env.js').ClientEnv}
 */
//@ts-ignore // Don't worry about TypeScript here; we know we're passing the correct environment variables to `extra` in `app.config.ts`.
const rawExtra =
  Constants.expoConfig?.extra ??
  Constants.manifest2?.extra ??
  Constants.manifest?.extra ??
  {};

/**
 * Normalize Expo `extra` so code can read unprefixed keys.
 * If keys are provided as `EXPO_PUBLIC_*`, expose both the original prefixed
 * key and an unprefixed alias (e.g. `EXPO_PUBLIC_API_URL` -> `API_URL`).
 * Unprefixed keys already present take precedence.
 */
function normalizeExtra(extra) {
  const normalized = { ...extra };
  for (const [key, value] of Object.entries(extra)) {
    if (typeof key === 'string' && key.startsWith('EXPO_PUBLIC_')) {
      const alias = key.replace(/^EXPO_PUBLIC_/, '');
      if (normalized[alias] === undefined) {
        normalized[alias] = value;
      }
    }
  }
  return normalized;
}

export const Env = normalizeExtra(rawExtra);
