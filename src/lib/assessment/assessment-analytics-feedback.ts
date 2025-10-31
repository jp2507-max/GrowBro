import { Q } from '@nozbe/watermelondb';

import { database } from '@/lib/watermelon';
import type { AssessmentFeedbackModel } from '@/lib/watermelon-models/assessment-feedback';

/**
 * Get feedback statistics for analytics
 *
 * @param days - Number of days to look back (default: 30). Use 0 for all historical data.
 */
export async function getFeedbackStats(days: number = 30): Promise<{
  total: number;
  helpful: number;
  notHelpful: number;
  resolved: number;
  notResolved: number;
  tooEarly: number;
}> {
  // Build query conditions
  const conditions = [];

  // Add time-based filter if days > 0 (performance optimization)
  if (days > 0) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    conditions.push(Q.where('created_at', Q.gte(cutoffDate.getTime())));
  }

  const allFeedback = await database
    .get<AssessmentFeedbackModel>('assessment_feedback')
    .query(...conditions)
    .fetch();

  const stats = {
    total: allFeedback.length,
    helpful: 0,
    notHelpful: 0,
    resolved: 0,
    notResolved: 0,
    tooEarly: 0,
  };

  for (const feedback of allFeedback) {
    if (feedback.helpful) {
      stats.helpful++;
    } else {
      stats.notHelpful++;
    }

    if (feedback.issueResolved === 'yes') {
      stats.resolved++;
    } else if (feedback.issueResolved === 'no') {
      stats.notResolved++;
    } else if (feedback.issueResolved === 'too_early') {
      stats.tooEarly++;
    }
  }

  return stats;
}
