/**
 * Tests for reservoir service
 *
 * Validates CRUD operations, validation, and observables for reservoir management.
 */

import { database } from '@/lib/watermelon';

import type { CreateReservoirData } from './reservoir-service';
import {
  assignSourceWaterProfile,
  createReservoir,
  deleteReservoir,
  updateReservoir,
} from './reservoir-service';

// Mock WatermelonDB
jest.mock('@/lib/watermelon');

describe('reservoir-service', () => {
  describe('createReservoir', () => {
    it('should create a reservoir with valid data', async () => {
      const mockCreate = jest.fn().mockImplementation((callback) => {
        const reservoir = {
          id: 'reservoir-1',
          name: 'Test Reservoir',
          volumeL: 100,
          medium: 'hydro',
          targetPhMin: 5.5,
          targetPhMax: 6.5,
          targetEcMin25c: 1.2,
          targetEcMax25c: 1.8,
          ppmScale: '500',
        };
        callback(reservoir);
        return Promise.resolve(reservoir);
      });

      (database as any).get = jest.fn().mockReturnValue({
        create: mockCreate,
      });
      (database as any).write = jest
        .fn()
        .mockImplementation((callback) => callback());

      const data: CreateReservoirData = {
        name: 'Test Reservoir',
        volumeL: 100,
        medium: 'hydro',
        targetPhMin: 5.5,
        targetPhMax: 6.5,
        targetEcMin25c: 1.2,
        targetEcMax25c: 1.8,
        ppmScale: '500',
      };

      const result = await createReservoir(data, 'user-1');

      expect(result).toBeDefined();
      expect(mockCreate).toHaveBeenCalled();
    });

    it('should reject empty name', async () => {
      const data: CreateReservoirData = {
        name: '',
        volumeL: 100,
        medium: 'hydro',
        targetPhMin: 5.5,
        targetPhMax: 6.5,
        targetEcMin25c: 1.2,
        targetEcMax25c: 1.8,
        ppmScale: '500',
      };

      await expect(createReservoir(data)).rejects.toThrow(
        'Reservoir name cannot be empty'
      );
    });

    it('should reject invalid volume', async () => {
      const data: CreateReservoirData = {
        name: 'Test',
        volumeL: -10,
        medium: 'hydro',
        targetPhMin: 5.5,
        targetPhMax: 6.5,
        targetEcMin25c: 1.2,
        targetEcMax25c: 1.8,
        ppmScale: '500',
      };

      await expect(createReservoir(data)).rejects.toThrow(
        'Reservoir volume must be greater than 0'
      );
    });

    it('should reject invalid pH range', async () => {
      const data: CreateReservoirData = {
        name: 'Test',
        volumeL: 100,
        medium: 'hydro',
        targetPhMin: 6.5,
        targetPhMax: 5.5,
        targetEcMin25c: 1.2,
        targetEcMax25c: 1.8,
        ppmScale: '500',
      };

      await expect(createReservoir(data)).rejects.toThrow(
        'Target pH min must be less than pH max'
      );
    });

    it('should reject invalid EC range', async () => {
      const data: CreateReservoirData = {
        name: 'Test',
        volumeL: 100,
        medium: 'hydro',
        targetPhMin: 5.5,
        targetPhMax: 6.5,
        targetEcMin25c: 1.8,
        targetEcMax25c: 1.2,
        ppmScale: '500',
      };

      await expect(createReservoir(data)).rejects.toThrow(
        'Target EC min must be less than EC max'
      );
    });
  });

  describe('updateReservoir', () => {
    it('should update reservoir fields', async () => {
      const mockUpdate = jest.fn().mockImplementation((callback) => {
        const updated = { id: 'reservoir-1', name: 'Updated Name' };
        callback(updated);
        return Promise.resolve(updated);
      });

      const mockReservoir = {
        id: 'reservoir-1',
        update: mockUpdate,
      };

      (database as any).get = jest.fn().mockReturnValue({
        find: jest.fn().mockResolvedValue(mockReservoir),
      });
      (database as any).write = jest
        .fn()
        .mockImplementation((callback) => callback());

      await updateReservoir('reservoir-1', {
        name: 'Updated Name',
      });

      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe('deleteReservoir', () => {
    it('should soft delete reservoir', async () => {
      const mockMarkAsDeleted = jest.fn().mockResolvedValue(undefined);

      const mockReservoir = {
        id: 'reservoir-1',
        markAsDeleted: mockMarkAsDeleted,
      };

      (database as any).get = jest.fn().mockReturnValue({
        find: jest.fn().mockResolvedValue(mockReservoir),
      });
      (database as any).write = jest
        .fn()
        .mockImplementation((callback) => callback());

      await deleteReservoir('reservoir-1');

      expect(mockMarkAsDeleted).toHaveBeenCalled();
    });
  });

  describe('assignSourceWaterProfile', () => {
    it('should assign profile to reservoir', async () => {
      const mockUpdate = jest.fn().mockImplementation((callback) => {
        const updated = {
          id: 'reservoir-1',
          sourceWaterProfileId: 'profile-1',
        };
        callback(updated);
        return Promise.resolve(updated);
      });

      const mockReservoir = {
        id: 'reservoir-1',
        update: mockUpdate,
      };

      (database as any).get = jest.fn().mockReturnValue({
        find: jest.fn().mockResolvedValue(mockReservoir),
      });
      (database as any).write = jest
        .fn()
        .mockImplementation((callback) => callback());

      await assignSourceWaterProfile('reservoir-1', 'profile-1');

      expect(mockUpdate).toHaveBeenCalled();
    });
  });
});
