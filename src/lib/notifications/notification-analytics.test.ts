/**
 * @jest-environment node
 */

import { supabase } from '@/lib/supabase';

import { notificationAnalytics } from './notification-analytics';

// Mock Supabase client
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

describe('NotificationAnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDeliveryStats', () => {
    it('should fetch delivery stats without date filters', async () => {
      const mockData = [
        {
          date: '2025-09-30',
          type: 'community.reply',
          platform: 'ios',
          attempted: 100,
          sent: 98,
          delivered: 95,
          failed: 2,
          opened: 60,
          delivery_rate_percent: 98.0,
          engagement_rate_percent: 63.16,
        },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await notificationAnalytics.getDeliveryStats();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        date: '2025-09-30',
        type: 'community.reply',
        platform: 'ios',
        attempted: 100,
        sent: 98,
        delivered: 95,
        failed: 2,
        opened: 60,
        deliveryRatePercent: 98.0,
        engagementRatePercent: 63.16,
      });
    });

    it('should apply date filters when provided', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      await notificationAnalytics.getDeliveryStats('2025-09-01', '2025-09-30');

      expect(mockQuery.gte).toHaveBeenCalledWith('date', '2025-09-01');
      expect(mockQuery.lte).toHaveBeenCalledWith('date', '2025-09-30');
    });

    it('should throw error on database failure', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      await expect(notificationAnalytics.getDeliveryStats()).rejects.toThrow(
        'Failed to fetch delivery stats: Database error'
      );
    });
  });

  describe('getOptInRates', () => {
    it('should fetch opt-in rates for all notification types', async () => {
      const mockData = [
        {
          notification_type: 'community.interactions',
          total_users: 1000,
          opted_in: 850,
          opted_out: 150,
          opt_in_rate_percent: 85.0,
        },
        {
          notification_type: 'cultivation.reminders',
          total_users: 1000,
          opted_in: 920,
          opted_out: 80,
          opt_in_rate_percent: 92.0,
        },
      ];

      const mockQuery = {
        select: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await notificationAnalytics.getOptInRates();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        notificationType: 'community.interactions',
        totalUsers: 1000,
        optedIn: 850,
        optedOut: 150,
        optInRatePercent: 85.0,
      });
    });
  });

  describe('calculateDeliveryRate', () => {
    it('should calculate delivery rate for specific notification type', async () => {
      const mockData = [
        {
          notification_type: 'community.reply',
          days_analyzed: 7,
          attempted: 500,
          sent: 485,
          delivery_rate_percent: 97.0,
        },
      ];

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result =
        await notificationAnalytics.calculateDeliveryRate('community.reply');

      expect(result).toEqual({
        notificationType: 'community.reply',
        daysAnalyzed: 7,
        attempted: 500,
        sent: 485,
        deliveryRatePercent: 97.0,
      });
    });

    it('should return null when no data available', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [],
        error: null,
      });

      const result =
        await notificationAnalytics.calculateDeliveryRate('community.like');

      expect(result).toBeNull();
    });
  });

  describe('checkDeliveryRateAlerts', () => {
    it('should return alerts for notification types below threshold', async () => {
      const mockData = [
        {
          notification_type: 'community.like',
          delivery_rate_percent: 92.5,
          alert_message: 'Delivery rate below threshold (95%)',
        },
      ];

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await notificationAnalytics.checkDeliveryRateAlerts();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        notificationType: 'community.like',
        deliveryRatePercent: 92.5,
        alertMessage: 'Delivery rate below threshold (95%)',
      });
    });

    it('should return empty array when all rates are above threshold', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await notificationAnalytics.checkDeliveryRateAlerts();

      expect(result).toEqual([]);
    });
  });

  describe('trackNotificationOpened', () => {
    it('should update notification status to opened', async () => {
      const mockEq2 = jest.fn().mockResolvedValue({ error: null });
      const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });
      const mockUpdate = {
        update: jest.fn().mockReturnValue({ eq: mockEq1 }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockUpdate);

      await notificationAnalytics.trackNotificationOpened('msg_123');

      expect(mockUpdate.update).toHaveBeenCalledWith({
        status: 'opened',
        updated_at: expect.any(String),
      });
      expect(mockEq1).toHaveBeenCalledWith('message_id', 'msg_123');
      expect(mockEq2).toHaveBeenCalledWith('status', 'delivered');
    });

    it('should not throw error on database failure (non-critical tracking)', async () => {
      const mockEq2 = jest.fn().mockResolvedValue({
        error: { message: 'Database error' },
      });
      const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });
      const mockUpdate = {
        update: jest.fn().mockReturnValue({ eq: mockEq1 }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockUpdate);

      // Should not throw
      await expect(
        notificationAnalytics.trackNotificationOpened('msg_123')
      ).resolves.not.toThrow();
    });
  });

  describe('getDashboardStats', () => {
    it('should aggregate statistics from multiple sources', async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const mockDeliveryStats = [
        {
          date: new Date().toISOString().split('T')[0],
          type: 'community.reply',
          platform: 'ios' as const,
          attempted: 100,
          sent: 98,
          delivered: 95,
          failed: 2,
          opened: 60,
          deliveryRatePercent: 98.0,
          engagementRatePercent: 63.16,
        },
      ];

      const mockOptInRates = [
        {
          notificationType: 'community.interactions',
          totalUsers: 1000,
          optedIn: 850,
          optedOut: 150,
          optInRatePercent: 85.0,
        },
      ];

      const mockFailures: never[] = [];
      const mockAlerts: never[] = [];

      jest
        .spyOn(notificationAnalytics, 'getDeliveryStats')
        .mockResolvedValue(mockDeliveryStats);
      jest
        .spyOn(notificationAnalytics, 'getOptInRates')
        .mockResolvedValue(mockOptInRates);
      jest
        .spyOn(notificationAnalytics, 'getDeliveryFailures')
        .mockResolvedValue(mockFailures);
      jest
        .spyOn(notificationAnalytics, 'checkDeliveryRateAlerts')
        .mockResolvedValue(mockAlerts);

      const result = await notificationAnalytics.getDashboardStats();

      expect(result.deliveryRate).toBe(98.0);
      expect(result.engagementRate).toBe(63.16);
      expect(result.optInRate).toBe(85.0);
      expect(result.recentFailures).toBe(0);
      expect(result.alerts).toEqual([]);
    });

    it('should handle empty data gracefully', async () => {
      jest
        .spyOn(notificationAnalytics, 'getDeliveryStats')
        .mockResolvedValue([]);
      jest.spyOn(notificationAnalytics, 'getOptInRates').mockResolvedValue([]);
      jest
        .spyOn(notificationAnalytics, 'getDeliveryFailures')
        .mockResolvedValue([]);
      jest
        .spyOn(notificationAnalytics, 'checkDeliveryRateAlerts')
        .mockResolvedValue([]);

      const result = await notificationAnalytics.getDashboardStats();

      expect(result.deliveryRate).toBe(0);
      expect(result.engagementRate).toBe(0);
      expect(result.optInRate).toBe(0);
      expect(result.recentFailures).toBe(0);
    });
  });
});
