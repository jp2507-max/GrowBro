// Mock for @/lib/storage
import type { MMKV } from 'react-native-mmkv';

// Use Partial because in tests we only need a subset of MMKV methods.
// jest.Mocked wraps functions with jest mock types so tests can assert calls.
export const storage: jest.Mocked<Partial<MMKV>> = {
  // synchronous getters -> default sensible values
  getAllKeys: jest.fn().mockReturnValue([]),
  getString: jest.fn().mockReturnValue(null),

  // setters / mutators -> return undefined (MMKV methods are sync)
  set: jest.fn().mockReturnValue(undefined),
  delete: jest.fn().mockReturnValue(undefined),
  clearAll: jest.fn().mockReturnValue(undefined),

  // typed getters with sensible defaults
  getBoolean: jest.fn().mockReturnValue(false),
  getNumber: jest.fn().mockReturnValue(0),

  // Additional MMKV methods that might be used by tests
  getItem: jest.fn().mockReturnValue(null),
  setItem: jest.fn().mockReturnValue(undefined),
  removeItem: jest.fn().mockReturnValue(undefined),
};

// Mock functions exported by @/lib/storage that use the MMKV instance
export function getItem<T>(key: string): T | null {
  const value = storage.getString(key);
  if (value === null || value === undefined) {
    return null;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function setItem<T>(key: string, value: T): void {
  storage.set(key, JSON.stringify(value));
}

export function removeItem(key: string): void {
  storage.delete(key);
}

export default storage;
