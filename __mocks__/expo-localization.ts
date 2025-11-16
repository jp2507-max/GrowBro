export const locale = 'en-US';
export const locales = ['en-US'];
export const timezone = 'UTC';
export const isRTL = false;

export function getCalendars(): { timeZone: string }[] {
  return [{ timeZone: 'UTC' }];
}

export function getLocales(): { timeZone?: string }[] {
  return [{ timeZone: 'UTC' }];
}
