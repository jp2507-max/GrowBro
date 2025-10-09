import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { migrations } from './watermelon-migrations';
import { AISuggestionModel } from './watermelon-models/ai-suggestion';
import { CachedStrainModel } from './watermelon-models/cached-strain';
import { DeviceTokenModel } from './watermelon-models/device-token';
import { FavoriteModel } from './watermelon-models/favorite';
import { HarvestModel } from './watermelon-models/harvest';
import { HarvestAuditModel } from './watermelon-models/harvest-audit';
import { ImageUploadQueueModel } from './watermelon-models/image-upload-queue';
import { InventoryModel } from './watermelon-models/inventory';
import { NotificationModel } from './watermelon-models/notification';
import { NotificationPreferenceModel } from './watermelon-models/notification-preference';
import { NotificationQueueModel } from './watermelon-models/notification-queue';
import { OccurrenceOverrideModel } from './watermelon-models/occurrence-override';
import { OutboxNotificationActionModel } from './watermelon-models/outbox-notification-action';
import { PlaybookModel } from './watermelon-models/playbook';
import { PlaybookApplicationModel } from './watermelon-models/playbook-application';
import { SeriesModel } from './watermelon-models/series';
import { TaskModel } from './watermelon-models/task';
import { TrichomeAssessmentModel } from './watermelon-models/trichome-assessment';
import { UndoDescriptorModel } from './watermelon-models/undo-descriptor';
import { schema } from './watermelon-schema';

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  // Enable JSI for production performance. Keep disabled in Jest.
  jsi: process.env.JEST_WORKER_ID === undefined,
  onSetUpError: (error: unknown) => {
    console.error('[WatermelonDB] setup error', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [
    SeriesModel,
    TaskModel,
    OccurrenceOverrideModel,
    NotificationQueueModel,
    NotificationModel,
    NotificationPreferenceModel,
    DeviceTokenModel,
    ImageUploadQueueModel,
    FavoriteModel,
    CachedStrainModel,
    // Playbook models
    PlaybookModel,
    PlaybookApplicationModel,
    UndoDescriptorModel,
    OutboxNotificationActionModel,
    AISuggestionModel,
    TrichomeAssessmentModel,
    // Harvest workflow models
    HarvestModel,
    HarvestAuditModel,
    InventoryModel,
  ],
});
