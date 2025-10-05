/**
 * Phase Tracker Tests
 *
 * Tests for phase computation and progress tracking
 */

import { DateTime } from 'luxon';

import type { Playbook } from '@/types/playbook';

import {
  computeCurrentPhase,
  getPhaseProgress,
  getPhaseSummary,
} from '../phase-tracker';

// Mock WatermelonDB
jest.mock('@/lib/watermelon', () => ({
  database: {
    get: jest.fn(() => ({
      query: jest.fn(() => ({
        fetch: jest.fn(() => Promise.resolve([])),
      })),
    })),
  },
}));

describe('Phase Tracker', () => {
  const mockPlaybook: Playbook = {
    id: 'playbook-1',
    name: 'Test Playbook',
    setup: 'auto_indoor',
    locale: 'en',
    phaseOrder: ['seedling', 'veg', 'flower', 'harvest'],
    steps: [
      {
        id: 'step-1',
        phase: 'seedling',
        title: 'Water seedling',
        descriptionIcu: 'Water your seedling',
        relativeDay: 0,
        defaultReminderLocal: '08:00',
        taskType: 'water',
        durationDays: 14,
        dependencies: [],
      },
      {
        id: 'step-2',
        phase: 'veg',
        title: 'Feed plant',
        descriptionIcu: 'Feed your plant',
        relativeDay: 14,
        defaultReminderLocal: '08:00',
        taskType: 'feed',
        durationDays: 28,
        dependencies: [],
      },
      {
        id: 'step-3',
        phase: 'flower',
        title: 'Monitor trichomes',
        descriptionIcu: 'Check trichomes',
        relativeDay: 42,
        defaultReminderLocal: '20:00',
        taskType: 'monitor',
        durationDays: 56,
        dependencies: [],
      },
      {
        id: 'step-4',
        phase: 'harvest',
        title: 'Harvest plant',
        descriptionIcu: 'Harvest your plant',
        relativeDay: 98,
        defaultReminderLocal: '08:00',
        taskType: 'custom',
        durationDays: 7,
        dependencies: [],
      },
    ],
    metadata: {
      difficulty: 'beginner',
      estimatedDuration: 15,
    },
    isTemplate: true,
    isCommunity: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  };

  describe('computeCurrentPhase', () => {
    it('should compute seedling phase at start', async () => {
      const plantStartDate = DateTime.now().toISO()!;
      const timezone = 'America/Los_Angeles';

      const result = await computeCurrentPhase({
        plantId: 'plant-1',
        playbookId: 'playbook-1',
        playbook: mockPlaybook,
        plantStartDate,
        timezone,
      });

      expect(result.currentPhase).toBe('seedling');
      expect(result.phaseIndex).toBe(0);
      expect(result.daysInPhase).toBe(0);
    });

    it('should compute veg phase after 14 days', async () => {
      const plantStartDate = DateTime.now().minus({ days: 20 }).toISO()!;
      const timezone = 'America/Los_Angeles';

      const result = await computeCurrentPhase({
        plantId: 'plant-1',
        playbookId: 'playbook-1',
        playbook: mockPlaybook,
        plantStartDate,
        timezone,
      });

      expect(result.currentPhase).toBe('veg');
      expect(result.phaseIndex).toBe(1);
      expect(result.daysInPhase).toBeGreaterThan(0);
    });

    it('should compute flower phase after 42 days', async () => {
      const plantStartDate = DateTime.now().minus({ days: 50 }).toISO()!;
      const timezone = 'America/Los_Angeles';

      const result = await computeCurrentPhase({
        plantId: 'plant-1',
        playbookId: 'playbook-1',
        playbook: mockPlaybook,
        plantStartDate,
        timezone,
      });

      expect(result.currentPhase).toBe('flower');
      expect(result.phaseIndex).toBe(2);
    });

    it('should compute harvest phase after 98 days', async () => {
      const plantStartDate = DateTime.now().minus({ days: 100 }).toISO()!;
      const timezone = 'America/Los_Angeles';

      const result = await computeCurrentPhase({
        plantId: 'plant-1',
        playbookId: 'playbook-1',
        playbook: mockPlaybook,
        plantStartDate,
        timezone,
      });

      expect(result.currentPhase).toBe('harvest');
      expect(result.phaseIndex).toBe(3);
    });

    it('should calculate progress percentage correctly', async () => {
      const plantStartDate = DateTime.now().minus({ days: 7 }).toISO()!;
      const timezone = 'America/Los_Angeles';

      const result = await computeCurrentPhase({
        plantId: 'plant-1',
        playbookId: 'playbook-1',
        playbook: mockPlaybook,
        plantStartDate,
        timezone,
      });

      expect(result.progressPercent).toBeGreaterThan(0);
      expect(result.progressPercent).toBeLessThanOrEqual(100);
    });
  });

  describe('getPhaseProgress', () => {
    it('should return progress for all phases', async () => {
      const result = await getPhaseProgress({
        plantId: 'plant-1',
        playbookId: 'playbook-1',
        playbook: mockPlaybook,
        currentPhaseIndex: 0,
        timezone: 'America/Los_Angeles',
      });

      expect(result).toHaveLength(4);
      expect(result[0].phase).toBe('seedling');
      expect(result[1].phase).toBe('veg');
      expect(result[2].phase).toBe('flower');
      expect(result[3].phase).toBe('harvest');
    });

    it('should calculate task counts correctly', async () => {
      const result = await getPhaseProgress({
        plantId: 'plant-1',
        playbookId: 'playbook-1',
        playbook: mockPlaybook,
        currentPhaseIndex: 0,
        timezone: 'America/Los_Angeles',
      });

      result.forEach((phase) => {
        expect(phase.totalTasks).toBeGreaterThanOrEqual(0);
        expect(phase.completedTasks).toBeGreaterThanOrEqual(0);
        expect(phase.currentTasks).toBeGreaterThanOrEqual(0);
        expect(phase.upcomingTasks).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('getPhaseSummary', () => {
    it('should return null for phase with no tasks', async () => {
      const result = await getPhaseSummary({
        plantId: 'plant-1',
        playbookId: 'playbook-1',
        phaseIndex: 0,
        phase: 'seedling',
      });

      expect(result).toBeNull();
    });
  });
});
