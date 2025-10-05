import {
  ANALYTICS_CONSENT_KEY,
  createConsentGatedAnalytics,
  InMemoryMetrics,
} from '@/lib/analytics';
import { hasConsent, setPrivacyConsent } from '@/lib/privacy-consent';

describe('InMemoryMetrics', () => {
  it('stores and retrieves events', () => {
    const metrics = new InMemoryMetrics();
    metrics.track('notif_scheduled', { taskId: 't1' });
    metrics.track('sync_push', { pushed: 3, queue_length: 5 });
    const events = metrics.getAll();
    expect(events.length).toBe(2);
    expect(events[0].name).toBe('notif_scheduled');
    expect((events[0].payload as any).taskId).toBe('t1');
    expect(events[1].name).toBe('sync_push');
  });

  it('clears events', () => {
    const metrics = new InMemoryMetrics();
    metrics.track('notif_scheduled', { taskId: 't1' });
    metrics.clear();
    expect(metrics.getAll().length).toBe(0);
  });
});

describe('ConsentGatedAnalytics', () => {
  let baseClient: InMemoryMetrics;
  let gatedClient: ReturnType<typeof createConsentGatedAnalytics>;

  beforeEach(() => {
    baseClient = new InMemoryMetrics();
    gatedClient = createConsentGatedAnalytics(baseClient);
    // Reset consent to denied by default
    setPrivacyConsent({ analytics: false });
  });

  describe('Consent Disabled Flows', () => {
    it('does not emit guided grow playbook events when analytics consent is denied', () => {
      // Ensure consent is denied
      expect(hasConsent('analytics')).toBe(false);

      // Try to track various playbook events
      gatedClient.track('playbook_apply', {
        playbookId: 'pb-123',
        strainType: 'indica',
        setupType: 'hydroponic',
      });
      gatedClient.track('playbook_shift_preview', {
        plantId: 'plant-123',
        daysDelta: 7,
        affectedTaskCount: 5,
      });
      gatedClient.track('ai_adjustment_suggested', {
        playbookId: 'pb-123',
        adjustmentType: 'watering',
        confidence: 0.85,
      });
      gatedClient.track('trichome_helper_open', {
        playbookId: 'pb-123',
      });

      // Verify no events were tracked
      expect(baseClient.getAll()).toHaveLength(0);
    });

    it('does not emit events when consent is withdrawn mid-session', () => {
      // Start with consent granted
      setPrivacyConsent({ analytics: true });
      expect(hasConsent('analytics')).toBe(true);

      // Track an event successfully
      gatedClient.track('playbook_apply', {
        playbookId: 'pb-123',
        strainType: 'sativa',
      });
      expect(baseClient.getAll()).toHaveLength(1);

      // Withdraw consent
      setPrivacyConsent({ analytics: false });
      expect(hasConsent('analytics')).toBe(false);

      // Try to track another event
      gatedClient.track('playbook_shift_apply', {
        plantId: 'plant-123',
        daysDelta: -3,
        affectedTaskCount: 5,
      });

      // Verify only the first event was tracked
      expect(baseClient.getAll()).toHaveLength(1);
    });

    it('allows non-playbook events to pass through when analytics consent is denied', () => {
      // Ensure analytics consent is denied
      expect(hasConsent('analytics')).toBe(false);

      // Track non-playbook events (these should still work if telemetry consent exists)
      gatedClient.track('notif_scheduled', { taskId: 'task-123' });
      gatedClient.track('sync_push', { pushed: 5, queue_length: 10 });

      // These events should still be tracked (assuming telemetry consent exists)
      // Note: In a real scenario, we'd need to mock telemetry consent as well
      expect(baseClient.getAll()).toHaveLength(2);
    });
  });

  describe('Consent Granted Flows', () => {
    beforeEach(() => {
      // Grant analytics consent for these tests
      setPrivacyConsent({ analytics: true });
      expect(hasConsent('analytics')).toBe(true);
    });

    it('emits guided grow playbook events when analytics consent is granted', () => {
      gatedClient.track('playbook_apply', {
        playbookId: 'pb-456',
        strainType: 'hybrid',
        setupType: 'soil',
      });

      const events = baseClient.getAll();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe('playbook_apply');
      expect((events[0].payload as any).playbookId).toBe('pb-456');
      expect((events[0].payload as any).strainType).toBe('hybrid');
      expect((events[0].payload as any).setupType).toBe('soil');
    });

    it('emits all playbook event types when consent is granted', () => {
      const testEvents = [
        {
          name: 'playbook_shift_preview' as const,
          payload: {
            plantId: 'plant-1',
            daysDelta: 5,
            affectedTaskCount: 10,
          },
        },
        {
          name: 'playbook_shift_apply' as const,
          payload: {
            plantId: 'plant-1',
            daysDelta: -3,
            affectedTaskCount: 8,
          },
        },
        {
          name: 'ai_adjustment_suggested' as const,
          payload: {
            playbookId: 'pb-1',
            adjustmentType: 'feeding' as const,
            confidence: 0.92,
          },
        },
        {
          name: 'ai_adjustment_applied' as const,
          payload: {
            playbookId: 'pb-1',
            adjustmentType: 'lighting' as const,
            applied: true,
          },
        },
        {
          name: 'trichome_helper_logged' as const,
          payload: {
            playbookId: 'pb-1',
            trichomeStage: 'milky' as const,
            assessmentConfidence: 0.78,
          },
        },
      ];

      testEvents.forEach(({ name, payload }) => {
        gatedClient.track(name, payload);
      });

      const events = baseClient.getAll();
      expect(events).toHaveLength(testEvents.length);
      testEvents.forEach((testEvent, index) => {
        expect(events[index].name).toBe(testEvent.name);
        expect(events[index].payload).toEqual(testEvent.payload);
      });
    });
  });

  describe('PII Sanitization', () => {
    beforeEach(() => {
      // Grant analytics consent for these tests
      setPrivacyConsent({ analytics: true });
      expect(hasConsent('analytics')).toBe(true);
    });

    it('strips PII fields from playbook event payloads', () => {
      const payloadWithPII = {
        playbookId: 'pb-123',
        templateName: 'My Awesome Grow Setup! v2.0',
        email: 'user@example.com',
        name: 'John Doe',
        location: 'California, USA',
        userId: 'user-456',
      };

      gatedClient.track('playbook_saved_as_template', payloadWithPII as any);

      const events = baseClient.getAll();
      expect(events).toHaveLength(1);

      const sanitizedPayload = events[0].payload as any;
      // PII fields should be removed
      expect(sanitizedPayload.email).toBeUndefined();
      expect(sanitizedPayload.name).toBeUndefined();
      expect(sanitizedPayload.location).toBeUndefined();
      expect(sanitizedPayload.userId).toBeUndefined();

      // Non-PII fields should remain
      expect(sanitizedPayload.playbookId).toBe('pb-123');
      expect(sanitizedPayload.templateName).toBe('My Awesome Grow Setup! v2.0');
    });

    it('sanitizes template names by removing special characters and limiting length', () => {
      const payloadWithComplexTemplateName = {
        playbookId: 'pb-123',
        templateName:
          'My Super Complex Template Name with @#$%^&*() Characters and a very long description that exceeds fifty characters!!!',
        isPublic: true,
      };

      gatedClient.track(
        'playbook_saved_as_template',
        payloadWithComplexTemplateName
      );

      const events = baseClient.getAll();
      expect(events).toHaveLength(1);

      const sanitizedPayload = events[0].payload as any;
      // Template name should be sanitized and truncated to 50 chars
      expect(sanitizedPayload.templateName).toBe(
        'My Super Complex Template Name with  Characters an'
      );
      expect(sanitizedPayload.templateName.length).toBeLessThanOrEqual(50);
    });

    it('preserves non-playbook event payloads unchanged', () => {
      const payload = {
        taskId: 'task-123',
        notificationId: 'notif-456',
      };

      gatedClient.track('notif_interacted', payload);

      const events = baseClient.getAll();
      expect(events).toHaveLength(1);

      // Non-playbook events should pass through unchanged
      expect(events[0].payload).toEqual(payload);
    });

    it('sanitizes community_error payloads with context', () => {
      const payload = {
        error_type: 'network' as const,
        context: {
          strain_search: {
            query: 'test query with email@example.com',
            results_count: 5,
            is_offline: false,
          },
          home_view: {
            widgets_shown: [
              'widget1',
              'widget2',
              'widget3',
              'widget4',
              'widget5',
              'widget6',
              'widget7',
              'widget8',
              'widget9',
              'widget10',
              'widget11',
            ],
          },
        },
      };

      gatedClient.track('community_error', payload);

      const events = baseClient.getAll();
      expect(events).toHaveLength(1);

      const sanitizedPayload = events[0].payload as any;
      // error_type should be sanitized
      expect(sanitizedPayload.error_type).toBe('network');

      // strain_search should have sanitized_query instead of query
      expect(sanitizedPayload.context.strain_search.sanitized_query).toBe(
        'test query with [redacted_email]'
      );
      expect(sanitizedPayload.context.strain_search.query).toBeUndefined();

      // home_view widgets should be sanitized and limited to 10
      expect(sanitizedPayload.context.home_view.widgets_shown).toHaveLength(10);
      expect(sanitizedPayload.context.home_view.widgets_shown).toEqual([
        'widget1',
        'widget2',
        'widget3',
        'widget4',
        'widget5',
        'widget6',
        'widget7',
        'widget8',
        'widget9',
        'widget10',
      ]);
    });
  });

  describe('Analytics Consent Key', () => {
    it('exports the correct analytics consent key constant', () => {
      expect(ANALYTICS_CONSENT_KEY).toBe('analytics');
    });
  });
});
