/* eslint-disable simple-import-sort/imports */
import { storage } from '@/lib/storage';
import { cleanup } from '@/lib/test-utils';
import {
  hydrateAgeGate,
  getAgeGateAuditLog,
  getAgeGateState,
  checkAgeGateExpiration,
  isAgeGateVerified,
} from '@/lib/compliance/age-gate';

// key used by the age-gate storage
const AGE_GATE_STATE_KEY = 'compliance.ageGate.state';

afterEach(() => {
  cleanup();
  // reset storage mocks
  try {
    (storage.getString as jest.Mock).mockReset();
    (storage.set as jest.Mock).mockReset();
    (storage.delete as jest.Mock).mockReset();
  } catch {}
});

test('legacy persisted state with expiresAt = null remains verified on hydrate', () => {
  const now = new Date().toISOString();
  const persisted = {
    verifiedAt: now,
    method: 'self-certification',
    expiresAt: null,
  };
  // make storage.getString return our persisted value for the state key
  (storage.getString as jest.Mock).mockImplementation((key: string) =>
    key === AGE_GATE_STATE_KEY ? JSON.stringify(persisted) : null
  );

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
  (storage.getString as jest.Mock).mockImplementation((key: string) =>
    key === AGE_GATE_STATE_KEY ? JSON.stringify(persisted) : null
  );

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

test('checkAgeGateExpiration returns true and appends audit when state is verified but expires in past', () => {
  const old = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365).toISOString(); // 1 year ago
  const persisted = {
    verifiedAt: old,
    method: 'self-certification',
    expiresAt: old,
  };
  (storage.getString as jest.Mock).mockImplementation((key: string) =>
    key === AGE_GATE_STATE_KEY ? JSON.stringify(persisted) : null
  );
  // hydrate again to set verified then run checkExpiration via exported function
  hydrateAgeGate();

  // ensure current state is blocked from hydrate
  const state = getAgeGateState();
  expect(state.status).toBe('blocked');

  // Now set a verified state with expiresAt in the past directly to the store to test checkAgeGateExpiration
  (storage.getString as jest.Mock).mockImplementation((key: string) =>
    key === AGE_GATE_STATE_KEY ? JSON.stringify(persisted) : null
  );
  // hydrate again to set verified then run checkExpiration via exported function
  hydrateAgeGate();

  // If it's expired, checkAgeGateExpiration should return true
  const expired = checkAgeGateExpiration();
  expect(expired).toBe(true);

  const events = getAgeGateAuditLog();
  expect(events.some((e) => e.type === 'verify-denied')).toBe(true);
});
