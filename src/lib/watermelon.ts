import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { migrations } from './watermelon-migrations';
import { AISuggestionModel } from './watermelon-models/ai-suggestion';
import {
  AssessmentClassModel,
  AssessmentModel,
} from './watermelon-models/assessment';
import { AssessmentFeedbackModel } from './watermelon-models/assessment-feedback';
import { AssessmentRequestModel } from './watermelon-models/assessment-request';
import { AssessmentTelemetryModel } from './watermelon-models/assessment-telemetry';
import { CachedStrainModel } from './watermelon-models/cached-strain';
import { CalibrationModel } from './watermelon-models/calibration';
import { DeviationAlertModel } from './watermelon-models/deviation-alert';
import { DeviceTokenModel } from './watermelon-models/device-token';
import { DiagnosticResultModel } from './watermelon-models/diagnostic-result';
import { FavoriteModel } from './watermelon-models/favorite';
import { FeedingTemplateModel } from './watermelon-models/feeding-template';
import { HarvestModel } from './watermelon-models/harvest';
import { HarvestAuditModel } from './watermelon-models/harvest-audit';
import { ImageUploadQueueModel } from './watermelon-models/image-upload-queue';
import { InventoryModel } from './watermelon-models/inventory';
import { InventoryBatchModel } from './watermelon-models/inventory-batch';
import { InventoryItemModel } from './watermelon-models/inventory-item';
import { InventoryMovementModel } from './watermelon-models/inventory-movement';
import { NotificationModel } from './watermelon-models/notification';
import { NotificationPreferenceModel } from './watermelon-models/notification-preference';
import { NotificationQueueModel } from './watermelon-models/notification-queue';
import { OccurrenceOverrideModel } from './watermelon-models/occurrence-override';
import { OutboxModel } from './watermelon-models/outbox';
import { OutboxNotificationActionModel } from './watermelon-models/outbox-notification-action';
import { PhEcReadingModel } from './watermelon-models/ph-ec-reading';
import { PlaybookModel } from './watermelon-models/playbook';
import { PlaybookApplicationModel } from './watermelon-models/playbook-application';
import { PostModel } from './watermelon-models/post';
import { PostCommentModel } from './watermelon-models/post-comment';
import { PostLikeModel } from './watermelon-models/post-like';
import { ReservoirModel } from './watermelon-models/reservoir';
import { ReservoirEventModel } from './watermelon-models/reservoir-event';
import { SeriesModel } from './watermelon-models/series';
import { SourceWaterProfileModel } from './watermelon-models/source-water-profile';
import { TaskModel } from './watermelon-models/task';
import { TrichomeAssessmentModel } from './watermelon-models/trichome-assessment';
import { UndoDescriptorModel } from './watermelon-models/undo-descriptor';
import { schema } from './watermelon-schema';

export const adapter = new SQLiteAdapter({
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
    // Inventory and consumables models
    InventoryItemModel,
    InventoryBatchModel,
    InventoryMovementModel,
    // Nutrient engine models
    FeedingTemplateModel,
    PhEcReadingModel,
    ReservoirModel,
    ReservoirEventModel,
    SourceWaterProfileModel,
    CalibrationModel,
    DiagnosticResultModel,
    DeviationAlertModel,
    // AI Photo Diagnosis models
    AssessmentClassModel,
    AssessmentModel,
    AssessmentRequestModel,
    AssessmentFeedbackModel,
    AssessmentTelemetryModel,
    // Community feed models
    PostModel,
    PostCommentModel,
    PostLikeModel,
    OutboxModel,
  ],
});
