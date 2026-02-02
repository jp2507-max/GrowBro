import { translate } from '@/lib/i18n';
import type { TxKeyPath } from '@/lib/i18n/utils';

/**
 * Returns a greeting message based on the current time of day.
 */
export function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return translate('home.greeting.morning' as TxKeyPath);
  } else if (hour >= 12 && hour < 17) {
    return translate('home.greeting.afternoon' as TxKeyPath);
  } else if (hour >= 17 && hour < 21) {
    return translate('home.greeting.evening' as TxKeyPath);
  } else {
    return translate('home.greeting.night' as TxKeyPath);
  }
}
