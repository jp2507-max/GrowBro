import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export class AiSecondOpinionsQueueModel extends Model {
  static table = 'ai_second_opinions_queue';

  @text('assessment_id') assessmentId!: string;
  @text('photo_uri') photoUri!: string;
  @text('ai_assessment') aiAssessmentJson!: string;
  @text('user_notes') userNotes?: string;
  @field('consent_human_review') consentHumanReview!: boolean;
  @field('consent_training_use') consentTrainingUse!: boolean;
  @text('status') status!: string;
  @text('expert_review') expertReviewJson?: string;
  @field('queue_position') queuePosition?: number;
  @field('estimated_completion') estimatedCompletion?: number;
  @field('reviewed_at') reviewedAt?: number;
  @text('client_request_id') clientRequestId!: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;

  get aiAssessment(): any {
    try {
      return JSON.parse(this.aiAssessmentJson);
    } catch (error) {
      console.warn(
        '[AiSecondOpinionsQueueModel] Failed to parse AI assessment',
        error
      );
      return null;
    }
  }

  setAiAssessment(assessment: any): void {
    this.aiAssessmentJson = JSON.stringify(assessment);
  }

  get expertReview(): any {
    if (!this.expertReviewJson) return null;
    try {
      return JSON.parse(this.expertReviewJson);
    } catch (error) {
      console.warn(
        '[AiSecondOpinionsQueueModel] Failed to parse expert review',
        error
      );
      return null;
    }
  }

  setExpertReview(review: any): void {
    this.expertReviewJson = review ? JSON.stringify(review) : '';
  }
}
