import { useMMKVBoolean } from 'react-native-mmkv';

import { storage } from '@/lib/storage';

const PREF_ALLOW_NOTIFICATIONS = 'PREF_ALLOW_NOTIFICATIONS';
const PREF_DEFAULT_REMINDER_MINUTES = 'PREF_DEFAULT_REMINDER_MINUTES';

export function useAllowNotifications(): [boolean, (value: boolean) => void] {
  const [value, setValue] = useMMKVBoolean(PREF_ALLOW_NOTIFICATIONS, storage);
  return [Boolean(value), (v: boolean) => setValue(v)];
}

export function getDefaultReminderMinutes(): number {
  const raw = storage.getNumber(PREF_DEFAULT_REMINDER_MINUTES);
  return typeof raw === 'number' && !Number.isNaN(raw) ? raw : 30;
}

export function setDefaultReminderMinutes(minutes: number): void {
  const safe = Number.isFinite(minutes) && minutes >= 0 ? minutes : 30;
  storage.set(PREF_DEFAULT_REMINDER_MINUTES, safe);
}
