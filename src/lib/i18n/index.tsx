// import Localization from 'expo-localization';
import i18n, { dir } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';

import { resources } from './resources';
export * from './utils';

// Initialize i18n with a safe default language at module load time to avoid
// touching storage or other IO in test environments. Language can later be
// changed via the exposed `changeLanguage` util/hook.
// eslint-disable-next-line import/no-named-as-default-member
i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  compatibilityJSON: 'v3', // By default React Native projects does not support Intl
  interpolation: { escapeValue: false },
});

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
