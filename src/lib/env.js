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
  (Constants.expoConfig && Constants.expoConfig.extra) ||
  (Constants.manifest2 && Constants.manifest2.extra) ||
  // Accessing manifest?.extra is not supported in newer Expo SDK types, fallback removed
  {};

// In development with Dev Client, also merge in EXPO_PUBLIC_* from process.env
// as they may not be available in Constants.expoConfig.extra
const runtimeEnv =
  typeof process !== 'undefined' && process.env ? process.env : {};

// Merge both sources: Constants.extra (build-time) and process.env (runtime for dev)
const mergedExtra = { ...rawExtra };
for (const [key, value] of Object.entries(runtimeEnv)) {
  if (key.startsWith('EXPO_PUBLIC_') && value != null && value !== '') {
    // Only add if not already present from Constants.extra
    if (!Object.prototype.hasOwnProperty.call(mergedExtra, key)) {
      mergedExtra[key] = value;
    }
  }
}

/**
 * Normalize Expo `extra` so code can read unprefixed keys.
 * If keys are provided as `EXPO_PUBLIC_*`, expose both the original prefixed
 * key and an unprefixed alias (e.g. `EXPO_PUBLIC_API_URL` -> `API_URL`).
 * Unprefixed keys already present take precedence.
 */
/**
 * @param {Record<string, any>} extra
 */
function normalizeExtra(extra) {
  const normalized = { ...extra };
  for (const [key, value] of Object.entries(extra)) {
    if (key.startsWith('EXPO_PUBLIC_')) {
      const alias = key.replace(/^EXPO_PUBLIC_/, '');
      // skip dangerous prototype keys
      if (
        alias === '__proto__' ||
        alias === 'prototype' ||
        alias === 'constructor'
      ) {
        continue;
      }
      // if the normalized object already has the alias (even if intentionally undefined), don't overwrite
      if (!Object.prototype.hasOwnProperty.call(normalized, alias)) {
        Object.defineProperty(normalized, alias, {
          value: value,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
    }
  }
  return normalized;
}

export const Env = normalizeExtra(mergedExtra);
