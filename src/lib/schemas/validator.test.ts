import invalidPlaybook from './__fixtures__/invalid-playbook.json';
import validPlaybook from './__fixtures__/valid-playbook.json';
import {
  formatValidationErrors,
  validateISODatetime,
  validatePlaybookSchema,
  validateRRULEFormat,
  validateTimeFormat,
} from './validator';

describe('validatePlaybookSchema - basic', () => {
  test('validates a correct playbook', () => {
    const result = validatePlaybookSchema(validPlaybook);
    expect(result.valid).toBe(true);
  });

  test('rejects an invalid playbook', () => {
    const result = validatePlaybookSchema(invalidPlaybook);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  test('rejects playbook with missing required fields', () => {
    const incomplete = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test',
    };
    const result = validatePlaybookSchema(incomplete);
    expect(result.valid).toBe(false);
  });

  test('rejects playbook with invalid setup type', () => {
    const invalid = { ...validPlaybook, setup: 'invalid_setup' };
    const result = validatePlaybookSchema(invalid);
    expect(result.valid).toBe(false);
  });

  test('rejects playbook with empty name', () => {
    const invalid = { ...validPlaybook, name: '' };
    const result = validatePlaybookSchema(invalid);
    expect(result.valid).toBe(false);
  });
});

describe('validatePlaybookSchema - locale', () => {
  test('rejects playbook with invalid locale format', () => {
    const invalid = { ...validPlaybook, locale: 'invalid' };
    const result = validatePlaybookSchema(invalid);
    expect(result.valid).toBe(false);
  });

  test('accepts valid locale formats', () => {
    const locales = ['en', 'de', 'en-US', 'de-DE'];
    locales.forEach((locale) => {
      const playbook = { ...validPlaybook, locale };
      const result = validatePlaybookSchema(playbook);
      expect(result.valid).toBe(true);
    });
  });
});

describe('validatePlaybookSchema - steps', () => {
  test('rejects step with negative relativeDay', () => {
    const invalid = {
      ...validPlaybook,
      steps: [{ ...validPlaybook.steps[0], relativeDay: -1 }],
    };
    const result = validatePlaybookSchema(invalid);
    expect(result.valid).toBe(false);
  });

  test('rejects step with invalid taskType', () => {
    const invalid = {
      ...validPlaybook,
      steps: [{ ...validPlaybook.steps[0], taskType: 'invalid' }],
    };
    const result = validatePlaybookSchema(invalid);
    expect(result.valid).toBe(false);
  });

  test('rejects step with invalid phase', () => {
    const invalid = {
      ...validPlaybook,
      steps: [{ ...validPlaybook.steps[0], phase: 'invalid' }],
    };
    const result = validatePlaybookSchema(invalid);
    expect(result.valid).toBe(false);
  });
});

describe('validateRRULEFormat', () => {
  test('validates correct RRULE patterns', () => {
    const validRules = [
      'FREQ=DAILY',
      'FREQ=DAILY;INTERVAL=2',
      'FREQ=WEEKLY;BYDAY=MO,WE,FR',
      'FREQ=MONTHLY;BYMONTHDAY=1',
      'FREQ=YEARLY;BYMONTH=1',
    ];

    validRules.forEach((rule) => {
      expect(validateRRULEFormat(rule)).toBe(true);
    });
  });

  test('rejects invalid RRULE patterns', () => {
    const invalidRules = [
      'INVALID',
      'FREQ=INVALID',
      'INTERVAL=2',
      '',
      'freq=daily',
    ];

    invalidRules.forEach((rule) => {
      expect(validateRRULEFormat(rule)).toBe(false);
    });
  });
});

describe('validateTimeFormat', () => {
  test('validates correct time formats', () => {
    const validTimes = ['00:00', '08:00', '12:30', '23:59'];

    validTimes.forEach((time) => {
      expect(validateTimeFormat(time)).toBe(true);
    });
  });

  test('rejects invalid time formats', () => {
    const invalidTimes = [
      '24:00',
      '12:60',
      '8:00',
      '12:5',
      '25:99',
      'invalid',
      '',
    ];

    invalidTimes.forEach((time) => {
      expect(validateTimeFormat(time)).toBe(false);
    });
  });
});

describe('validateISODatetime', () => {
  test('validates correct ISO datetime strings', () => {
    const validDatetimes = [
      '2025-01-01T00:00:00.000Z',
      '2025-12-31T23:59:59.999Z',
      '2025-06-15T12:30:45.123Z',
    ];

    validDatetimes.forEach((datetime) => {
      expect(validateISODatetime(datetime)).toBe(true);
    });
  });

  test('rejects invalid ISO datetime strings', () => {
    const invalidDatetimes = [
      '2025-01-01',
      '2025-01-01T00:00:00',
      'invalid',
      '',
      '2025-13-01T00:00:00.000Z',
      '2025-01-32T00:00:00.000Z',
    ];

    invalidDatetimes.forEach((datetime) => {
      expect(validateISODatetime(datetime)).toBe(false);
    });
  });
});

describe('formatValidationErrors', () => {
  test('returns empty array for valid result', () => {
    const result = { valid: true as const };
    expect(formatValidationErrors(result)).toEqual([]);
  });

  test('formats error messages correctly', () => {
    const result = validatePlaybookSchema(invalidPlaybook);
    if (!result.valid) {
      const messages = formatValidationErrors(result);
      expect(messages.length).toBeGreaterThan(0);
      messages.forEach((message) => {
        expect(typeof message).toBe('string');
        expect(message.length).toBeGreaterThan(0);
      });
    }
  });
});
