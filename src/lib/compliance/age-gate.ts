import { create } from 'zustand';

import { storage } from '@/lib/storage';
import { createSelectors } from '@/lib/utils';

const AGE_GATE_STATE_KEY = 'compliance.ageGate.state';
const AGE_GATE_AUDIT_KEY = 'compliance.ageGate.audit';
const MAX_AUDIT_EVENTS = 100;

export type AgeGateMethod = 'self-certification' | 'document';
export type AgeGateStatus = 'unknown' | 'verified' | 'blocked';

export type AgeGateAuditEvent = {
  timestamp: string;
  type: 'session-start' | 'verify-success' | 'verify-denied';
  detail?: string;
};

export type AgeGateVerifyInput = {
  birthYear: number;
  birthMonth?: number;
  birthDay?: number;
  region?: string;
  method?: AgeGateMethod;
};

export type AgeGateVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'invalid-input' | 'underage' };

type PersistedAgeGateState = {
  verifiedAt: string | null;
  method: AgeGateMethod | null;
};

export type AgeGateStoreState = {
  status: AgeGateStatus;
  verifiedAt: string | null;
  method: AgeGateMethod | null;
  sessionId: string | null;
  sessionStartedAt: string | null;
  hydrate: () => void;
  verify: (input: AgeGateVerifyInput) => AgeGateVerifyResult;
  reset: () => void;
  startSession: () => void;
};

function loadPersistedState(): PersistedAgeGateState {
  try {
    const raw = storage.getString(AGE_GATE_STATE_KEY);
    if (!raw) {
      return { verifiedAt: null, method: null };
    }
    const parsed = JSON.parse(raw) as PersistedAgeGateState;
    return {
      verifiedAt:
        typeof parsed?.verifiedAt === 'string' ? parsed.verifiedAt : null,
      method:
        typeof parsed?.method === 'string'
          ? (parsed.method as AgeGateMethod)
          : null,
    };
  } catch {
    return { verifiedAt: null, method: null };
  }
}

function savePersistedState(state: PersistedAgeGateState): void {
  storage.set(AGE_GATE_STATE_KEY, JSON.stringify(state));
}

function readAuditLog(): AgeGateAuditEvent[] {
  try {
    const raw = storage.getString(AGE_GATE_AUDIT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AgeGateAuditEvent[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((event) => typeof event?.timestamp === 'string');
  } catch {
    return [];
  }
}

function writeAuditLog(events: AgeGateAuditEvent[]): void {
  storage.set(AGE_GATE_AUDIT_KEY, JSON.stringify(events));
}

function appendAudit(event: AgeGateAuditEvent): void {
  const events = readAuditLog();
  events.push(event);
  const trimmed = events.slice(-MAX_AUDIT_EVENTS);
  writeAuditLog(trimmed);
}

function buildBirthDate(input: AgeGateVerifyInput): Date | null {
  const { birthYear, birthMonth = 1, birthDay = 1 } = input;
  if (
    !Number.isInteger(birthYear) ||
    birthYear < 1900 ||
    birthYear > new Date().getFullYear()
  ) {
    return null;
  }
  if (!Number.isInteger(birthMonth) || birthMonth < 1 || birthMonth > 12) {
    return null;
  }
  if (!Number.isInteger(birthDay) || birthDay < 1 || birthDay > 31) {
    return null;
  }
  const date = new Date(Date.UTC(birthYear, birthMonth - 1, birthDay));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function computeAge(birthDate: Date, reference: Date): number {
  const diff = reference.getUTCFullYear() - birthDate.getUTCFullYear();
  const refMonth = reference.getUTCMonth();
  const refDay = reference.getUTCDate();
  const birthMonth = birthDate.getUTCMonth();
  const birthDay = birthDate.getUTCDate();

  if (refMonth < birthMonth || (refMonth === birthMonth && refDay < birthDay)) {
    return diff - 1;
  }
  return diff;
}

function createSessionId(): string {
  return `ag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createHydrateFunction(set: any) {
  return () => {
    const persisted = loadPersistedState();
    if (persisted.verifiedAt) {
      set({
        status: 'verified',
        verifiedAt: persisted.verifiedAt,
        method: persisted.method ?? 'self-certification',
      });
    } else {
      set({ status: 'blocked', verifiedAt: null, method: null });
    }
  };
}

function createVerifyFunction(set: any) {
  return (input: AgeGateVerifyInput) => {
    const birthDate = buildBirthDate(input);
    const now = new Date();
    const timestamp = now.toISOString();
    if (!birthDate) {
      appendAudit({
        timestamp,
        type: 'verify-denied',
        detail: 'invalid-input',
      });
      set({ status: 'blocked', sessionId: null, sessionStartedAt: null });
      return { ok: false, reason: 'invalid-input' };
    }

    const age = computeAge(birthDate, now);
    if (age < 18) {
      appendAudit({
        timestamp,
        type: 'verify-denied',
        detail: `age:${age}`,
      });
      set({ status: 'blocked', sessionId: null, sessionStartedAt: null });
      return { ok: false, reason: 'underage' };
    }

    const method = input.method ?? 'self-certification';
    const sessionId = createSessionId();
    const sessionStartedAt = timestamp;
    set({
      status: 'verified',
      verifiedAt: timestamp,
      method,
      sessionId,
      sessionStartedAt,
    });
    savePersistedState({ verifiedAt: timestamp, method });
    appendAudit({ timestamp, type: 'verify-success', detail: method });
    return { ok: true };
  };
}

function createResetFunction(set: any) {
  return () => {
    storage.delete(AGE_GATE_STATE_KEY);
    storage.delete(AGE_GATE_AUDIT_KEY);
    set({
      status: 'blocked',
      verifiedAt: null,
      method: null,
      sessionId: null,
      sessionStartedAt: null,
    });
  };
}

function createStartSessionFunction(set: any, get: any) {
  return () => {
    const state = get();
    if (state.status !== 'verified') {
      set({ sessionId: null, sessionStartedAt: null });
      return;
    }
    const sessionId = createSessionId();
    const timestamp = new Date().toISOString();
    set({ sessionId, sessionStartedAt: timestamp });
    appendAudit({ timestamp, type: 'session-start', detail: sessionId });
  };
}

function createAgeGateStore(set: any, get: any) {
  return {
    status: 'unknown',
    verifiedAt: null,
    method: null,
    sessionId: null,
    sessionStartedAt: null,
    hydrate: createHydrateFunction(set),
    verify: createVerifyFunction(set),
    reset: createResetFunction(set),
    startSession: createStartSessionFunction(set, get),
  };
}

const _useAgeGate = create<AgeGateStoreState>((set, get) =>
  createAgeGateStore(set, get)
);

const ageGateStore = createSelectors(_useAgeGate);

export const useAgeGate = ageGateStore.use;

export function hydrateAgeGate(): void {
  ageGateStore.getState().hydrate();
}

export function verifyAgeGate(input: AgeGateVerifyInput): AgeGateVerifyResult {
  return ageGateStore.getState().verify(input);
}

export function resetAgeGate(): void {
  ageGateStore.getState().reset();
}

export function startAgeGateSession(): void {
  ageGateStore.getState().startSession();
}

export function isAgeGateVerified(): boolean {
  return ageGateStore.getState().status === 'verified';
}

export function getAgeGateAuditLog(limit = 50): AgeGateAuditEvent[] {
  const events = readAuditLog();
  if (limit <= 0) return events;
  return events.slice(-limit);
}

export function getAgeGateState(): AgeGateStoreState {
  return ageGateStore.getState();
}
