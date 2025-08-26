import de from '@/translations/de.json';
import en from '@/translations/en.json';

export const resources = {
  en: {
    translation: en,
  },
  ar: {
    translation: ar,
  },
  de: {
    translation: de,
  },
};

export type Language = keyof typeof resources;
