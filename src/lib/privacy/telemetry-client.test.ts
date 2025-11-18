import { ConsentService } from '@/lib/privacy/consent-service';
import { SDKGate } from '@/lib/privacy/sdk-gate';
import {
  telemetryClient,
  type TelemetryEvent,
} from '@/lib/privacy/telemetry-client';

jest.mock('@/lib/privacy/retention-worker', () => ({
  addRetentionRecord: jest.fn().mockResolvedValue(undefined),
}));

// Lightweight tests that don't rely on real timers or network.
describe('TelemetryClient buffer accounting', () => {
  beforeEach(() => {
    // Reset internal queue for test isolation. Tests intentionally
    // access private fields; keep these assertions limited and focused.
    // @ts-ignore test-only access
    telemetryClient['buffer'] = [];
    // @ts-ignore
    telemetryClient['bufferBytes'] = 0;
    jest.restoreAllMocks();
  });

  test('does not inflate bufferBytes when flush aborts', async () => {
    // Prepare a minimal event
    const ev: TelemetryEvent = {
      name: 'test_event',
      properties: {},
      timestamp: new Date(),
      sessionId: 's1',
    };

    // Force SDK gate to block delivery
    jest.spyOn(SDKGate, 'isSDKAllowed').mockImplementation(() => false);

    // Ensure telemetry consent is withdrawn so client will buffer
    await ConsentService.setConsent('telemetry', false);

    // Enqueue a couple events
    // @ts-ignore
    telemetryClient['enqueue'](ev);
    // @ts-ignore
    telemetryClient['enqueue'](ev);

    // Snapshot before flush
    // @ts-ignore
    const beforeLen = telemetryClient['buffer'].length;
    // @ts-ignore
    const beforeBytes = telemetryClient['bufferBytes'];

    // Attempt flush (should abort due to SDK gate/consent)
    // @ts-ignore
    await telemetryClient.flush();

    // After aborted flush, queue and bytes must be unchanged
    // @ts-ignore
    expect(telemetryClient['buffer'].length).toBe(beforeLen);
    // @ts-ignore
    expect(telemetryClient['bufferBytes']).toBe(beforeBytes);

    // Allow delivery and grant telemetry consent; flush should drain queue
    jest.spyOn(SDKGate, 'isSDKAllowed').mockImplementation(() => true);
    await ConsentService.setConsent('telemetry', true);

    // ConsentService.onChange triggers a background flush. Wait briefly
    // for the flush loop to drain the queue (throttle is ~200ms/event).
    await new Promise((r) => setTimeout(r, 700));

    // @ts-ignore
    expect(telemetryClient['buffer'].length).toBe(0);
    // @ts-ignore
    expect(telemetryClient['bufferBytes']).toBe(0);
  });
});
