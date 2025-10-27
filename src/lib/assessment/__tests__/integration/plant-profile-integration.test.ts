/**
 * Plant Profile Integration Tests
 *
 * Tests assessment history display and integration with plant profiles.
 *
 * Requirements:
 * - 3.4: Link assessment history to plant profiles
 * - 9.1: Enable assessment tracking
 */

import { database } from '@/lib/watermelon';
import type { AssessmentModel } from '@/lib/watermelon-models/assessment';

import {
  getAssessmentById,
  getAssessmentCount,
  getAssessmentsByPlantId,
  getUnresolvedAssessments,
} from '../../assessment-queries';

describe('Plant Profile Integration', () => {
  const mockPlantId = 'plant-123';
  const mockUserId = 'user-456';

  beforeEach(async () => {
    // Clear database before each test
    await database.write(async () => {
      const assessments = await database.collections
        .get<AssessmentModel>('assessments')
        .query()
        .fetch();
      await Promise.all(assessments.map((a) => a.destroyPermanently()));
    });
  });

  describe('getAssessmentsByPlantId', () => {
    it('should return assessments for a specific plant', async () => {
      // Create test assessments
      await database.write(async () => {
        const collection =
          database.collections.get<AssessmentModel>('assessments');
        await collection.create((record) => {
          (record as any).plantId = mockPlantId;
          (record as any).userId = mockUserId;
          (record as any).status = 'completed';
          (record as any).inferenceMode = 'device';
          (record as any).modelVersion = '1.0.0';
          (record as any).predictedClass = 'nitrogen_deficiency';
          (record as any).calibratedConfidence = 0.85;
          (record as any).consentedForTraining = false;
          (record as any).createdAt = new Date();
          (record as any).updatedAt = new Date();
        });
      });

      const results = await getAssessmentsByPlantId(mockPlantId);

      expect(results).toHaveLength(1);
      expect(results[0].plantId).toBe(mockPlantId);
      expect(results[0].predictedClass).toBe('nitrogen_deficiency');
      expect(results[0].calibratedConfidence).toBe(0.85);
    });

    it('should return empty array for plant with no assessments', async () => {
      const results = await getAssessmentsByPlantId('nonexistent-plant');
      expect(results).toHaveLength(0);
    });

    it('should respect limit parameter', async () => {
      // Create 5 assessments
      await database.write(async () => {
        const collection =
          database.collections.get<AssessmentModel>('assessments');
        for (let i = 0; i < 5; i++) {
          await collection.create((record) => {
            (record as any).plantId = mockPlantId;
            (record as any).userId = mockUserId;
            (record as any).status = 'completed';
            (record as any).inferenceMode = 'device';
            (record as any).modelVersion = '1.0.0';
            (record as any).consentedForTraining = false;
            (record as any).createdAt = new Date(Date.now() - i * 1000);
            (record as any).updatedAt = new Date();
          });
        }
      });

      const results = await getAssessmentsByPlantId(mockPlantId, 3);
      expect(results).toHaveLength(3);
    });

    it('should return assessments sorted by creation date (newest first)', async () => {
      const timestamps = [
        Date.now() - 3000,
        Date.now() - 1000,
        Date.now() - 2000,
      ];

      await database.write(async () => {
        const collection =
          database.collections.get<AssessmentModel>('assessments');
        for (const timestamp of timestamps) {
          await collection.create((record) => {
            (record as any).plantId = mockPlantId;
            (record as any).userId = mockUserId;
            (record as any).status = 'completed';
            (record as any).inferenceMode = 'device';
            (record as any).modelVersion = '1.0.0';
            (record as any).consentedForTraining = false;
            (record as any).createdAt = new Date(timestamp);
            (record as any).updatedAt = new Date();
          });
        }
      });

      const results = await getAssessmentsByPlantId(mockPlantId);

      expect(results).toHaveLength(3);
      // Verify newest first
      expect(results[0].createdAt.getTime()).toBeGreaterThan(
        results[1].createdAt.getTime()
      );
      expect(results[1].createdAt.getTime()).toBeGreaterThan(
        results[2].createdAt.getTime()
      );
    });
  });

  describe('getUnresolvedAssessments', () => {
    it('should return only unresolved assessments', async () => {
      await database.write(async () => {
        const collection =
          database.collections.get<AssessmentModel>('assessments');

        // Create resolved assessment
        await collection.create((record) => {
          (record as any).plantId = mockPlantId;
          (record as any).userId = mockUserId;
          (record as any).status = 'completed';
          (record as any).inferenceMode = 'device';
          (record as any).modelVersion = '1.0.0';
          (record as any).issueResolved = true;
          (record as any).consentedForTraining = false;
          (record as any).createdAt = new Date();
          (record as any).updatedAt = new Date();
        });

        // Create unresolved assessment
        await collection.create((record) => {
          (record as any).plantId = mockPlantId;
          (record as any).userId = mockUserId;
          (record as any).status = 'completed';
          (record as any).inferenceMode = 'device';
          (record as any).modelVersion = '1.0.0';
          (record as any).issueResolved = false;
          (record as any).consentedForTraining = false;
          (record as any).createdAt = new Date();
          (record as any).updatedAt = new Date();
        });
      });

      const results = await getUnresolvedAssessments(mockPlantId);

      expect(results).toHaveLength(1);
      expect(results[0].issueResolved).toBe(false);
    });

    it('should only return completed assessments', async () => {
      await database.write(async () => {
        const collection =
          database.collections.get<AssessmentModel>('assessments');

        // Create pending assessment
        await collection.create((record) => {
          (record as any).plantId = mockPlantId;
          (record as any).userId = mockUserId;
          (record as any).status = 'pending';
          (record as any).inferenceMode = 'device';
          (record as any).modelVersion = '1.0.0';
          (record as any).consentedForTraining = false;
          (record as any).createdAt = new Date();
          (record as any).updatedAt = new Date();
        });
      });

      const results = await getUnresolvedAssessments(mockPlantId);
      expect(results).toHaveLength(0);
    });
  });

  describe('getAssessmentCount', () => {
    it('should return correct count of assessments', async () => {
      await database.write(async () => {
        const collection =
          database.collections.get<AssessmentModel>('assessments');
        for (let i = 0; i < 3; i++) {
          await collection.create((record) => {
            (record as any).plantId = mockPlantId;
            (record as any).userId = mockUserId;
            (record as any).status = 'completed';
            (record as any).inferenceMode = 'device';
            (record as any).modelVersion = '1.0.0';
            (record as any).consentedForTraining = false;
            (record as any).createdAt = new Date();
            (record as any).updatedAt = new Date();
          });
        }
      });

      const count = await getAssessmentCount(mockPlantId);
      expect(count).toBe(3);
    });

    it('should return 0 for plant with no assessments', async () => {
      const count = await getAssessmentCount('nonexistent-plant');
      expect(count).toBe(0);
    });
  });

  describe('getAssessmentById', () => {
    it('should return assessment by ID', async () => {
      let assessmentId: string = '';

      await database.write(async () => {
        const collection =
          database.collections.get<AssessmentModel>('assessments');
        const record = await collection.create((r) => {
          (r as any).plantId = mockPlantId;
          (r as any).userId = mockUserId;
          (r as any).status = 'completed';
          (r as any).inferenceMode = 'device';
          (r as any).modelVersion = '1.0.0';
          (r as any).predictedClass = 'healthy';
          (r as any).consentedForTraining = false;
          (r as any).createdAt = new Date();
          (r as any).updatedAt = new Date();
        });
        assessmentId = record.id;
      });

      const result = await getAssessmentById(assessmentId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(assessmentId);
      expect(result?.predictedClass).toBe('healthy');
    });

    it('should return null for nonexistent ID', async () => {
      const result = await getAssessmentById('nonexistent-id');
      expect(result).toBeNull();
    });
  });
});
