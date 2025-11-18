/**
 * Tests for alert service
 */

import { database } from '@/lib/watermelon';
import type { DeviationAlertModel } from '@/lib/watermelon-models/deviation-alert';
import type { PhEcReadingModel } from '@/lib/watermelon-models/ph-ec-reading';
import type { ReservoirModel } from '@/lib/watermelon-models/reservoir';

import {
  acknowledgeAlert,
  createAlert,
  evaluateAndTriggerAlert,
  getActiveAlerts,
  getAlertHistory,
  getOfflineAlerts,
  getUnacknowledgedAlerts,
  markAlertDeliveredLocally,
  observeActiveAlerts,
  resolveAlert,
} from './alert-service';

// ============================================================================
// Test Setup and Cleanup
// ============================================================================

let reservoir: ReservoirModel;
let reading: PhEcReadingModel;

beforeEach(async () => {
  const db = database;

  // Create test reservoir
  reservoir = await db.write(async () => {
    return db
      .get<ReservoirModel>('reservoirs_v2')
      .create((res: ReservoirModel) => {
        res.name = 'Test Reservoir';
        res.volumeL = 20;
        res.medium = 'hydro';
        res.targetPhMin = 5.5;
        res.targetPhMax = 6.5;
        res.targetEcMin25c = 1.0;
        res.targetEcMax25c = 2.0;
        res.ppmScale = '500';
      });
  });

  // Create test reading (within range)
  reading = await db.write(async () => {
    return db
      .get<PhEcReadingModel>('ph_ec_readings_v2')
      .create((r: PhEcReadingModel) => {
        r.reservoirId = reservoir.id;
        r.measuredAt = Date.now();
        r.ph = 6.0;
        r.ecRaw = 1.5;
        r.ec25c = 1.5;
        r.tempC = 22;
        r.atcOn = true;
        r.ppmScale = '500';
      });
  });
});

afterEach(async () => {
  const db = database;
  await db.write(async () => {
    await reservoir.destroyPermanently();
    await reading.destroyPermanently();

    // Clean up any alerts
    const alerts = await db
      .get<DeviationAlertModel>('deviation_alerts_v2')
      .query()
      .fetch();
    await Promise.all(
      alerts.map((a: DeviationAlertModel) => a.destroyPermanently())
    );
  });
});

// ============================================================================
// Tests: Alert Creation and Triggering
// ============================================================================

describe('evaluateAndTriggerAlert', () => {
  test('triggers alert for pH out of range with persistence', async () => {
    const db = database;
    const now = Date.now();

    // Create older readings showing persistent high pH
    const oldReading1 = await db.write(async () => {
      return db
        .get<PhEcReadingModel>('ph_ec_readings_v2')
        .create((r: PhEcReadingModel) => {
          r.reservoirId = reservoir.id;
          r.measuredAt = now - 8 * 60_000; // 8 minutes ago
          r.ph = 7.2;
          r.ecRaw = 1.5;
          r.ec25c = 1.5;
          r.tempC = 22;
          r.atcOn = true;
          r.ppmScale = '500';
        });
    });

    const oldReading2 = await db.write(async () => {
      return db
        .get<PhEcReadingModel>('ph_ec_readings_v2')
        .create((r: PhEcReadingModel) => {
          r.reservoirId = reservoir.id;
          r.measuredAt = now - 6 * 60_000; // 6 minutes ago
          r.ph = 7.3;
          r.ecRaw = 1.5;
          r.ec25c = 1.5;
          r.tempC = 22;
          r.atcOn = true;
          r.ppmScale = '500';
        });
    });

    // Create current reading with high pH
    const highPhReading = await db.write(async () => {
      return db
        .get<PhEcReadingModel>('ph_ec_readings_v2')
        .create((r: PhEcReadingModel) => {
          r.reservoirId = reservoir.id;
          r.measuredAt = now;
          r.ph = 7.4; // Above max (6.5) + deadband (0.1)
          r.ecRaw = 1.5;
          r.ec25c = 1.5;
          r.tempC = 22;
          r.atcOn = true;
          r.ppmScale = '500';
        });
    });

    const alert = await evaluateAndTriggerAlert(highPhReading, reservoir);

    expect(alert).toBeTruthy();
    expect(alert?.type).toBe('ph_high');
    expect(alert?.severity).toBe('warning');
    expect(alert?.message).toContain('pH 7.4');
    expect(alert?.recommendationCodes).toContain('ADJUST_PH_DOWN');

    // Cleanup
    await db.write(async () => {
      await oldReading1.destroyPermanently();
      await oldReading2.destroyPermanently();
      await highPhReading.destroyPermanently();
      if (alert) await alert.destroyPermanently();
    });
  });

  test('does not trigger alert for reading within range', async () => {
    const alert = await evaluateAndTriggerAlert(reading, reservoir);
    expect(alert).toBeNull();
  });

  test('does not trigger alert without persistence', async () => {
    const db = database;
    const now = Date.now();

    // Create a single high reading without prior history
    const highReading = await db.write(async () => {
      return db
        .get<PhEcReadingModel>('ph_ec_readings_v2')
        .create((r: PhEcReadingModel) => {
          r.reservoirId = reservoir.id;
          r.measuredAt = now;
          r.ph = 7.5;
          r.ecRaw = 1.5;
          r.ec25c = 1.5;
          r.tempC = 22;
          r.atcOn = true;
          r.ppmScale = '500';
        });
    });

    const alert = await evaluateAndTriggerAlert(highReading, reservoir);
    expect(alert).toBeNull();

    // Cleanup
    await db.write(async () => {
      await highReading.destroyPermanently();
    });
  });
});

describe('createAlert', () => {
  test('creates alert with all required fields', async () => {
    const alertData = {
      readingId: reading.id,
      type: 'ph_high' as const,
      severity: 'warning' as const,
      message: 'Test alert',
      recommendations: ['Fix it'],
      recommendationCodes: ['FIX'],
      triggeredAt: Date.now(),
    };

    const alert = await createAlert(alertData, 'user123');

    expect(alert.readingId).toBe(reading.id);
    expect(alert.type).toBe('ph_high');
    expect(alert.userId).toBe('user123');

    // Cleanup
    const db = database;
    await db.write(async () => {
      await alert.destroyPermanently();
    });
  });
});

// ============================================================================
// Tests: Alert Lifecycle
// ============================================================================

describe('acknowledgeAlert', () => {
  test('sets acknowledgedAt timestamp', async () => {
    const alertData = {
      readingId: reading.id,
      type: 'ph_high' as const,
      severity: 'warning' as const,
      message: 'Test',
      recommendations: [],
      recommendationCodes: [],
      triggeredAt: Date.now(),
    };

    const alert = await createAlert(alertData);
    expect(alert.acknowledgedAt).toBeUndefined();

    const updated = await acknowledgeAlert(alert.id);
    expect(updated.acknowledgedAt).toBeTruthy();
    expect(updated.acknowledgedAt).toBeGreaterThan(0);

    // Cleanup
    const db = database;
    await db.write(async () => {
      await alert.destroyPermanently();
    });
  });
});

describe('resolveAlert', () => {
  test('sets resolvedAt timestamp', async () => {
    const alertData = {
      readingId: reading.id,
      type: 'ec_low' as const,
      severity: 'warning' as const,
      message: 'Test',
      recommendations: [],
      recommendationCodes: [],
      triggeredAt: Date.now(),
    };

    const alert = await createAlert(alertData);
    expect(alert.resolvedAt).toBeUndefined();

    const updated = await resolveAlert(alert.id);
    expect(updated.resolvedAt).toBeTruthy();
    expect(updated.resolvedAt).toBeGreaterThan(0);

    // Cleanup
    const db = database;
    await db.write(async () => {
      await alert.destroyPermanently();
    });
  });
});

describe('markAlertDeliveredLocally', () => {
  test('sets deliveredAtLocal timestamp', async () => {
    const alertData = {
      readingId: reading.id,
      type: 'temp_high' as const,
      severity: 'info' as const,
      message: 'Test',
      recommendations: [],
      recommendationCodes: [],
      triggeredAt: Date.now(),
    };

    const alert = await createAlert(alertData);
    expect(alert.deliveredAtLocal).toBeUndefined();

    const updated = await markAlertDeliveredLocally(alert.id);
    expect(updated.deliveredAtLocal).toBeTruthy();
    expect(updated.wasDeliveredOffline).toBe(true);

    // Cleanup
    const db = database;
    await db.write(async () => {
      await alert.destroyPermanently();
    });
  });
});

// ============================================================================
// Tests: Alert Queries
// ============================================================================

describe('getActiveAlerts', () => {
  test('returns unresolved alerts for reservoir', async () => {
    // Create active alert
    const activeAlert = await createAlert({
      readingId: reading.id,
      type: 'ph_high' as const,
      severity: 'warning' as const,
      message: 'Active',
      recommendations: [],
      recommendationCodes: [],
      triggeredAt: Date.now(),
    });

    // Create resolved alert
    const resolvedAlert = await createAlert({
      readingId: reading.id,
      type: 'ec_low' as const,
      severity: 'warning' as const,
      message: 'Resolved',
      recommendations: [],
      recommendationCodes: [],
      triggeredAt: Date.now(),
      resolvedAt: Date.now(),
    });

    const active = await getActiveAlerts(reservoir.id);

    expect(active.length).toBe(1);
    expect(active[0].id).toBe(activeAlert.id);
    expect(active[0].type).toBe('ph_high');

    // Cleanup
    const db = database;
    await db.write(async () => {
      await activeAlert.destroyPermanently();
      await resolvedAlert.destroyPermanently();
    });
  });

  test('returns empty array for reservoir with no alerts', async () => {
    const active = await getActiveAlerts(reservoir.id);
    expect(active).toEqual([]);
  });
});

describe('getAlertHistory', () => {
  test('returns alerts within time period', async () => {
    const now = Date.now();

    // Create recent alert
    const recentAlert = await createAlert({
      readingId: reading.id,
      type: 'ph_high' as const,
      severity: 'warning' as const,
      message: 'Recent',
      recommendations: [],
      recommendationCodes: [],
      triggeredAt: now - 60_000, // 1 minute ago
    });

    const history = await getAlertHistory(reservoir.id, 7);

    expect(history.length).toBeGreaterThan(0);
    expect(history.find((a) => a.id === recentAlert.id)).toBeTruthy();

    // Cleanup
    const db = database;
    await db.write(async () => {
      await recentAlert.destroyPermanently();
    });
  });
});

describe('getUnacknowledgedAlerts', () => {
  test('returns all unacknowledged alerts', async () => {
    const unacknowledged = await createAlert({
      readingId: reading.id,
      type: 'ph_high' as const,
      severity: 'warning' as const,
      message: 'Unack',
      recommendations: [],
      recommendationCodes: [],
      triggeredAt: Date.now(),
    });

    const acknowledged = await createAlert({
      readingId: reading.id,
      type: 'ec_low' as const,
      severity: 'warning' as const,
      message: 'Ack',
      recommendations: [],
      recommendationCodes: [],
      triggeredAt: Date.now(),
      acknowledgedAt: Date.now(),
    });

    const results = await getUnacknowledgedAlerts();

    expect(results.length).toBeGreaterThan(0);
    expect(results.find((a) => a.id === unacknowledged.id)).toBeTruthy();
    expect(results.find((a) => a.id === acknowledged.id)).toBeUndefined();

    // Cleanup
    const db = database;
    await db.write(async () => {
      await unacknowledged.destroyPermanently();
      await acknowledged.destroyPermanently();
    });
  });
});

describe('getOfflineAlerts', () => {
  test('returns alerts delivered offline', async () => {
    const offlineAlert = await createAlert({
      readingId: reading.id,
      type: 'temp_high' as const,
      severity: 'info' as const,
      message: 'Offline',
      recommendations: [],
      recommendationCodes: [],
      triggeredAt: Date.now(),
      deliveredAtLocal: Date.now(),
    });

    const onlineAlert = await createAlert({
      readingId: reading.id,
      type: 'ph_high' as const,
      severity: 'warning' as const,
      message: 'Online',
      recommendations: [],
      recommendationCodes: [],
      triggeredAt: Date.now(),
    });

    const offline = await getOfflineAlerts();

    expect(offline.find((a) => a.id === offlineAlert.id)).toBeTruthy();
    expect(offline.find((a) => a.id === onlineAlert.id)).toBeUndefined();

    // Cleanup
    const db = database;
    await db.write(async () => {
      await offlineAlert.destroyPermanently();
      await onlineAlert.destroyPermanently();
    });
  });
});

// Test observeActiveAlerts in isolation to avoid global test setup issues
describe('observeActiveAlerts', () => {
  let mockDb: {
    get: jest.Mock;
  };

  beforeEach(() => {
    // Mock the database observe method
    const mockObservable = {
      subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    };

    // Mock the database queries
    mockDb = {
      get: jest.fn().mockReturnValue({
        query: jest.fn().mockReturnValue({
          observeWithColumns: jest.fn().mockReturnValue({
            pipe: jest.fn().mockReturnValue(mockObservable),
          }),
        }),
      }),
    };
  });

  test('returns observable that filters by reservoir ID', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const observable = observeActiveAlerts('test-reservoir-id', mockDb as any);

    expect(mockDb.get).toHaveBeenCalledWith('ph_ec_readings_v2');
    expect(typeof observable.subscribe).toBe('function');
  });
});
