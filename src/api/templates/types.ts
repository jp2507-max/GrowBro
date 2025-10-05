/**
 * API Types for Community Templates
 */

export interface CommunityTemplate {
  id: string;
  authorId: string;
  authorHandle: string;
  name: string;
  description?: string;
  setup: 'auto_indoor' | 'auto_outdoor' | 'photo_indoor' | 'photo_outdoor';
  locale: string;
  license: string;
  steps: any[];
  phaseOrder: string[];
  totalWeeks?: number;
  taskCount: number;
  adoptionCount: number;
  ratingAverage?: number;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateListParams {
  setup?: string;
  locale?: string;
  sortBy?: 'created_at' | 'rating_average' | 'adoption_count';
  limit?: number;
  offset?: number;
}

export interface ShareTemplateParams {
  playbookId: string;
  authorHandle: string;
  description?: string;
  license?: string;
  isPublic?: boolean;
}

export interface AdoptTemplateParams {
  templateId: string;
  plantId: string;
  customizations?: {
    name?: string;
    adjustStartDate?: boolean;
    skipSteps?: string[];
    modifySteps?: {
      stepId: string;
      changes: Partial<{
        title: string;
        description: string;
        relativeDay: number;
        rrule: string;
      }>;
    }[];
  };
}

export interface RateTemplateParams {
  templateId: string;
  rating: number;
  review?: string;
}

export interface CommentTemplateParams {
  templateId: string;
  comment: string;
  userHandle: string;
}
