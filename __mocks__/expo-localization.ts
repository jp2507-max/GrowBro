export const locale = 'en-US';
export const locales = ['en-US'];
export const timezone = 'UTC';
export const isRTL = false;

export function getCalendars(): { timeZone: string }[] {
  return [{ timeZone: 'UTC' }];
}

export function getLocales(): {
  languageTag: string;
  regionCode?: string;
  timeZone?: string;
}[] {
  return [{ languageTag: 'en-US', regionCode: 'US', timeZone: 'UTC' }];
}
