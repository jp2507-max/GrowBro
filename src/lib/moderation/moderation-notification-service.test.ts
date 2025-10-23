/**
 * Tests for Moderation Notification Service
 *
 * Tests notification delivery for:
 * - Statement of Reasons (DSA Art. 17)
 * - Appeal deadlines (DSA Art. 20)
 * - SLA breach alerts (Requirement 5.2)
 */

import * as Notifications from 'expo-notifications';

import type {
  ModerationAction,
  ModerationDecision,
  StatementOfReasons,
} from '@/types/moderation';

import { supabase } from '../supabase';
import {
  ModerationNotificationService,
  moderationNotificationService,
} from './moderation-notification-service';

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest
    .fn()
    .mockResolvedValue('mock-notification-id'),
  AndroidNotificationPriority: {
    MIN: -2,
    LOW: -1,
    DEFAULT: 0,
    HIGH: 1,
    MAX: 2,
  },
  SchedulableTriggerInputTypes: {
    DATE: 'date',
    TIME_INTERVAL: 'timeInterval',
    DAILY: 'daily',
    WEEKLY: 'weekly',
    YEARLY: 'yearly',
    CALENDAR: 'calendar',
  },
}));

// Mock supabase
jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(),
    functions: {
      invoke: jest.fn(),
    },
  },
}));

describe('ModerationNotificationService', () => {
  let service: ModerationNotificationService;

  const mockDecision: ModerationDecision = {
    id: 'decision-123',
    report_id: 'report-456',
    moderator_id: 'mod-789',
    action: 'remove' as ModerationAction,
    policy_violations: ['hate_speech'],
    reasoning: 'Content violates community guidelines',
    evidence: [],
    status: 'executed',
    requires_supervisor_approval: false,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockStatement: StatementOfReasons = {
    id: 'sor-123',
    decision_id: 'decision-123',
    decision_ground: 'terms',
    content_type: 'post',
    facts_and_circumstances: 'User posted hate speech content',
    automated_detection: false,
    automated_decision: false,
    redress: ['internal_appeal', 'ods'],
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    service = new ModerationNotificationService();
    jest.clearAllMocks();

    // Mock Supabase responses
    (supabase.from as jest.Mock).mockReturnValue({
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    });

    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: null,
      error: null,
    });
  });

  describe('sendStatementOfReasons', () => {
    it('should send SoR notification to user', async () => {
      const userId = 'user-123';

      await service.sendStatementOfReasons(userId, mockDecision, mockStatement);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'Moderation Decision',
            data: expect.objectContaining({
              type: 'moderation_decision',
              decisionId: mockDecision.id,
              statementId: mockStatement.id,
              userId,
            }),
          }),
          trigger: null,
        })
      );
    });

    it('should log notification delivery', async () => {
      const userId = 'user-123';

      await service.sendStatementOfReasons(userId, mockDecision, mockStatement);

      expect(supabase.from).toHaveBeenCalledWith('notification_delivery_log');
    });

    it('should send email for serious actions', async () => {
      const userId = 'user-123';
      const seriousDecision = {
        ...mockDecision,
        action: 'suspend_user' as ModerationAction,
      };

      await service.sendStatementOfReasons(
        userId,
        seriousDecision,
        mockStatement
      );

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'send-moderation-email',
        expect.objectContaining({
          body: expect.objectContaining({
            userId,
            decisionId: seriousDecision.id,
            action: 'suspend_user',
          }),
        })
      );
    });

    it('should not throw on notification failure', async () => {
      const userId = 'user-123';
      (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValue(
        new Error('Notification failed')
      );

      await expect(
        service.sendStatementOfReasons(userId, mockDecision, mockStatement)
      ).resolves.not.toThrow();
    });

    it('should log notification failure', async () => {
      const userId = 'user-123';
      (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValue(
        new Error('Notification failed')
      );

      await service.sendStatementOfReasons(userId, mockDecision, mockStatement);

      expect(supabase.from).toHaveBeenCalledWith('notification_delivery_log');
    });
  });

  describe('sendDecisionNotification', () => {
    it('should send decision notification to user', async () => {
      const userId = 'user-123';

      await service.sendDecisionNotification(userId, mockDecision);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'Content Moderation Update',
            data: expect.objectContaining({
              type: 'moderation_decision',
              decisionId: mockDecision.id,
              userId,
              action: mockDecision.action,
            }),
          }),
        })
      );
    });

    it('should include appeal information in notification', async () => {
      const userId = 'user-123';

      await service.sendDecisionNotification(userId, mockDecision);

      const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock
        .calls[0][0];
      expect(call.content.body).toContain('appeal');
      expect(call.content.body).toContain('14 days');
    });
  });

  describe('sendAppealDeadlineNotification', () => {
    it('should send appeal deadline notification', async () => {
      const userId = 'user-123';
      const decisionId = 'decision-123';
      const deadlineDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

      await service.sendAppealDeadlineNotification(
        userId,
        decisionId,
        deadlineDate
      );

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'Appeal Deadline Approaching',
            data: expect.objectContaining({
              type: 'appeal_deadline',
              decisionId,
              userId,
            }),
          }),
        })
      );
    });

    it('should calculate days remaining correctly', async () => {
      const userId = 'user-123';
      const decisionId = 'decision-123';
      const deadlineDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now

      await service.sendAppealDeadlineNotification(
        userId,
        decisionId,
        deadlineDate
      );

      const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock
        .calls[0][0];
      expect(call.content.body).toContain('3 days');
    });
  });

  describe('scheduleAppealDeadlineReminder', () => {
    it('should schedule reminder 24 hours before deadline', async () => {
      const userId = 'user-123';
      const decisionId = 'decision-123';
      const deadlineDate = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours from now

      await service.scheduleAppealDeadlineReminder(
        userId,
        decisionId,
        deadlineDate
      );

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'Appeal Deadline Tomorrow',
          }),
          trigger: expect.objectContaining({
            type: Notifications.SchedulableTriggerInputTypes.DATE,
          }),
        })
      );
    });

    it('should not schedule if deadline is less than 24 hours away', async () => {
      const userId = 'user-123';
      const decisionId = 'decision-123';
      const deadlineDate = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours from now

      await service.scheduleAppealDeadlineReminder(
        userId,
        decisionId,
        deadlineDate
      );

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('sendSLABreachAlert', () => {
    it('should send SLA breach alert to moderator', async () => {
      const alertData = {
        moderatorId: 'mod-123',
        type: 'sla_breach' as const,
        reportId: 'report-456',
        priority: 'critical' as const,
      };

      await service.sendSLABreachAlert(alertData);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'SLA Breach',
            data: expect.objectContaining({
              type: 'moderator_alert',
              alertType: 'sla_breach',
              reportId: alertData.reportId,
            }),
            priority: Notifications.AndroidNotificationPriority.MAX,
          }),
        })
      );
    });

    it('should log moderator alert', async () => {
      const alertData = {
        moderatorId: 'mod-123',
        type: 'sla_breach' as const,
        reportId: 'report-456',
        priority: 'critical' as const,
      };

      await service.sendSLABreachAlert(alertData);

      expect(supabase.from).toHaveBeenCalledWith('moderator_alert_log');
    });
  });

  describe('sendSLAWarning', () => {
    it('should send SLA warning at 75% threshold', async () => {
      const alertData = {
        moderatorId: 'mod-123',
        type: 'sla_warning' as const,
        reportId: 'report-456',
        priority: 'high' as const,
        slaPercentage: 75,
      };

      await service.sendSLAWarning(alertData);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'SLA Warning (75%)',
            data: expect.objectContaining({
              slaPercentage: 75,
            }),
          }),
        })
      );
    });

    it('should send SLA warning at 90% threshold', async () => {
      const alertData = {
        moderatorId: 'mod-123',
        type: 'sla_warning' as const,
        reportId: 'report-456',
        priority: 'high' as const,
        slaPercentage: 90,
      };

      await service.sendSLAWarning(alertData);

      const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock
        .calls[0][0];
      expect(call.content.title).toContain('90%');
    });
  });

  describe('sendEscalationAlert', () => {
    it('should send escalation alert to supervisor', async () => {
      const supervisorId = 'supervisor-123';
      const reportId = 'report-456';
      const reason = 'Requires legal review';

      await service.sendEscalationAlert(supervisorId, reportId, reason);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'Escalation Required',
            body: expect.stringContaining(reason),
            data: expect.objectContaining({
              alertType: 'escalation_required',
              reportId,
            }),
          }),
        })
      );
    });
  });

  describe('Action text formatting', () => {
    it('should format action text correctly', async () => {
      const actions: ModerationAction[] = [
        'no_action',
        'quarantine',
        'geo_block',
        'remove',
        'suspend_user',
        'rate_limit',
        'shadow_ban',
      ];

      for (const action of actions) {
        const decision = { ...mockDecision, action };
        await service.sendDecisionNotification('user-123', decision);
      }

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(
        actions.length
      );
    });
  });

  describe('Email notification requirements', () => {
    it('should send email for content removal', async () => {
      const userId = 'user-123';
      const decision = {
        ...mockDecision,
        action: 'remove' as ModerationAction,
      };

      await service.sendStatementOfReasons(userId, decision, mockStatement);

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'send-moderation-email',
        expect.any(Object)
      );
    });

    it('should send email for account suspension', async () => {
      const userId = 'user-123';
      const decision = {
        ...mockDecision,
        action: 'suspend_user' as ModerationAction,
      };

      await service.sendStatementOfReasons(userId, decision, mockStatement);

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'send-moderation-email',
        expect.any(Object)
      );
    });

    it('should not send email for minor actions', async () => {
      const userId = 'user-123';
      const decision = {
        ...mockDecision,
        action: 'quarantine' as ModerationAction,
      };

      await service.sendStatementOfReasons(userId, decision, mockStatement);

      expect(supabase.functions.invoke).not.toHaveBeenCalled();
    });
  });

  describe('Appeal deadline calculation', () => {
    it('should calculate 14-day deadline for content removal', async () => {
      const userId = 'user-123';
      const decision = {
        ...mockDecision,
        action: 'remove' as ModerationAction,
      };

      await service.sendStatementOfReasons(userId, decision, mockStatement);

      const emailCall = (supabase.functions.invoke as jest.Mock).mock.calls[0];
      const appealDeadline = new Date(emailCall[1].body.appealDeadline);
      const daysDiff = Math.ceil(
        (appealDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      expect(daysDiff).toBe(14);
    });

    it('should calculate 30-day deadline for account suspension', async () => {
      const userId = 'user-123';
      const decision = {
        ...mockDecision,
        action: 'suspend_user' as ModerationAction,
      };

      await service.sendStatementOfReasons(userId, decision, mockStatement);

      const emailCall = (supabase.functions.invoke as jest.Mock).mock.calls[0];
      const appealDeadline = new Date(emailCall[1].body.appealDeadline);
      const daysDiff = Math.ceil(
        (appealDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      expect(daysDiff).toBe(30);
    });
  });

  describe('Singleton instance', () => {
    it('should export singleton instance', () => {
      expect(moderationNotificationService).toBeInstanceOf(
        ModerationNotificationService
      );
    });
  });
});
