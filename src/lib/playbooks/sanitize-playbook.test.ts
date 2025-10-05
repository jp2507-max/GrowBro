/**
 * Tests for PII Sanitization
 */

import {
  type Playbook,
  sanitizePlaybookForSharing,
  validatePlaybookForSharing,
} from './sanitize-playbook';

describe('sanitizePlaybookForSharing', () => {
  const mockPlaybook: Playbook = {
    id: 'test-playbook-1',
    name: 'My Custom Grow',
    setup: 'auto_indoor',
    locale: 'en',
    phaseOrder: ['seedling', 'veg', 'flower', 'harvest'],
    steps: [
      {
        id: 'step-1',
        phase: 'seedling',
        title: 'Water seedlings',
        descriptionIcu: 'Water your seedlings gently',
        relativeDay: 0,
        taskType: 'water',
        defaultReminderLocal: '08:00',
      },
      {
        id: 'step-2',
        phase: 'veg',
        title: 'Feed plants',
        descriptionIcu: 'Apply nutrients',
        relativeDay: 14,
        taskType: 'feed',
        durationDays: 7,
        defaultReminderLocal: '09:00',
      },
    ],
  };

  describe('PII Removal', () => {
    test('removes email addresses from text', () => {
      const playbook = {
        ...mockPlaybook,
        name: 'Contact me at john@example.com for tips',
      };

      const sanitized = sanitizePlaybookForSharing(playbook, 'testuser');

      expect(sanitized.name).not.toContain('john@example.com');
      expect(sanitized.name).toContain('[email removed]');
    });

    test('removes phone numbers from text', () => {
      const playbook = {
        ...mockPlaybook,
        steps: [
          {
            ...mockPlaybook.steps[0],
            title: 'Call me at 555-123-4567',
          },
        ],
      };

      const sanitized = sanitizePlaybookForSharing(playbook, 'testuser');

      expect(sanitized.steps[0].title).not.toContain('555-123-4567');
      expect(sanitized.steps[0].title).toContain('[phone removed]');
    });

    test('removes URLs from text', () => {
      const playbook = {
        ...mockPlaybook,
        steps: [
          {
            ...mockPlaybook.steps[0],
            descriptionIcu: 'Check out https://mysite.com/guide',
          },
        ],
      };

      const sanitized = sanitizePlaybookForSharing(playbook, 'testuser');

      expect(sanitized.steps[0].descriptionIcu).not.toContain(
        'https://mysite.com'
      );
      expect(sanitized.steps[0].descriptionIcu).toContain('[link removed]');
    });

    test('removes @ mentions from text', () => {
      const playbook = {
        ...mockPlaybook,
        name: 'Thanks to @johndoe for the tips',
      };

      const sanitized = sanitizePlaybookForSharing(playbook, 'testuser');

      expect(sanitized.name).not.toContain('@johndoe');
      expect(sanitized.name).toContain('[mention removed]');
    });

    test('truncates long text to prevent abuse', () => {
      const longText = 'a'.repeat(600);
      const playbook = {
        ...mockPlaybook,
        name: longText,
      };

      const sanitized = sanitizePlaybookForSharing(playbook, 'testuser');

      expect(sanitized.name.length).toBeLessThanOrEqual(503); // 500 + '...'
      expect(sanitized.name).toContain('...');
    });
  });

  describe('Author Handle Validation', () => {
    test('accepts valid author handles', () => {
      expect(() =>
        sanitizePlaybookForSharing(mockPlaybook, 'valid_user')
      ).not.toThrow();
      expect(() =>
        sanitizePlaybookForSharing(mockPlaybook, 'user123')
      ).not.toThrow();
      expect(() =>
        sanitizePlaybookForSharing(mockPlaybook, 'grow-master')
      ).not.toThrow();
    });

    test('rejects handles with email patterns', () => {
      expect(() =>
        sanitizePlaybookForSharing(mockPlaybook, 'user@example.com')
      ).toThrow('Invalid author handle');
    });

    test('rejects handles with phone numbers', () => {
      expect(() =>
        sanitizePlaybookForSharing(mockPlaybook, 'user1234567890')
      ).toThrow('Invalid author handle');
    });

    test('rejects handles with URLs', () => {
      expect(() =>
        sanitizePlaybookForSharing(mockPlaybook, 'https://example.com')
      ).toThrow('Invalid author handle');
    });

    test('rejects handles that are too short', () => {
      expect(() => sanitizePlaybookForSharing(mockPlaybook, 'ab')).toThrow(
        'Invalid author handle'
      );
    });

    test('rejects handles that are too long', () => {
      const longHandle = 'a'.repeat(31);
      expect(() =>
        sanitizePlaybookForSharing(mockPlaybook, longHandle)
      ).toThrow('Invalid author handle');
    });
  });

  describe('Metadata Calculation', () => {
    test('calculates total weeks correctly', () => {
      const sanitized = sanitizePlaybookForSharing(mockPlaybook, 'testuser');

      // step-2 ends at day 14 + 7 = 21, which is 3 weeks
      expect(sanitized.totalWeeks).toBe(3);
    });

    test('calculates task count correctly', () => {
      const sanitized = sanitizePlaybookForSharing(mockPlaybook, 'testuser');

      expect(sanitized.taskCount).toBe(2);
    });

    test('handles playbooks with no duration days', () => {
      const playbook = {
        ...mockPlaybook,
        steps: [
          {
            id: 'step-1',
            phase: 'seedling' as const,
            title: 'Water',
            relativeDay: 7,
            taskType: 'water' as const,
          },
        ],
      };

      const sanitized = sanitizePlaybookForSharing(playbook, 'testuser');

      expect(sanitized.totalWeeks).toBe(1); // 7 days = 1 week
    });
  });

  describe('Step Sanitization', () => {
    test('preserves essential step data', () => {
      const sanitized = sanitizePlaybookForSharing(mockPlaybook, 'testuser');

      expect(sanitized.steps[0]).toMatchObject({
        id: 'step-1',
        phase: 'seedling',
        title: expect.any(String),
        relativeDay: 0,
        taskType: 'water',
        defaultReminderLocal: '08:00',
      });
    });

    test('sanitizes step titles and descriptions', () => {
      const playbook = {
        ...mockPlaybook,
        steps: [
          {
            ...mockPlaybook.steps[0],
            title: 'Email me@example.com for help',
            descriptionIcu: 'Call 555-1234',
          },
        ],
      };

      const sanitized = sanitizePlaybookForSharing(playbook, 'testuser');

      expect(sanitized.steps[0].title).toContain('[email removed]');
      expect(sanitized.steps[0].descriptionIcu).toContain('[phone removed]');
    });
  });
});

describe('validatePlaybookForSharing', () => {
  const validPlaybook: Playbook = {
    id: 'test-playbook-1',
    name: 'Valid Playbook',
    setup: 'auto_indoor',
    locale: 'en',
    phaseOrder: ['seedling', 'veg', 'flower', 'harvest'],
    steps: [
      {
        id: 'step-1',
        phase: 'seedling',
        title: 'Step 1',
        relativeDay: 0,
        taskType: 'water',
      },
      {
        id: 'step-2',
        phase: 'veg',
        title: 'Step 2',
        relativeDay: 7,
        taskType: 'feed',
      },
      {
        id: 'step-3',
        phase: 'flower',
        title: 'Step 3',
        relativeDay: 14,
        taskType: 'monitor',
      },
      {
        id: 'step-4',
        phase: 'flower',
        title: 'Step 4',
        relativeDay: 21,
        taskType: 'prune',
      },
      {
        id: 'step-5',
        phase: 'harvest',
        title: 'Step 5',
        relativeDay: 28,
        taskType: 'note',
      },
    ],
  };

  test('validates a correct playbook', () => {
    const result = validatePlaybookForSharing(validPlaybook);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('rejects playbook without name', () => {
    const playbook = { ...validPlaybook, name: '' };
    const result = validatePlaybookForSharing(playbook);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Playbook name is required');
  });

  test('rejects playbook without setup', () => {
    const playbook = { ...validPlaybook, setup: undefined as any };
    const result = validatePlaybookForSharing(playbook);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Playbook setup type is required');
  });

  test('rejects playbook with too few steps', () => {
    const playbook = {
      ...validPlaybook,
      steps: validPlaybook.steps.slice(0, 3),
    };
    const result = validatePlaybookForSharing(playbook);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Playbook must have at least 5 steps');
  });

  test('rejects steps without titles', () => {
    const playbook = {
      ...validPlaybook,
      steps: [
        ...validPlaybook.steps.slice(0, 4),
        { ...validPlaybook.steps[4], title: '' },
      ],
    };
    const result = validatePlaybookForSharing(playbook);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Step 5 is missing a title');
  });

  test('rejects steps without phase', () => {
    const playbook = {
      ...validPlaybook,
      steps: [
        ...validPlaybook.steps.slice(0, 4),
        { ...validPlaybook.steps[4], phase: undefined as any },
      ],
    };
    const result = validatePlaybookForSharing(playbook);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Step 5 is missing a phase');
  });

  test('rejects steps with invalid relativeDay', () => {
    const playbook = {
      ...validPlaybook,
      steps: [
        ...validPlaybook.steps.slice(0, 4),
        { ...validPlaybook.steps[4], relativeDay: -1 },
      ],
    };
    const result = validatePlaybookForSharing(playbook);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Step 5 has invalid relativeDay');
  });

  test('rejects steps without taskType', () => {
    const playbook = {
      ...validPlaybook,
      steps: [
        ...validPlaybook.steps.slice(0, 4),
        { ...validPlaybook.steps[4], taskType: undefined as any },
      ],
    };
    const result = validatePlaybookForSharing(playbook);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Step 5 is missing a task type');
  });
});
