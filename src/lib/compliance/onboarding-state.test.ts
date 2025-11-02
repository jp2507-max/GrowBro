import { storage } from '@/lib/storage';

import { loadPersistedState, normalizeStepId } from './onboarding-state';

// Mock storage
jest.mock('@/lib/storage', () => ({
  storage: {
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('onboarding-state normalization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('normalizeStepId', () => {
    test('returns current step ID if already valid', () => {
      expect(normalizeStepId('age-gate')).toBe('age-gate');
      expect(normalizeStepId('legal-confirmation')).toBe('legal-confirmation');
      expect(normalizeStepId('consent-modal')).toBe('consent-modal');
      expect(normalizeStepId('completed')).toBe('completed');
    });

    test('maps legacy step IDs to new ones', () => {
      expect(normalizeStepId('age_gate')).toBe('age-gate');
      expect(normalizeStepId('legal_confirmation')).toBe('legal-confirmation');
      expect(normalizeStepId('consent')).toBe('consent-modal');
      expect(normalizeStepId('complete')).toBe('completed');
    });

    test('returns null for unknown step IDs', () => {
      expect(normalizeStepId('unknown_step')).toBeNull();
      expect(normalizeStepId('')).toBeNull();
    });
  });

  describe('loadPersistedState with legacy step IDs', () => {
    test('normalizes legacy currentStep IDs', () => {
      const mockData = {
        currentStep: 'age_gate',
        completedSteps: [],
        lastUpdated: '2024-01-01T00:00:00.000Z',
      };
      (storage.getString as jest.Mock).mockReturnValue(
        JSON.stringify(mockData)
      );

      const result = loadPersistedState();

      expect(result.currentStep).toBe('age-gate');
    });

    test('normalizes legacy completedSteps IDs and dedupes', () => {
      const mockData = {
        currentStep: 'age-gate',
        completedSteps: [
          'age_gate',
          'legal_confirmation',
          'consent',
          'age_gate',
        ], // duplicate
        lastUpdated: '2024-01-01T00:00:00.000Z',
      };
      (storage.getString as jest.Mock).mockReturnValue(
        JSON.stringify(mockData)
      );

      const result = loadPersistedState();

      expect(result.completedSteps).toEqual([
        'age-gate',
        'legal-confirmation',
        'consent-modal',
      ]);
      expect(result.completedSteps).toHaveLength(3); // deduped
    });

    test('handles mixed legacy and new step IDs', () => {
      const mockData = {
        currentStep: 'age_gate',
        completedSteps: ['legal_confirmation', 'consent-modal', 'complete'],
        lastUpdated: '2024-01-01T00:00:00.000Z',
      };
      (storage.getString as jest.Mock).mockReturnValue(
        JSON.stringify(mockData)
      );

      const result = loadPersistedState();

      expect(result.currentStep).toBe('age-gate');
      expect(result.completedSteps).toEqual([
        'legal-confirmation',
        'consent-modal',
        'completed',
      ]);
    });

    test('falls back to age-gate for unknown currentStep', () => {
      const mockData = {
        currentStep: 'unknown_step',
        completedSteps: [],
        lastUpdated: '2024-01-01T00:00:00.000Z',
      };
      (storage.getString as jest.Mock).mockReturnValue(
        JSON.stringify(mockData)
      );

      const result = loadPersistedState();

      expect(result.currentStep).toBe('age-gate');
    });

    test('filters out unknown completedSteps', () => {
      const mockData = {
        currentStep: 'age-gate',
        completedSteps: ['age_gate', 'unknown_step', 'legal_confirmation'],
        lastUpdated: '2024-01-01T00:00:00.000Z',
      };
      (storage.getString as jest.Mock).mockReturnValue(
        JSON.stringify(mockData)
      );

      const result = loadPersistedState();

      expect(result.completedSteps).toEqual(['age-gate', 'legal-confirmation']);
    });

    test('preserves existing lastUpdated timestamp', () => {
      const mockData = {
        currentStep: 'age-gate',
        completedSteps: [],
        lastUpdated: '2024-01-01T00:00:00.000Z',
      };
      (storage.getString as jest.Mock).mockReturnValue(
        JSON.stringify(mockData)
      );

      const result = loadPersistedState();

      expect(result.lastUpdated).toBe('2024-01-01T00:00:00.000Z');
    });

    test('falls back to current timestamp when lastUpdated is missing', () => {
      const mockData = {
        currentStep: 'age-gate',
        completedSteps: [],
      };
      (storage.getString as jest.Mock).mockReturnValue(
        JSON.stringify(mockData)
      );

      const result = loadPersistedState();

      expect(result.lastUpdated).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      );
    });

    test('handles empty storage', () => {
      (storage.getString as jest.Mock).mockReturnValue(null);

      const result = loadPersistedState();

      expect(result.currentStep).toBe('age-gate');
      expect(result.completedSteps).toEqual([]);
    });

    test('handles invalid JSON', () => {
      (storage.getString as jest.Mock).mockReturnValue('invalid json');

      const result = loadPersistedState();

      expect(result.currentStep).toBe('age-gate');
      expect(result.completedSteps).toEqual([]);
    });
  });
});
