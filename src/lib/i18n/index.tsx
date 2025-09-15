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
  const isTestEnv = typeof (globalThis as any).jest !== 'undefined';
  if (isTestEnv) return;

  // Lazy import utils to avoid module-load IO
  const utils = await import('./utils');
  const persisted = utils.getLanguage?.();

  // initialize i18next with resources and either persisted or fallback
  // eslint-disable-next-line import/no-named-as-default-member
  i18n.use(initReactI18next).init({
    resources,
    lng: (persisted as string) || 'en',
    fallbackLng: 'en',
    compatibilityJSON: 'v3',
    interpolation: { escapeValue: false },
  });

  // Apply RTL settings based on resolved language
  const isRtl = dir((persisted as string) || i18n.language) === 'rtl';
  I18nManager.allowRTL(isRtl);
  I18nManager.forceRTL(isRtl);
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

// Is it a RTL language?
export const isRTL: boolean = dir() === 'rtl';

// Avoid forcing RTL/LTR in Jest to prevent unexpected global side-effects that
// could interfere with tests or keep processes alive in some environments.
const isTestEnv = typeof (globalThis as any).jest !== 'undefined';
if (!isTestEnv) {
  I18nManager.allowRTL(isRTL);
  I18nManager.forceRTL(isRTL);
}

export default i18n;
