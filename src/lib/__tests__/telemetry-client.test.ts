import { ConsentService } from '@/lib/privacy/consent-service';
import type { TelemetryEvent } from '@/lib/privacy/telemetry-client';
import { TelemetryClient } from '@/lib/privacy/telemetry-client';
import { setPrivacyConsent } from '@/lib/privacy-consent';

jest.mock('@/lib/privacy/retention-worker', () => ({
  addRetentionRecord: jest.fn().mockResolvedValue(undefined),
}));

const retentionMock = jest.requireMock('@/lib/privacy/retention-worker') as {
  addRetentionRecord: jest.Mock;
};

function makeEvent(overrides: Partial<TelemetryEvent> = {}) {
  const base: TelemetryEvent = {
    name: 'perf_first_paint_ms',
    properties: { ms: 123, note: 'user john.doe@example.com viewed screen' },
    timestamp: new Date(),
    sessionId: 'sess-123',
  };
  return { ...base, ...overrides };
}

describe('TelemetryClient', () => {
  beforeEach(() => {
    retentionMock.addRetentionRecord.mockClear();
  });

  test('sanitizes PII in string properties and enforces bounds', async () => {
    const delivered: any[] = [];
    const client = new TelemetryClient({
      deliver: async (e) => {
        delivered.push(e);
      },
    });
    // Ensure telemetry consent so events are delivered immediately
    await ConsentService.setConsent('telemetry', true);
    setPrivacyConsent({ analytics: true });
    const ev = makeEvent({
      properties: {
        ms: 42,
        email: 'leak: alice+id@example.com',
        phone: 'call +1 (415) 555-1234',
        address: '742 Evergreen Terrace, Springfield',
      },
    });
    await client.track(ev);

    expect(delivered).toHaveLength(1);
    const out = delivered[0];
    expect(out.properties.email).toContain('[EMAIL_REDACTED]');
    expect(out.properties.phone).toContain('[PHONE_REDACTED]');
    expect(String(out.properties.address)).toContain('[ADDRESS_REDACTED]');
    expect(out.schemaVersion).toBe('telemetry.v1');
    expect(out.consentSnapshot).toEqual(
      expect.objectContaining({ telemetry: true, analytics: true })
    );
    expect(retentionMock.addRetentionRecord).toHaveBeenCalledWith(
      expect.objectContaining({ dataType: 'telemetry_raw' })
    );
  });

  test('queues until consent then flushes via deliver callback', async () => {
    const delivered: any[] = [];
    const client = new TelemetryClient({
      deliver: async (e) => {
        delivered.push(e);
      },
    });
    // Ensure telemetry consent is withdrawn
    await ConsentService.setConsent('telemetry', false);
    // Initially no telemetry consent → events should buffer
    await client.track(makeEvent());
    // No consent yet; nothing delivered
    expect(delivered).toHaveLength(0);

    // Grant telemetry consent via ConsentService
    await ConsentService.setConsent('telemetry', true);

    // Trigger another event which should cause flush; also explicitly flush to be deterministic
    await client.track(makeEvent({ properties: { ms: 7 } }));
    await client.flush();

    expect(delivered.length).toBeGreaterThanOrEqual(1);
  });
});
