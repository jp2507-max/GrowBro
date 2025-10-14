import { type Database } from '@nozbe/watermelondb';

import type { FeedingPhase } from '@/lib/nutrient-engine/types';

import {
  applyStrainAdjustments,
  createStarterTemplate,
  createTemplate,
  deleteTemplate,
  getDefaultPhaseConfig,
  getTemplate,
  listTemplates,
  TemplateValidationError,
  updateTemplate,
  validatePhase,
  validateTemplate,
} from './template-service';

/**
 * Unit tests for feeding template service
 *
 * Tests template CRUD operations, validation rules,
 * strain adjustments, and default configurations.
 *
 * Requirements: 1.1, 1.2, 1.6, 4.1, 4.2, 4.6, 4.7
 */

// Mock WatermelonDB
jest.mock('@nozbe/watermelondb');

describe('Template Service', () => {
  describe('validatePhase', () => {
    test('validates valid phase configuration', () => {
      const validPhase: FeedingPhase = {
        phase: 'veg',
        durationDays: 28,
        nutrients: [
          { nutrient: 'N', value: 2.5, unit: 'ml/L' },
          { nutrient: 'P', value: 1.5, unit: 'ml/L' },
        ],
        phRange: [5.5, 6.2],
        ecRange25c: [1.0, 1.6],
      };

      expect(() => validatePhase(validPhase)).not.toThrow();
    });

    test('rejects invalid phase type', () => {
      const invalidPhase = {
        phase: 'invalid' as any,
        durationDays: 28,
        nutrients: [],
        phRange: [5.5, 6.2] as [number, number],
        ecRange25c: [1.0, 1.6] as [number, number],
      };

      expect(() => validatePhase(invalidPhase as any)).toThrow(
        TemplateValidationError
      );
      expect(() => validatePhase(invalidPhase as any)).toThrow(/Invalid phase/);
    });

    test('rejects duration < 1 day', () => {
      const invalidPhase: FeedingPhase = {
        phase: 'veg',
        durationDays: 0,
        nutrients: [],
        phRange: [5.5, 6.2],
        ecRange25c: [1.0, 1.6],
      };

      expect(() => validatePhase(invalidPhase)).toThrow(
        TemplateValidationError
      );
      expect(() => validatePhase(invalidPhase)).toThrow(/Duration must be/);
    });

    test('rejects duration > 365 days', () => {
      const invalidPhase: FeedingPhase = {
        phase: 'veg',
        durationDays: 400,
        nutrients: [],
        phRange: [5.5, 6.2],
        ecRange25c: [1.0, 1.6],
      };

      expect(() => validatePhase(invalidPhase)).toThrow(
        TemplateValidationError
      );
      expect(() => validatePhase(invalidPhase)).toThrow(/Duration must be/);
    });

    test('rejects single-point pH (min === max)', () => {
      const invalidPhase: FeedingPhase = {
        phase: 'veg',
        durationDays: 28,
        nutrients: [],
        phRange: [6.0, 6.0], // Single point, not a range
        ecRange25c: [1.0, 1.6],
      };

      expect(() => validatePhase(invalidPhase)).toThrow(
        TemplateValidationError
      );
      expect(() => validatePhase(invalidPhase)).toThrow(/pH range min.*max/);
    });

    test('rejects pH range where min > max', () => {
      const invalidPhase: FeedingPhase = {
        phase: 'veg',
        durationDays: 28,
        nutrients: [],
        phRange: [6.5, 5.5], // Inverted range
        ecRange25c: [1.0, 1.6],
      };

      expect(() => validatePhase(invalidPhase)).toThrow(
        TemplateValidationError
      );
      expect(() => validatePhase(invalidPhase)).toThrow(/pH range min.*max/);
    });

    test('rejects pH range outside 4.0-8.5', () => {
      const tooLow: FeedingPhase = {
        phase: 'veg',
        durationDays: 28,
        nutrients: [],
        phRange: [3.5, 4.5],
        ecRange25c: [1.0, 1.6],
      };

      expect(() => validatePhase(tooLow)).toThrow(TemplateValidationError);
      expect(() => validatePhase(tooLow)).toThrow(/pH range must be within/);

      const tooHigh: FeedingPhase = {
        phase: 'veg',
        durationDays: 28,
        nutrients: [],
        phRange: [7.5, 9.0],
        ecRange25c: [1.0, 1.6],
      };

      expect(() => validatePhase(tooHigh)).toThrow(TemplateValidationError);
      expect(() => validatePhase(tooHigh)).toThrow(/pH range must be within/);
    });

    test('rejects single-point EC (min === max)', () => {
      const invalidPhase: FeedingPhase = {
        phase: 'veg',
        durationDays: 28,
        nutrients: [],
        phRange: [5.5, 6.2],
        ecRange25c: [1.5, 1.5], // Single point, not a range
      };

      expect(() => validatePhase(invalidPhase)).toThrow(
        TemplateValidationError
      );
      expect(() => validatePhase(invalidPhase)).toThrow(/EC range min.*max/);
    });

    test('rejects EC range where min > max', () => {
      const invalidPhase: FeedingPhase = {
        phase: 'veg',
        durationDays: 28,
        nutrients: [],
        phRange: [5.5, 6.2],
        ecRange25c: [2.0, 1.0], // Inverted range
      };

      expect(() => validatePhase(invalidPhase)).toThrow(
        TemplateValidationError
      );
      expect(() => validatePhase(invalidPhase)).toThrow(/EC range min.*max/);
    });

    test('rejects EC range outside 0.0-4.0 mS/cm', () => {
      const tooHigh: FeedingPhase = {
        phase: 'flower',
        durationDays: 56,
        nutrients: [],
        phRange: [5.5, 6.2],
        ecRange25c: [3.0, 5.0],
      };

      expect(() => validatePhase(tooHigh)).toThrow(TemplateValidationError);
      expect(() => validatePhase(tooHigh)).toThrow(/EC range must be within/);

      const negative: FeedingPhase = {
        phase: 'flower',
        durationDays: 56,
        nutrients: [],
        phRange: [5.5, 6.2],
        ecRange25c: [-0.5, 1.0],
      };

      expect(() => validatePhase(negative)).toThrow(TemplateValidationError);
      expect(() => validatePhase(negative)).toThrow(/EC range must be within/);
    });

    test('validates empty nutrients array', () => {
      const phase: FeedingPhase = {
        phase: 'flush',
        durationDays: 7,
        nutrients: [],
        phRange: [5.5, 6.2],
        ecRange25c: [0.0, 0.2],
      };

      expect(() => validatePhase(phase)).not.toThrow();
    });

    test('rejects invalid nutrient values', () => {
      const negativeValue: FeedingPhase = {
        phase: 'veg',
        durationDays: 28,
        nutrients: [{ nutrient: 'N', value: -1, unit: 'ml/L' }],
        phRange: [5.5, 6.2],
        ecRange25c: [1.0, 1.6],
      };

      expect(() => validatePhase(negativeValue)).toThrow(
        TemplateValidationError
      );
      expect(() => validatePhase(negativeValue)).toThrow(/non-negative/);
    });

    test('rejects nutrients without name', () => {
      const noName: FeedingPhase = {
        phase: 'veg',
        durationDays: 28,
        nutrients: [{ nutrient: '', value: 2.5, unit: 'ml/L' }],
        phRange: [5.5, 6.2],
        ecRange25c: [1.0, 1.6],
      };

      expect(() => validatePhase(noName)).toThrow(TemplateValidationError);
    });

    test('rejects nutrients without unit', () => {
      const noUnit: FeedingPhase = {
        phase: 'veg',
        durationDays: 28,
        nutrients: [{ nutrient: 'N', value: 2.5, unit: '' }],
        phRange: [5.5, 6.2],
        ecRange25c: [1.0, 1.6],
      };

      expect(() => validatePhase(noUnit)).toThrow(TemplateValidationError);
    });
  });

  describe('validateTemplate', () => {
    test('validates complete valid template', () => {
      const validTemplate = {
        name: 'Test Template',
        medium: 'coco' as const,
        phases: [
          {
            phase: 'veg' as const,
            durationDays: 28,
            nutrients: [{ nutrient: 'N', value: 2.5, unit: 'ml/L' }],
            phRange: [5.5, 6.2] as [number, number],
            ecRange25c: [1.0, 1.6] as [number, number],
          },
        ],
      };

      expect(() => validateTemplate(validTemplate)).not.toThrow();
    });

    test('rejects empty name', () => {
      const template = {
        name: '',
        medium: 'coco' as const,
        phases: [
          {
            phase: 'veg' as const,
            durationDays: 28,
            nutrients: [],
            phRange: [5.5, 6.2] as [number, number],
            ecRange25c: [1.0, 1.6] as [number, number],
          },
        ],
      };

      expect(() => validateTemplate(template)).toThrow(TemplateValidationError);
      expect(() => validateTemplate(template)).toThrow(/name is required/);
    });

    test('rejects name > 100 characters', () => {
      const template = {
        name: 'a'.repeat(101),
        medium: 'coco' as const,
        phases: [
          {
            phase: 'veg' as const,
            durationDays: 28,
            nutrients: [],
            phRange: [5.5, 6.2] as [number, number],
            ecRange25c: [1.0, 1.6] as [number, number],
          },
        ],
      };

      expect(() => validateTemplate(template)).toThrow(TemplateValidationError);
      expect(() => validateTemplate(template)).toThrow(/100 characters/);
    });

    test('rejects invalid medium', () => {
      const template = {
        name: 'Test',
        medium: 'invalid' as any,
        phases: [
          {
            phase: 'veg' as const,
            durationDays: 28,
            nutrients: [],
            phRange: [5.5, 6.2] as [number, number],
            ecRange25c: [1.0, 1.6] as [number, number],
          },
        ],
      };

      expect(() => validateTemplate(template)).toThrow(TemplateValidationError);
      expect(() => validateTemplate(template)).toThrow(/Invalid medium/);
    });

    test('rejects template with no phases', () => {
      const template = {
        name: 'Test',
        medium: 'coco' as const,
        phases: [],
      };

      expect(() => validateTemplate(template)).toThrow(TemplateValidationError);
      expect(() => validateTemplate(template)).toThrow(/at least one phase/);
    });

    test('propagates phase validation errors with context', () => {
      const template = {
        name: 'Test',
        medium: 'coco' as const,
        phases: [
          {
            phase: 'veg' as const,
            durationDays: -1, // Invalid
            nutrients: [],
            phRange: [5.5, 6.2] as [number, number],
            ecRange25c: [1.0, 1.6] as [number, number],
          },
        ],
      };

      expect(() => validateTemplate(template)).toThrow(TemplateValidationError);
      expect(() => validateTemplate(template)).toThrow(/Phase 1.*vegetative/);
    });
  });

  describe('getDefaultPhaseConfig', () => {
    test('returns soilless defaults for coco', () => {
      const config = getDefaultPhaseConfig('coco', 'veg');

      expect(config.phase).toBe('veg');
      expect(config.durationDays).toBe(28);
      expect(config.phRange).toEqual([5.4, 6.4]); // Soilless norm
      expect(config.ecRange25c).toEqual([1.0, 1.6]);
      expect(config.nutrients).toEqual([]);
    });

    test('returns adjusted pH for soil medium', () => {
      const config = getDefaultPhaseConfig('soil', 'veg');

      expect(config.phRange).toEqual([6.0, 7.0]); // Soil prefers higher pH
    });

    test('returns seedling duration of 14 days', () => {
      const config = getDefaultPhaseConfig('coco', 'seedling');

      expect(config.durationDays).toBe(14);
      expect(config.ecRange25c).toEqual([0.4, 0.8]); // Lower EC for seedlings
    });

    test('returns flush duration of 7 days', () => {
      const config = getDefaultPhaseConfig('hydro', 'flush');

      expect(config.durationDays).toBe(7);
      expect(config.ecRange25c).toEqual([0.0, 0.2]); // Very low EC for flush
    });

    test('returns flowering EC range', () => {
      const config = getDefaultPhaseConfig('coco', 'flower');

      expect(config.ecRange25c).toEqual([1.4, 2.2]); // Higher EC for flowering
    });
  });

  describe('Database Operations', () => {
    let mockDatabase: jest.Mocked<Database>;
    let mockCollection: any;
    let mockTemplate: any;

    beforeEach(() => {
      // Setup mocks
      mockTemplate = {
        id: 'template-1',
        name: 'Test Template',
        medium: 'coco',
        phases: [
          {
            phase: 'veg',
            durationDays: 28,
            nutrients: [],
            phRange: [5.5, 6.2],
            ecRange25c: [1.0, 1.6],
          },
        ],
        targetRanges: {},
        isCustom: false,
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        markAsDeleted: jest.fn(),
        update: jest.fn((fn) => {
          fn(mockTemplate);
          return Promise.resolve(mockTemplate);
        }),
      };

      mockCollection = {
        create: jest.fn((fn) => {
          fn(mockTemplate);
          return Promise.resolve(mockTemplate);
        }),
        find: jest.fn().mockResolvedValue(mockTemplate),
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue([mockTemplate]),
        }),
      };

      mockDatabase = {
        get: jest.fn().mockReturnValue(mockCollection),
        write: jest.fn((fn) => fn()),
      } as any;
    });

    describe('createTemplate', () => {
      test('creates valid template', async () => {
        const options = {
          name: 'Test Template',
          medium: 'coco' as const,
          phases: [
            {
              phase: 'veg' as const,
              durationDays: 28,
              nutrients: [],
              phRange: [5.5, 6.2] as [number, number],
              ecRange25c: [1.0, 1.6] as [number, number],
            },
          ],
        };

        const result = await createTemplate(mockDatabase, options);

        expect(result.id).toBe('template-1');
        expect(result.name).toBe('Test Template');
        expect(result.medium).toBe('coco');
        expect(mockDatabase.write).toHaveBeenCalled();
        expect(mockCollection.create).toHaveBeenCalled();
      });

      test('throws validation error for invalid template', async () => {
        const options = {
          name: '',
          medium: 'coco' as const,
          phases: [],
        };

        await expect(createTemplate(mockDatabase, options)).rejects.toThrow(
          TemplateValidationError
        );
      });
    });

    describe('getTemplate', () => {
      test('returns template by ID', async () => {
        const result = await getTemplate(mockDatabase, 'template-1');

        expect(result).not.toBeNull();
        expect(result?.id).toBe('template-1');
        expect(mockCollection.find).toHaveBeenCalledWith('template-1');
      });

      test('returns null for non-existent template', async () => {
        mockCollection.find.mockRejectedValueOnce(new Error('Not found'));

        const result = await getTemplate(mockDatabase, 'non-existent');

        expect(result).toBeNull();
      });
    });

    describe('updateTemplate', () => {
      test('updates template fields', async () => {
        const updates = {
          name: 'Updated Name',
        };

        const result = await updateTemplate(
          mockDatabase,
          'template-1',
          updates
        );

        expect(result.name).toBe('Updated Name');
        expect(mockTemplate.update).toHaveBeenCalled();
      });

      test('validates updated data', async () => {
        const updates = {
          phases: [], // Invalid: no phases
        };

        await expect(
          updateTemplate(mockDatabase, 'template-1', updates)
        ).rejects.toThrow(TemplateValidationError);
      });

      test('throws error for non-existent template', async () => {
        mockCollection.find.mockRejectedValueOnce(new Error('Not found'));

        await expect(
          updateTemplate(mockDatabase, 'non-existent', { name: 'New' })
        ).rejects.toThrow();
      });
    });

    describe('deleteTemplate', () => {
      test('marks template as deleted', async () => {
        await deleteTemplate(mockDatabase, 'template-1');

        expect(mockTemplate.markAsDeleted).toHaveBeenCalled();
        expect(mockDatabase.write).toHaveBeenCalled();
      });

      test('throws error for non-existent template', async () => {
        mockCollection.find.mockRejectedValueOnce(new Error('Not found'));

        await expect(
          deleteTemplate(mockDatabase, 'non-existent')
        ).rejects.toThrow();
      });
    });

    describe('listTemplates', () => {
      test('returns all templates', async () => {
        const result = await listTemplates(mockDatabase);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('template-1');
      });
    });

    describe('createStarterTemplate', () => {
      test('creates template with all phases', async () => {
        const result = await createStarterTemplate(mockDatabase, 'coco');

        expect(result.name).toContain('Starter');
        expect(result.medium).toBe('coco');
        expect(mockCollection.create).toHaveBeenCalled();
      });

      test('uses custom name if provided', async () => {
        const result = await createStarterTemplate(
          mockDatabase,
          'hydro',
          'My Custom Template'
        );

        expect(result.name).toBe('My Custom Template');
      });
    });

    describe('applyStrainAdjustments', () => {
      test('creates adjusted template with offsets', async () => {
        const adjustment = {
          strainId: 'strain-1',
          strainName: 'Test Strain',
          phaseAdjustments: [
            {
              phase: 'veg' as const,
              phOffset: 0.2,
              ecOffset: 0.3,
            },
          ],
        };

        const result = await applyStrainAdjustments(
          mockDatabase,
          'template-1',
          adjustment
        );

        expect(result.name).toContain('Test Strain');
        expect(result.isCustom).toBe(true);
        expect(mockCollection.create).toHaveBeenCalled();
      });

      test('preserves phases without adjustments', async () => {
        mockTemplate.phases = [
          {
            phase: 'veg',
            durationDays: 28,
            nutrients: [],
            phRange: [5.5, 6.2],
            ecRange25c: [1.0, 1.6],
          },
          {
            phase: 'flower',
            durationDays: 56,
            nutrients: [],
            phRange: [5.8, 6.5],
            ecRange25c: [1.4, 2.2],
          },
        ];

        const adjustment = {
          strainId: 'strain-1',
          strainName: 'Test Strain',
          phaseAdjustments: [
            {
              phase: 'flower' as const,
              ecOffset: 0.2,
            },
          ],
        };

        const result = await applyStrainAdjustments(
          mockDatabase,
          'template-1',
          adjustment
        );

        // First phase should be unchanged
        const vegPhase = result.phases[0];
        expect(vegPhase.phRange).toEqual([5.5, 6.2]);
        expect(vegPhase.ecRange25c).toEqual([1.0, 1.6]);
      });

      test('overrides phase duration when specified', async () => {
        const adjustment = {
          strainId: 'strain-1',
          strainName: 'Test Strain',
          phaseAdjustments: [
            {
              phase: 'veg' as const,
              durationDaysOverride: 35,
            },
          ],
        };

        const result = await applyStrainAdjustments(
          mockDatabase,
          'template-1',
          adjustment
        );

        expect(result.phases[0].durationDays).toBe(35);
      });

      test('throws error for non-existent base template', async () => {
        mockCollection.find.mockRejectedValueOnce(new Error('Not found'));

        const adjustment = {
          strainId: 'strain-1',
          strainName: 'Test Strain',
          phaseAdjustments: [],
        };

        await expect(
          applyStrainAdjustments(mockDatabase, 'non-existent', adjustment)
        ).rejects.toThrow(/not found/);
      });
    });
  });
});
