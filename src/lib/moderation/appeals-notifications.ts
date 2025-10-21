/**
 * Appeals Notification Service
 *
 * Sends notifications for appeal-related events (DSA Art. 20 requirement)
 * Integrates with existing notification infrastructure
 */

import * as Notifications from 'expo-notifications';

import type { AppealDecision, AppealStatus } from '@/types/moderation';

export interface AppealNotificationData {
  appealId: string;
  userId: string;
  type:
    | 'appeal_submitted'
    | 'appeal_assigned'
    | 'appeal_decision'
    | 'deadline_warning'
    | 'ods_escalation';
  decision?: AppealDecision;
  status?: AppealStatus;
  deadlineDate?: Date;
  odsBodyName?: string;
}

/**
 * Send notification to user about appeal status
 */
export async function sendAppealNotification(
  data: AppealNotificationData
): Promise<void> {
  try {
    const { title, body } = getNotificationContent(data);

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          type: 'appeal',
          appealId: data.appealId,
          userId: data.userId,
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Send immediately
    });
  } catch (error) {
    console.error('[AppealsNotifications] Failed to send notification:', error);
    // Don't throw - notification failure shouldn't block core operations
  }
}

/**
 * Schedule deadline warning notification
 */
export async function scheduleDeadlineWarning(
  appealId: string,
  userId: string,
  deadlineDate: Date
): Promise<void> {
  try {
    // Schedule notification 24 hours before deadline
    const warningDate = new Date(deadlineDate.getTime() - 24 * 60 * 60 * 1000);

    if (warningDate < new Date()) {
      return; // Deadline is less than 24 hours away, skip scheduling
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Appeal Deadline Approaching',
        body: 'Your appeal will be automatically reviewed soon. The deadline is in 24 hours.',
        data: {
          type: 'appeal_deadline',
          appealId,
          userId,
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: warningDate,
      },
    });
  } catch (error) {
    console.error(
      '[AppealsNotifications] Failed to schedule deadline warning:',
      error
    );
  }
}

/**
 * Get notification content based on event type
 */
function getNotificationContent(data: AppealNotificationData): {
  title: string;
  body: string;
} {
  switch (data.type) {
    case 'appeal_submitted':
      return {
        title: 'Appeal Submitted',
        body: 'Your appeal has been received and will be reviewed within 7 days.',
      };

    case 'appeal_assigned':
      return {
        title: 'Appeal Under Review',
        body: 'A reviewer has been assigned to your appeal.',
      };

    case 'appeal_decision':
      if (data.decision === 'upheld') {
        return {
          title: 'Appeal Upheld',
          body: 'Your appeal was successful. The original decision has been reversed.',
        };
      } else if (data.decision === 'rejected') {
        return {
          title: 'Appeal Rejected',
          body: 'Your appeal was not successful. You may escalate to an out-of-court dispute settlement body.',
        };
      } else {
        return {
          title: 'Appeal Decision - Partial',
          body: 'Your appeal received a partial resolution. Check the details in the app.',
        };
      }

    case 'deadline_warning':
      return {
        title: 'Appeal Deadline Approaching',
        body: `Your appeal will be reviewed by ${data.deadlineDate?.toLocaleDateString() || 'soon'}.`,
      };

    case 'ods_escalation':
      return {
        title: 'Appeal Escalated to ODS',
        body: `Your appeal has been escalated to ${data.odsBodyName || 'an out-of-court dispute settlement body'}.`,
      };

    default:
      return {
        title: 'Appeal Update',
        body: 'Your appeal status has been updated.',
      };
  }
}
