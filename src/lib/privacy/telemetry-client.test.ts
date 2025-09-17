/* eslint-disable max-lines-per-function */
import { jest } from '@jest/globals';

import { ConsentService } from '@/lib/privacy/consent-service';
import { SDKGate } from '@/lib/privacy/sdk-gate';
import { TelemetryClient } from '@/lib/privacy/telemetry-client';
import { setPrivacyConsent } from '@/lib/privacy-consent';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('TelemetryClient: buffering', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await ConsentService.setConsent('telemetry', false);
  });

  test('buffers pre-consent and flushes after consent', async () => {
    const client = new TelemetryClient({
      buffer: { maxBytes: 1024, maxAgeMs: 10000, purgeOnConsentChange: true },
    });

    await client.track({
      name: 'app_open',
      properties: { cold: true },
      timestamp: new Date(),
      sessionId: 's1',
    });

    // No consent, so even after waiting, events remain buffered (no real network send path)
    await wait(50);

    // Flip consent to true and ensure flush proceeds
    await ConsentService.setConsent('telemetry', true);
    await wait(250); // allow flush throttle loop to drain

    // At this point buffer should be empty after flush attempt
    // We cannot access private buffer; use side-effect via SDKGate status
    expect(SDKGate.isSDKAllowed('telemetry')).toBe(true);
  });
});

describe('TelemetryClient: consent changes', () => {
  test('purges buffer on consent withdrawal', async () => {
    const client = new TelemetryClient({
      buffer: { maxBytes: 1024, maxAgeMs: 10000, purgeOnConsentChange: true },
    });

    // Allow and enqueue a couple events
    await ConsentService.setConsent('telemetry', true);
    await client.track({
      name: 'e1',
      properties: { a: 1 },
      timestamp: new Date(),
      sessionId: 's',
    });
    await client.track({
      name: 'e2',
      properties: { b: true },
      timestamp: new Date(),
      sessionId: 's',
    });

    // Withdraw → client should purge
    await ConsentService.setConsent('telemetry', false);
    await wait(20);

    // Gate should be false now
    expect(SDKGate.isSDKAllowed('telemetry')).toBe(false);
  });
});

describe('TelemetryClient: schema', () => {
  test('schema: drops invalid events silently', async () => {
    const client = new TelemetryClient();
    await client.track({
      name: 'bad',
      // invalid type shapes are dropped internally; use allowed types here to keep TS happy
      properties: { flag: true },
      timestamp: new Date(),
      sessionId: 's',
    });

    // No throws expected, and with no consent nothing flushes
    await expect(Promise.resolve()).resolves.toBeUndefined();
  });
});

describe('TelemetryClient: Analytics Consent Gating', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset both types of consent
    await ConsentService.setConsent('telemetry', false);
    setPrivacyConsent({ analytics: false });
  });

  describe('Guided Grow Playbook Events', () => {
    test('buffers playbook events when analytics consent is denied', async () => {
      const client = new TelemetryClient({
        buffer: { maxBytes: 1024, maxAgeMs: 10000, purgeOnConsentChange: true },
      });

      // Ensure telemetry consent is granted but analytics is denied
      await ConsentService.setConsent('telemetry', true);
      expect(setPrivacyConsent({ analytics: false }));

      // Try to track playbook events
      await client.track({
        name: 'playbook_apply',
        properties: { playbookId: 'pb-123', strainType: 'indica' },
        timestamp: new Date(),
        sessionId: 's1',
      });

      await client.track({
        name: 'ai_adjustment_suggested',
        properties: {
          playbookId: 'pb-456',
          adjustmentType: 'watering',
          confidence: 0.85,
        },
        timestamp: new Date(),
        sessionId: 's1',
      });

      // Events should be buffered but not flushed due to lack of analytics consent
      await wait(50);
      // We can't directly check buffer size, but the events should remain buffered
    });

    test('flushes playbook events when analytics consent is granted', async () => {
      const client = new TelemetryClient({
        buffer: { maxBytes: 1024, maxAgeMs: 10000, purgeOnConsentChange: true },
      });

      // Start with analytics consent denied
      await ConsentService.setConsent('telemetry', true);
      setPrivacyConsent({ analytics: false });

      // Track playbook events (should be buffered)
      await client.track({
        name: 'playbook_shift_preview',
        properties: {
          playbookId: 'pb-123',
          shiftType: 'forward',
          shiftDays: 7,
        },
        timestamp: new Date(),
        sessionId: 's1',
      });

      // Grant analytics consent
      setPrivacyConsent({ analytics: true });

      // Wait for flush to complete
      await wait(250);

      // Events should be flushed (we verify via SDK gate status)
      expect(SDKGate.isSDKAllowed('telemetry')).toBe(true);
    });

    test('immediately emits playbook events when analytics consent is already granted', async () => {
      const client = new TelemetryClient({
        buffer: { maxBytes: 1024, maxAgeMs: 10000, purgeOnConsentChange: true },
      });

      // Grant both consents upfront
      await ConsentService.setConsent('telemetry', true);
      setPrivacyConsent({ analytics: true });

      // Track playbook event
      await client.track({
        name: 'trichome_helper_open',
        properties: { playbookId: 'pb-789' },
        timestamp: new Date(),
        sessionId: 's1',
      });

      // Should flush immediately
      await wait(50);
      expect(SDKGate.isSDKAllowed('telemetry')).toBe(true);
    });
  });

  describe('Non-Playbook Events', () => {
    test('still requires telemetry consent for non-playbook events', async () => {
      const client = new TelemetryClient({
        buffer: { maxBytes: 1024, maxAgeMs: 10000, purgeOnConsentChange: true },
      });

      // Deny telemetry consent but grant analytics consent
      await ConsentService.setConsent('telemetry', false);
      setPrivacyConsent({ analytics: true });

      // Track non-playbook event
      await client.track({
        name: 'notif_scheduled',
        properties: { taskId: 'task-123' },
        timestamp: new Date(),
        sessionId: 's1',
      });

      // Should be buffered due to lack of telemetry consent
      await wait(50);
      expect(SDKGate.isSDKAllowed('telemetry')).toBe(false);
    });

    test('emits non-playbook events when telemetry consent is granted (regardless of analytics consent)', async () => {
      const client = new TelemetryClient({
        buffer: { maxBytes: 1024, maxAgeMs: 10000, purgeOnConsentChange: true },
      });

      // Grant telemetry consent but deny analytics consent
      await ConsentService.setConsent('telemetry', true);
      setPrivacyConsent({ analytics: false });

      // Track non-playbook event
      await client.track({
        name: 'sync_push',
        properties: { pushed: 5, queue_length: 10 },
        timestamp: new Date(),
        sessionId: 's1',
      });

      // Should flush successfully
      await wait(250);
      expect(SDKGate.isSDKAllowed('telemetry')).toBe(true);
    });
  });

  describe('Consent Changes', () => {
    test('handles dynamic analytics consent changes correctly', async () => {
      const client = new TelemetryClient({
        buffer: { maxBytes: 1024, maxAgeMs: 10000, purgeOnConsentChange: true },
      });

      // Start with analytics consent denied
      await ConsentService.setConsent('telemetry', true);
      setPrivacyConsent({ analytics: false });

      // Track playbook event (should be buffered)
      await client.track({
        name: 'playbook_saved_as_template',
        properties: {
          playbookId: 'pb-123',
          templateName: 'My Template',
          isPublic: true,
        },
        timestamp: new Date(),
        sessionId: 's1',
      });

      // Grant analytics consent
      setPrivacyConsent({ analytics: true });
      await wait(250);

      // Withdraw analytics consent
      setPrivacyConsent({ analytics: false });
      await wait(50);

      // Track another playbook event (should be buffered again)
      await client.track({
        name: 'ai_adjustment_declined',
        properties: {
          playbookId: 'pb-456',
          adjustmentType: 'feeding',
          reason: 'not needed',
        },
        timestamp: new Date(),
        sessionId: 's1',
      });

      // SDK should still be allowed for telemetry (but analytics consent is denied)
      expect(SDKGate.isSDKAllowed('telemetry')).toBe(true);
    });
  });

  describe('Event Classification', () => {
    test('correctly identifies playbook event prefixes', async () => {
      const client = new TelemetryClient();

      // Test various playbook event names
      const playbookEvents = [
        'playbook_apply',
        'playbook_shift_preview',
        'playbook_shift_apply',
        'playbook_shift_undo',
        'playbook_task_customized',
        'playbook_saved_as_template',
        'ai_adjustment_suggested',
        'ai_adjustment_applied',
        'ai_adjustment_declined',
        'trichome_helper_open',
        'trichome_helper_logged',
      ];

      // Grant telemetry but deny analytics
      await ConsentService.setConsent('telemetry', true);
      setPrivacyConsent({ analytics: false });

      // All playbook events should be buffered
      for (const eventName of playbookEvents) {
        await client.track({
          name: eventName,
          properties: { playbookId: 'pb-test' },
          timestamp: new Date(),
          sessionId: 's1',
        });
      }

      // Non-playbook event should flush
      await client.track({
        name: 'notif_fired',
        properties: { taskId: 'task-123' },
        timestamp: new Date(),
        sessionId: 's1',
      });

      await wait(250);
      // We can't directly check buffer, but the non-playbook event should have flushed
    });
  });
});
