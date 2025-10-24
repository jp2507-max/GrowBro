/**
 * Geo-Restriction Notification Service
 * Sends notifications to authors about regional content restrictions
 * Part of Task 10: Geo-Location Service (Requirement 9.7)
 */

import { supabase } from '@/lib/supabase';
import type {
  DeliveryMethod,
  GeoRestrictionNotification,
  NotificationType,
} from '@/types/geo-location';

import { NOTIFICATION_CONFIG } from './geo-config';

/**
 * Input for creating a geo-restriction notification
 */
interface CreateNotificationInput {
  restrictionId: string;
  recipientId: string;
  notificationType: NotificationType;
  deliveryMethod: DeliveryMethod;
}

/**
 * Notification payload for different delivery methods
 */
interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Service for managing geo-restriction notifications
 */
export class GeoNotificationService {
  /**
   * Send author alert about geo-restriction
   * Requirement 9.7: Provide author notifications indicating affected regions
   */
  async notifyAuthor(options: {
    userId: string;
    contentId: string;
    restrictedRegions: string[];
    lawfulBasis: string;
    reasonCode: string;
  }): Promise<void> {
    const { userId, contentId, restrictedRegions, lawfulBasis, reasonCode } =
      options;
    try {
      // Get restriction ID
      const { data: restriction, error: restrictionError } = await supabase
        .from('geo_restrictions')
        .select('id')
        .eq('content_id', contentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (restrictionError) {
        throw restrictionError;
      }

      // Create notification record
      const notification = await this.createNotification({
        restrictionId: restriction.id,
        recipientId: userId,
        notificationType: 'author_alert',
        deliveryMethod: 'in_app', // Default to in-app, can be extended
      });

      // Build notification payload
      const payload = this.buildAuthorAlertPayload({
        contentId,
        restrictedRegions,
        lawfulBasis,
        reasonCode,
      });

      // Send notification with retry logic
      await this.sendWithRetry({
        notificationId: notification.id,
        userId,
        payload,
        deliveryMethod: 'in_app',
      });
    } catch (error) {
      console.error('Failed to notify author:', error);
      throw error;
    }
  }

  /**
   * Send user explainer about why content is not available
   * Requirement 9.3: Provide "why can't I see this?" explainer
   */
  async notifyUserExplainer(options: {
    userId: string;
    contentId: string;
    restrictedRegions: string[];
    reasonCode: string;
  }): Promise<void> {
    const { userId, contentId, restrictedRegions, reasonCode } = options;
    try {
      // Get restriction ID
      const { data: restriction, error: restrictionError } = await supabase
        .from('geo_restrictions')
        .select('id')
        .eq('content_id', contentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (restrictionError) {
        throw restrictionError;
      }

      // Create notification record
      const notification = await this.createNotification({
        restrictionId: restriction.id,
        recipientId: userId,
        notificationType: 'user_explainer',
        deliveryMethod: 'in_app',
      });

      // Build notification payload
      const payload = this.buildUserExplainerPayload(
        contentId,
        restrictedRegions,
        reasonCode
      );

      // Send notification
      await this.sendWithRetry({
        notificationId: notification.id,
        userId,
        payload,
        deliveryMethod: 'in_app',
      });
    } catch (error) {
      console.error('Failed to notify user explainer:', error);
      throw error;
    }
  }

  /**
   * Create notification record in database
   */
  private async createNotification(
    input: CreateNotificationInput
  ): Promise<GeoRestrictionNotification> {
    const { data, error } = await supabase
      .from('geo_restriction_notifications')
      .insert({
        restriction_id: input.restrictionId,
        recipient_id: input.recipientId,
        notification_type: input.notificationType,
        delivery_method: input.deliveryMethod,
        delivery_status: 'pending',
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as GeoRestrictionNotification;
  }

  /**
   * Build notification payload for author alert
   */
  private buildAuthorAlertPayload(options: {
    contentId: string;
    restrictedRegions: string[];
    lawfulBasis: string;
    reasonCode: string;
  }): NotificationPayload {
    const { contentId, restrictedRegions, lawfulBasis, reasonCode } = options;
    const regionList = restrictedRegions.join(', ');

    return {
      title: 'Content Restricted in Some Regions',
      body: `Your content is not visible in ${regionList} due to regional restrictions.`,
      data: {
        type: 'geo_restriction_author_alert',
        contentId,
        restrictedRegions,
        lawfulBasis,
        reasonCode,
        action: 'view_restriction_details',
      },
    };
  }

  /**
   * Build notification payload for user explainer
   */
  private buildUserExplainerPayload(
    contentId: string,
    restrictedRegions: string[],
    reasonCode: string
  ): NotificationPayload {
    const regionList = restrictedRegions.join(', ');
    const reason = this.getReasonText(reasonCode);

    return {
      title: 'Content Not Available',
      body: `This content is not available in ${regionList}. ${reason}`,
      data: {
        type: 'geo_restriction_user_explainer',
        contentId,
        restrictedRegions,
        reasonCode,
        action: 'view_explainer',
      },
    };
  }

  /**
   * Get human-readable reason text for restriction
   */
  private getReasonText(reasonCode: string): string {
    const reasons: Record<string, string> = {
      illegal_content: 'This content violates local laws.',
      policy_violation:
        'This content violates platform policies in your region.',
      legal_request: 'This content was restricted following a legal request.',
      age_restriction: 'This content is age-restricted in your region.',
    };

    return reasons[reasonCode] || 'Regional restrictions apply.';
  }

  /**
   * Send notification with retry logic
   */
  private async sendWithRetry(options: {
    notificationId: string;
    userId: string;
    payload: NotificationPayload;
    deliveryMethod: DeliveryMethod;
    attempt?: number;
  }): Promise<void> {
    const { notificationId, userId, payload, deliveryMethod } = options;
    let attempt = options.attempt ?? 1;
    try {
      // Send based on delivery method
      switch (deliveryMethod) {
        case 'in_app':
          await this.sendInAppNotification(userId, payload);
          break;
        case 'push':
          await this.sendPushNotification(userId, payload);
          break;
        case 'email':
          await this.sendEmailNotification(userId, payload);
          break;
        default:
          throw new Error(`Unsupported delivery method: ${deliveryMethod}`);
      }

      // Mark as sent
      await this.updateNotificationStatus(notificationId, 'sent');
    } catch (error) {
      console.error(
        `Failed to send notification (attempt ${attempt}/${NOTIFICATION_CONFIG.RETRY_ATTEMPTS}):`,
        error
      );

      // Retry if within limit
      if (attempt < NOTIFICATION_CONFIG.RETRY_ATTEMPTS) {
        await new Promise((resolve) =>
          setTimeout(resolve, NOTIFICATION_CONFIG.RETRY_DELAY_MS)
        );
        return this.sendWithRetry({
          notificationId,
          userId,
          payload,
          deliveryMethod,
          attempt: attempt + 1,
        });
      }

      // Mark as failed
      await this.updateNotificationStatus(
        notificationId,
        'failed',
        error instanceof Error ? error.message : String(error)
      );

      throw error;
    }
  }

  /**
   * Send in-app notification
   */
  private async sendInAppNotification(
    userId: string,
    payload: NotificationPayload
  ): Promise<void> {
    // Store in-app notification in database for user to see
    const { error } = await supabase.from('in_app_notifications').insert({
      user_id: userId,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      read: false,
      created_at: new Date().toISOString(),
    });

    if (error) {
      throw error;
    }
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(
    userId: string,
    payload: NotificationPayload
  ): Promise<void> {
    // Use Supabase edge function or Expo push notification service
    const { error } = await supabase.functions.invoke(
      'send-push-notification',
      {
        body: {
          userId,
          ...payload,
        },
      }
    );

    if (error) {
      throw error;
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    userId: string,
    payload: NotificationPayload
  ): Promise<void> {
    // Use Supabase edge function or email service (SendGrid, Resend)
    const { error } = await supabase.functions.invoke(
      'send-email-notification',
      {
        body: {
          userId,
          subject: payload.title,
          body: payload.body,
          data: payload.data,
        },
      }
    );

    if (error) {
      throw error;
    }
  }

  /**
   * Update notification delivery status
   */
  private async updateNotificationStatus(
    notificationId: string,
    status: 'sent' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    const update: {
      delivery_status: string;
      sent_at?: string;
      error_message?: string;
    } = {
      delivery_status: status,
    };

    if (status === 'sent') {
      update.sent_at = new Date().toISOString();
    }

    if (errorMessage) {
      update.error_message = errorMessage;
    }

    await supabase
      .from('geo_restriction_notifications')
      .update(update)
      .eq('id', notificationId);
  }

  /**
   * Get notification history for a user
   */
  async getNotificationHistory(
    userId: string
  ): Promise<GeoRestrictionNotification[]> {
    const { data, error } = await supabase
      .from('geo_restriction_notifications')
      .select('*')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data as GeoRestrictionNotification[];
  }

  /**
   * Batch notify multiple authors about geo-restrictions
   */
  async batchNotifyAuthors(
    notifications: {
      userId: string;
      contentId: string;
      restrictedRegions: string[];
      lawfulBasis: string;
      reasonCode: string;
    }[]
  ): Promise<void> {
    const promises = notifications.map((notification) =>
      this.notifyAuthor({
        userId: notification.userId,
        contentId: notification.contentId,
        restrictedRegions: notification.restrictedRegions,
        lawfulBasis: notification.lawfulBasis,
        reasonCode: notification.reasonCode,
      })
    );

    await Promise.allSettled(promises);
  }
}

/**
 * Singleton instance
 */
export const geoNotificationService = new GeoNotificationService();
