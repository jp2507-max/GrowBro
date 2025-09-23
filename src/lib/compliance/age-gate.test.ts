import {
  getAgeGateAuditLog,
  getAgeGateState,
  hydrateAgeGate,
  isAgeGateVerified,
  resetAgeGate,
  startAgeGateSession,
  verifyAgeGate,
} from '@/lib/compliance/age-gate';

const ADULT_BIRTH_YEAR = 2000;
const UNDERAGE_BIRTH_YEAR = 2010;

function setFixedNow(year: number, month = 0, day = 1): void {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(Date.UTC(year, month, day)));
}

describe('age-gate compliance store', () => {
  beforeEach(() => {
    jest.useRealTimers();
    resetAgeGate();
  });

  afterEach(() => {
    jest.useRealTimers();
    resetAgeGate();
  });

  test('hydrateAgeGate flags blocked when no verification recorded', () => {
    hydrateAgeGate();
    const state = getAgeGateState();
    expect(state.status).toBe('blocked');
    expect(isAgeGateVerified()).toBe(false);
  });

  test('verifyAgeGate rejects invalid input', () => {
    setFixedNow(2025);
    const result = verifyAgeGate({ birthYear: 0 });
    expect(result).toEqual({ ok: false, reason: 'invalid-input' });
    const state = getAgeGateState();
    expect(state.status).toBe('blocked');
  });

  test('verifyAgeGate blocks users under 18', () => {
    setFixedNow(2025);
    const result = verifyAgeGate({
      birthYear: UNDERAGE_BIRTH_YEAR,
      birthMonth: 5,
      birthDay: 5,
    });
    expect(result).toEqual({ ok: false, reason: 'underage' });
    expect(isAgeGateVerified()).toBe(false);
    const audit = getAgeGateAuditLog();
    expect(audit[audit.length - 1]?.type).toBe('verify-denied');
  });

  test('verifyAgeGate approves adults and records audit entry', () => {
    setFixedNow(2025);
    const result = verifyAgeGate({
      birthYear: ADULT_BIRTH_YEAR,
      birthMonth: 1,
      birthDay: 1,
    });
    expect(result).toEqual({ ok: true });
    const state = getAgeGateState();
    expect(state.status).toBe('verified');
    expect(state.sessionId).not.toBeNull();
    const audit = getAgeGateAuditLog();
    expect(audit[audit.length - 1]).toMatchObject({ type: 'verify-success' });
  });

  test('startSession logs audit event when verified', () => {
    setFixedNow(2025);
    verifyAgeGate({ birthYear: ADULT_BIRTH_YEAR, birthMonth: 6, birthDay: 1 });
    resetTimersToReal();
    startAgeGateSession();
    const state = getAgeGateState();
    expect(state.sessionId).not.toBeNull();
    const audit = getAgeGateAuditLog();
    expect(audit.some((event) => event.type === 'session-start')).toBe(true);
  });
});

function resetTimersToReal(): void {
  jest.useRealTimers();
}
