/**
 * Tests for source water profile service
 *
 * Requirements: 8.1, 8.2, 8.5
 */

import { database } from '@/lib/watermelon';
import type { SourceWaterProfileModel } from '@/lib/watermelon-models/source-water-profile';

import {
  createSourceWaterProfile,
  type CreateSourceWaterProfileData,
  deleteSourceWaterProfile,
  getSourceWaterProfile,
  listSourceWaterProfiles,
  modelToSourceWaterProfile,
  observeSourceWaterProfile,
  observeSourceWaterProfiles,
  updateSourceWaterProfile,
} from './source-water-profile-service';

// Mock WatermelonDB
jest.mock('@/lib/watermelon', () => ({
  database: {
    get: jest.fn(),
    write: jest.fn(),
  },
}));

describe('source-water-profile-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Validation', () => {
    it('should reject empty profile name', async () => {
      const data: CreateSourceWaterProfileData = {
        name: '   ',
        baselineEc25c: 0.3,
        alkalinityMgPerLCaco3: 80,
        hardnessMgPerL: 150,
      };

      await expect(createSourceWaterProfile(data)).rejects.toThrow(
        'Profile name cannot be empty'
      );
    });

    it('should reject baseline EC outside valid range', async () => {
      const dataTooLow: CreateSourceWaterProfileData = {
        name: 'Test Profile',
        baselineEc25c: -0.1,
        alkalinityMgPerLCaco3: 80,
        hardnessMgPerL: 150,
      };

      await expect(createSourceWaterProfile(dataTooLow)).rejects.toThrow(
        'Baseline EC must be between 0 and 5.0 mS/cm'
      );

      const dataTooHigh: CreateSourceWaterProfileData = {
        name: 'Test Profile',
        baselineEc25c: 5.5,
        alkalinityMgPerLCaco3: 80,
        hardnessMgPerL: 150,
      };

      await expect(createSourceWaterProfile(dataTooHigh)).rejects.toThrow(
        'Baseline EC must be between 0 and 5.0 mS/cm'
      );
    });

    it('should reject alkalinity outside valid range', async () => {
      const dataTooLow: CreateSourceWaterProfileData = {
        name: 'Test Profile',
        baselineEc25c: 0.3,
        alkalinityMgPerLCaco3: -10,
        hardnessMgPerL: 150,
      };

      await expect(createSourceWaterProfile(dataTooLow)).rejects.toThrow(
        'Alkalinity must be between 0 and 500 mg/L as CaCO₃'
      );

      const dataTooHigh: CreateSourceWaterProfileData = {
        name: 'Test Profile',
        baselineEc25c: 0.3,
        alkalinityMgPerLCaco3: 600,
        hardnessMgPerL: 150,
      };

      await expect(createSourceWaterProfile(dataTooHigh)).rejects.toThrow(
        'Alkalinity must be between 0 and 500 mg/L as CaCO₃'
      );
    });

    it('should reject hardness outside valid range', async () => {
      const dataTooLow: CreateSourceWaterProfileData = {
        name: 'Test Profile',
        baselineEc25c: 0.3,
        alkalinityMgPerLCaco3: 80,
        hardnessMgPerL: -10,
      };

      await expect(createSourceWaterProfile(dataTooLow)).rejects.toThrow(
        'Hardness must be between 0 and 1000 mg/L'
      );

      const dataTooHigh: CreateSourceWaterProfileData = {
        name: 'Test Profile',
        baselineEc25c: 0.3,
        alkalinityMgPerLCaco3: 80,
        hardnessMgPerL: 1500,
      };

      await expect(createSourceWaterProfile(dataTooHigh)).rejects.toThrow(
        'Hardness must be between 0 and 1000 mg/L'
      );
    });

    it('should reject future test dates', async () => {
      const futureDate = Date.now() + 86400000; // Tomorrow
      const data: CreateSourceWaterProfileData = {
        name: 'Test Profile',
        baselineEc25c: 0.3,
        alkalinityMgPerLCaco3: 80,
        hardnessMgPerL: 150,
        lastTestedAt: futureDate,
      };

      await expect(createSourceWaterProfile(data)).rejects.toThrow(
        'Test date cannot be in the future'
      );
    });

    it('should accept valid profile data', async () => {
      const mockCreate = jest.fn().mockImplementation((callback) => {
        const profile = {
          id: 'profile-1',
          name: 'City Water',
          baselineEc25c: 0.3,
          alkalinityMgPerLCaCO3: 80,
          hardnessMgPerL: 150,
          lastTestedAt: Date.now(),
        };
        callback(profile);
        return Promise.resolve(profile);
      });

      (database as any).get = jest.fn().mockReturnValue({
        create: mockCreate,
      });
      (database as any).write = jest
        .fn()
        .mockImplementation((callback) => callback());

      const data: CreateSourceWaterProfileData = {
        name: 'City Water',
        baselineEc25c: 0.3,
        alkalinityMgPerLCaco3: 80,
        hardnessMgPerL: 150,
      };

      const result = await createSourceWaterProfile(data);

      expect(mockCreate).toHaveBeenCalled();
      expect(result.name).toBe('City Water');
    });
  });

  describe('createSourceWaterProfile', () => {
    it('should create profile with default lastTestedAt if not provided', async () => {
      const mockCreate = jest.fn().mockImplementation((callback) => {
        const profile = {
          id: 'profile-1',
          lastTestedAt: 0,
        };
        callback(profile);
        return Promise.resolve(profile);
      });

      (database as any).get = jest.fn().mockReturnValue({
        create: mockCreate,
      });
      (database as any).write = jest
        .fn()
        .mockImplementation((callback) => callback());

      const data: CreateSourceWaterProfileData = {
        name: 'Test Profile',
        baselineEc25c: 0.3,
        alkalinityMgPerLCaco3: 80,
        hardnessMgPerL: 150,
      };

      await createSourceWaterProfile(data);

      expect(mockCreate).toHaveBeenCalled();
      const callback = mockCreate.mock.calls[0][0];
      const mockProfile = { lastTestedAt: 0 };
      callback(mockProfile);

      // Should set lastTestedAt to current time
      expect(mockProfile.lastTestedAt).toBeGreaterThan(0);
    });

    it('should trim profile name', async () => {
      const mockCreate = jest.fn().mockImplementation((callback) => {
        const profile = {
          id: 'profile-1',
          name: '',
        };
        callback(profile);
        return Promise.resolve(profile);
      });

      (database as any).get = jest.fn().mockReturnValue({
        create: mockCreate,
      });
      (database as any).write = jest
        .fn()
        .mockImplementation((callback) => callback());

      const data: CreateSourceWaterProfileData = {
        name: '  City Water  ',
        baselineEc25c: 0.3,
        alkalinityMgPerLCaco3: 80,
        hardnessMgPerL: 150,
      };

      await createSourceWaterProfile(data);

      const callback = mockCreate.mock.calls[0][0];
      const mockProfile = { name: '' };
      callback(mockProfile);

      expect(mockProfile.name).toBe('City Water');
    });

    it('should set userId when provided', async () => {
      const mockCreate = jest.fn().mockImplementation((callback) => {
        const profile = {
          id: 'profile-1',
          userId: undefined,
        };
        callback(profile);
        return Promise.resolve(profile);
      });

      (database as any).get = jest.fn().mockReturnValue({
        create: mockCreate,
      });
      (database as any).write = jest
        .fn()
        .mockImplementation((callback) => callback());

      const data: CreateSourceWaterProfileData = {
        name: 'Test Profile',
        baselineEc25c: 0.3,
        alkalinityMgPerLCaco3: 80,
        hardnessMgPerL: 150,
      };

      await createSourceWaterProfile(data, 'user-123');

      const callback = mockCreate.mock.calls[0][0];
      const mockProfile = { userId: undefined };
      callback(mockProfile);

      expect(mockProfile.userId).toBe('user-123');
    });
  });

  describe('updateSourceWaterProfile', () => {
    it('should update profile fields', async () => {
      const mockUpdate = jest.fn().mockImplementation((callback) => {
        const updated = {
          id: 'profile-1',
          name: 'Old Name',
          baselineEc25c: 0.3,
        };
        callback(updated);
        return Promise.resolve(updated);
      });

      const mockProfile = {
        id: 'profile-1',
        update: mockUpdate,
      };

      (database as any).get = jest.fn().mockReturnValue({
        find: jest.fn().mockResolvedValue(mockProfile),
      });
      (database as any).write = jest
        .fn()
        .mockImplementation((callback) => callback());

      await updateSourceWaterProfile('profile-1', {
        name: 'New Name',
        baselineEc25c: 0.5,
      });

      expect(mockUpdate).toHaveBeenCalled();
      const callback = mockUpdate.mock.calls[0][0];
      const mockRecord = { name: 'Old Name', baselineEc25c: 0.3 };
      callback(mockRecord);

      expect(mockRecord.name).toBe('New Name');
      expect(mockRecord.baselineEc25c).toBe(0.5);
    });

    it('should update lastTestedAt when explicitly provided', async () => {
      const newTestDate = Date.now() - 1000000;
      const mockUpdate = jest.fn().mockImplementation((callback) => {
        const updated = {
          id: 'profile-1',
          lastTestedAt: 0,
        };
        callback(updated);
        return Promise.resolve(updated);
      });

      const mockProfile = {
        id: 'profile-1',
        update: mockUpdate,
      };

      (database as any).get = jest.fn().mockReturnValue({
        find: jest.fn().mockResolvedValue(mockProfile),
      });
      (database as any).write = jest
        .fn()
        .mockImplementation((callback) => callback());

      await updateSourceWaterProfile('profile-1', {
        lastTestedAt: newTestDate,
      });

      const callback = mockUpdate.mock.calls[0][0];
      const mockRecord = { lastTestedAt: 0 };
      callback(mockRecord);

      expect(mockRecord.lastTestedAt).toBe(newTestDate);
    });
  });

  describe('deleteSourceWaterProfile', () => {
    it('should soft delete profile', async () => {
      const mockMarkAsDeleted = jest.fn().mockResolvedValue(undefined);

      const mockProfile = {
        id: 'profile-1',
        markAsDeleted: mockMarkAsDeleted,
      };

      (database as any).get = jest.fn().mockReturnValue({
        find: jest.fn().mockResolvedValue(mockProfile),
      });
      (database as any).write = jest
        .fn()
        .mockImplementation((callback) => callback());

      await deleteSourceWaterProfile('profile-1');

      expect(mockMarkAsDeleted).toHaveBeenCalled();
    });
  });

  describe('getSourceWaterProfile', () => {
    it('should return profile when found', async () => {
      const mockProfile = {
        id: 'profile-1',
        name: 'Test Profile',
      };

      (database as any).get = jest.fn().mockReturnValue({
        find: jest.fn().mockResolvedValue(mockProfile),
      });

      const result = await getSourceWaterProfile('profile-1');

      expect(result).toEqual(mockProfile);
    });

    it('should return null when profile not found', async () => {
      (database as any).get = jest.fn().mockReturnValue({
        find: jest.fn().mockRejectedValue(new Error('Not found')),
      });

      const result = await getSourceWaterProfile('invalid-id');

      expect(result).toBeNull();
    });
  });

  describe('listSourceWaterProfiles', () => {
    it('should list all profiles when no userId provided', async () => {
      const mockProfiles = [
        { id: 'profile-1', name: 'Profile 1' },
        { id: 'profile-2', name: 'Profile 2' },
      ];

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue(mockProfiles),
      };

      (database as any).get = jest.fn().mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      });

      const result = await listSourceWaterProfiles();

      expect(result).toEqual(mockProfiles);
    });

    it('should filter by userId when provided', async () => {
      const mockProfiles = [{ id: 'profile-1', name: 'Profile 1' }];

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue(mockProfiles),
      };

      (database as any).get = jest.fn().mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      });

      const result = await listSourceWaterProfiles('user-123');

      expect(result).toEqual(mockProfiles);
    });
  });

  describe('Observables', () => {
    it('should observe single profile', (done) => {
      const mockProfile = {
        id: 'profile-1',
        observe: jest.fn().mockReturnValue({
          subscribe: jest.fn().mockImplementation((callbacks) => {
            callbacks.next(mockProfile);
            return { unsubscribe: jest.fn() };
          }),
        }),
      };

      (database as any).get = jest.fn().mockReturnValue({
        find: jest.fn().mockResolvedValue(mockProfile),
      });

      const observable = observeSourceWaterProfile('profile-1');

      observable.subscribe({
        next: (profile) => {
          expect(profile).toEqual(mockProfile);
          done();
        },
      });
    });

    it('should observe all profiles', (done) => {
      const mockProfiles = [
        { id: 'profile-1' },
        { id: 'profile-2' },
      ] as SourceWaterProfileModel[];

      const mockQuery = {
        observe: jest.fn().mockReturnValue({
          subscribe: jest.fn().mockImplementation((callbacks) => {
            callbacks.next(mockProfiles);
            return { unsubscribe: jest.fn() };
          }),
        }),
      };

      (database as any).get = jest.fn().mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      });

      const observable = observeSourceWaterProfiles();

      observable.subscribe({
        next: (profiles) => {
          expect(profiles).toEqual(mockProfiles);
          done();
        },
      });
    });
  });

  describe('modelToSourceWaterProfile', () => {
    it('should convert model to type', () => {
      const mockModel = {
        id: 'profile-1',
        name: 'Test Profile',
        baselineEc25c: 0.3,
        alkalinityMgPerLCaCO3: 80,
        hardnessMgPerL: 150,
        lastTestedAt: 1700000000000,
        createdAt: new Date(1700000000000),
        updatedAt: new Date(1700000000000),
      } as SourceWaterProfileModel;

      const result = modelToSourceWaterProfile(mockModel);

      expect(result).toEqual({
        id: 'profile-1',
        name: 'Test Profile',
        baselineEc25c: 0.3,
        alkalinityMgPerLCaco3: 80,
        hardnessMgPerL: 150,
        lastTestedAt: 1700000000000,
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      });
    });
  });
});
