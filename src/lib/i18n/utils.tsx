import * as Localization from 'expo-localization';
import type { TOptions } from 'i18next';
import i18n, { dir, exists as i18nextExists } from 'i18next';
import memoize from 'lodash.memoize';
import { useCallback } from 'react';
import { I18nManager, NativeModules, Platform } from 'react-native';
import { useMMKVString } from 'react-native-mmkv';
import RNRestart from 'react-native-restart';

import type { Language } from '@/lib/i18n/resources';
import { resources } from '@/lib/i18n/resources';
import type { RecursiveKeyOf } from '@/lib/i18n/types';
import { storage } from '@/lib/storage';

// runtime reference so `resources` is treated as a value import (needed for `typeof resources` in types)
export const AVAILABLE_LANGUAGES = Object.keys(resources) as Language[];

type DefaultLocale = typeof resources.en.translation;
export type TxKeyPath = RecursiveKeyOf<DefaultLocale>;

export const LOCAL = 'local';

/**
 * Detects the device's preferred language using expo-localization.
 * Returns the language code if supported, otherwise falls back to 'en'.
 */
export function getDeviceLanguage(): Language {
  // Get device locale (e.g., "de-DE", "en-US")
  const locale = Localization.getLocales()[0]?.languageCode ?? 'en';
  // Return if supported, otherwise fallback to 'en'
  return AVAILABLE_LANGUAGES.includes(locale as Language)
    ? (locale as Language)
    : 'en';
}

/**
 * Gets the app language with the following priority:
 * 1. User's manually selected language (from MMKV storage)
 * 2. Device's preferred language (if supported: en/de)
 * 3. English (fallback for unsupported languages)
 */
export const getLanguage = (): Language => {
  const persisted = storage.getString(LOCAL);
  if (persisted && AVAILABLE_LANGUAGES.includes(persisted as Language)) {
    return persisted as Language;
  }
  return getDeviceLanguage();
};

// Simple dot-path resolver for resource fallback
function resolveResource(
  lang: keyof typeof resources,
  path: string,
  opts?: TOptions
): string | undefined {
  const parts = path.split('.') as string[];
  let cur: unknown = resources[lang]?.translation;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>))
      cur = (cur as Record<string, unknown>)[p];
    else return undefined;
  }
  // Handle i18next plural forms (one/other structure)
  if (cur && typeof cur === 'object' && 'one' in cur && 'other' in cur) {
    const pluralObj = cur as { one: string; other: string };
    const rawCount = (opts as Record<string, unknown>)?.count;
    let count = Number(rawCount);
    if (Number.isNaN(count)) count = 0;
    // Use 'one' for count === 1, 'other' for all other values
    return count === 1 ? pluralObj.one : pluralObj.other;
  }
  return typeof cur === 'string' ? cur : undefined;
}

// Naive mustache-style interpolation for fallback strings
function interpolate(str: string, opts?: TOptions): string {
  if (!opts) return str;
  return str.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => {
    const optsRecord = opts as Record<string, unknown>;
    const v = optsRecord[k];
    return v == null ? '' : String(v);
  });
}

export const translate = memoize(
  (key: TxKeyPath, options = undefined) => {
    // If i18n isn't initialized (common in tests), fall back to local resources
    if (!i18n.isInitialized) {
      const lang = (i18n.language as keyof typeof resources) || 'en';
      const fallback = resolveResource(
        lang in resources ? lang : 'en',
        key,
        options as TOptions
      );
      if (fallback)
        return interpolate(fallback, options as TOptions | undefined);
    }
    // eslint-disable-next-line import/no-named-as-default-member
    return i18n.t(key, options) as unknown as string;
  },
  (key: TxKeyPath, options: TOptions) => {
    // include current language so cached values are invalidated when language changes
    const lang = i18n.language || '';
    const base = options ? key + JSON.stringify(options) : key;
    return `${lang}:${base}`;
  }
);

/**
 * Translates dynamic keys that cannot be statically verified at compile time.
 * Performs runtime validation to ensure the key exists before delegating to the
 * type-safe translate function. Logs a warning in development if the key is not found.
 */
export function translateDynamic(key: string, options = undefined): string {
  // Runtime check for key existence
  // prefer the named `exists` import to satisfy eslint `import/no-named-as-default-member`
  if (__DEV__ && !i18nextExists(key)) {
    console.warn(
      `[i18n] Missing translation key: "${key}". Consider adding it to the translation files.`
    );
  }
  // Delegate to the type-safe translate function with a type assertion
  return translate(key as TxKeyPath, options);
}

export const changeLanguage = (lang: Language) => {
  // eslint-disable-next-line import/no-named-as-default-member
  i18n.changeLanguage(lang);
  // determine direction from i18next for the selected language
  // use the named `dir` export to avoid `import/no-named-as-default-member` lint warning
  const isRtl = dir(lang) === 'rtl';

  // Update RTL setting if needed
  const currentRTL = I18nManager.isRTL;
  if (currentRTL !== isRtl) {
    // RTL change requires app restart on native platforms
    // Ensure the app is allowed to change layout direction at runtime on platforms
    // that require permission before forcing RTL. Call allowRTL before forceRTL
    // so the runtime will accept the change without requiring a restart.
    I18nManager.allowRTL(isRtl);
    I18nManager.forceRTL(isRtl);

    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      if (__DEV__) NativeModules.DevSettings.reload();
      else RNRestart.restart();
    } else if (Platform.OS === 'web') {
      window.location.reload();
    }
  }
  // If only language changed (not RTL direction), components using useTranslation()
  // will automatically re-render with new translations. Requirement 3.2, 3.7
};

export const useSelectedLanguage = () => {
  const [language, setLang] = useMMKVString(LOCAL);

  const setLanguage = useCallback(
    (lang: Language) => {
      setLang(lang);
      if (lang !== undefined) changeLanguage(lang as Language);
    },
    [setLang]
  );

  return { language: language ?? (i18n.language as Language), setLanguage };
};
