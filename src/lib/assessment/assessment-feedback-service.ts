import { Q } from '@nozbe/watermelondb';

import { database } from '@/lib/watermelon';
import type {
  AssessmentFeedbackModel,
  FeedbackIssueResolved,
} from '@/lib/watermelon-models/assessment-feedback';

import { addFeedbackBreadcrumb } from './assessment-sentry';
import { logFeedbackSubmitted } from './assessment-telemetry-service';

/**
 * Assessment Feedback Service
 * Handles feedback collection and storage
 */

export type SubmitFeedbackOptions = {
  assessmentId: string;
  helpful: boolean;
  issueResolved?: FeedbackIssueResolved;
  notes?: string;
};

/**
 * Submit feedback for an assessment
 */
export async function submitFeedback(
  options: SubmitFeedbackOptions
): Promise<AssessmentFeedbackModel> {
  const { assessmentId, helpful, issueResolved, notes } = options;

  // Create feedback record
  const feedback = await database.write(async () => {
    return await database
      .get<AssessmentFeedbackModel>('assessment_feedback')
      .create((record) => {
        record.assessmentId = assessmentId;
        record.helpful = helpful;
        record.issueResolved = issueResolved;
        record.notes = notes?.trim().slice(0, 500); // Max 500 chars
      });
  });

  // Log telemetry
  await logFeedbackSubmitted({
    assessmentId,
    helpful,
    issueResolved,
  });

  // Add Sentry breadcrumb
  addFeedbackBreadcrumb({
    assessmentId,
    helpful,
    issueResolved,
  });

  return feedback;
}

/**
 * Get feedback for an assessment
 */
export async function getAssessmentFeedback(
  assessmentId: string
): Promise<AssessmentFeedbackModel | null> {
  const feedbackList = await database
    .get<AssessmentFeedbackModel>('assessment_feedback')
    .query(Q.where('assessment_id', assessmentId))
    .fetch();

  return feedbackList[0] ?? null;
}

/**
 * Check if assessment has feedback
 */
export async function hasAssessmentFeedback(
  assessmentId: string
): Promise<boolean> {
  const feedback = await getAssessmentFeedback(assessmentId);
  return feedback !== null;
}

// Re-export analytics function for backward compatibility
export { getFeedbackStats } from './assessment-analytics';
