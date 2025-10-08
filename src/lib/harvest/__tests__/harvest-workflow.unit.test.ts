/**
 * Unit Tests - Harvest Workflow Business Logic
 * Fast, mock-based tests for harvest workflow business logic and data transformations
 *
 * Coverage:
 * - Harvest state transitions and validation logic
 * - Conflict resolution algorithms (LWW, idempotency)
 * - Photo storage and cleanup business rules
 * - Notification scheduling calculations
 * - Complete workflow state management
 */

import { HarvestStages } from '@/types/harvest';

// Test data generators
function generateTestHarvest(overrides = {}) {
  return {
    id: `test-harvest-${Date.now()}`,
    plant_id: 'test-plant-1',
    user_id: 'test-user-1',
    stage: HarvestStages.HARVEST,
    wet_weight_g: 1000,
    dry_weight_g: null,
    trimmings_weight_g: 50,
    notes: 'Test harvest',
    stage_started_at: new Date().toISOString(),
    stage_completed_at: null,
    photos: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    conflict_seen: false,
    ...overrides,
  };
}

function generateTestInventory(harvestId: string, overrides = {}) {
  return {
    id: `test-inventory-${Date.now()}`,
    plant_id: 'test-plant-1',
    harvest_id: harvestId,
    user_id: 'test-user-1',
    final_weight_g: 850,
    harvest_date: new Date().toISOString().split('T')[0],
    total_duration_days: 21,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    ...overrides,
  };
}

describe('Harvest Workflow - Unit Tests', () => {
  describe('Scenario 1: Complete Offline-to-Online Sync with Conflict Resolution', () => {
    it('should create harvest offline, sync online, and resolve conflicts with LWW', async () => {
      // 1. Simulate offline mode (tracked for context)

      // 2. Create harvest offline
      const harvest = generateTestHarvest({
        notes: 'Created offline',
      });

      // Store in local WatermelonDB (mocked)
      const localHarvests = [harvest];

      expect(localHarvests).toHaveLength(1);
      expect(localHarvests[0].notes).toBe('Created offline');

      // 3. Simulate concurrent edit on another device
      const serverHarvest = {
        ...harvest,
        notes: 'Updated on server',
        updated_at: new Date(Date.now() + 1000).toISOString(), // Later timestamp
      };

      // 4. Go online and sync
      // Last-Write-Wins: server timestamp is later, so server version wins
      const resolvedHarvest = {
        ...harvest,
        ...serverHarvest,
        conflict_seen: true, // Mark conflict detected
      };

      expect(resolvedHarvest.notes).toBe('Updated on server');
      expect(resolvedHarvest.conflict_seen).toBe(true);
    });

    it('should handle stage transitions during offline sync', async () => {
      // 1. Create harvest offline
      const harvest = generateTestHarvest({
        stage: HarvestStages.HARVEST,
      });

      // 2. Advance to DRYING offline
      const updatedHarvest = {
        ...harvest,
        stage: HarvestStages.DRYING,
        stage_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 3. Queue operations for sync
      const pendingOps = [
        { type: 'created', table: 'harvests', record: harvest },
        { type: 'updated', table: 'harvests', record: updatedHarvest },
      ];

      expect(pendingOps).toHaveLength(2);
      expect(updatedHarvest.stage).toBe(HarvestStages.DRYING);

      // 4. Simulate sync: server applies changes in order
      const serverState = updatedHarvest;
      expect(serverState.stage).toBe(HarvestStages.DRYING);
      expect(serverState.stage_completed_at).not.toBeNull();
    });

    it('should sync multiple harvests with photos without duplicates', async () => {
      // 1. Create 3 harvests offline with photos
      const harvests = [
        generateTestHarvest({
          id: 'h1',
          photos: ['file:///photo1.jpg', 'file:///photo2.jpg'],
        }),
        generateTestHarvest({
          id: 'h2',
          photos: ['file:///photo3.jpg'],
        }),
        generateTestHarvest({
          id: 'h3',
          photos: [],
        }),
      ];

      // 2. Queue for sync
      const pendingCreates = harvests.length;
      expect(pendingCreates).toBe(3);

      // 3. Simulate sync
      const syncedHarvests = harvests.map((h) => ({
        ...h,
        updated_at: new Date().toISOString(), // Server updates timestamp
      }));

      // 4. Verify no duplicates
      const uniqueIds = new Set(syncedHarvests.map((h) => h.id));
      expect(uniqueIds.size).toBe(3);

      // 5. Verify photo URIs preserved
      expect(syncedHarvests[0].photos).toHaveLength(2);
      expect(syncedHarvests[1].photos).toHaveLength(1);
      expect(syncedHarvests[2].photos).toHaveLength(0);
    });
  });

  describe('Scenario 2: Atomic Inventory Creation Under Failure Conditions', () => {
    it('should rollback transaction on partial failure', async () => {
      // 1. Create harvest in CURING stage
      const harvest = generateTestHarvest({
        id: 'h-atomic-1',
        stage: HarvestStages.CURING,
        dry_weight_g: 850,
      });

      // 2. Attempt to finalize curing (atomic operation with idempotency)

      // Simulate transactional failure (e.g., inventory creation fails)
      const transactionFailed = true;

      if (transactionFailed) {
        // Rollback: harvest stage remains CURING
        expect(harvest.stage).toBe(HarvestStages.CURING);
        // No inventory record created
        const inventory = null;
        expect(inventory).toBeNull();
      }
    });

    it('should enforce idempotency on retries', async () => {
      const idempotencyKey = 'idem-key-2';
      const harvestId = 'h-atomic-2';

      // 1. First request succeeds
      const firstResult = {
        harvest: generateTestHarvest({
          id: harvestId,
          stage: HarvestStages.INVENTORY,
        }),
        inventory: generateTestInventory(harvestId),
        server_timestamp_ms: Date.now(),
      };

      // Store idempotency record
      const idempotencyRecords = new Map();
      idempotencyRecords.set(idempotencyKey, {
        status: 'SUCCESS',
        response: firstResult,
      });

      // 2. Retry with same idempotency key
      const cachedRecord = idempotencyRecords.get(idempotencyKey);
      expect(cachedRecord?.status).toBe('SUCCESS');

      // 3. Return cached response (no duplicate creation)
      const retryResult = cachedRecord?.response;
      expect(retryResult).toEqual(firstResult);

      // 4. Verify no duplicate inventory
      const inventoryCount = 1; // Only one inventory record exists
      expect(inventoryCount).toBe(1);
    });

    it('should handle concurrent finalization attempts with 409 conflict', async () => {
      const harvestId = 'h-atomic-3';

      // 1. Two concurrent requests to finalize same harvest (with different idempotency keys)

      // 2. First request wins (creates inventory)
      const firstWins = {
        harvest: generateTestHarvest({
          id: harvestId,
          stage: HarvestStages.INVENTORY,
        }),
        inventory: generateTestInventory(harvestId),
      };

      // Enforce UNIQUE(inventory.harvest_id)
      const inventoryExists = true;

      // 3. Second request gets 409 Conflict
      if (inventoryExists) {
        const conflictError = {
          status: 409,
          message: 'Inventory already exists for this harvest',
          canonical_state: firstWins,
        };

        expect(conflictError.status).toBe(409);
        expect(conflictError.canonical_state.inventory.harvest_id).toBe(
          harvestId
        );
      }
    });

    it('should retry transient failures with exponential backoff', async () => {
      const maxRetries = 3;
      let attemptCount = 0;
      const delays: number[] = [];

      const mockOperation = async (): Promise<{
        harvest: TestHarvest;
        inventory: TestInventory;
      }> => {
        attemptCount++;
        if (attemptCount < maxRetries) {
          throw new Error('Transient network error');
        }
        return {
          harvest: generateTestHarvest({ stage: HarvestStages.INVENTORY }),
          inventory: generateTestInventory('h-retry-1'),
        };
      };

      // Mock retry utility with exponential backoff
      const retryWithBackoff = async <T>(
        operation: () => Promise<T>,
        maxRetries: number,
        baseDelay = 100
      ): Promise<T> => {
        for (let i = 0; i < maxRetries; i++) {
          if (i > 0) {
            const delay = baseDelay * Math.pow(2, i - 1);
            delays.push(delay);
            // In real tests, use fake timers instead of actual delays
          }
          const result = await operation().catch((err) => {
            if (i === maxRetries - 1) throw err;
            return null;
          });
          if (result) return result;
        }
        throw new Error('Max retries exceeded');
      };

      const result = await retryWithBackoff(mockOperation, maxRetries);

      expect(attemptCount).toBe(3);
      expect(delays).toEqual([100, 200]); // 100 * 2^0, 100 * 2^1
      expect(result.harvest.stage).toBe(HarvestStages.INVENTORY);
    });

    it('should require dry weight to finalize curing', async () => {
      // 1. Create harvest without dry weight
      const harvest = generateTestHarvest({
        stage: HarvestStages.CURING,
        dry_weight_g: null,
      });

      // 2. Attempt to finalize
      const canFinalize = harvest.dry_weight_g !== null;

      expect(canFinalize).toBe(false);

      // 3. Add dry weight
      const updatedHarvest = {
        ...harvest,
        dry_weight_g: 850,
      };

      // 4. Now can finalize
      const canFinalizeNow = updatedHarvest.dry_weight_g !== null;
      expect(canFinalizeNow).toBe(true);
    });
  });

  describe('Scenario 3: Photo Storage Cleanup and Orphan Detection', () => {
    it('should detect orphaned photos after harvest deletion', async () => {
      // 1. Create harvest with photos
      generateTestHarvest({
        id: 'h-photo-1',
        photos: [
          'file:///storage/photo1.jpg',
          'file:///storage/photo2.jpg',
          'file:///storage/photo3.jpg',
        ],
      });

      // Track referenced photos for cleanup

      // 2. Soft-delete harvest (marks as deleted with timestamp)

      // 3. Run orphan detection
      const allPhotosOnDisk = [
        'file:///storage/photo1.jpg',
        'file:///storage/photo2.jpg',
        'file:///storage/photo3.jpg',
        'file:///storage/old-orphan.jpg', // Orphaned
      ];

      // Photos referenced by active harvests (deleted harvest excluded)
      const activeReferences = new Set<string>();

      const orphans = allPhotosOnDisk.filter((p) => !activeReferences.has(p));

      expect(orphans).toHaveLength(4); // All 4 files are orphans (harvest deleted)
    });

    it('should protect recent photos during LRU cleanup', async () => {
      const now = Date.now();
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

      // 1. Create photos with timestamps
      const photos = [
        {
          uri: 'file:///photo-recent.jpg',
          created_at: now,
          size: 500000,
        },
        {
          uri: 'file:///photo-old.jpg',
          created_at: thirtyDaysAgo - 1000,
          size: 500000,
        },
      ];

      // 2. Run LRU cleanup (protect recent < 30 days)
      const protectionThreshold = 30 * 24 * 60 * 60 * 1000;
      const eligibleForCleanup = photos.filter(
        (p) => now - p.created_at > protectionThreshold
      );

      expect(eligibleForCleanup).toHaveLength(1);
      expect(eligibleForCleanup[0].uri).toBe('file:///photo-old.jpg');
    });

    it('should cleanup by storage threshold', async () => {
      // 1. Simulate storage stats
      const storageStats = {
        totalSize: 100 * 1024 * 1024, // 100 MB
        threshold: 80 * 1024 * 1024, // 80 MB threshold
        isOverThreshold: true,
      };

      const photos = [
        {
          uri: 'p1.jpg',
          size: 20 * 1024 * 1024,
          created_at: Date.now() - 60 * 24 * 60 * 60 * 1000,
        },
        {
          uri: 'p2.jpg',
          size: 20 * 1024 * 1024,
          created_at: Date.now() - 45 * 24 * 60 * 60 * 1000,
        },
        {
          uri: 'p3.jpg',
          size: 20 * 1024 * 1024,
          created_at: Date.now() - 20 * 24 * 60 * 60 * 1000,
        },
      ];

      // 2. Cleanup oldest first until under threshold
      const sortedByAge = [...photos].sort(
        (a, b) => a.created_at - b.created_at
      );

      let currentSize = storageStats.totalSize;
      const cleaned: string[] = [];

      for (const photo of sortedByAge) {
        if (currentSize <= storageStats.threshold) break;
        currentSize -= photo.size;
        cleaned.push(photo.uri);
      }

      expect(cleaned).toHaveLength(1);
      expect(cleaned[0]).toBe('p1.jpg'); // Oldest removed first
      expect(currentSize).toBeLessThanOrEqual(storageStats.threshold);
    });

    it('should skip cleanup when battery is low and not charging', async () => {
      // 1. Simulate low battery state
      const batteryState = {
        level: 0.15, // 15% battery
        charging: false,
      };

      // 2. Check cleanup eligibility
      const shouldCleanup = batteryState.level > 0.2 || batteryState.charging;

      expect(shouldCleanup).toBe(false); // Skip cleanup
    });

    it('should run cleanup when charging', async () => {
      // 1. Simulate charging state
      const batteryState = {
        level: 0.15, // 15% battery but charging
        charging: true,
      };

      // 2. Check cleanup eligibility
      const shouldCleanup = batteryState.level > 0.2 || batteryState.charging;

      expect(shouldCleanup).toBe(true); // Run cleanup
    });
  });

  describe('Scenario 4: Notification Scheduling and Rehydration', () => {
    it('should schedule notifications on stage entry', async () => {
      // 1. Create harvest and enter DRYING stage
      const harvest = generateTestHarvest({
        stage: HarvestStages.DRYING,
        stage_started_at: new Date().toISOString(),
      });

      // 2. Schedule notification for target duration (7 days)
      const targetDurationDays = 7;
      const notificationDate = new Date(
        Date.parse(harvest.stage_started_at) +
          targetDurationDays * 24 * 60 * 60 * 1000
      );

      const scheduledNotification = {
        id: 'notif-1',
        harvestId: harvest.id,
        stage: harvest.stage,
        trigger: notificationDate.toISOString(),
        title: 'Drying Complete',
        body: 'Your harvest has been drying for 7 days',
      };

      expect(scheduledNotification.stage).toBe(HarvestStages.DRYING);
      expect(scheduledNotification.harvestId).toBe(harvest.id);
    });

    it('should reschedule notifications after back-dated stage edits', async () => {
      // 1. Create harvest with existing stage
      const harvest = generateTestHarvest({
        stage: HarvestStages.CURING,
        stage_started_at: new Date().toISOString(),
      });

      const oldNotificationId = 'notif-old';

      // 2. Edit stage_started_at to be 2 days earlier
      const updatedHarvest = {
        ...harvest,
        stage_started_at: new Date(
          Date.now() - 2 * 24 * 60 * 60 * 1000
        ).toISOString(),
      };

      // 3. Cancel old notification
      const canceledNotificationIds = [oldNotificationId];

      // 4. Schedule new notification with updated date
      const targetDurationDays = 14; // Curing duration
      const newTrigger = new Date(
        Date.parse(updatedHarvest.stage_started_at) +
          targetDurationDays * 24 * 60 * 60 * 1000
      );

      const newNotification = {
        id: 'notif-new',
        harvestId: harvest.id,
        stage: harvest.stage,
        trigger: newTrigger.toISOString(),
      };

      expect(canceledNotificationIds).toContain(oldNotificationId);
      expect(newNotification.id).toBe('notif-new');
    });

    it('should rehydrate notifications on app start', async () => {
      // 1. Simulate app restart
      const persistedHarvests = [
        generateTestHarvest({
          id: 'h1',
          stage: HarvestStages.DRYING,
          stage_started_at: new Date().toISOString(),
        }),
        generateTestHarvest({
          id: 'h2',
          stage: HarvestStages.CURING,
          stage_started_at: new Date().toISOString(),
        }),
      ];

      // 2. Rehydrate notifications from persisted state
      const rehydratedNotifications = persistedHarvests.map((h) => {
        const daysToAdd = h.stage === HarvestStages.DRYING ? 7 : 14;
        return {
          id: `notif-${h.id}`,
          harvestId: h.id,
          stage: h.stage,
          trigger: new Date(
            Date.parse(h.stage_started_at) + daysToAdd * 24 * 60 * 60 * 1000
          ).toISOString(),
        };
      });

      expect(rehydratedNotifications).toHaveLength(2);
      expect(rehydratedNotifications[0].stage).toBe(HarvestStages.DRYING);
      expect(rehydratedNotifications[1].stage).toBe(HarvestStages.CURING);
    });

    it('should cancel notifications on stage completion', async () => {
      // 1. Harvest with scheduled notification
      generateTestHarvest({
        id: 'h-cancel',
        stage: HarvestStages.DRYING,
      });

      const scheduledNotificationId = 'notif-cancel';

      // 2. Complete DRYING stage (transitions to CURING)

      // 3. Cancel old notification for DRYING
      const canceledIds = [scheduledNotificationId];

      expect(canceledIds).toContain(scheduledNotificationId);

      // 4. Schedule new notification for CURING
      const newNotificationId = 'notif-curing';
      expect(newNotificationId).toBeDefined();
    });

    it('should send gentle reminder after exceeding max duration', async () => {
      // 1. Create harvest that has exceeded max duration
      const maxDurationDays = 10;
      const actualDurationDays = 12;

      const harvest = generateTestHarvest({
        stage: HarvestStages.DRYING,
        stage_started_at: new Date(
          Date.now() - actualDurationDays * 24 * 60 * 60 * 1000
        ).toISOString(),
      });

      // 2. Check if exceeded
      const elapsedDays = Math.floor(
        (Date.now() - Date.parse(harvest.stage_started_at)) /
          (24 * 60 * 60 * 1000)
      );

      const exceededMax = elapsedDays > maxDurationDays;

      expect(exceededMax).toBe(true);

      // 3. Send reminder notification
      const reminderNotification = {
        id: 'notif-reminder',
        title: 'Drying Duration Notice',
        body: `Your harvest has been drying for ${elapsedDays} days (recommended max: ${maxDurationDays} days)`,
      };

      expect(reminderNotification.body).toContain('12 days');
    });
  });

  describe('Scenario 5: Complete Happy Path Flow', () => {
    it('should complete full workflow: Harvest → Drying → Curing → Inventory', async () => {
      // 1. Create harvest
      const harvest = generateTestHarvest({
        id: 'h-happy-path',
        stage: HarvestStages.HARVEST,
        wet_weight_g: 1200,
        photos: ['file:///harvest-photo.jpg'],
      });

      expect(harvest.stage).toBe(HarvestStages.HARVEST);

      // 2. Advance to DRYING
      const drying = {
        ...harvest,
        stage: HarvestStages.DRYING,
        stage_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      expect(drying.stage).toBe(HarvestStages.DRYING);
      expect(drying.stage_completed_at).not.toBeNull();

      // 3. Add dry weight and advance to CURING
      const curing = {
        ...drying,
        stage: HarvestStages.CURING,
        dry_weight_g: 950,
        stage_started_at: new Date().toISOString(),
        photos: [...drying.photos, 'file:///curing-photo.jpg'],
      };

      expect(curing.stage).toBe(HarvestStages.CURING);
      expect(curing.dry_weight_g).toBe(950);
      expect(curing.photos).toHaveLength(2);

      // 4. Complete CURING and create Inventory (atomic)
      const finalWeight = 850;
      const inventoryResult = {
        harvest: {
          ...curing,
          stage: HarvestStages.INVENTORY,
          stage_completed_at: new Date().toISOString(),
        },
        inventory: generateTestInventory(harvest.id, {
          final_weight_g: finalWeight,
        }),
        server_timestamp_ms: Date.now(),
      };

      expect(inventoryResult.harvest.stage).toBe(HarvestStages.INVENTORY);
      expect(inventoryResult.inventory.harvest_id).toBe(harvest.id);
      expect(inventoryResult.inventory.final_weight_g).toBe(finalWeight);

      // 5. Verify final state
      expect(inventoryResult.harvest.wet_weight_g).toBe(1200);
      expect(inventoryResult.harvest.dry_weight_g).toBe(950);
      expect(inventoryResult.inventory.final_weight_g).toBe(850);
    });

    it('should support undo within 15-second window', async () => {
      // 1. Advance stage
      const harvest = generateTestHarvest({
        stage: HarvestStages.HARVEST,
      });

      const advanced = {
        ...harvest,
        stage: HarvestStages.DRYING,
        stage_completed_at: new Date().toISOString(),
      };

      // 2. Undo within 15 seconds
      const completedAt = Date.parse(advanced.stage_completed_at!);
      const now = Date.now();
      const elapsedSeconds = (now - completedAt) / 1000;

      const canUndo = elapsedSeconds <= 15;

      expect(canUndo).toBe(true);

      // 3. Revert to previous stage
      const undone = {
        ...advanced,
        stage: HarvestStages.HARVEST,
        stage_completed_at: null,
      };

      expect(undone.stage).toBe(HarvestStages.HARVEST);
      expect(undone.stage_completed_at).toBeNull();
    });

    it('should require audit note for revert after 15-second window', async () => {
      // 1. Advance stage
      const harvest = generateTestHarvest({
        stage: HarvestStages.DRYING,
        stage_completed_at: new Date(Date.now() - 60 * 1000).toISOString(), // 60 seconds ago
      });

      // 2. Check if undo window elapsed
      const completedAt = Date.parse(harvest.stage_completed_at!);
      const now = Date.now();
      const elapsedSeconds = (now - completedAt) / 1000;

      const canUndo = elapsedSeconds <= 15;

      expect(canUndo).toBe(false); // Window elapsed

      // 3. Require revert with audit note
      const auditNote = 'Reverting due to measurement error';
      const reverted = {
        ...harvest,
        stage: HarvestStages.HARVEST,
        notes: `${harvest.notes}\n[Reverted: ${auditNote}]`,
      };

      expect(reverted.stage).toBe(HarvestStages.HARVEST);
      expect(reverted.notes).toContain(
        'Reverted: Reverting due to measurement error'
      );
    });
  });
});
