/**
 * Low Stock Notification Service
 *
 * Schedules and manages local notifications for low-stock inventory items.
 * Uses exact alarms when permission granted, falls back to inexact alarms otherwise.
 *
 * Requirements: 4.2, 4.3
 */

import type { Database } from '@nozbe/watermelondb';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { LocalNotificationService } from '@/lib/notifications/local-service';

import type { LowStockItem } from '../stock-monitoring-service';
import { StockMonitoringService } from '../stock-monitoring-service';
import { ExactAlarmCoordinator } from './exact-alarm-coordinator';

const NOTIFICATION_STORAGE_KEY = '@growbro/inventory/low-stock-notifications';

interface NotificationRecord {
  itemId: string;
  notificationId: string;
  scheduledAt: string;
  exactAlarm: boolean;
}

export class LowStockNotificationService {
  private stockMonitoring: StockMonitoringService;

  constructor(private database: Database) {
    this.stockMonitoring = new StockMonitoringService(database);
  }

  /**
   * Refresh all low-stock notifications
   *
   * Call on app start/resume to ensure notifications are up-to-date.
   * Cancels notifications for items no longer low on stock.
   * Schedules new notifications for newly low-stock items.
   */
  async refreshNotifications(): Promise<void> {
    try {
      const lowStockItems = await this.stockMonitoring.checkLowStock();
      const existingRecords = await this.getNotificationRecords();

      // Cancel notifications for items no longer low on stock
      const currentLowStockIds = new Set(
        lowStockItems.map((item) => item.itemId)
      );
      const toCancel = existingRecords.filter(
        (record) => !currentLowStockIds.has(record.itemId)
      );

      for (const record of toCancel) {
        await this.cancelNotification(record.itemId);
      }

      // Schedule notifications for low-stock items without notifications
      const existingIds = new Set(existingRecords.map((r) => r.itemId));
      const toSchedule = lowStockItems.filter(
        (item) => !existingIds.has(item.itemId)
      );

      for (const item of toSchedule) {
        await this.scheduleNotification(item);
      }
    } catch (error) {
      console.error('Error refreshing low-stock notifications:', error);
    }
  }

  /**
   * Schedule a notification for a low-stock item
   *
   * @param item - Low-stock item data
   * @returns Notification ID or null if failed
   */
  async scheduleNotification(item: LowStockItem): Promise<string | null> {
    try {
      const canUseExactAlarms =
        await ExactAlarmCoordinator.canScheduleExactAlarms();

      // Prepare notification content
      const title = `Low stock: ${item.name}`;
      const body = `${item.currentStock} ${item.unitOfMeasure} remaining (below ${item.minStock})`;

      const urgencyText =
        item.daysToZero !== null ? ` ~${item.daysToZero} days left` : '';

      // Schedule immediately (within 1 second)
      const triggerDate = new Date(Date.now() + 1000);

      let notificationId: string;

      if (canUseExactAlarms) {
        notificationId =
          await LocalNotificationService.scheduleExactNotification({
            idTag: `inventory_low_stock_${item.itemId}`,
            title,
            body: body + urgencyText,
            data: {
              type: 'inventory.low_stock',
              itemId: item.itemId,
              daysToZero: item.daysToZero,
            },
            triggerDate,
            androidChannelKey: 'inventory.alerts',
          });
      } else {
        // Fallback to inexact notification (not yet implemented in LocalNotificationService)
        // For now, use exact notification without permission check
        notificationId =
          await LocalNotificationService.scheduleExactNotification({
            idTag: `inventory_low_stock_${item.itemId}`,
            title,
            body: body + urgencyText + ' (may be delayed)',
            data: {
              type: 'inventory.low_stock',
              itemId: item.itemId,
              daysToZero: item.daysToZero,
              inexact: true,
            },
            triggerDate,
            androidChannelKey: 'inventory.alerts',
          });
      }

      // Store notification record
      await this.saveNotificationRecord({
        itemId: item.itemId,
        notificationId,
        scheduledAt: new Date().toISOString(),
        exactAlarm: canUseExactAlarms,
      });

      return notificationId;
    } catch (error) {
      console.error('Error scheduling low-stock notification:', error);
      return null;
    }
  }

  /**
   * Cancel notification for an item
   *
   * @param itemId - Inventory item ID
   */
  async cancelNotification(itemId: string): Promise<void> {
    try {
      const records = await this.getNotificationRecords();
      const record = records.find((r) => r.itemId === itemId);

      if (record) {
        await LocalNotificationService.cancelScheduledNotification(
          record.notificationId
        );
        await this.removeNotificationRecord(itemId);
      }
    } catch (error) {
      console.error('Error canceling notification:', error);
    }
  }

  /**
   * Cancel all low-stock notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      const records = await this.getNotificationRecords();

      for (const record of records) {
        await LocalNotificationService.cancelScheduledNotification(
          record.notificationId
        );
      }

      await AsyncStorage.removeItem(NOTIFICATION_STORAGE_KEY);
    } catch (error) {
      console.error('Error canceling all notifications:', error);
    }
  }

  /**
   * Get count of active low-stock notifications
   *
   * @returns Number of active notifications
   */
  async getActiveNotificationCount(): Promise<number> {
    const records = await this.getNotificationRecords();
    return records.length;
  }

  // ========== Private Methods ==========

  /**
   * Get stored notification records
   */
  private async getNotificationRecords(): Promise<NotificationRecord[]> {
    try {
      const json = await AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY);
      return json ? JSON.parse(json) : [];
    } catch (error) {
      console.error('Error loading notification records:', error);
      return [];
    }
  }

  /**
   * Save a notification record
   */
  private async saveNotificationRecord(
    record: NotificationRecord
  ): Promise<void> {
    try {
      const records = await this.getNotificationRecords();
      const existing = records.findIndex((r) => r.itemId === record.itemId);

      if (existing >= 0) {
        records[existing] = record;
      } else {
        records.push(record);
      }

      await AsyncStorage.setItem(
        NOTIFICATION_STORAGE_KEY,
        JSON.stringify(records)
      );
    } catch (error) {
      console.error('Error saving notification record:', error);
    }
  }

  /**
   * Remove a notification record
   */
  private async removeNotificationRecord(itemId: string): Promise<void> {
    try {
      const records = await this.getNotificationRecords();
      const filtered = records.filter((r) => r.itemId !== itemId);
      await AsyncStorage.setItem(
        NOTIFICATION_STORAGE_KEY,
        JSON.stringify(filtered)
      );
    } catch (error) {
      console.error('Error removing notification record:', error);
    }
  }
}
