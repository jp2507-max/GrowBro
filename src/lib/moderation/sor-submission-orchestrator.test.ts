import { cleanup } from '@/lib/test-utils';

import { dsaTransparencyClient } from './dsa-transparency-client';
import { piiScrubber } from './pii-scrubber';
import { dsaCircuitBreaker } from './sor-circuit-breaker';
import { sorExportQueueManager } from './sor-export-queue';
import { sorMetrics } from './sor-metrics';
import { SoRSubmissionOrchestratorClass } from './sor-submission-orchestrator';

// Mock all dependencies
jest.mock('./pii-scrubber', () => ({
  piiScrubber: {
    scrubStatementOfReasons: jest.fn(),
    validateRedaction: jest.fn(),
    categorizeEvidenceType: jest.fn(),
    categorizeContentAge: jest.fn(),
  },
}));

jest.mock('./sor-export-queue', () => ({
  sorExportQueueManager: {
    enqueue: jest.fn(),
    updateStatus: jest.fn(),
    markSubmitted: jest.fn(),
    getRetryEligible: jest.fn(),
    getStats: jest.fn(),
  },
}));

jest.mock('./sor-circuit-breaker', () => ({
  dsaCircuitBreaker: {
    execute: jest.fn(),
    getStats: jest.fn(),
  },
}));

jest.mock('./dsa-transparency-client', () => ({
  dsaTransparencyClient: {
    submitSingle: jest.fn(),
  },
}));

jest.mock('./sor-metrics', () => ({
  sorMetrics: {
    recordSubmission: jest.fn(),
    recordRetry: jest.fn(),
    getMetrics: jest.fn(),
  },
}));

afterEach(cleanup);

describe('SoRSubmissionOrchestrator', () => {
  let orchestrator: SoRSubmissionOrchestratorClass;

  beforeEach(() => {
    orchestrator = new SoRSubmissionOrchestratorClass();
    jest.clearAllMocks();
  });

  describe('submit - happy path', () => {
    const mockSoR = {
      id: 'test-statement-id',
      decision_id: 'decision-123',
      decision_ground: 'illegal' as const,
      legal_reference: 'Article 14 DSA',
      content_type: 'post',
      automated_detection: false,
      automated_decision: false,
      territorial_scope: 'EU',
      redress: 'appeal',
      facts_and_circumstances: 'User posted inappropriate content',
      explanation: 'Content violates community guidelines',
      user_id: 'user-123',
      created_at: new Date().toISOString(),
    };

    const mockRedactedSoR = {
      decision_id: 'decision-123',
      decision_ground: 'illegal' as const,
      legal_reference: 'Article 14 DSA',
      content_type: 'post',
      automated_detection: false,
      automated_decision: false,
      territorial_scope: 'EU',
      redress: 'appeal',
      created_at: new Date().toISOString(),
      aggregated_data: {
        report_count: 5,
        evidence_type: 'text' as const,
        content_age: 'new' as const,
        jurisdiction_count: 1,
        has_trusted_flagger: false,
      },
      pseudonymized_reporter_id: 'pseudonym-123',
      pseudonymized_moderator_id: 'pseudonym-mod',
      pseudonymized_decision_id: 'pseudonym-dec',
      scrubbing_metadata: {
        scrubbed_at: new Date(),
        scrubbing_version: '1.0.0',
        redacted_fields: ['facts_and_circumstances'],
        environment_salt_version: '1',
        aggregation_suppression: {
          report_count: false,
          jurisdiction_count: false,
          k: 5,
        },
      },
    };

    test('successfully submits SoR through complete flow', async () => {
      // Mock PII scrubbing and validation
      (piiScrubber.scrubStatementOfReasons as jest.Mock).mockResolvedValue(
        mockRedactedSoR
      );
      (piiScrubber.validateRedaction as jest.Mock).mockReturnValue({
        is_valid: true,
        violations: [],
      });
      (piiScrubber.categorizeEvidenceType as jest.Mock).mockReturnValue('text');
      (piiScrubber.categorizeContentAge as jest.Mock).mockReturnValue('new');

      // Mock queue enqueue
      (sorExportQueueManager.enqueue as jest.Mock).mockResolvedValue({
        success: true,
        queue_id: 'queue-123',
        already_enqueued: false,
      });

      // Mock circuit breaker execution
      (dsaCircuitBreaker.execute as jest.Mock).mockImplementation(
        async (fn) => {
          return await fn();
        }
      );

      // Mock API submission
      (dsaTransparencyClient.submitSingle as jest.Mock).mockResolvedValue({
        status: 'submitted',
        transparency_db_id: 'transparency-456',
      });

      // Mock queue mark submitted
      (sorExportQueueManager.markSubmitted as jest.Mock).mockResolvedValue({
        success: true,
      });

      const result = await orchestrator.submit(mockSoR, {
        reports: [{ id: 'report-1' } as any],
        hasTrustedFlagger: false,
        evidenceUrls: ['text-evidence'],
        contentCreatedAt: new Date(),
      });

      expect(result.success).toBe(true);
      expect(result.queueId).toBe('queue-123');
      expect(result.wasQueued).toBe(true);
      expect(result.gracefullyDegraded).toBe(false);

      // Verify PII scrubbing was called with correct context
      expect(piiScrubber.scrubStatementOfReasons).toHaveBeenCalledWith(
        mockSoR,
        {
          report_count: 1,
          evidence_type: 'text',
          content_age: 'new',
          jurisdiction_count: 2, // EU.length
          has_trusted_flagger: false,
        }
      );

      // Verify validation was called
      expect(piiScrubber.validateRedaction).toHaveBeenCalledWith(
        mockRedactedSoR
      );

      // Verify queue enqueue was called
      expect(sorExportQueueManager.enqueue).toHaveBeenCalledWith(
        'test-statement-id',
        mockRedactedSoR
      );

      // Verify API submission was called
      expect(dsaTransparencyClient.submitSingle).toHaveBeenCalledWith(
        mockRedactedSoR,
        'queue-123'
      );

      // Verify queue mark submitted was called
      expect(sorExportQueueManager.markSubmitted).toHaveBeenCalledWith(
        'queue-123',
        'transparency-456'
      );

      // Verify metrics were recorded
      expect(sorMetrics.recordSubmission).toHaveBeenCalledWith(
        expect.any(Number), // duration
        true // success
      );
    });

    test('handles PII validation failure', async () => {
      // Mock PII scrubbing success but validation failure
      (piiScrubber.scrubStatementOfReasons as jest.Mock).mockResolvedValue(
        mockRedactedSoR
      );
      (piiScrubber.validateRedaction as jest.Mock).mockReturnValue({
        is_valid: false,
        violations: ['PII field still present'],
      });

      const result = await orchestrator.submit(mockSoR);

      expect(result.success).toBe(false);
      expect(result.error).toContain('PII validation failed');
      expect(result.wasQueued).toBe(false);
      expect(result.gracefullyDegraded).toBe(false);

      // Verify queue was not called
      expect(sorExportQueueManager.enqueue).not.toHaveBeenCalled();
    });

    test('handles queue enqueue failure', async () => {
      // Mock PII scrubbing and validation success
      (piiScrubber.scrubStatementOfReasons as jest.Mock).mockResolvedValue(
        mockRedactedSoR
      );
      (piiScrubber.validateRedaction as jest.Mock).mockReturnValue({
        is_valid: true,
        violations: [],
      });

      // Mock queue failure
      (sorExportQueueManager.enqueue as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Database connection failed',
      });

      const result = await orchestrator.submit(mockSoR);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to enqueue SoR');
      expect(result.wasQueued).toBe(false);
    });

    test('handles circuit breaker activation (graceful degradation)', async () => {
      // Mock PII scrubbing, validation, and enqueue success
      (piiScrubber.scrubStatementOfReasons as jest.Mock).mockResolvedValue(
        mockRedactedSoR
      );
      (piiScrubber.validateRedaction as jest.Mock).mockReturnValue({
        is_valid: true,
        violations: [],
      });
      (sorExportQueueManager.enqueue as jest.Mock).mockResolvedValue({
        success: true,
        queue_id: 'queue-123',
        already_enqueued: false,
      });

      // Mock circuit breaker failure
      (dsaCircuitBreaker.execute as jest.Mock).mockRejectedValue(
        new Error('Circuit breaker is OPEN')
      );

      // Mock queue status update
      (sorExportQueueManager.updateStatus as jest.Mock).mockResolvedValue({
        success: true,
      });

      const result = await orchestrator.submit(mockSoR);

      expect(result.success).toBe(true); // Still success - gracefully degraded
      expect(result.wasQueued).toBe(true);
      expect(result.gracefullyDegraded).toBe(true);
      expect(result.error).toContain('Circuit breaker protection activated');

      // Verify status update was called with failure
      expect(sorExportQueueManager.updateStatus).toHaveBeenCalledWith({
        queueId: 'queue-123',
        status: 'failed',
        errorMessage: 'Circuit breaker is OPEN',
      });

      // Verify retry metrics recorded
      expect(sorMetrics.recordRetry).toHaveBeenCalled();
    });

    test('handles API submission failure within circuit breaker', async () => {
      // Mock PII scrubbing, validation, and enqueue success
      (piiScrubber.scrubStatementOfReasons as jest.Mock).mockResolvedValue(
        mockRedactedSoR
      );
      (piiScrubber.validateRedaction as jest.Mock).mockReturnValue({
        is_valid: true,
        violations: [],
      });
      (sorExportQueueManager.enqueue as jest.Mock).mockResolvedValue({
        success: true,
        queue_id: 'queue-123',
        already_enqueued: false,
      });

      // Mock circuit breaker allowing execution but API failure
      (dsaCircuitBreaker.execute as jest.Mock).mockImplementation(
        async (fn) => {
          await fn(); // Execute but let API fail
        }
      );

      // Mock API submission failure
      (dsaTransparencyClient.submitSingle as jest.Mock).mockResolvedValue({
        status: 'failed',
        error: { message: 'API timeout' },
      });

      // Mock queue status update
      (sorExportQueueManager.updateStatus as jest.Mock).mockResolvedValue({
        success: true,
      });

      const result = await orchestrator.submit(mockSoR);

      expect(result.success).toBe(true); // Still success - gracefully degraded
      expect(result.wasQueued).toBe(true);
      expect(result.gracefullyDegraded).toBe(true);
      expect(result.error).toContain('Submission failed');

      // Verify status update was called with failure
      expect(sorExportQueueManager.updateStatus).toHaveBeenCalledWith({
        queueId: 'queue-123',
        status: 'failed',
        errorMessage: 'Submission failed',
      });
    });
  });

  describe('processPendingQueue', () => {
    test('processes retry-eligible items', async () => {
      const mockQueueItems = [
        {
          id: 'queue-1',
          statement_id: 'statement-1',
          status: 'retry',
          attempts: 2,
        },
        {
          id: 'queue-2',
          statement_id: 'statement-2',
          status: 'retry',
          attempts: 1,
        },
      ];

      // Mock fetching retry items
      (sorExportQueueManager.getRetryEligible as jest.Mock).mockResolvedValue({
        success: true,
        items: mockQueueItems,
      });

      // Mock statement fetching
      const mockStatement = {
        id: 'statement-1',
        decision_id: 'decision-123',
        decision_ground: 'illegal' as const,
        legal_reference: 'Article 14 DSA',
        content_type: 'post',
        automated_detection: false,
        automated_decision: false,
        territorial_scope: 'EU',
        redress: 'appeal',
        facts_and_circumstances: 'Content violation',
        user_id: 'user-123',
        created_at: new Date().toISOString(),
      };

      orchestrator['fetchStatement'] = jest
        .fn()
        .mockResolvedValueOnce({ data: mockStatement })
        .mockResolvedValueOnce({ data: mockStatement });

      // Mock successful submission for both
      orchestrator.submit = jest.fn().mockResolvedValue({
        success: true,
      });

      await orchestrator.processPendingQueue(10);

      // Verify retry-eligible items were fetched
      expect(sorExportQueueManager.getRetryEligible).toHaveBeenCalledWith(10);

      // Verify statements were fetched and submitted
      expect(orchestrator['fetchStatement']).toHaveBeenCalledWith(
        'statement-1'
      );
      expect(orchestrator['fetchStatement']).toHaveBeenCalledWith(
        'statement-2'
      );
      expect(orchestrator.submit).toHaveBeenCalledTimes(2);
    });

    test('handles empty queue gracefully', async () => {
      (sorExportQueueManager.getRetryEligible as jest.Mock).mockResolvedValue({
        success: true,
        items: [],
      });

      await orchestrator.processPendingQueue();

      expect(orchestrator['fetchStatement']).not.toHaveBeenCalled();
      expect(orchestrator.submit).not.toHaveBeenCalled();
    });

    test('handles fetch failure gracefully', async () => {
      (sorExportQueueManager.getRetryEligible as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Database error',
      });

      // Should not throw
      await expect(orchestrator.processPendingQueue()).resolves.not.toThrow();
    });

    test('handles individual item processing errors gracefully', async () => {
      const mockQueueItems = [
        {
          id: 'queue-1',
          statement_id: 'statement-1',
          status: 'retry',
          attempts: 2,
        },
      ];

      (sorExportQueueManager.getRetryEligible as jest.Mock).mockResolvedValue({
        success: true,
        items: mockQueueItems,
      });

      // Mock statement fetch failure
      orchestrator['fetchStatement'] = jest
        .fn()
        .mockResolvedValue({ data: null });

      // Should not throw, should log error
      await expect(orchestrator.processPendingQueue()).resolves.not.toThrow();
      expect(orchestrator.submit).not.toHaveBeenCalled();
    });
  });

  describe('health checks', () => {
    test('reports healthy system', async () => {
      (dsaCircuitBreaker.getStats as jest.Mock).mockReturnValue({
        state: 'CLOSED',
        failureCount: 0,
      });

      (sorMetrics.getMetrics as jest.Mock).mockReturnValue({
        dlqCount: 10,
        p95LatencyMs: 1000,
      });

      const health = await orchestrator.checkHealth();

      expect(health.healthy).toBe(true);
      expect(health.circuitOpen).toBe(false);
      expect(health.dlqExceeded).toBe(false);
      expect(health.latencySLABreached).toBe(false);
    });

    test('reports unhealthy system when circuit is open', async () => {
      (dsaCircuitBreaker.getStats as jest.Mock).mockReturnValue({
        state: 'OPEN',
        failureCount: 5,
      });

      (sorMetrics.getMetrics as jest.Mock).mockReturnValue({
        dlqCount: 10,
        p95LatencyMs: 1000,
      });

      const health = await orchestrator.checkHealth();

      expect(health.healthy).toBe(false);
      expect(health.circuitOpen).toBe(true);
    });

    test('reports unhealthy system when DLQ exceeded', async () => {
      (dsaCircuitBreaker.getStats as jest.Mock).mockReturnValue({
        state: 'CLOSED',
        failureCount: 0,
      });

      (sorMetrics.getMetrics as jest.Mock).mockReturnValue({
        dlqCount: 150, // Over threshold of 100
        p95LatencyMs: 1000,
      });

      const health = await orchestrator.checkHealth();

      expect(health.healthy).toBe(false);
      expect(health.dlqExceeded).toBe(true);
    });

    test('reports unhealthy system when latency SLA breached', async () => {
      (dsaCircuitBreaker.getStats as jest.Mock).mockReturnValue({
        state: 'CLOSED',
        failureCount: 0,
      });

      (sorMetrics.getMetrics as jest.Mock).mockReturnValue({
        dlqCount: 10,
        p95LatencyMs: 6000, // Over 5 second SLA
      });

      const health = await orchestrator.checkHealth();

      expect(health.healthy).toBe(false);
      expect(health.latencySLABreached).toBe(true);
    });
  });

  describe('metrics integration', () => {
    test('exposes metrics from all components', () => {
      const mockMetrics = {
        submissions: 100,
        successes: 95,
        failures: 5,
      };

      const mockCircuitStats = {
        state: 'CLOSED',
        failureCount: 0,
      };

      const mockQueueStats = {
        pending: 5,
        retry: 2,
        submitted: 95,
        failed: 3,
        dlq: 1,
      };

      (sorMetrics.getMetrics as jest.Mock).mockReturnValue(mockMetrics);
      (dsaCircuitBreaker.getStats as jest.Mock).mockReturnValue(
        mockCircuitStats
      );
      (sorExportQueueManager.getStats as jest.Mock).mockResolvedValue(
        mockQueueStats
      );

      expect(orchestrator.getMetrics()).toBe(mockMetrics);
      expect(orchestrator.getCircuitStats()).toBe(mockCircuitStats);
    });
  });
});
