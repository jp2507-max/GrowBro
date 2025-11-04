/**
 * Tests for form preservation service
 */

import { storage } from '@/lib/storage';

import {
  clearAllPreservedStates,
  clearPreservedState,
  hasPreservedState,
  preserveFormState,
  restoreFormState,
} from '../form-preservation';

// Mock storage
jest.mock('@/lib/storage');
const mockStorage = storage as jest.Mocked<typeof storage>;

describe('Form Preservation Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.set.mockImplementation(() => {});
    mockStorage.delete.mockImplementation(() => {});
    mockStorage.contains.mockReturnValue(false);
    mockStorage.getAllKeys.mockReturnValue([]);
  });

  describe('preserveFormState', () => {
    it('saves form state to storage', () => {
      const formData = { displayName: 'Test User', bio: 'Test bio' };

      preserveFormState('profile-edit', formData);

      expect(mockStorage.set).toHaveBeenCalledWith(
        'form.preserved.profile-edit',
        expect.any(String)
      );
    });

    it('includes validation state and dirty fields', () => {
      const formData = { displayName: 'Test' };
      const validationState = { displayName: 'Too short' };
      const dirtyFields = ['displayName'];

      preserveFormState('profile-edit', formData, {
        validationState,
        dirtyFields,
      });

      expect(mockStorage.set).toHaveBeenCalled();
    });
  });

  describe('restoreFormState', () => {
    it('returns null if no preserved state exists', () => {
      mockStorage.getString.mockReturnValue(undefined);

      const result = restoreFormState('profile-edit');

      expect(result).toBeNull();
    });

    it('returns preserved state if exists and not expired', () => {
      const state = {
        screenName: 'profile-edit',
        formData: { displayName: 'Test' },
        timestamp: Date.now() - 1000, // 1 second ago
      };

      mockStorage.getString.mockReturnValue(JSON.stringify(state));

      const result = restoreFormState('profile-edit');

      expect(result).toEqual(state);
    });

    it('returns null and clears if TTL expired', () => {
      const state = {
        screenName: 'profile-edit',
        formData: { displayName: 'Test' },
        timestamp: Date.now() - 16 * 60 * 1000, // 16 minutes ago (expired)
      };

      mockStorage.getString.mockReturnValue(JSON.stringify(state));

      const result = restoreFormState('profile-edit');

      expect(result).toBeNull();
      expect(mockStorage.delete).toHaveBeenCalledWith(
        'form.preserved.profile-edit'
      );
    });

    it('returns null and clears if parse error', () => {
      mockStorage.getString.mockReturnValue('invalid json');

      const result = restoreFormState('profile-edit');

      expect(result).toBeNull();
      expect(mockStorage.delete).toHaveBeenCalledWith(
        'form.preserved.profile-edit'
      );
    });
  });

  describe('clearPreservedState', () => {
    it('deletes preserved state from storage', () => {
      clearPreservedState('profile-edit');

      expect(mockStorage.delete).toHaveBeenCalledWith(
        'form.preserved.profile-edit'
      );
    });
  });

  describe('clearAllPreservedStates', () => {
    it('deletes all preserved states from storage', () => {
      mockStorage.getAllKeys.mockReturnValue([
        'form.preserved.profile-edit',
        'form.preserved.security',
        'other.key',
      ]);

      clearAllPreservedStates();

      expect(mockStorage.delete).toHaveBeenCalledTimes(2);
      expect(mockStorage.delete).toHaveBeenCalledWith(
        'form.preserved.profile-edit'
      );
      expect(mockStorage.delete).toHaveBeenCalledWith(
        'form.preserved.security'
      );
      expect(mockStorage.delete).not.toHaveBeenCalledWith('other.key');
    });
  });

  describe('hasPreservedState', () => {
    it('returns true if preserved state exists', () => {
      mockStorage.contains.mockReturnValue(true);

      const result = hasPreservedState('profile-edit');

      expect(result).toBe(true);
      expect(mockStorage.contains).toHaveBeenCalledWith(
        'form.preserved.profile-edit'
      );
    });

    it('returns false if preserved state does not exist', () => {
      mockStorage.contains.mockReturnValue(false);

      const result = hasPreservedState('profile-edit');

      expect(result).toBe(false);
    });
  });
});
