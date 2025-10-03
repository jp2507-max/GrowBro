// Mock for @/lib/storage
import type { MMKV } from 'react-native-mmkv';

// Mock the full MMKV interface so tests get properly-typed mocks.
// Keep the implementation minimal — methods are jest.fn() stubs.
const _storage = {
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
  // Convenience aliases used in some tests
  // contains is part of the MMKV API (check types); add as a stub
  contains: jest.fn().mockReturnValue(false),
  // readonly properties on MMKV
  size: 0 as any,
  isReadOnly: false as any,

  // binary buffer getters / helpers
  getBuffer: jest.fn().mockReturnValue(null),

  // recrypt helper sometimes present on MMKV
  recrypt: jest.fn().mockReturnValue(undefined),

  // utility helpers present on MMKV
  trim: jest.fn().mockReturnValue(undefined),
  toJSON: jest.fn().mockReturnValue({}),
  toString: jest.fn().mockReturnValue('[MMKV mock]'),

  // value change listeners (MMKV exposes listener collection)
  addOnValueChangedListener: jest.fn().mockReturnValue(undefined),
  onValueChangedListeners: [] as any,
  // internal / runtime helpers present on MMKV
  functionCache: {} as any,
  id: 'mmkv-mock' as any,
  getFunctionFromCache: jest.fn().mockReturnValue(undefined),
  onValuesChanged: jest.fn().mockReturnValue(undefined),
} as const;

// Cast to the full mocked MMKV type. We keep a concrete object with the
// methods our helpers and tests use, then assert it matches the mocked
// MMKV type to provide correct typing in tests.
export const storage: jest.Mocked<MMKV> =
  _storage as unknown as jest.Mocked<MMKV>;

// Mock functions exported by @/lib/storage that use the MMKV instance

export function getItem<T>(key: string): T | null {
  // getString is defined in the mock above; use non-null assertion to
  // satisfy the TypeScript compiler since Partial<T> marks it optional.
  const value = storage.getString!(key);
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
  storage.set!(key, JSON.stringify(value));
}

export function removeItem(key: string): void {
  storage.delete!(key);
}

export default storage;
