/**
 * Action Tracking Module
 *
 * Tracks user actions on assessment results for analytics and model improvement.
 * Privacy-safe telemetry without PII.
 *
 * Requirements:
 * - 9.2: Track task creation, playbook shifts, and user actions
 * - Privacy-safe metrics (no PII)
 */

import type { AssessmentResult } from '@/types/assessment';

/**
 * Action types for tracking
 */
export type AssessmentActionType =
  | 'task_created'
  | 'playbook_adjustment'
  | 'community_cta_tapped'
  | 'retake_initiated'
  | 'helpful_vote'
  | 'not_helpful_vote'
  | 'issue_resolved'
  | 'issue_not_resolved';

/**
 * Action tracking event
 */
export type AssessmentActionEvent = {
  assessmentId: string;
  actionType: AssessmentActionType;
  classId: string;
  confidence: number;
  inferenceMode: 'device' | 'cloud';
  metadata?: Record<string, unknown>;
  timestamp: number;
};

/**
 * Task creation tracking metadata
 */
export type TaskCreationMetadata = {
  taskCount: number;
  plantId: string;
  timezone: string;
};

/**
 * Playbook adjustment tracking metadata
 */
export type PlaybookAdjustmentMetadata = {
  adjustmentCount: number;
  accepted: boolean;
  plantId: string;
};

/**
 * Action Tracking Service
 *
 * Logs user actions on assessment results for analytics.
 */
export class ActionTrackingService {
  private events: AssessmentActionEvent[] = [];

  /**
   * Track task creation from assessment
   *
   * @param assessmentId - Assessment ID
   * @param assessment - Assessment result
   * @param metadata - Task creation metadata
   */
  trackTaskCreation(
    assessmentId: string,
    assessment: AssessmentResult,
    metadata: TaskCreationMetadata
  ): void {
    this.logEvent({
      assessmentId,
      actionType: 'task_created',
      classId: assessment.topClass.id,
      confidence: assessment.calibratedConfidence,
      inferenceMode: assessment.mode,
      metadata: {
        taskCount: metadata.taskCount,
        // plantId excluded from telemetry for privacy
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Track playbook adjustment suggestion acceptance/rejection
   *
   * @param assessmentId - Assessment ID
   * @param assessment - Assessment result
   * @param metadata - Playbook adjustment metadata
   */
  trackPlaybookAdjustment(
    assessmentId: string,
    assessment: AssessmentResult,
    metadata: PlaybookAdjustmentMetadata
  ): void {
    this.logEvent({
      assessmentId,
      actionType: 'playbook_adjustment',
      classId: assessment.topClass.id,
      confidence: assessment.calibratedConfidence,
      inferenceMode: assessment.mode,
      metadata: {
        adjustmentCount: metadata.adjustmentCount,
        accepted: metadata.accepted,
        // plantId excluded from telemetry for privacy
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Track community CTA tap
   *
   * @param assessmentId - Assessment ID
   * @param assessment - Assessment result
   */
  trackCommunityCTA(assessmentId: string, assessment: AssessmentResult): void {
    this.logEvent({
      assessmentId,
      actionType: 'community_cta_tapped',
      classId: assessment.topClass.id,
      confidence: assessment.calibratedConfidence,
      inferenceMode: assessment.mode,
      timestamp: Date.now(),
    });
  }

  /**
   * Track retake photo action
   *
   * @param assessmentId - Assessment ID
   * @param assessment - Assessment result
   */
  trackRetake(assessmentId: string, assessment: AssessmentResult): void {
    this.logEvent({
      assessmentId,
      actionType: 'retake_initiated',
      classId: assessment.topClass.id,
      confidence: assessment.calibratedConfidence,
      inferenceMode: assessment.mode,
      timestamp: Date.now(),
    });
  }

  /**
   * Track helpful vote
   *
   * @param assessmentId - Assessment ID
   * @param assessment - Assessment result
   * @param helpful - True if helpful, false if not helpful
   */
  trackHelpfulVote(
    assessmentId: string,
    assessment: AssessmentResult,
    helpful: boolean
  ): void {
    this.logEvent({
      assessmentId,
      actionType: helpful ? 'helpful_vote' : 'not_helpful_vote',
      classId: assessment.topClass.id,
      confidence: assessment.calibratedConfidence,
      inferenceMode: assessment.mode,
      timestamp: Date.now(),
    });
  }

  /**
   * Track issue resolution status
   *
   * @param assessmentId - Assessment ID
   * @param assessment - Assessment result
   * @param resolved - True if issue was resolved
   */
  trackIssueResolution(
    assessmentId: string,
    assessment: AssessmentResult,
    resolved: boolean
  ): void {
    this.logEvent({
      assessmentId,
      actionType: resolved ? 'issue_resolved' : 'issue_not_resolved',
      classId: assessment.topClass.id,
      confidence: assessment.calibratedConfidence,
      inferenceMode: assessment.mode,
      timestamp: Date.now(),
    });
  }

  /**
   * Log an action event
   *
   * @param event - Action event to log
   */
  private logEvent(event: AssessmentActionEvent): void {
    this.events.push(event);

    // In production, this would send to analytics service
    // For now, just log to console in development
    if (__DEV__) {
      console.log('[ActionTracking]', event.actionType, {
        assessmentId: event.assessmentId,
        classId: event.classId,
        confidence: event.confidence.toFixed(2),
        mode: event.inferenceMode,
        metadata: event.metadata,
      });
    }

    // TODO: Integrate with existing analytics service
    // analytics.track('assessment_action', {
    //   action_type: event.actionType,
    //   class_id: event.classId,
    //   confidence: event.confidence,
    //   inference_mode: event.inferenceMode,
    //   ...event.metadata,
    // });
  }

  /**
   * Get all tracked events (for testing/debugging)
   *
   * @returns Array of tracked events
   */
  getEvents(): AssessmentActionEvent[] {
    return [...this.events];
  }

  /**
   * Clear all tracked events (for testing)
   */
  clearEvents(): void {
    this.events = [];
  }

  /**
   * Get event count by action type
   *
   * @param actionType - Action type to count
   * @returns Count of events
   */
  getEventCount(actionType: AssessmentActionType): number {
    return this.events.filter((e) => e.actionType === actionType).length;
  }

  /**
   * Get events for a specific assessment
   *
   * @param assessmentId - Assessment ID
   * @returns Array of events for the assessment
   */
  getEventsForAssessment(assessmentId: string): AssessmentActionEvent[] {
    return this.events.filter((e) => e.assessmentId === assessmentId);
  }
}

/**
 * Singleton instance for convenience
 */
export const actionTrackingService = new ActionTrackingService();

/**
 * Track task creation (convenience function)
 */
export function trackTaskCreation(
  assessmentId: string,
  assessment: AssessmentResult,
  metadata: TaskCreationMetadata
): void {
  actionTrackingService.trackTaskCreation(assessmentId, assessment, metadata);
}

/**
 * Track playbook adjustment (convenience function)
 */
export function trackPlaybookAdjustment(
  assessmentId: string,
  assessment: AssessmentResult,
  metadata: PlaybookAdjustmentMetadata
): void {
  actionTrackingService.trackPlaybookAdjustment(
    assessmentId,
    assessment,
    metadata
  );
}

/**
 * Track community CTA (convenience function)
 */
export function trackCommunityCTA(
  assessmentId: string,
  assessment: AssessmentResult
): void {
  actionTrackingService.trackCommunityCTA(assessmentId, assessment);
}

/**
 * Track retake (convenience function)
 */
export function trackRetake(
  assessmentId: string,
  assessment: AssessmentResult
): void {
  actionTrackingService.trackRetake(assessmentId, assessment);
}

/**
 * Track helpful vote (convenience function)
 */
export function trackHelpfulVote(
  assessmentId: string,
  assessment: AssessmentResult,
  helpful: boolean
): void {
  actionTrackingService.trackHelpfulVote(assessmentId, assessment, helpful);
}

/**
 * Track issue resolution (convenience function)
 */
export function trackIssueResolution(
  assessmentId: string,
  assessment: AssessmentResult,
  resolved: boolean
): void {
  actionTrackingService.trackIssueResolution(
    assessmentId,
    assessment,
    resolved
  );
}
