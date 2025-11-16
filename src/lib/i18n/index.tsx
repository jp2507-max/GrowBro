// import Localization from 'expo-localization';
import i18n, { dir } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';

import { resources } from './resources';
export * from './utils';

/**
 * Initialize i18n during app bootstrap.
 * - avoids doing IO during module import to keep tests hermetic
 * - restores persisted language if available
 */
export async function initI18n(): Promise<void> {
  // Avoid touching storage in test environments
  const globalWithJest = globalThis as { jest?: unknown };
  const isTestEnv = typeof globalWithJest.jest !== 'undefined';

  // Lazy import utils to avoid module-load IO
  const utils = await import('./utils');

  // Conditionally compute persisted language - skip storage access in test env
  let persisted: string | undefined;
  if (!isTestEnv) {
    // getLanguage returns string | undefined synchronously
    persisted = utils.getLanguage?.();
  }

  // initialize i18next with resources and either persisted or fallback
  // eslint-disable-next-line import/no-named-as-default-member
  await i18n.use(initReactI18next).init({
    resources,
    lng: persisted || 'en',
    fallbackLng: 'en',
    compatibilityJSON: 'v3',
    interpolation: { escapeValue: false },
  });

  // Apply RTL settings based on resolved language
  // RTL application moved to applyRTLIfNeeded so callers can apply it after
  // i18n initialization (and after persisted language is loaded).
  // Consumers should call `applyRTLIfNeeded()` after `initI18n()` completes.
}

// Initialize i18n with a safe default language at module load time to avoid
// touching storage or other IO in test environments. Language can later be
// changed via the exposed `changeLanguage` util/hook.
// i18n initialization is commented out temporarily to avoid hardcoding the
// language at module load time. The persisted language should be restored
// during app bootstrap (e.g. by calling changeLanguage with a stored value)
// so we keep the original init here as a reference. Restore or replace
// this block with a startup-safe initialization that reads persisted state.
/*
i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  compatibilityJSON: 'v3', // By default React Native projects does not support Intl
  interpolation: { escapeValue: false },
});
*/

// prevent unused-import compile errors while the init block is commented out
/* istanbul ignore next */
void initReactI18next;
/* istanbul ignore next */
void resources;

// Is it a RTL language? Keep exporting a boolean for backwards-compatibility
// with existing call sites that import `isRTL` and treat it as a boolean.
// Provide a helper to refresh the value after language initialization.
export let isRTL: boolean = dir() === 'rtl';

/**
 * Re-evaluate and update the exported `isRTL` boolean. Call this after
 * i18n initialization or whenever the app language changes.
 */
export function refreshIsRTL(): void {
  isRTL = dir() === 'rtl';
}

/**
 * Apply RTL settings to React Native I18nManager if not running inside Jest.
 * Call this after i18n initialization or whenever the app language changes.
 */
export function applyRTLIfNeeded(): void {
  const globalWithJest = globalThis as { jest?: unknown };
  const isTestEnv = typeof globalWithJest.jest !== 'undefined';
  if (isTestEnv) return;
  const rtl = isRTL;
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
}

export default i18n;
