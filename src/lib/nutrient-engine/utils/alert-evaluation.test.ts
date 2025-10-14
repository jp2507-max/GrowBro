/**
 * Tests for alert evaluation logic
 */

import type {
  DeviationAlert,
  PhEcReading,
  Reservoir,
} from '@/lib/nutrient-engine/types';

import {
  COOLDOWN_MS,
  DEAD_BAND,
  evaluateReadingAgainstTargets,
  generateRecommendations,
  MIN_PERSIST_MS,
  TEMP_HIGH_THRESHOLD,
} from './alert-evaluation';

// ============================================================================
// Test Fixtures
// ============================================================================

const mockReservoir: Reservoir = {
  id: 'res1',
  name: 'Test Reservoir',
  volumeL: 20,
  medium: 'hydro',
  targetPhMin: 5.5,
  targetPhMax: 6.5,
  targetEcMin25c: 1.0,
  targetEcMax25c: 2.0,
  ppmScale: '500',
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

function createMockReading(overrides: Partial<PhEcReading> = {}): PhEcReading {
  const now = Date.now();
  return {
    id: `reading_${now}`,
    reservoirId: 'res1',
    measuredAt: now,
    ph: 6.0,
    ecRaw: 1.5,
    ec25c: 1.5,
    tempC: 22,
    atcOn: true,
    ppmScale: '500',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ============================================================================
// Tests: pH Deviation Detection
// ============================================================================

describe('evaluateReadingAgainstTargets - pH deviations', () => {
  test('detects pH too high with persistence', () => {
    const now = Date.now();
    const baseTime = now - MIN_PERSIST_MS - 60_000; // 6 minutes ago

    const recentReadings = [
      createMockReading({
        id: 'r1',
        ph: 7.0,
        measuredAt: baseTime,
      }),
      createMockReading({
        id: 'r2',
        ph: 7.1,
        measuredAt: baseTime + 120_000,
      }),
    ];

    const currentReading = createMockReading({
      ph: 7.2, // Above targetPhMax (6.5) + deadband (0.1) = 6.6
      measuredAt: now,
    });

    const result = evaluateReadingAgainstTargets(
      currentReading,
      mockReservoir,
      {
        recentReadings,
        activeAlerts: [],
      }
    );

    expect(result).toBeTruthy();
    expect(result?.type).toBe('ph_high');
    expect(result?.severity).toBe('warning');
    expect(result?.message).toContain('pH 7.2');
    expect(result?.recommendationCodes).toContain('ADJUST_PH_DOWN');
  });

  test('detects pH too low with persistence', () => {
    const now = Date.now();
    const baseTime = now - MIN_PERSIST_MS - 60_000;

    const recentReadings = [
      createMockReading({
        id: 'r1',
        ph: 5.2,
        measuredAt: baseTime,
      }),
      createMockReading({
        id: 'r2',
        ph: 5.1,
        measuredAt: baseTime + 120_000,
      }),
    ];

    const currentReading = createMockReading({
      ph: 5.0, // Below targetPhMin (5.5) - deadband (0.1) = 5.4
      measuredAt: now,
    });

    const result = evaluateReadingAgainstTargets(
      currentReading,
      mockReservoir,
      {
        recentReadings,
        activeAlerts: [],
      }
    );

    expect(result).toBeTruthy();
    expect(result?.type).toBe('ph_low');
    expect(result?.recommendationCodes).toContain('ADJUST_PH_UP');
  });

  test('does not trigger alert within deadband', () => {
    const currentReading = createMockReading({
      ph: 6.55, // Just slightly above targetPhMax but within deadband
    });

    const result = evaluateReadingAgainstTargets(
      currentReading,
      mockReservoir,
      {
        recentReadings: [],
        activeAlerts: [],
      }
    );

    expect(result).toBeNull();
  });

  test('does not trigger alert without persistence', () => {
    const now = Date.now();
    const recentReadings = [
      createMockReading({
        ph: 6.0, // Within range
        measuredAt: now - 120_000,
      }),
    ];

    const currentReading = createMockReading({
      ph: 7.2, // High, but no persistence
      measuredAt: now,
    });

    const result = evaluateReadingAgainstTargets(
      currentReading,
      mockReservoir,
      {
        recentReadings,
        activeAlerts: [],
      }
    );

    expect(result).toBeNull();
  });
});

// ============================================================================
// Tests: EC Deviation Detection
// ============================================================================

describe('evaluateReadingAgainstTargets - EC deviations', () => {
  test('detects EC too high with persistence', () => {
    const now = Date.now();
    const baseTime = now - MIN_PERSIST_MS - 60_000;

    const recentReadings = [
      createMockReading({
        id: 'r1',
        ec25c: 2.3,
        measuredAt: baseTime,
      }),
      createMockReading({
        id: 'r2',
        ec25c: 2.4,
        measuredAt: baseTime + 120_000,
      }),
    ];

    const currentReading = createMockReading({
      ec25c: 2.5, // Above targetEcMax25c (2.0) + deadband (0.1) = 2.1
      measuredAt: now,
    });

    const result = evaluateReadingAgainstTargets(
      currentReading,
      mockReservoir,
      {
        recentReadings,
        activeAlerts: [],
      }
    );

    expect(result).toBeTruthy();
    expect(result?.type).toBe('ec_high');
    expect(result?.message).toContain('EC 2.50');
    expect(result?.recommendationCodes).toContain('DILUTE_10PCT');
  });

  test('detects EC too low with persistence', () => {
    const now = Date.now();
    const baseTime = now - MIN_PERSIST_MS - 60_000;

    const recentReadings = [
      createMockReading({
        id: 'r1',
        ec25c: 0.7,
        measuredAt: baseTime,
      }),
      createMockReading({
        id: 'r2',
        ec25c: 0.6,
        measuredAt: baseTime + 120_000,
      }),
    ];

    const currentReading = createMockReading({
      ec25c: 0.5, // Below targetEcMin25c (1.0) - deadband (0.1) = 0.9
      measuredAt: now,
    });

    const result = evaluateReadingAgainstTargets(
      currentReading,
      mockReservoir,
      {
        recentReadings,
        activeAlerts: [],
      }
    );

    expect(result).toBeTruthy();
    expect(result?.type).toBe('ec_low');
    expect(result?.recommendationCodes).toContain('ADD_NUTRIENTS');
  });
});

// ============================================================================
// Tests: Cooldown Logic
// ============================================================================

describe('evaluateReadingAgainstTargets - cooldown', () => {
  test('respects cooldown period for same alert type', () => {
    const now = Date.now();
    const baseTime = now - MIN_PERSIST_MS - 60_000;

    const recentReadings = [
      createMockReading({
        ph: 7.2,
        measuredAt: baseTime,
      }),
    ];

    const activeAlerts: DeviationAlert[] = [
      {
        id: 'alert1',
        readingId: 'r1',
        type: 'ph_high',
        severity: 'warning',
        message: 'pH high',
        recommendations: [],
        recommendationCodes: [],
        cooldownUntil: now + COOLDOWN_MS / 2, // Still in cooldown
        triggeredAt: now - 1000,
        createdAt: now - 1000,
        updatedAt: now - 1000,
      },
    ];

    const currentReading = createMockReading({
      ph: 7.3,
      measuredAt: now,
    });

    const result = evaluateReadingAgainstTargets(
      currentReading,
      mockReservoir,
      {
        recentReadings,
        activeAlerts,
      }
    );

    expect(result).toBeNull();
  });

  test('allows alert after cooldown expires', () => {
    const now = Date.now();
    const baseTime = now - MIN_PERSIST_MS - 60_000;

    const recentReadings = [
      createMockReading({
        ph: 7.2,
        measuredAt: baseTime,
      }),
    ];

    const activeAlerts: DeviationAlert[] = [
      {
        id: 'alert1',
        readingId: 'r1',
        type: 'ph_high',
        severity: 'warning',
        message: 'pH high',
        recommendations: [],
        recommendationCodes: [],
        cooldownUntil: now - 1000, // Cooldown expired
        triggeredAt: now - COOLDOWN_MS - 2000,
        createdAt: now - COOLDOWN_MS - 2000,
        updatedAt: now - COOLDOWN_MS - 2000,
      },
    ];

    const currentReading = createMockReading({
      ph: 7.3,
      measuredAt: now,
    });

    const result = evaluateReadingAgainstTargets(
      currentReading,
      mockReservoir,
      {
        recentReadings,
        activeAlerts,
      }
    );

    expect(result).toBeTruthy();
    expect(result?.type).toBe('ph_high');
  });

  test('allows different alert types simultaneously', () => {
    const now = Date.now();
    const baseTime = now - MIN_PERSIST_MS - 60_000;

    const recentReadings = [
      createMockReading({
        ph: 7.2,
        ec25c: 0.5,
        measuredAt: baseTime,
      }),
    ];

    const activeAlerts: DeviationAlert[] = [
      {
        id: 'alert1',
        readingId: 'r1',
        type: 'ph_high',
        severity: 'warning',
        message: 'pH high',
        recommendations: [],
        recommendationCodes: [],
        cooldownUntil: now + COOLDOWN_MS / 2,
        triggeredAt: now - 1000,
        createdAt: now - 1000,
        updatedAt: now - 1000,
      },
    ];

    const currentReading = createMockReading({
      ph: 7.3, // pH high - in cooldown
      ec25c: 0.5, // EC low - not in cooldown
      measuredAt: now,
    });

    const result = evaluateReadingAgainstTargets(
      currentReading,
      mockReservoir,
      {
        recentReadings,
        activeAlerts,
      }
    );

    // Should trigger EC alert since it's not in cooldown
    expect(result).toBeTruthy();
    expect(result?.type).toBe('ec_low');
  });
});

// ============================================================================
// Tests: Temperature Warning
// ============================================================================

describe('evaluateReadingAgainstTargets - temperature', () => {
  test('triggers temp_high alert when temperature exceeds threshold', () => {
    const currentReading = createMockReading({
      tempC: TEMP_HIGH_THRESHOLD + 1,
    });

    const result = evaluateReadingAgainstTargets(
      currentReading,
      mockReservoir,
      {
        recentReadings: [],
        activeAlerts: [],
      }
    );

    expect(result).toBeTruthy();
    expect(result?.type).toBe('temp_high');
    expect(result?.severity).toBe('info');
    expect(result?.message).toContain('Temperature');
    expect(result?.recommendationCodes).toContain('COOL_RESERVOIR');
  });

  test('does not trigger temp alert for normal temperature', () => {
    const currentReading = createMockReading({
      tempC: 22,
      ph: 6.0, // Within range
      ec25c: 1.5, // Within range
    });

    const result = evaluateReadingAgainstTargets(
      currentReading,
      mockReservoir,
      {
        recentReadings: [],
        activeAlerts: [],
      }
    );

    expect(result).toBeNull();
  });
});

// ============================================================================
// Tests: Recommendation Generation
// ============================================================================

describe('generateRecommendations', () => {
  test('generates pH high recommendations with volume-based dilution', () => {
    const reading = createMockReading({ ph: 7.5 });
    const { recommendations, recommendationCodes } = generateRecommendations(
      'ph_high',
      reading,
      mockReservoir
    );

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0]).toContain('pH down');
    expect(recommendationCodes).toContain('ADJUST_PH_DOWN');
    expect(recommendationCodes).toContain('RECHECK_15MIN');
  });

  test('generates EC high recommendations with reservoir volume calculation', () => {
    const reading = createMockReading({ ec25c: 2.5 });
    const { recommendations, recommendationCodes } = generateRecommendations(
      'ec_high',
      reading,
      mockReservoir
    );

    expect(recommendations[0]).toContain('10%');
    expect(recommendations[0]).toContain('2.0L'); // 10% of 20L
    expect(recommendationCodes).toContain('DILUTE_10PCT');
  });

  test('generates calibration recommendations', () => {
    const reading = createMockReading();
    const { recommendations, recommendationCodes } = generateRecommendations(
      'calibration_stale',
      reading,
      mockReservoir
    );

    expect(recommendations).toContain(
      'Calibrate pH and EC meters with fresh calibration solutions'
    );
    expect(recommendationCodes).toContain('CALIBRATE_METER');
  });
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('evaluateReadingAgainstTargets - edge cases', () => {
  test('handles reading exactly at deadband boundary', () => {
    const currentReading = createMockReading({
      ph: mockReservoir.targetPhMax + DEAD_BAND.ph, // Exactly at boundary
    });

    const result = evaluateReadingAgainstTargets(
      currentReading,
      mockReservoir,
      {
        recentReadings: [],
        activeAlerts: [],
      }
    );

    // Should not trigger (boundary is inclusive of safe range)
    expect(result).toBeNull();
  });

  test('handles empty recent readings array', () => {
    const currentReading = createMockReading({
      ph: 7.5, // Way out of range
    });

    const result = evaluateReadingAgainstTargets(
      currentReading,
      mockReservoir,
      {
        recentReadings: [], // No recent readings
        activeAlerts: [],
      }
    );

    // Should not trigger without persistence verification
    expect(result).toBeNull();
  });

  test('handles reading within range after previous out-of-range readings', () => {
    const now = Date.now();
    const baseTime = now - MIN_PERSIST_MS - 60_000;

    const recentReadings = [
      createMockReading({
        ph: 7.2, // Was high
        measuredAt: baseTime,
      }),
    ];

    const currentReading = createMockReading({
      ph: 6.0, // Now normal
      measuredAt: now,
    });

    const result = evaluateReadingAgainstTargets(
      currentReading,
      mockReservoir,
      {
        recentReadings,
        activeAlerts: [],
      }
    );

    expect(result).toBeNull();
  });

  test('prioritizes first detected deviation when multiple exist', () => {
    const now = Date.now();
    const baseTime = now - MIN_PERSIST_MS - 60_000;

    const recentReadings = [
      createMockReading({
        ph: 7.2,
        ec25c: 2.5,
        measuredAt: baseTime,
      }),
    ];

    const currentReading = createMockReading({
      ph: 7.3, // pH high
      ec25c: 2.6, // EC high
      measuredAt: now,
    });

    const result = evaluateReadingAgainstTargets(
      currentReading,
      mockReservoir,
      {
        recentReadings,
        activeAlerts: [],
      }
    );

    // Should return first detected (pH checked before EC)
    expect(result).toBeTruthy();
    expect(result?.type).toBe('ph_high');
  });
});
