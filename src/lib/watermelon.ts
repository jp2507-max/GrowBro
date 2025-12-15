import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { toPromise } from '@nozbe/watermelondb/utils/fp/Result';

import { migrations } from './watermelon-migrations';
import { AiSecondOpinionsQueueModel } from './watermelon-models/ai-second-opinions-queue';
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
import { HelpArticleCacheModel } from './watermelon-models/help-article-cache';
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
import { PlantModel } from './watermelon-models/plant';
import { PlaybookModel } from './watermelon-models/playbook';
import { PlaybookApplicationModel } from './watermelon-models/playbook-application';
import { PostModel } from './watermelon-models/post';
import { PostCommentModel } from './watermelon-models/post-comment';
import { PostLikeModel } from './watermelon-models/post-like';
import { ProfileModel } from './watermelon-models/profile';
import { ReservoirModel } from './watermelon-models/reservoir';
import { ReservoirEventModel } from './watermelon-models/reservoir-event';
import { SeriesModel } from './watermelon-models/series';
import { SourceWaterProfileModel } from './watermelon-models/source-water-profile';
import { SupportTicketQueueModel } from './watermelon-models/support-ticket-queue';
import { TaskModel } from './watermelon-models/task';
import { TrichomeAssessmentModel } from './watermelon-models/trichome-assessment';
import { UndoDescriptorModel } from './watermelon-models/undo-descriptor';
import { schema } from './watermelon-schema';

type GlobalWithResetFlag = typeof globalThis & {
  __gbWatermelonReset?: boolean;
};

const globalWithReset = globalThis as GlobalWithResetFlag;

async function forceResetDatabase(adapterInstance: SQLiteAdapter) {
  if (globalWithReset.__gbWatermelonReset) return;
  globalWithReset.__gbWatermelonReset = true;
  try {
    console.warn(
      '[WatermelonDB] Forcing unsafeResetDatabase due to setup error'
    );
    await toPromise<void>((callback) =>
      adapterInstance.unsafeResetDatabase(callback)
    );
    console.info('[WatermelonDB] unsafeResetDatabase completed');
  } catch (resetError) {
    console.error('[WatermelonDB] unsafeResetDatabase failed', resetError);
  }
}

function shouldForceReset(error: unknown): boolean {
  if (!__DEV__) return false;
  if (typeof error === 'string')
    return error.includes('Diagnostic error') || error.includes('updated_at');
  if (error instanceof Error)
    return (
      error.message.includes('Diagnostic error') ||
      error.message.includes('updated_at')
    );
  return false;
}

export const adapter = new SQLiteAdapter({
  schema,
  migrations,
  // Enable JSI for production performance. Keep disabled in Jest.
  jsi: process.env.JEST_WORKER_ID === undefined,
  onSetUpError: (error: unknown) => {
    console.error('[WatermelonDB] setup error', error);
    if (shouldForceReset(error)) {
      void forceResetDatabase(adapter);
    }
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
    // Customer support models
    HelpArticleCacheModel,
    SupportTicketQueueModel,
    AiSecondOpinionsQueueModel,
    // User profile model
    ProfileModel,
    PlantModel,
  ],
});
