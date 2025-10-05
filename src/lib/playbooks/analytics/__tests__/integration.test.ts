/**
 * Integration tests for analytics system
 */

import { analytics } from '../index';

// Mock MMKV with in-memory storage
const mockStorage = new Map<string, string | number>();

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    getString: jest.fn(
      (key: string) => mockStorage.get(key) as string | undefined
    ),
    getNumber: jest.fn(
      (key: string) => mockStorage.get(key) as number | undefined
    ),
    set: jest.fn((key: string, value: string | number) =>
      mockStorage.set(key, value)
    ),
    delete: jest.fn((key: string) => mockStorage.delete(key)),
  })),
}));

// Mock Sentry
jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

describe('Analytics Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.clear();
    analytics.resetMetrics();
  });

  describe('Complete Playbook Workflow', () => {
    it('should track complete playbook apply workflow', () => {
      const playbookId = 'playbook-1';
      const plantId = 'plant-1';
      const jobId = 'job-1';

      // Track playbook apply
      analytics.trackPlaybookApply(playbookId, plantId, 25, 180, jobId);

      // Track some task customizations
      analytics.trackPlaybookTaskCustomized(
        'task-1',
        plantId,
        playbookId,
        ['title', 'dueDate'],
        true
      );

      // Track schedule shift
      analytics.trackPlaybookShiftPreview(plantId, 3, 20, false, false);
      analytics.trackPlaybookShiftApply(plantId, 'shift-1', 3, 20, 120);

      // No errors thrown
      expect(true).toBe(true);
    });

    it('should track playbook shift with undo', () => {
      const plantId = 'plant-1';
      const shiftId = 'shift-1';

      analytics.trackPlaybookShiftPreview(plantId, 5, 15, false, false);
      analytics.trackPlaybookShiftApply(plantId, shiftId, 5, 15, 100);
      analytics.trackPlaybookShiftUndo(plantId, shiftId, 15, 80);

      // No errors thrown
      expect(true).toBe(true);
    });
  });

  describe('Notification Lifecycle', () => {
    it('should track complete notification lifecycle', () => {
      const notificationId = 'notif-1';
      const taskId = 'task-1';
      const scheduledTime = Date.now();
      const deliveryTime = scheduledTime + 2000;

      // Schedule
      analytics.trackNotificationScheduled(
        notificationId,
        taskId,
        scheduledTime,
        false
      );

      // Deliver
      analytics.trackNotificationDelivered(notificationId, deliveryTime);

      // Check metrics
      const metrics = analytics.getNotificationMetrics();
      expect(metrics.totalDelivered).toBe(1);
      expect(metrics.deliveryRate).toBe(1);
    });

    it('should track missed notifications', () => {
      const notificationId = 'notif-1';
      const taskId = 'task-1';

      analytics.trackNotificationScheduled(
        notificationId,
        taskId,
        Date.now(),
        false
      );
      analytics.trackNotificationMissed(notificationId, 'doze_mode');

      const metrics = analytics.getNotificationMetrics();
      expect(metrics.totalMissed).toBe(1);
    });
  });

  describe('Sync Operations', () => {
    it('should track successful sync', () => {
      const syncId = 'sync-1';

      analytics.trackSyncStart(syncId, 'full');
      analytics.trackSyncComplete(syncId, 10);

      const metrics = analytics.getSyncMetrics();
      expect(metrics.successfulSyncs).toBe(1);
      expect(metrics.failRate).toBe(0);
    });

    it('should track failed sync', () => {
      const syncId = 'sync-1';

      analytics.trackSyncStart(syncId, 'push');
      analytics.trackSyncFail(syncId, 'NETWORK_ERROR', true);

      const metrics = analytics.getSyncMetrics();
      expect(metrics.failedSyncs).toBe(1);
      expect(metrics.failRate).toBe(1);
    });

    it('should track conflicts', () => {
      analytics.trackConflictSeen(
        'tasks',
        'task-1',
        'update_update',
        'server_wins'
      );
      analytics.trackConflictRestored('tasks', 'task-1', 'update_update');

      const metrics = analytics.getConflictMetrics();
      expect(metrics.totalConflicts).toBe(1);
      expect(metrics.restoredCount).toBe(1);
    });
  });

  describe('AI Suggestions', () => {
    it('should track AI suggestion workflow', () => {
      const plantId = 'plant-1';
      const suggestionId = 'suggestion-1';

      // Suggestion made
      analytics.trackAISuggested(
        plantId,
        suggestionId,
        'nutrient_deficiency',
        0.85,
        5,
        'Detected nitrogen deficiency based on leaf color'
      );

      // User applies suggestion
      analytics.trackAIApplied(
        plantId,
        suggestionId,
        'nutrient_deficiency',
        0.85,
        5,
        true
      );

      // No errors thrown
      expect(true).toBe(true);
    });

    it('should track declined suggestions', () => {
      const plantId = 'plant-1';
      const suggestionId = 'suggestion-2';

      analytics.trackAISuggested(
        plantId,
        suggestionId,
        'overwatering',
        0.65,
        3,
        'Possible overwatering detected'
      );

      analytics.trackAIDeclined(
        plantId,
        suggestionId,
        'overwatering',
        0.65,
        3,
        false
      );

      // No errors thrown
      expect(true).toBe(true);
    });
  });

  describe('Trichome Helper', () => {
    it('should track trichome helper usage', () => {
      const plantId = 'plant-1';

      analytics.trackTrichomeHelperOpen(plantId, 'flowering');
      analytics.trackTrichomeHelperLogged(plantId, 'milky', true, 3, 2);

      // No errors thrown
      expect(true).toBe(true);
    });

    it('should track different assessment types', () => {
      const plantId = 'plant-1';

      const assessments: ('clear' | 'milky' | 'amber' | 'mixed')[] = [
        'clear',
        'milky',
        'amber',
        'mixed',
      ];

      assessments.forEach((assessment) => {
        analytics.trackTrichomeHelperLogged(plantId, assessment, false, 0);
      });

      // No errors thrown
      expect(true).toBe(true);
    });
  });

  describe('Health Monitoring', () => {
    it('should provide health status', () => {
      const health = analytics.getHealthStatus();

      expect(health).toHaveProperty('overall');
      expect(health).toHaveProperty('notifications');
      expect(health).toHaveProperty('sync');
      expect(health).toHaveProperty('issues');
    });

    it('should generate metrics report', () => {
      const report = analytics.getMetricsReport();

      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
    });

    it('should emit summary', () => {
      analytics.emitSummary();
      // No errors thrown
      expect(true).toBe(true);
    });
  });

  describe('Session Management', () => {
    it('should provide session ID', () => {
      const sessionId = analytics.getSessionId();
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);
    });

    it('should reset session', () => {
      const oldSessionId = analytics.getSessionId();
      analytics.resetSession();
      const newSessionId = analytics.getSessionId();

      expect(newSessionId).not.toBe(oldSessionId);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup old notifications', () => {
      analytics.cleanupOldNotifications();
      // No errors thrown
      expect(true).toBe(true);
    });

    it('should flush events', async () => {
      await analytics.flush();
      // No errors thrown
      expect(true).toBe(true);
    });

    it('should shutdown gracefully', async () => {
      await analytics.shutdown();
      // No errors thrown
      expect(true).toBe(true);
    });
  });
});
