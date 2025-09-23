import type { TOptions } from 'i18next';
import i18n, { dir } from 'i18next';
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

export const getLanguage = () => storage.getString(LOCAL); // 'Marc' getItem<Language | undefined>(LOCAL);

// Simple dot-path resolver for resource fallback
function resolveResource(
  lang: keyof typeof resources,
  path: string
): string | undefined {
  const parts = path.split('.') as string[];
  let cur: unknown = (resources as any)?.[lang]?.translation;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, any>))
      cur = (cur as Record<string, any>)[p];
    else return undefined;
  }
  return typeof cur === 'string' ? cur : undefined;
}

// Naive mustache-style interpolation for fallback strings
function interpolate(str: string, opts?: TOptions): string {
  if (!opts) return str;
  return str.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => {
    const v = (opts as any)?.[k];
    return v == null ? '' : String(v);
  });
}

export const translate = memoize(
  (key: TxKeyPath, options = undefined) => {
    // If i18n isn't initialized (common in tests), fall back to local resources
    if (!i18n.isInitialized) {
      const lang = (i18n.language as keyof typeof resources) || 'en';
      const fallback = resolveResource(lang in resources ? lang : 'en', key);
      if (fallback) return interpolate(fallback, options as any);
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

export const changeLanguage = (lang: Language) => {
  // eslint-disable-next-line import/no-named-as-default-member
  i18n.changeLanguage(lang);
  // determine direction from i18next for the selected language
  // use the named `dir` export to avoid `import/no-named-as-default-member` lint warning
  const isRtl = dir(lang) === 'rtl';
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
