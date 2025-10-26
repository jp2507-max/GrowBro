import { Model } from '@nozbe/watermelondb';
import {
  date,
  field,
  json,
  readonly,
  text,
} from '@nozbe/watermelondb/decorators';

import type {
  AssessmentPlantContext,
  AssessmentStatus,
  CapturedPhoto,
} from '@/types/assessment';

const MAX_PHOTOS = 10;

function sanitizePhotos(photos: CapturedPhoto[] | undefined): CapturedPhoto[] {
  if (!Array.isArray(photos)) {
    return [];
  }

  return photos
    .filter((photo) => {
      // Filter out any photo missing a non-empty string id or uri
      return (
        typeof photo?.id === 'string' &&
        photo.id.trim() !== '' &&
        typeof photo?.uri === 'string' &&
        photo.uri.trim() !== ''
      );
    })
    .slice(0, MAX_PHOTOS)
    .map((photo) => ({
      id: photo.id,
      uri: photo.uri,
      timestamp:
        typeof photo.timestamp === 'number' ? photo.timestamp : Date.now(),
      qualityScore: photo.qualityScore ?? {
        score: 0,
        acceptable: false,
        issues: [],
      },
      metadata: {
        width:
          typeof photo.metadata?.width === 'number' ? photo.metadata.width : 0,
        height:
          typeof photo.metadata?.height === 'number'
            ? photo.metadata.height
            : 0,
      },
    }));
}

function sanitizePlantContext(
  context: AssessmentPlantContext | undefined
): AssessmentPlantContext {
  if (!context || typeof context !== 'object') {
    return { id: '' };
  }

  return {
    id: typeof context.id === 'string' ? context.id : String(context.id ?? ''),
    metadata: context.metadata,
  };
}

/**
 * AssessmentRequest model for offline queue management
 * Stores assessment requests that need to be processed when connectivity is available
 */
export class AssessmentRequestModel extends Model {
  static table = 'assessment_requests';

  @text('plant_id') plantId!: string;
  @text('user_id') userId!: string;
  @text('status') status!: AssessmentStatus;

  @json('photos', sanitizePhotos)
  photos!: CapturedPhoto[];

  @json('plant_context', sanitizePlantContext)
  plantContext!: AssessmentPlantContext;

  @field('retry_count') retryCount!: number;
  @text('last_error') lastError?: string;
  @field('next_attempt_at') nextAttemptAt?: number;

  // Original capture timestamp - preserved for context
  @field('original_timestamp') originalTimestamp!: number;

  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  // Computed properties for queue management
  get isPending(): boolean {
    return this.status === 'pending';
  }

  get isProcessing(): boolean {
    return this.status === 'processing';
  }

  get isCompleted(): boolean {
    return this.status === 'completed';
  }

  get hasFailed(): boolean {
    return this.status === 'failed';
  }

  get shouldRetry(): boolean {
    if (this.status !== 'pending' && this.status !== 'failed') {
      return false;
    }
    // Terminal failure: failed status with no retry scheduled
    if (this.status === 'failed' && !this.nextAttemptAt) {
      return false;
    }
    if (!this.nextAttemptAt) {
      return true; // No retry timestamp set, should retry immediately
    }
    return Date.now() >= this.nextAttemptAt;
  }

  get hasExceededMaxRetries(): boolean {
    return this.retryCount >= 5;
  }
}
