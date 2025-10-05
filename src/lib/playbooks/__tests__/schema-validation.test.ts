/**
 * Playbook Schema Validation Tests
 * Tests JSON Schema 2020-12 compliance for playbook templates
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

describe('Playbook Schema Validation', () => {
  let ajv: Ajv;

  beforeEach(() => {
    ajv = new Ajv({ strict: true, allErrors: true });
    addFormats(ajv);
  });

  const playbookSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://canabro.app/schemas/playbook.json',
    type: 'object',
    required: ['id', 'name', 'setup', 'locale', 'steps'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string', minLength: 1 },
      setup: {
        enum: ['auto_indoor', 'auto_outdoor', 'photo_indoor', 'photo_outdoor'],
      },
      locale: { type: 'string', pattern: '^[a-z]{2}(-[A-Z]{2})?$' },
      phaseOrder: {
        type: 'array',
        items: { enum: ['seedling', 'veg', 'flower', 'harvest'] },
      },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'phase', 'title', 'relativeDay', 'taskType'],
          properties: {
            id: { type: 'string' },
            phase: { enum: ['seedling', 'veg', 'flower', 'harvest'] },
            title: { type: 'string' },
            descriptionIcu: { type: 'string' },
            relativeDay: { type: 'integer' },
            rrule: { type: 'string' },
            defaultReminderLocal: {
              type: 'string',
              pattern: '^\\d{2}:\\d{2}$',
            },
            taskType: {
              enum: [
                'water',
                'feed',
                'prune',
                'train',
                'monitor',
                'note',
                'custom',
              ],
            },
            durationDays: { type: 'integer' },
            dependencies: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  };

  describe('Valid Playbook Schemas', () => {
    it('should validate minimal valid playbook', () => {
      const validate = ajv.compile(playbookSchema);
      const playbook = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Auto Indoor Basic',
        setup: 'auto_indoor',
        locale: 'en',
        steps: [
          {
            id: 'step-1',
            phase: 'seedling',
            title: 'Initial watering',
            relativeDay: 0,
            taskType: 'water',
          },
        ],
      };

      const valid = validate(playbook);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should validate complete playbook with all fields', () => {
      const validate = ajv.compile(playbookSchema);
      const playbook = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Photo Indoor Advanced',
        setup: 'photo_indoor',
        locale: 'en-US',
        phaseOrder: ['seedling', 'veg', 'flower', 'harvest'],
        steps: [
          {
            id: 'step-1',
            phase: 'seedling',
            title: 'Initial watering',
            descriptionIcu: 'Water seedlings gently',
            relativeDay: 0,
            rrule: 'FREQ=DAILY;INTERVAL=2',
            defaultReminderLocal: '08:00',
            taskType: 'water',
            durationDays: 14,
            dependencies: [],
          },
          {
            id: 'step-2',
            phase: 'veg',
            title: 'First feeding',
            descriptionIcu: 'Apply vegetative nutrients',
            relativeDay: 14,
            rrule: 'FREQ=WEEKLY;BYDAY=MO,TH',
            defaultReminderLocal: '09:00',
            taskType: 'feed',
            durationDays: 28,
            dependencies: ['step-1'],
          },
        ],
      };

      const valid = validate(playbook);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should validate playbook with all task types', () => {
      const validate = ajv.compile(playbookSchema);
      const playbook = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Complete Task Types',
        setup: 'auto_indoor',
        locale: 'de',
        steps: [
          {
            id: 'step-1',
            phase: 'seedling',
            title: 'Water',
            relativeDay: 0,
            taskType: 'water',
          },
          {
            id: 'step-2',
            phase: 'veg',
            title: 'Feed',
            relativeDay: 7,
            taskType: 'feed',
          },
          {
            id: 'step-3',
            phase: 'veg',
            title: 'Prune',
            relativeDay: 14,
            taskType: 'prune',
          },
          {
            id: 'step-4',
            phase: 'veg',
            title: 'Train',
            relativeDay: 21,
            taskType: 'train',
          },
          {
            id: 'step-5',
            phase: 'flower',
            title: 'Monitor',
            relativeDay: 42,
            taskType: 'monitor',
          },
          {
            id: 'step-6',
            phase: 'harvest',
            title: 'Note',
            relativeDay: 84,
            taskType: 'note',
          },
          {
            id: 'step-7',
            phase: 'harvest',
            title: 'Custom',
            relativeDay: 90,
            taskType: 'custom',
          },
        ],
      };

      const valid = validate(playbook);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });
  });

  describe('Invalid Playbook Schemas', () => {
    it('should reject playbook missing required fields', () => {
      const validate = ajv.compile(playbookSchema);
      const playbook = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Incomplete',
        // Missing setup, locale, steps
      };

      const valid = validate(playbook);
      expect(valid).toBe(false);
      expect(validate.errors).not.toBeNull();
      expect(validate.errors?.length).toBeGreaterThan(0);
    });

    it('should reject invalid UUID format', () => {
      const validate = ajv.compile(playbookSchema);
      const playbook = {
        id: 'not-a-uuid',
        name: 'Invalid ID',
        setup: 'auto_indoor',
        locale: 'en',
        steps: [],
      };

      const valid = validate(playbook);
      expect(valid).toBe(false);
      expect(validate.errors?.[0]?.message).toContain('format');
    });

    it('should reject invalid setup value', () => {
      const validate = ajv.compile(playbookSchema);
      const playbook = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Invalid Setup',
        setup: 'invalid_setup',
        locale: 'en',
        steps: [],
      };

      const valid = validate(playbook);
      expect(valid).toBe(false);
      expect(validate.errors?.[0]?.message).toContain('enum');
    });

    it('should reject invalid locale format', () => {
      const validate = ajv.compile(playbookSchema);
      const playbook = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Invalid Locale',
        setup: 'auto_indoor',
        locale: 'invalid',
        steps: [],
      };

      const valid = validate(playbook);
      expect(valid).toBe(false);
      expect(validate.errors?.[0]?.message).toContain('pattern');
    });

    it('should reject invalid reminder time format', () => {
      const validate = ajv.compile(playbookSchema);
      const playbook = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Invalid Reminder',
        setup: 'auto_indoor',
        locale: 'en',
        steps: [
          {
            id: 'step-1',
            phase: 'seedling',
            title: 'Water',
            relativeDay: 0,
            taskType: 'water',
            defaultReminderLocal: '8:00', // Invalid format (should be 08:00)
          },
        ],
      };

      const valid = validate(playbook);
      expect(valid).toBe(false);
      expect(validate.errors?.[0]?.message).toContain('pattern');
    });

    it('should reject step missing required fields', () => {
      const validate = ajv.compile(playbookSchema);
      const playbook = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Incomplete Step',
        setup: 'auto_indoor',
        locale: 'en',
        steps: [
          {
            id: 'step-1',
            phase: 'seedling',
            // Missing title, relativeDay, taskType
          },
        ],
      };

      const valid = validate(playbook);
      expect(valid).toBe(false);
      expect(validate.errors).not.toBeNull();
    });

    it('should reject invalid phase value', () => {
      const validate = ajv.compile(playbookSchema);
      const playbook = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Invalid Phase',
        setup: 'auto_indoor',
        locale: 'en',
        steps: [
          {
            id: 'step-1',
            phase: 'invalid_phase',
            title: 'Water',
            relativeDay: 0,
            taskType: 'water',
          },
        ],
      };

      const valid = validate(playbook);
      expect(valid).toBe(false);
      expect(validate.errors?.[0]?.message).toContain('enum');
    });

    it('should reject invalid task type', () => {
      const validate = ajv.compile(playbookSchema);
      const playbook = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Invalid Task Type',
        setup: 'auto_indoor',
        locale: 'en',
        steps: [
          {
            id: 'step-1',
            phase: 'seedling',
            title: 'Invalid',
            relativeDay: 0,
            taskType: 'invalid_type',
          },
        ],
      };

      const valid = validate(playbook);
      expect(valid).toBe(false);
      expect(validate.errors?.[0]?.message).toContain('enum');
    });

    it('should reject negative relativeDay', () => {
      const validate = ajv.compile(playbookSchema);
      const playbook = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Negative Day',
        setup: 'auto_indoor',
        locale: 'en',
        steps: [
          {
            id: 'step-1',
            phase: 'seedling',
            title: 'Water',
            relativeDay: -1,
            taskType: 'water',
          },
        ],
      };

      const valid = validate(playbook);
      expect(valid).toBe(false);
      expect(validate.errors?.[0]?.message).toContain('integer');
    });
  });

  describe('Edge Cases', () => {
    it('should validate empty steps array', () => {
      const validate = ajv.compile(playbookSchema);
      const playbook = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Empty Steps',
        setup: 'auto_indoor',
        locale: 'en',
        steps: [],
      };

      const valid = validate(playbook);
      expect(valid).toBe(true);
    });

    it('should validate playbook with many steps', () => {
      const validate = ajv.compile(playbookSchema);
      const steps = Array.from({ length: 100 }, (_, i) => ({
        id: `step-${i}`,
        phase: 'veg' as const,
        title: `Task ${i}`,
        relativeDay: i,
        taskType: 'water' as const,
      }));

      const playbook = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Many Steps',
        setup: 'auto_indoor',
        locale: 'en',
        steps,
      };

      const valid = validate(playbook);
      expect(valid).toBe(true);
    });

    it('should validate locale with region code', () => {
      const validate = ajv.compile(playbookSchema);
      const playbook = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Regional Locale',
        setup: 'auto_indoor',
        locale: 'de-DE',
        steps: [],
      };

      const valid = validate(playbook);
      expect(valid).toBe(true);
    });

    it('should validate complex RRULE patterns', () => {
      const validate = ajv.compile(playbookSchema);
      const playbook = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Complex RRULE',
        setup: 'auto_indoor',
        locale: 'en',
        steps: [
          {
            id: 'step-1',
            phase: 'veg',
            title: 'Complex Schedule',
            relativeDay: 0,
            taskType: 'water',
            rrule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR;COUNT=10',
          },
        ],
      };

      const valid = validate(playbook);
      expect(valid).toBe(true);
    });
  });

  describe('Schema Metadata', () => {
    it('should have correct schema version', () => {
      expect(playbookSchema.$schema).toBe(
        'https://json-schema.org/draft/2020-12/schema'
      );
    });

    it('should have schema ID', () => {
      expect(playbookSchema.$id).toBe(
        'https://canabro.app/schemas/playbook.json'
      );
    });

    it('should define all required fields', () => {
      expect(playbookSchema.required).toEqual([
        'id',
        'name',
        'setup',
        'locale',
        'steps',
      ]);
    });
  });
});
