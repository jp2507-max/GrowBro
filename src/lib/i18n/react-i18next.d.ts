import type { resources } from './resources';

// react-i18next versions higher than 11.11.0
// Updated to include quietHours translations

declare module 'react-i18next' {
  interface CustomTypeOptions {
    resources: (typeof resources)['en'];
  }
}
