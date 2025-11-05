import de from '@/translations/de.json';
import en from '@/translations/en.json';

export const resources = {
  en: { translation: en },
  de: { translation: de },
} as const;

export type Language = keyof typeof resources;
