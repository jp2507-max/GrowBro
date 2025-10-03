/* eslint-disable simple-import-sort/imports */
import { storage } from '@/lib/storage';
import { cleanup } from '@/lib/test-utils';
import {
  hydrateAgeGate,
  getAgeGateAuditLog,
  getAgeGateState,
  checkAgeGateExpiration,
  isAgeGateVerified,
  verifyAgeGate,
  resetAgeGate,
} from '@/lib/compliance/age-gate';

// key used by the age-gate storage
const AGE_GATE_STATE_KEY = 'compliance.ageGate.state';

// In-memory store for spied storage
const storageStore = new Map<string, string>();

afterEach(() => {
  cleanup();
  // clear storage store and restore spies
  storageStore.clear();
  try {
    jest.restoreAllMocks();
  } catch {}
});

test('legacy persisted state with expiresAt = null remains verified on hydrate', () => {
  const now = new Date().toISOString();
  const persisted = {
    verifiedAt: now,
    method: 'self-certification',
    expiresAt: null,
  };
  // make storage.getString return our persisted value
  jest
    .spyOn(storage, 'getString')
    .mockImplementation((key: string) => storageStore.get(key) ?? undefined);
  jest
    .spyOn(storage, 'set')
    .mockImplementation((key: string, value: string) => {
      storageStore.set(key, value);
      return undefined;
    });
  jest
    .spyOn(storage, 'delete')
    .mockImplementation((key: string) => storageStore.delete(key));

  // Set the persisted state
  storageStore.set(AGE_GATE_STATE_KEY, JSON.stringify(persisted));

  hydrateAgeGate();

  const state = getAgeGateState();
  expect(state.status).toBe('verified');
  expect(state.verifiedAt).toBe(now);
  expect(isAgeGateVerified()).toBe(true);
  // no audit entry should be added for re-verification
  const events = getAgeGateAuditLog();
  expect(events.some((e) => e.type === 'verify-denied')).toBe(false);
});

test('past expiresAt causes expiration and appends verify-denied audit', () => {
  const old = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365).toISOString(); // 1 year ago
  const persisted = {
    verifiedAt: old,
    method: 'self-certification',
    expiresAt: old,
  };
  // make storage work with in-memory store
  jest
    .spyOn(storage, 'getString')
    .mockImplementation((key: string) => storageStore.get(key) ?? undefined);
  jest
    .spyOn(storage, 'set')
    .mockImplementation((key: string, value: string) => {
      storageStore.set(key, value);
      return undefined;
    });
  jest
    .spyOn(storage, 'delete')
    .mockImplementation((key: string) => storageStore.delete(key));

  // Set the persisted state
  storageStore.set(AGE_GATE_STATE_KEY, JSON.stringify(persisted));

  hydrateAgeGate();

  // After hydrate, expired should have been detected and state blocked
  const state = getAgeGateState();
  expect(state.status).toBe('blocked');
  expect(state.verifiedAt).toBeNull();

  const events = getAgeGateAuditLog();
  // there should be at least one verify-denied event with detail re-verification-required
  expect(events.length).toBeGreaterThan(0);
  expect(events.some((e) => e.type === 'verify-denied')).toBe(true);
});

test('checkAgeGateExpiration returns true and blocks when verified state has expired expiresAt', () => {
  // Reset any existing state
  resetAgeGate();

  // Verify age gate with valid input to set verified state
  const result = verifyAgeGate({
    birthYear: 1990,
    birthMonth: 1,
    birthDay: 1,
    method: 'self-certification',
  });
  expect(result.ok).toBe(true);

  // Verify state is verified with future expiration
  const initialState = getAgeGateState();
  expect(initialState.status).toBe('verified');
  expect(initialState.expiresAt).toBeTruthy();

  // Use fake timers to set system time past expiration
  jest.useFakeTimers();
  const futureExpiration = new Date(initialState.expiresAt!);
  const pastExpiration = new Date(
    futureExpiration.getTime() + 24 * 60 * 60 * 1000
  ); // 1 day after expiration
  jest.setSystemTime(pastExpiration);

  // Now checkAgeGateExpiration should detect expiration and block
  const expired = checkAgeGateExpiration();
  expect(expired).toBe(true);

  jest.useRealTimers();

  // Verify state is now blocked
  const finalState = getAgeGateState();
  expect(finalState.status).toBe('blocked');

  const events = getAgeGateAuditLog();
  expect(events.some((e) => e.type === 'verify-denied')).toBe(true);
});
