export type HelpCategory =
  | 'getting-started'
  | 'calendar-tasks'
  | 'plants-harvest'
  | 'community'
  | 'ai-assessment'
  | 'account-settings'
  | 'troubleshooting';

export type SupportCategory =
  | 'technical-issue'
  | 'account-problem'
  | 'feature-request'
  | 'ai-assessment-question'
  | 'other';

// 'failed' represents permanent failures (e.g. max retry exceeded) and is
// distinct from 'resolved' which represents successful delivery/handling.
export type SupportStatus = 'open' | 'in-progress' | 'resolved' | 'failed';

export type SupportPriority = 'low' | 'medium' | 'high' | 'urgent';

export type SecondOpinionStatus =
  | 'pending'
  | 'in-review'
  | 'completed'
  | 'rejected';

export type SystemStatusSeverity = 'critical' | 'degraded' | 'informational';

export interface HelpArticle {
  id: string;
  title: string;
  bodyMarkdown: string;
  category: HelpCategory;
  locale: string;
  tags: string[];
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  lastUpdated: number;
  expiresAt?: number;
}

export interface HelpArticleRating {
  articleId: string;
  helpful: boolean;
  feedback?: string;
  timestamp: number;
}

export interface DeviceContext {
  appVersion: string;
  osVersion: string;
  deviceModel: string;
  locale: string;
  lastRoute?: string;
  sentryLastErrorId?: string;
}

export interface Attachment {
  localUri: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  exifStripped: boolean;
}

export interface SupportTicket {
  id: string;
  category: SupportCategory;
  subject: string;
  description: string;
  deviceContext: DeviceContext;
  attachments: Attachment[];
  status: SupportStatus;
  priority: SupportPriority;
  ticketReference?: string;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
  retryCount: number;
  lastRetryAt?: number;
}

export interface AIAssessmentPayload {
  modelVersion: string;
  confidence: number;
  detectedIssues: DetectedIssue[];
  timestamp: number;
}

export interface DetectedIssue {
  issueType: string;
  confidence: number;
  severity: string;
  description: string;
  recommendations: string[];
}

export interface ExpertReview {
  reviewerId: string;
  reviewerRole: string;
  assessment: string;
  changesFromAI: string[];
  confidence: number;
  reviewedAt: number;
}

export interface SecondOpinionRequest {
  id: string;
  assessmentId: string;
  photoUri: string;
  aiAssessment: AIAssessmentPayload;
  userNotes?: string;
  consentHumanReview: boolean;
  consentTrainingUse: boolean;
  status: SecondOpinionStatus;
  expertReview?: ExpertReview;
  queuePosition?: number;
  estimatedCompletion?: number;
  createdAt: number;
  updatedAt: number;
  reviewedAt?: number;
}

export interface SystemStatus {
  id: string;
  severity: SystemStatusSeverity;
  title: string;
  description: string;
  affectedServices: string[];
  estimatedResolution?: number;
  incidentUrl?: string;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
}

export interface FeedbackSubmission {
  id: string;
  rating: number;
  feedbackText?: string;
  feedbackType: 'general' | 'bug' | 'feature-request';
  createdAt: number;
}

export interface EducationalContent {
  id: string;
  title: string;
  bodyMarkdown: string;
  contentType: 'article' | 'video' | 'guide';
  tags: string[];
  locale: string;
  thumbnailUri?: string;
  videoUri?: string;
  estimatedReadTime?: number;
  lastUpdated: number;
}
