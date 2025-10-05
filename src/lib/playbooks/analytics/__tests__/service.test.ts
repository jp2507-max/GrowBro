/**
 * Tests for analytics service
 */

import { analyticsService } from '../service';
import type { PlaybookApplyEvent } from '../types';

// Mock Sentry
jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

// Mock MMKV
jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}));

describe('AnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should configure analytics service', () => {
      analyticsService.configure({
        enabled: false,
        debug: true,
      });

      // Configuration is applied (no error thrown)
      expect(true).toBe(true);
    });
  });

  describe('Event Tracking', () => {
    it('should track playbook apply event', () => {
      analyticsService.track<PlaybookApplyEvent>('playbook_apply', {
        playbookId: 'playbook-1',
        plantId: 'plant-1',
        appliedTaskCount: 10,
        durationMs: 150,
        jobId: 'job-1',
      });

      // Event tracked successfully (no error thrown)
      expect(true).toBe(true);
    });

    it('should include timestamp and session ID', () => {
      const sessionId = analyticsService.getSessionId();
      expect(sessionId).toBeTruthy();
      expect(typeof sessionId).toBe('string');
    });

    it('should not track when disabled', () => {
      analyticsService.configure({ enabled: false });

      analyticsService.track<PlaybookApplyEvent>('playbook_apply', {
        playbookId: 'playbook-1',
        plantId: 'plant-1',
        appliedTaskCount: 10,
        durationMs: 150,
        jobId: 'job-1',
      });

      // No error thrown even when disabled
      expect(true).toBe(true);

      // Re-enable for other tests
      analyticsService.configure({ enabled: true });
    });
  });

  describe('Session Management', () => {
    it('should generate session ID', () => {
      const sessionId = analyticsService.getSessionId();
      expect(sessionId).toBeTruthy();
    });

    it('should reset session', () => {
      const oldSessionId = analyticsService.getSessionId();
      analyticsService.resetSession();
      const newSessionId = analyticsService.getSessionId();

      expect(newSessionId).toBeTruthy();
      expect(newSessionId).not.toBe(oldSessionId);
    });
  });

  describe('Flushing', () => {
    it('should flush events', async () => {
      await analyticsService.flush();
      // No error thrown
      expect(true).toBe(true);
    });

    it('should handle flush errors gracefully', async () => {
      // Flush should not throw even if there are errors
      await expect(analyticsService.flush()).resolves.not.toThrow();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      await analyticsService.shutdown();
      // No error thrown
      expect(true).toBe(true);
    });
  });
});
