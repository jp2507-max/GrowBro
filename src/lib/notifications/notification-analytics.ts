/**
 * Notification Analytics Service
 *
 * Tracks delivery and engagement metrics for push notifications.
 * Provides delivery rates, engagement rates, and alerting for low delivery rates.
 */

import { supabase } from '@/lib/supabase';

export interface DeliveryStats {
  date: string;
  type: string;
  platform: 'ios' | 'android';
  attempted: number;
  sent: number;
  delivered: number;
  failed: number;
  opened: number;
  deliveryRatePercent: number;
  engagementRatePercent: number;
}

export interface OptInStats {
  notificationType: string;
  totalUsers: number;
  optedIn: number;
  optedOut: number;
  optInRatePercent: number;
}

export interface DeliveryFailure {
  id: string;
  userId: string;
  messageId: string;
  type: string;
  platform: 'ios' | 'android';
  deviceToken: string;
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
}

export interface EngagementEvent {
  messageId: string;
  type: string;
  platform: 'ios' | 'android';
  userId: string;
  sentAt: string;
  openedAt: string;
  status: string;
  timeToOpenSeconds: number;
}

export interface DeliveryRateResult {
  notificationType: string;
  daysAnalyzed: number;
  attempted: number;
  sent: number;
  deliveryRatePercent: number;
}

export interface DeliveryRateAlert {
  notificationType: string;
  deliveryRatePercent: number;
  alertMessage: string;
}

class NotificationAnalyticsService {
  /**
   * Fetch delivery statistics for a date range
   */
  async getDeliveryStats(
    startDate?: string,
    endDate?: string
  ): Promise<DeliveryStats[]> {
    let query = supabase.from('notification_delivery_stats').select('*');

    if (startDate) {
      query = query.gte('date', startDate);
    }

    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query.order('date', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch delivery stats: ${error.message}`);
    }

    return (data || []).map((row) => ({
      date: row.date,
      type: row.type,
      platform: row.platform,
      attempted: row.attempted,
      sent: row.sent,
      delivered: row.delivered,
      failed: row.failed,
      opened: row.opened,
      deliveryRatePercent: row.delivery_rate_percent,
      engagementRatePercent: row.engagement_rate_percent,
    }));
  }

  /**
   * Fetch opt-in rates by notification type
   */
  async getOptInRates(): Promise<OptInStats[]> {
    const { data, error } = await supabase
      .from('notification_opt_in_rates')
      .select('*');

    if (error) {
      throw new Error(`Failed to fetch opt-in rates: ${error.message}`);
    }

    return (data || []).map((row) => ({
      notificationType: row.notification_type,
      totalUsers: row.total_users,
      optedIn: row.opted_in,
      optedOut: row.opted_out,
      optInRatePercent: row.opt_in_rate_percent,
    }));
  }

  /**
   * Fetch recent delivery failures (last 24 hours)
   */
  async getDeliveryFailures(): Promise<DeliveryFailure[]> {
    const { data, error } = await supabase
      .from('notification_delivery_failures')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(`Failed to fetch delivery failures: ${error.message}`);
    }

    return (data || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      messageId: row.message_id,
      type: row.type,
      platform: row.platform,
      deviceToken: row.device_token,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Fetch engagement tracking events
   */
  async getEngagementEvents(limit = 100): Promise<EngagementEvent[]> {
    const { data, error } = await supabase
      .from('notification_engagement_tracking')
      .select('*')
      .order('opened_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch engagement events: ${error.message}`);
    }

    return (data || []).map((row) => ({
      messageId: row.message_id,
      type: row.type,
      platform: row.platform,
      userId: row.user_id,
      sentAt: row.sent_at,
      openedAt: row.opened_at,
      status: row.status,
      timeToOpenSeconds: row.time_to_open_seconds,
    }));
  }

  /**
   * Calculate delivery rate for a specific notification type
   */
  async calculateDeliveryRate(
    notificationType: string,
    days = 7
  ): Promise<DeliveryRateResult | null> {
    const { data, error } = await supabase.rpc('get_delivery_rate', {
      p_notification_type: notificationType,
      p_days: days,
    });

    if (error) {
      throw new Error(`Failed to calculate delivery rate: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return null;
    }

    const result = data[0] as {
      notification_type: string;
      days_analyzed: number;
      attempted: number;
      sent: number;
      delivery_rate_percent: number;
    };
    return {
      notificationType: result.notification_type,
      daysAnalyzed: result.days_analyzed,
      attempted: result.attempted,
      sent: result.sent,
      deliveryRatePercent: result.delivery_rate_percent,
    };
  }

  /**
   * Check for delivery rate alerts (below 95% threshold)
   */
  async checkDeliveryRateAlerts(
    threshold = 95.0
  ): Promise<DeliveryRateAlert[]> {
    const { data, error } = await supabase.rpc(
      'check_delivery_rate_threshold',
      {
        p_threshold: threshold,
      }
    );

    if (error) {
      throw new Error(
        `Failed to check delivery rate threshold: ${error.message}`
      );
    }

    return (data || []).map(
      (row: {
        notification_type: string;
        delivery_rate_percent: number;
        alert_message: string;
      }) => ({
        notificationType: row.notification_type,
        deliveryRatePercent: row.delivery_rate_percent,
        alertMessage: row.alert_message,
      })
    );
  }

  /**
   * Track notification open event (client-side)
   * Updates notification_queue status from delivered -> opened
   */
  async trackNotificationOpened(messageId: string): Promise<void> {
    const { error } = await supabase
      .from('notification_queue')
      .update({
        status: 'opened',
        updated_at: new Date().toISOString(),
      })
      .eq('message_id', messageId)
      .eq('status', 'delivered');

    if (error) {
      console.error(`Failed to track notification open: ${error.message}`);
      // Don't throw - this is non-critical tracking
    }
  }

  /**
   * Get summary statistics for dashboard
   */
  async getDashboardStats(): Promise<{
    deliveryRate: number;
    engagementRate: number;
    optInRate: number;
    recentFailures: number;
    alerts: DeliveryRateAlert[];
  }> {
    // Run queries in parallel
    const [deliveryStats, optInRates, failures, alerts] = await Promise.all([
      this.getDeliveryStats(),
      this.getOptInRates(),
      this.getDeliveryFailures(),
      this.checkDeliveryRateAlerts(),
    ]);

    // Calculate overall delivery rate (last 7 days)
    const recentStats = deliveryStats.filter((stat) => {
      const statDate = new Date(stat.date);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return statDate >= sevenDaysAgo;
    });

    const totalAttempted = recentStats.reduce(
      (sum, stat) => sum + stat.attempted,
      0
    );
    const totalSent = recentStats.reduce((sum, stat) => sum + stat.sent, 0);
    const totalOpened = recentStats.reduce((sum, stat) => sum + stat.opened, 0);
    const totalDelivered = recentStats.reduce(
      (sum, stat) => sum + stat.delivered,
      0
    );

    const deliveryRate =
      totalAttempted > 0 ? (totalSent / totalAttempted) * 100 : 0;
    const engagementRate =
      totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0;

    // Calculate average opt-in rate
    const avgOptInRate =
      optInRates.length > 0
        ? optInRates.reduce((sum, rate) => sum + rate.optInRatePercent, 0) /
          optInRates.length
        : 0;

    return {
      deliveryRate: Math.round(deliveryRate * 100) / 100,
      engagementRate: Math.round(engagementRate * 100) / 100,
      optInRate: Math.round(avgOptInRate * 100) / 100,
      recentFailures: failures.length,
      alerts,
    };
  }
}

export const notificationAnalytics = new NotificationAnalyticsService();
