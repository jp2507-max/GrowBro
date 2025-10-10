/**
 * Offline Queue Tests
 */

import {
  generateIdempotencyKey,
  getReadingDeduplicationKey,
  isUniqueReading,
} from '../offline-queue';

describe('generateIdempotencyKey', () => {
  it('generates consistent key for same inputs', () => {
    const key1 = generateIdempotencyKey('readings', 'create', 'id1', 1000);
    const key2 = generateIdempotencyKey('readings', 'create', 'id1', 1000);

    expect(key1).toBe(key2);
    expect(key1).toBe('readings_create_id1_1000');
  });

  it('generates different keys for different inputs', () => {
    const key1 = generateIdempotencyKey('readings', 'create', 'id1', 1000);
    const key2 = generateIdempotencyKey('readings', 'update', 'id1', 1000);
    const key3 = generateIdempotencyKey('readings', 'create', 'id2', 1000);
    const key4 = generateIdempotencyKey('readings', 'create', 'id1', 2000);

    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key1).not.toBe(key4);
  });
});

describe('isUniqueReading', () => {
  it('returns true for unique reading', () => {
    const newReading = {
      plant_id: 'plant1',
      meter_id: 'meter1',
      measured_at: 1000000,
    };
    const existingReadings = [
      {
        plant_id: 'plant2',
        meter_id: 'meter1',
        measured_at: 1000000,
      },
      {
        plant_id: 'plant1',
        meter_id: 'meter2',
        measured_at: 1000000,
      },
    ];

    expect(isUniqueReading(newReading, existingReadings)).toBe(true);
  });

  it('returns false for duplicate reading', () => {
    const newReading = {
      plant_id: 'plant1',
      meter_id: 'meter1',
      measured_at: 1000000,
    };
    const existingReadings = [
      {
        plant_id: 'plant1',
        meter_id: 'meter1',
        measured_at: 1000500, // Within 1s tolerance
      },
    ];

    expect(isUniqueReading(newReading, existingReadings)).toBe(false);
  });

  it('handles empty existing readings array', () => {
    const newReading = {
      plant_id: 'plant1',
      meter_id: 'meter1',
      measured_at: 1000000,
    };

    expect(isUniqueReading(newReading, [])).toBe(true);
  });

  it('returns true when time difference exceeds tolerance', () => {
    const newReading = {
      plant_id: 'plant1',
      meter_id: 'meter1',
      measured_at: 1000000,
    };
    const existingReadings = [
      {
        plant_id: 'plant1',
        meter_id: 'meter1',
        measured_at: 1005000, // 5s difference
      },
    ];

    expect(isUniqueReading(newReading, existingReadings)).toBe(true);
  });
});

describe('getReadingDeduplicationKey', () => {
  it('returns consistent deduplication key', () => {
    const key1 = getReadingDeduplicationKey('plant1', 'meter1', 1234567890);
    const key2 = getReadingDeduplicationKey('plant1', 'meter1', 1234567890);

    expect(key1).toBe(key2);
  });

  it('buckets timestamps to seconds', () => {
    const key1 = getReadingDeduplicationKey('plant1', 'meter1', 1234567000);
    const key2 = getReadingDeduplicationKey('plant1', 'meter1', 1234567999);

    expect(key1).toBe(key2);
  });

  it('handles undefined IDs', () => {
    const key = getReadingDeduplicationKey(undefined, undefined, 1000000000);

    expect(key).toContain('null');
  });
});
