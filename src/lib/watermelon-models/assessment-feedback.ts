import { Model } from '@nozbe/watermelondb';
import {
  date,
  field,
  readonly,
  relation,
  text,
} from '@nozbe/watermelondb/decorators';

import type { AssessmentModel } from './assessment';

export type FeedbackIssueResolved = 'yes' | 'no' | 'too_early';

/**
 * AssessmentFeedback model
 * Stores user feedback for AI assessment results
 */
export class AssessmentFeedbackModel extends Model {
  static table = 'assessment_feedback';

  static associations = {
    assessments: { type: 'belongs_to', key: 'assessment_id' },
  } as const;

  @text('assessment_id') assessmentId!: string;
  @field('helpful') helpful!: boolean;
  @text('issue_resolved') issueResolved?: FeedbackIssueResolved;
  @text('notes') notes?: string;

  @readonly @date('created_at') createdAt!: Date;

  @relation('assessments', 'assessment_id')
  assessment?: AssessmentModel;
}
