/**
 * Plant Profile Integration Tests
 *
 * Tests assessment history display and integration with plant profiles.
 *
 * Requirements:
 * - 3.4: Link assessment history to plant profiles
 * - 9.1: Enable assessment tracking
 */

import {
  getAssessmentById,
  getAssessmentCount,
  getAssessmentsByPlantId,
  getUnresolvedAssessments,
} from '@/lib/assessment/assessment-queries';
import { database } from '@/lib/watermelon';
import type { AssessmentModel } from '@/lib/watermelon-models/assessment';

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
          record.plantId = mockPlantId;
          record.userId = mockUserId;
          record.status = 'completed';
          record.inferenceMode = 'device';
          record.modelVersion = '1.0.0';
          record.predictedClass = 'nitrogen_deficiency';
          record.calibratedConfidence = 0.85;
          record.consentedForTraining = false;
          record.images = [
            'https://s3.amazonaws.com/growbro-assessments/image1.jpg',
          ];
          record.integritySha256 = [
            'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
          ];
          record.filenameKeys = ['image1.jpg'];
          record.plantContext = {
            id: mockPlantId,
            metadata: {
              strain: 'Northern Lights',
              stage: 'flowering',
              setup_type: 'indoor',
            },
          };
          record.qualityScores = [
            {
              score: 0.85,
              acceptable: true,
              issues: [],
            },
          ];
          record.createdAt = new Date();
          record.updatedAt = new Date();
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
            record.plantId = mockPlantId;
            record.userId = mockUserId;
            record.status = 'completed';
            record.inferenceMode = 'device';
            record.modelVersion = '1.0.0';
            record.consentedForTraining = false;
            record.images = [
              `https://s3.amazonaws.com/growbro-assessments/image${i + 1}.jpg`,
            ];
            record.integritySha256 = [
              `hash${i + 1}a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3`,
            ];
            record.filenameKeys = [`image${i + 1}.jpg`];
            record.plantContext = {
              id: mockPlantId,
              metadata: {
                strain: 'Northern Lights',
                stage: 'flowering',
                setup_type: 'indoor',
              },
            };
            record.qualityScores = [
              {
                score: 0.8 + i * 0.02, // Vary scores slightly
                acceptable: true,
                issues: [],
              },
            ];
            record.createdAt = new Date(Date.now() - i * 1000);
            record.updatedAt = new Date();
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
            record.plantId = mockPlantId;
            record.userId = mockUserId;
            record.status = 'completed';
            record.inferenceMode = 'device';
            record.modelVersion = '1.0.0';
            record.consentedForTraining = false;
            record.images = [
              `https://s3.amazonaws.com/growbro-assessments/timestamp_${timestamp}.jpg`,
            ];
            record.integritySha256 = [
              `timestamp_hash_${timestamp}a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3`,
            ];
            record.filenameKeys = [`timestamp_${timestamp}.jpg`];
            record.plantContext = {
              id: mockPlantId,
              metadata: {
                strain: 'Northern Lights',
                stage: 'flowering',
                setup_type: 'indoor',
              },
            };
            record.qualityScores = [
              {
                score: 0.82,
                acceptable: true,
                issues: [],
              },
            ];
            record.createdAt = new Date(timestamp);
            record.updatedAt = new Date();
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
          record.plantId = mockPlantId;
          record.userId = mockUserId;
          record.status = 'completed';
          record.inferenceMode = 'device';
          record.modelVersion = '1.0.0';
          record.issueResolved = true;
          record.consentedForTraining = false;
          record.images = [
            'https://s3.amazonaws.com/growbro-assessments/resolved_assessment.jpg',
          ];
          record.integritySha256 = [
            'resolved_hash_a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
          ];
          record.filenameKeys = ['resolved_assessment.jpg'];
          record.plantContext = {
            id: mockPlantId,
            metadata: {
              strain: 'Northern Lights',
              stage: 'flowering',
              setup_type: 'indoor',
            },
          };
          record.qualityScores = [
            {
              score: 0.9,
              acceptable: true,
              issues: [],
            },
          ];
          record.createdAt = new Date();
          record.updatedAt = new Date();
        });

        // Create unresolved assessment
        await collection.create((record) => {
          record.plantId = mockPlantId;
          record.userId = mockUserId;
          record.status = 'completed';
          record.inferenceMode = 'device';
          record.modelVersion = '1.0.0';
          record.issueResolved = false;
          record.consentedForTraining = false;
          record.images = [
            'https://s3.amazonaws.com/growbro-assessments/unresolved_assessment.jpg',
          ];
          record.integritySha256 = [
            'unresolved_hash_a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
          ];
          record.filenameKeys = ['unresolved_assessment.jpg'];
          record.plantContext = {
            id: mockPlantId,
            metadata: {
              strain: 'Northern Lights',
              stage: 'flowering',
              setup_type: 'indoor',
            },
          };
          record.qualityScores = [
            {
              score: 0.75,
              acceptable: true,
              issues: [
                {
                  type: 'blur',
                  severity: 'medium',
                  suggestion: 'Take photo in better lighting',
                },
              ],
            },
          ];
          record.createdAt = new Date();
          record.updatedAt = new Date();
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
          record.plantId = mockPlantId;
          record.userId = mockUserId;
          record.status = 'pending';
          record.inferenceMode = 'device';
          record.modelVersion = '1.0.0';
          record.consentedForTraining = false;
          record.images = [
            'https://s3.amazonaws.com/growbro-assessments/pending_assessment.jpg',
          ];
          record.integritySha256 = [
            'pending_hash_a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
          ];
          record.filenameKeys = ['pending_assessment.jpg'];
          record.plantContext = {
            id: mockPlantId,
            metadata: {
              strain: 'Northern Lights',
              stage: 'flowering',
              setup_type: 'indoor',
            },
          };
          record.qualityScores = [
            {
              score: 0.8,
              acceptable: true,
              issues: [],
            },
          ];
          record.createdAt = new Date();
          record.updatedAt = new Date();
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
            record.plantId = mockPlantId;
            record.userId = mockUserId;
            record.status = 'completed';
            record.inferenceMode = 'device';
            record.modelVersion = '1.0.0';
            record.consentedForTraining = false;
            record.images = [
              `https://s3.amazonaws.com/growbro-assessments/count_test_${i + 1}.jpg`,
            ];
            record.integritySha256 = [
              `count_hash_${i + 1}_a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3`,
            ];
            record.filenameKeys = [`count_test_${i + 1}.jpg`];
            record.plantContext = {
              id: mockPlantId,
              metadata: {
                strain: 'Northern Lights',
                stage: 'flowering',
                setup_type: 'indoor',
              },
            };
            record.qualityScores = [
              {
                score: 0.85 + i * 0.05, // Vary scores: 0.85, 0.90, 0.95
                acceptable: true,
                issues: [],
              },
            ];
            record.createdAt = new Date();
            record.updatedAt = new Date();
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
          r.plantId = mockPlantId;
          r.userId = mockUserId;
          r.status = 'completed';
          r.inferenceMode = 'device';
          r.modelVersion = '1.0.0';
          r.predictedClass = 'healthy';
          r.consentedForTraining = false;
          r.images = [
            'https://s3.amazonaws.com/growbro-assessments/get_by_id_test.jpg',
          ];
          r.integritySha256 = [
            'get_by_id_hash_a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
          ];
          r.filenameKeys = ['get_by_id_test.jpg'];
          r.plantContext = {
            id: mockPlantId,
            metadata: {
              strain: 'Northern Lights',
              stage: 'flowering',
              setup_type: 'indoor',
            },
          };
          r.qualityScores = [
            {
              score: 0.92,
              acceptable: true,
              issues: [],
            },
          ];
          r.createdAt = new Date();
          r.updatedAt = new Date();
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
