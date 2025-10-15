# Design Document: Customer Support & Feedback Loop

## Overview

The Customer Support & Feedback Loop feature provides a comprehensive in-app support system that enables users to access help content, contact support, request expert reviews of AI assessments, view system status, access educational content, and provide feedback. The system is designed to work offline-first, respect user privacy, and integrate seamlessly with the existing GrowBro architecture.

### Key Design Principles

1. **Offline-First**: All help content and support requests work offline with intelligent queueing and sync
2. **Privacy-Preserving**: Minimal PII collection with explicit consent gates and GDPR compliance
3. **Context-Aware**: Automatically capture relevant context (screen, device info, errors) to improve support quality
4. **Progressive Enhancement**: Core functionality works without network; enhanced features available online
5. **Accessibility-First**: WCAG AA compliance with screen reader support and dynamic font sizing
6. **Performance-Conscious**: Fast search (<150ms offline), lazy loading, and efficient caching

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
│  (React Native Components + NativeWind Styling)             │
├─────────────────────────────────────────────────────────────┤
│                     Business Logic Layer                     │
│  (React Query + Custom Hooks + Zustand Stores +            │
│   Feature Flags + Remote Config via Supabase)              │
├─────────────────────────────────────────────────────────────┤
│                     Background Tasks                         │
│  (expo-task-manager/background-fetch for queue flush       │
│   and status polling - iOS opportunistic, no strict SLA)   │
├─────────────────────────────────────────────────────────────┤
│                     Data Access Layer                        │
│  (WatermelonDB Models + Supabase Client + MMKV Storage)    │
├─────────────────────────────────────────────────────────────┤
│                     External Services                        │
│  (Supabase Edge Functions + Statuspage Proxy +             │
│   Email Provider via Edge Function + CDN)                  │
└─────────────────────────────────────────────────────────────┘
```

## Architecture

### System Components

#### 1. Help Center System

**Components:**

- `HelpCenterScreen`: Main help center interface with search and categories
- `HelpArticleScreen`: Individual article viewer with rich content rendering
- `HelpSearchBar`: Debounced search with offline full-text indexing
- `HelpCategoryList`: Categorized article navigation
- `ArticleRatingWidget`: Helpful/not helpful feedback collection

**Data Flow:**

```
User Search → Client-side Index (MiniSearch/FlexSearch in MMKV) → Ranked Results
           ↓
User Search → Supabase Query (online) → Server-Ranked Results → Cache Update
```

**Storage:**

- WatermelonDB: `help_articles` table for offline cache
- MMKV: Search index (MiniSearch/FlexSearch, <2MB), search history, article view telemetry (anonymized)
- Supabase: `help_articles` table (source of truth)

**Technical Notes:**

- **FTS Implementation:** Use MiniSearch or FlexSearch (pure JS) instead of SQLite FTS5 (not guaranteed in Expo runtime)
- **Markdown Rendering:** Use `@/components/ui/markdown` wrapper around react-native-markdown-display for theme tokens and link handling
- **Link Interception:** External URLs require confirm dialog before opening
- **Telemetry:** Store per-article impression counters locally, aggregate server-side via daily ping
- **Images:** Use expo-image with contentFit=contain, priority=low, lazy load below-the-fold
- **Debounce:** 200-300ms search debounce, cancel pending on unmount
- **Cache Invalidation:** ETag + If-None-Match headers, content version for fast equality checks
- **Accessibility:** Images must have alt text, links announce purpose, headings map to semantic structure

#### 2. Contact Support System

**Components:**

- `ContactSupportScreen`: Support request form with context capture
- `SupportHistoryScreen`: List of user's support tickets
- `SupportTicketDetailScreen`: Individual ticket view with status updates
- `DeviceContextCapture`: Automatic metadata collection utility
- `AttachmentPicker`: Screenshot attachment with EXIF stripping

**Data Flow:**

```
User Submits → Validate → Queue in WatermelonDB → Background Sync
                                                 ↓
                                          Supabase Edge Function
                                                 ↓
                                          Email Confirmation
```

**Storage:**

- WatermelonDB: `support_tickets` table (local queue + history)
- MMKV: Draft support requests, attachment metadata
- Supabase: `support_tickets` table, `support_attachments` storage bucket

#### 3. AI Assessment Second-Opinion System

**Components:**

- `SecondOpinionRequestModal`: Consent-gated request form
- `SecondOpinionStatusCard`: Display review status and results
- `AssessmentComparisonView`: Side-by-side AI vs expert review
- `ReportIssueModal`: Quick feedback for incorrect AI results

**Data Flow:**

```
User Requests → Consent Check → Queue with Photo + Assessment Data
                                              ↓
                                    Background Upload (Wi-Fi preferred)
                                              ↓
                                    Supabase Edge Function → Review Queue
                                              ↓
                                    Expert Review → Notification
```

**Storage:**

- WatermelonDB: `ai_second_opinions` table (local queue + results)
- MMKV: Consent preferences, review notifications
- Supabase: `ai_second_opinions` table, `assessment_photos` storage bucket

#### 4. System Status & Outage Messaging

**Components:**

- `StatusBanner`: Prominent banner for critical/degraded/informational messages
- `StatusDetailScreen`: Detailed incident history and uptime
- `OfflineIndicator`: Persistent offline mode indicator

**Data Flow:**

```
App Launch → Check Supabase Edge Function (status-feed)
                        ↓
          Merge External Status + Internal Health Checks
                        ↓
          Cache in MMKV → Display Banner (if active)
```

**Storage:**

- MMKV: Last known status, banner dismissal state
- Supabase Edge Function: Proxy for external status page + internal health

#### 5. Educational Content Integration

**Components:**

- `EducationalContentCard`: Contextual "Learn More" links in tasks/playbooks
- `EducationalArticleModal`: Full-screen article viewer with video embeds
- `ContentPrefetchService`: Background download of educational content
- `RelatedContentSuggestions`: Personalized content recommendations

**Data Flow:**

```
User Views Task → Check Content Map → Display "Learn More" Link
                                              ↓
User Taps Link → Check Cache → Display Article (offline)
                            ↓
                  Fetch from Supabase (online) → Update Cache
```

**Storage:**

- WatermelonDB: `educational_content` table (cached articles)
- MMKV: Content map (task/playbook/stage → content IDs), prefetch queue
- Supabase: `educational_content` table, `educational_videos` storage bucket

#### 6. Feedback Collection & Rating System

**Components:**

- `RatingPromptModal`: Native in-app rating prompt (SKStoreReviewController/Play In-App Review)
- `FeedbackFormScreen`: Detailed feedback collection for low ratings
- `FeedbackHistoryScreen`: User's feedback submissions

**Data Flow:**

```
Trigger Event → Check Throttle (30 days) → Check Opt-Out Preference
                                                      ↓
                                          Display Rating Prompt (1-5 stars)
                                                      ↓
                              4-5 Stars → Native Store Review API
                              1-3 Stars → In-App Feedback Form → Supabase
```

**Storage:**

- MMKV: Last prompt timestamp, opt-out preference, rating history
- Supabase: `feedback` table (low ratings + detailed feedback)

## Components and Interfaces

### Core Components

#### HelpCenterScreen

```typescript
interface HelpCenterScreenProps {
  initialCategory?: HelpCategory;
  initialSearchQuery?: string;
}

type HelpCategory =
  | 'getting-started'
  | 'calendar-tasks'
  | 'plants-harvest'
  | 'community'
  | 'ai-assessment'
  | 'account-settings'
  | 'troubleshooting';

interface HelpArticle {
  id: string;
  locale: 'en' | 'de';
  title: string;
  bodyMarkdown: string;
  keywords: string[];
  category: HelpCategory;
  version: number;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  updatedAt: number;
  cachedAt?: number;
  expiresAt?: number;
}
```

**Responsibilities:**

- Display categorized help articles
- Provide search functionality with offline FTS
- Track article views and helpfulness ratings
- Handle offline/online state transitions

**Dependencies:**

- `useHelpArticles` (React Query hook)
- `useHelpSearch` (custom hook with debouncing)
- `HelpArticleCache` (WatermelonDB model)

#### ContactSupportScreen

```typescript
interface ContactSupportFormData {
  category: SupportCategory;
  subject: string;
  description: string;
  attachments: Attachment[];
  deviceContext: DeviceContext;
  articleId?: string; // If initiated from help article
  sentryEventId?: string; // If initiated from error
}

type SupportCategory =
  | 'technical-issue'
  | 'account-help'
  | 'feature-request'
  | 'data-privacy'
  | 'other';

interface DeviceContext {
  appVersion: string;
  osVersion: string;
  deviceModel: string;
  featureFlags: Record<string, boolean>;
  lastScreenRoute: string;
  sentryLastErrorId?: string;
}

interface Attachment {
  localUri: string;
  mimeType: string;
  sizeBytes: number;
  hasExif: boolean;
  exifStripped: boolean;
}

interface SupportTicket {
  id: string;
  userId: string;
  category: SupportCategory;
  subject: string;
  description: string;
  attachments: string[]; // Remote URLs
  deviceContext: DeviceContext;
  status: 'queued' | 'sent' | 'open' | 'in-progress' | 'resolved';
  ticketReference?: string; // Backend-assigned reference
  createdAt: number;
  updatedAt: number;
  lastAttemptAt?: number;
  retryCount: number;
}
```

**Responsibilities:**

- Collect support request details with validation
- Capture device context automatically
- Handle screenshot attachments with EXIF stripping
- Queue requests for background sync
- Display submission status and history

**Dependencies:**

- `useSupportTickets` (React Query hook)
- `useDeviceContext` (custom hook)
- `ImagePicker` (expo-image-picker)
- `SupportTicketQueue` (WatermelonDB model)

#### SecondOpinionRequestModal

```typescript
interface SecondOpinionRequest {
  id: string;
  assessmentId: string;
  plantId: string;
  userId: string;
  photoUrl: string;
  aiPayload: AIAssessmentPayload;
  userNotes?: string;
  consentHumanReview: boolean;
  consentTrainingUse: boolean;
  status: 'queued' | 'uploading' | 'pending-review' | 'reviewed' | 'failed';
  expertReview?: ExpertReview;
  createdAt: number;
  updatedAt: number;
  reviewedAt?: number;
}

interface AIAssessmentPayload {
  modelVersion: string;
  detectedIssues: DetectedIssue[];
  confidence: number;
  timestamp: number;
}

interface DetectedIssue {
  issueType: string;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  symptoms: string[];
  recommendations: string[];
}

interface ExpertReview {
  reviewerId: string;
  reviewerRole: 'support-staff' | 'expert-grower';
  correctedIssues: DetectedIssue[];
  notes: string;
  changesFromAI: string[];
  reviewedAt: number;
}
```

**Responsibilities:**

- Display consent gates for human review and training use
- Queue second-opinion requests with photo upload
- Show review status and estimated completion time
- Display expert review alongside original AI assessment
- Allow feedback on review helpfulness

**Dependencies:**

- `useSecondOpinions` (React Query hook)
- `useAIAssessments` (existing hook)
- `SecondOpinionQueue` (WatermelonDB model)
- `PhotoUploadService` (existing service)

#### StatusBanner

```typescript
interface SystemStatus {
  id: string;
  severity: 'critical' | 'degraded' | 'informational';
  title: string;
  description: string;
  affectedServices: string[];
  estimatedResolution?: string;
  incidentUrl?: string;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
}

interface StatusBannerProps {
  status: SystemStatus;
  onDismiss?: () => void;
  onViewDetails?: () => void;
}
```

**Responsibilities:**

- Display prominent banner for active incidents
- Color-code by severity (WCAG AA compliant)
- Provide link to detailed status page
- Auto-dismiss when incident is resolved
- Respect offline state (don't show false outages)

**Dependencies:**

- `useSystemStatus` (React Query hook)
- `StatusCache` (MMKV storage)
- Supabase Edge Function: `status-feed`

### API Interfaces

#### Supabase Edge Functions

**1. support-intake**

```typescript
// POST /functions/v1/support-intake
interface SupportIntakeRequest {
  category: SupportCategory;
  subject: string;
  description: string;
  deviceContext: DeviceContext;
  attachmentUrls: string[];
  articleId?: string;
  sentryEventId?: string;
  clientRequestId: string; // For idempotency
}

interface SupportIntakeResponse {
  ticketReference: string;
  estimatedResponseTime: string;
  emailSent: boolean;
}
```

**2. status-feed**

```typescript
// GET /functions/v1/status-feed
interface StatusFeedResponse {
  incidents: SystemStatus[];
  uptime: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
  lastUpdated: number;
}
```

**3. second-opinion-submit**

```typescript
// POST /functions/v1/second-opinion-submit
interface SecondOpinionSubmitRequest {
  assessmentId: string;
  plantId: string;
  photoUrl: string;
  aiPayload: AIAssessmentPayload;
  userNotes?: string;
  consentHumanReview: boolean;
  consentTrainingUse: boolean;
  clientRequestId: string;
}

interface SecondOpinionSubmitResponse {
  requestId: string;
  estimatedCompletionTime: string;
  queuePosition: number;
}
```

## Data Models

### WatermelonDB Schema Extensions

```typescript
// Add to src/lib/watermelon-schema.ts

tableSchema({
  name: 'help_articles_cache',
  columns: [
    { name: 'article_id', type: 'string', isIndexed: true },
    { name: 'locale', type: 'string', isIndexed: true },
    { name: 'title', type: 'string' },
    { name: 'body_markdown', type: 'string' },
    { name: 'keywords_json', type: 'string' }, // JSON array
    { name: 'category', type: 'string', isIndexed: true },
    { name: 'version', type: 'number' },
    { name: 'view_count', type: 'number' },
    { name: 'helpful_count', type: 'number' },
    { name: 'not_helpful_count', type: 'number' },
    { name: 'cached_at', type: 'number', isIndexed: true },
    { name: 'expires_at', type: 'number', isIndexed: true },
    { name: 'created_at', type: 'number' },
    { name: 'updated_at', type: 'number' },
  ],
}),

tableSchema({
  name: 'support_tickets_queue',
  columns: [
    { name: 'user_id', type: 'string', isIndexed: true },
    { name: 'category', type: 'string' },
    { name: 'subject', type: 'string' },
    { name: 'description', type: 'string' },
    { name: 'attachments_json', type: 'string' }, // JSON array of local URIs
    { name: 'device_context_json', type: 'string' }, // JSON object
    { name: 'article_id', type: 'string', isOptional: true },
    { name: 'sentry_event_id', type: 'string', isOptional: true },
    { name: 'status', type: 'string', isIndexed: true }, // queued | uploading | sent | failed
    { name: 'ticket_reference', type: 'string', isOptional: true },
    { name: 'client_request_id', type: 'string', isIndexed: true },
    { name: 'retry_count', type: 'number' },
    { name: 'last_attempt_at', type: 'number', isOptional: true },
    { name: 'next_attempt_at', type: 'number', isOptional: true, isIndexed: true },
    { name: 'last_error', type: 'string', isOptional: true },
    { name: 'created_at', type: 'number', isIndexed: true },
    { name: 'updated_at', type: 'number' },
  ],
}),

tableSchema({
  name: 'ai_second_opinions_queue',
  columns: [
    { name: 'assessment_id', type: 'string', isIndexed: true },
    { name: 'plant_id', type: 'string', isIndexed: true },
    { name: 'user_id', type: 'string', isIndexed: true },
    { name: 'photo_url', type: 'string' },
    { name: 'ai_payload_json', type: 'string' }, // JSON object
    { name: 'user_notes', type: 'string', isOptional: true },
    { name: 'consent_human_review', type: 'boolean' },
    { name: 'consent_training_use', type: 'boolean' },
    { name: 'status', type: 'string', isIndexed: true }, // queued | uploading | pending-review | reviewed | failed
    { name: 'expert_review_json', type: 'string', isOptional: true }, // JSON object
    { name: 'client_request_id', type: 'string', isIndexed: true },
    { name: 'retry_count', type: 'number' },
    { name: 'last_attempt_at', type: 'number', isOptional: true },
    { name: 'next_attempt_at', type: 'number', isOptional: true, isIndexed: true },
    { name: 'reviewed_at', type: 'number', isOptional: true },
    { name: 'created_at', type: 'number', isIndexed: true },
    { name: 'updated_at', type: 'number' },
  ],
}),

tableSchema({
  name: 'educational_content_cache',
  columns: [
    { name: 'content_id', type: 'string', isIndexed: true },
    { name: 'locale', type: 'string', isIndexed: true },
    { name: 'title', type: 'string' },
    { name: 'body_markdown', type: 'string' },
    { name: 'content_type', type: 'string' }, // article | video | guide
    { name: 'video_url', type: 'string', isOptional: true },
    { name: 'thumbnail_url', type: 'string', isOptional: true },
    { name: 'related_to_json', type: 'string' }, // JSON array of task/playbook/stage IDs
    { name: 'size_bytes', type: 'number' },
    { name: 'cached_at', type: 'number', isIndexed: true },
    { name: 'expires_at', type: 'number', isIndexed: true },
    { name: 'created_at', type: 'number' },
    { name: 'updated_at', type: 'number' },
  ],
}),

tableSchema({
  name: 'feedback_submissions',
  columns: [
    { name: 'user_id', type: 'string', isIndexed: true },
    { name: 'rating', type: 'number' }, // 1-5
    { name: 'comment', type: 'string', isOptional: true },
    { name: 'context_json', type: 'string' }, // JSON object with trigger event, screen, etc.
    { name: 'status', type: 'string' }, // queued | sent
    { name: 'client_request_id', type: 'string', isIndexed: true },
    { name: 'created_at', type: 'number', isIndexed: true },
    { name: 'updated_at', type: 'number' },
  ],
}),
```

### Supabase Tables

```sql
-- Help Articles
CREATE TABLE help_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  locale TEXT NOT NULL CHECK (locale IN ('en', 'de')),
  title TEXT NOT NULL,
  body_markdown TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  category TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  view_count INTEGER NOT NULL DEFAULT 0,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  not_helpful_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id, locale)
);

CREATE INDEX idx_help_articles_category ON help_articles(category);
CREATE INDEX idx_help_articles_locale ON help_articles(locale);
CREATE INDEX idx_help_articles_updated_at ON help_articles(updated_at);

-- Full-text search index
CREATE INDEX idx_help_articles_fts ON help_articles
  USING gin(to_tsvector('english', title || ' ' || body_markdown));

-- Support Tickets
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  attachments TEXT[] NOT NULL DEFAULT '{}',
  device_context JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'resolved')),
  ticket_reference TEXT UNIQUE,
  article_id UUID REFERENCES help_articles(id),
  sentry_event_id TEXT,
  client_request_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_created_at ON support_tickets(created_at);

-- Row-level security
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tickets" ON support_tickets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tickets" ON support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- AI Second Opinions
CREATE TABLE ai_second_opinions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID NOT NULL,
  plant_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  ai_payload JSONB NOT NULL,
  user_notes TEXT,
  consent_human_review BOOLEAN NOT NULL,
  consent_training_use BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'pending-review' CHECK (status IN ('pending-review', 'reviewed', 'rejected')),
  expert_review JSONB,
  client_request_id TEXT NOT NULL UNIQUE,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_second_opinions_user_id ON ai_second_opinions(user_id);
CREATE INDEX idx_ai_second_opinions_status ON ai_second_opinions(status);
CREATE INDEX idx_ai_second_opinions_created_at ON ai_second_opinions(created_at);

-- Row-level security
ALTER TABLE ai_second_opinions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own second opinions" ON ai_second_opinions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own second opinions" ON ai_second_opinions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Feedback Submissions
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  context JSONB NOT NULL,
  client_request_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feedback_user_id ON feedback(user_id);
CREATE INDEX idx_feedback_rating ON feedback(rating);
CREATE INDEX idx_feedback_created_at ON feedback(created_at);

-- Row-level security
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feedback" ON feedback
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own feedback" ON feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Audit Logs (staff access tracking)
CREATE TABLE support_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  action TEXT NOT NULL,
  purpose TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_support_audit_logs_resource ON support_audit_logs(resource_type, resource_id);
CREATE INDEX idx_support_audit_logs_created_at ON support_audit_logs(created_at);

-- No RLS on audit logs - staff only access via service role
```

### MMKV Storage Keys

```typescript
// Storage keys for MMKV
export const STORAGE_KEYS = {
  // Help Center
  HELP_SEARCH_HISTORY: 'help.searchHistory',
  HELP_ARTICLE_TELEMETRY: 'help.articleTelemetry',
  HELP_LAST_SYNC: 'help.lastSync',

  // Support
  SUPPORT_DRAFT: 'support.draft',
  SUPPORT_LAST_PROMPT: 'support.lastPrompt',

  // Status
  STATUS_LAST_KNOWN: 'status.lastKnown',
  STATUS_BANNER_DISMISSED: 'status.bannerDismissed',
  STATUS_LAST_CHECK: 'status.lastCheck',

  // Educational Content
  CONTENT_MAP: 'education.contentMap',
  CONTENT_PREFETCH_QUEUE: 'education.prefetchQueue',
  CONTENT_WIFI_ONLY: 'education.wifiOnly',

  // Feedback
  FEEDBACK_LAST_PROMPT: 'feedback.lastPrompt',
  FEEDBACK_OPT_OUT: 'feedback.optOut',
  FEEDBACK_PROMPT_COUNT: 'feedback.promptCount',

  // Second Opinion
  SECOND_OPINION_CONSENT: 'secondOpinion.consent',
} as const;
```

## Error Handling

### Error Categories

```typescript
type SupportErrorCategory =
  | 'network' // Transient network issues
  | 'validation' // User input validation errors
  | 'permission' // Missing permissions (camera, notifications)
  | 'quota' // Storage/upload quota exceeded
  | 'auth' // Authentication/authorization errors
  | 'server' // Backend errors
  | 'unknown'; // Unexpected errors

interface SupportError {
  category: SupportErrorCategory;
  code: string;
  message: string;
  userMessage: string; // Localized, user-friendly message
  isRetryable: boolean;
  retryAfterMs?: number;
  recoveryActions?: RecoveryAction[];
}

interface RecoveryAction {
  label: string;
  action: () => void | Promise<void>;
}
```

### Error Handling Strategy

**Network Errors:**

- Queue operations locally in WatermelonDB
- Retry with exponential backoff (1s, 2s, 4s, 8s, 16s, 30s max)
- Show subtle "syncing" indicator
- Notify user only after max retries exhausted

**Validation Errors:**

- Show inline validation errors immediately
- Prevent submission until resolved
- Provide clear guidance on how to fix

**Permission Errors:**

- Show permission rationale before requesting
- Provide deep link to system settings if denied
- Offer alternative flows (e.g., skip photo attachment)

**Quota Errors:**

- Show storage usage before upload
- Offer to compress images or remove old data
- Prevent upload if quota would be exceeded

**Auth Errors:**

- Refresh token automatically if expired
- Prompt re-login if refresh fails
- Queue operations to retry after re-auth

**Server Errors:**

- Retry automatically for 5xx errors
- Show user-friendly error for 4xx errors
- Log to Sentry with full context

## Testing Strategy

### Unit Tests

**Help Center:**

- `HelpSearchService.test.ts`: Test offline FTS indexing and ranking
- `HelpArticleCache.test.ts`: Test cache invalidation and LRU eviction
- `HelpArticleRating.test.ts`: Test rating submission and aggregation

**Support:**

- `DeviceContextCapture.test.ts`: Test metadata collection
- `SupportTicketQueue.test.ts`: Test queueing and retry logic
- `AttachmentProcessor.test.ts`: Test EXIF stripping and compression

**Second Opinion:**

- `ConsentGate.test.ts`: Test consent validation
- `SecondOpinionQueue.test.ts`: Test upload queueing
- `AssessmentComparison.test.ts`: Test AI vs expert diff display

**Status:**

- `StatusFeedParser.test.ts`: Test incident parsing and merging
- `StatusBannerLogic.test.ts`: Test severity-based display logic
- `OfflineStatusHandling.test.ts`: Test offline state handling

**Feedback:**

- `RatingThrottle.test.ts`: Test 30-day throttling logic
- `NativeReviewAPI.test.ts`: Test platform-specific review APIs
- `FeedbackRouting.test.ts`: Test routing based on rating

### Integration Tests

**End-to-End Flows:**

- Submit support request → Queue → Sync → Confirmation
- Request second opinion → Upload → Review → Notification
- Search help articles → View → Rate → Feedback
- Trigger rating prompt → Rate → Store review or feedback
- View status banner → Tap details → View history

**Offline Scenarios:**

- Submit support request offline → Go online → Verify sync
- Search help articles offline → Verify cached results
- Queue second opinion offline → Go online → Verify upload

**Error Scenarios:**

- Network timeout during support submission → Verify retry
- Storage quota exceeded → Verify error handling
- Permission denied for camera → Verify fallback flow

### Accessibility Tests

- Screen reader navigation through help center
- Keyboard navigation for support form
- Color contrast for status banners (WCAG AA)
- Dynamic font sizing for articles
- Touch target sizes (≥44pt)

### Performance Tests

- Help search response time (<150ms offline, <700ms online)
- Status banner render time (<50ms cold start)
- Image compression time (<2s for 5MB photo)
- Queue processing throughput (>10 items/sec)

## Security & Privacy

### Data Minimization

**PII Collection:**

- Collect only essential data (user ID, email for confirmation)
- No collection of names, addresses, phone numbers by default
- Optional fields clearly marked and consent-gated

**Device Context:**

- Collect only technical metadata (app version, OS, device model)
- No collection of device identifiers (IMEI, serial number)
- Feature flags included only if relevant to issue

**Photo Handling:**

- Strip EXIF metadata by default (location, camera model, timestamps)
- Warn user if EXIF contains sensitive data
- Require explicit consent for photo sharing in second opinions

### Encryption

**At Rest:**

- WatermelonDB: Encrypted via platform keychain (iOS) or EncryptedSharedPreferences (Android)
- MMKV: Encrypted storage for sensitive preferences
- Queued payloads: Encrypted before storage, decrypted only during sync

**In Transit:**

- All API calls use TLS 1.3
- Signed URLs for photo uploads (time-limited, single-use)
- Certificate pinning for Supabase endpoints

### Access Control

**Row-Level Security (RLS):**

- Users can only view/create their own support tickets
- Users can only view/create their own second opinions
- Users can only view/create their own feedback

**Audit Logging:**

- All staff access to user data logged immutably
- Logs include: staff ID, resource accessed, purpose, timestamp
- Logs retained for 2 years for compliance

**Data Retention:**

- Support tickets: 90 days after resolution (configurable)
- Second opinions: 90 days after review (or immediate if consent withdrawn)
- Feedback: 180 days (aggregated after 90 days)
- Audit logs: 2 years

### Compliance

**GDPR:**

- Right to access: Export all support data via Settings > Privacy
- Right to erasure: Delete all support data on account deletion
- Right to rectification: Edit support tickets before submission
- Right to data portability: Export in JSON format

**COPPA:**

- Age gate check before allowing support requests
- Parental consent indicator required for users under 18
- No marketing or tracking for minors

**App Store Guidelines:**

- Rating prompts throttled per platform guidelines (Apple: 3/365 days)
- No gating of core features behind ratings
- Clear privacy labels in App Store/Play Store listings

## Internationalization (i18n)

### Translation Keys

All user-facing strings must be added to `src/translations/en.json` and `src/translations/de.json`:

```json
{
  "support": {
    "help_center": {
      "title": "Help Center",
      "search_placeholder": "Search for help...",
      "categories": {
        "getting_started": "Getting Started",
        "calendar_tasks": "Calendar & Tasks",
        "plants_harvest": "Plants & Harvest",
        "community": "Community",
        "ai_assessment": "AI Assessment",
        "account_settings": "Account & Settings",
        "troubleshooting": "Troubleshooting"
      },
      "offline_banner": "Offline Mode - Showing cached content",
      "no_results": "No articles found",
      "helpful": "Helpful",
      "not_helpful": "Not helpful",
      "contact_support": "Contact Support"
    },
    "contact": {
      "title": "Contact Support",
      "category_label": "Issue Category",
      "subject_label": "Subject",
      "description_label": "Description",
      "description_placeholder": "Describe your issue in detail...",
      "attach_screenshot": "Attach Screenshot",
      "exif_warning": "This photo contains location data. Strip before uploading?",
      "submit": "Submit Request",
      "submitting": "Submitting...",
      "success": "Support request submitted successfully",
      "queued": "Request queued. Will send when online.",
      "history_title": "Support History",
      "status": {
        "queued": "Queued",
        "sent": "Sent",
        "open": "Open",
        "in_progress": "In Progress",
        "resolved": "Resolved"
      }
    },
    "second_opinion": {
      "title": "Request Second Opinion",
      "consent_title": "Review Consent",
      "consent_human_review": "Allow human review of this photo",
      "consent_training_use": "Allow use for AI training (optional)",
      "consent_description": "Your photo will be reviewed by our support team. We'll notify you when the review is complete.",
      "estimated_time": "Estimated review time: {{time}}",
      "submit": "Request Review",
      "status": {
        "queued": "Queued for upload",
        "uploading": "Uploading photo...",
        "pending_review": "Pending review",
        "reviewed": "Review complete"
      },
      "comparison_title": "AI vs Expert Review",
      "ai_assessment": "AI Assessment",
      "expert_review": "Expert Review",
      "changes": "Changes from AI"
    },
    "status": {
      "banner": {
        "critical": "Critical Outage",
        "degraded": "Service Degraded",
        "informational": "Maintenance Scheduled"
      },
      "view_details": "View Details",
      "all_systems_operational": "All Systems Operational",
      "last_updated": "Last updated: {{time}}"
    },
    "feedback": {
      "rating_prompt_title": "Enjoying GrowBro?",
      "rating_prompt_message": "Rate your experience",
      "rating_submitted": "Thanks for your feedback!",
      "feedback_form_title": "Help Us Improve",
      "feedback_form_message": "What could we do better?",
      "feedback_placeholder": "Share your thoughts...",
      "submit": "Submit Feedback",
      "opt_out": "Don't ask again"
    },
    "education": {
      "learn_more": "Learn More",
      "related_content": "Related Content",
      "wifi_only_prompt": "This content requires {{size}}. Download on Wi-Fi only?",
      "language_fallback": "Content not available in {{language}}. Showing English version."
    }
  }
}
```

### Locale-Specific Behavior

**Date/Time Formatting:**

- Use `Intl.DateTimeFormat` with user's locale
- Relative time formatting (e.g., "2 hours ago") localized via i18next

**Number Formatting:**

- File sizes: Use `Intl.NumberFormat` with appropriate units (KB, MB, GB)
- Percentages: Localized decimal separators

**Content Fallback:**

- If help article not available in user's language, fallback to English
- Show language badge indicating fallback
- Allow user to switch language in Settings

## Performance Optimizations

### Help Center

**Search Optimization:**

- Local FTS index using SQLite FTS5 extension
- Debounced search input (300ms delay)
- Limit results to 50 items
- Lazy load article bodies (fetch on demand)

**Caching Strategy:**

- Cache top 100 most-viewed articles on first launch
- LRU eviction when cache exceeds 100MB
- Delta updates using ETag headers
- Prefetch articles linked from current article

### Support Tickets

**Queue Processing:**

- Batch process up to 10 tickets per sync cycle
- Prioritize by creation time (FIFO)
- Compress attachments before upload (target <1MB per image)
- Use signed URLs for direct-to-storage uploads (bypass backend)

**Attachment Handling:**

- Compress images on background thread
- Target quality: 80% JPEG, max dimension 2048px
- Strip EXIF on background thread
- Show compression progress for large files

### Second Opinions

**Photo Upload:**

- Queue uploads for Wi-Fi only by default (user configurable)
- Use resumable uploads for large files
- Show upload progress with cancel option
- Retry failed uploads with exponential backoff

**Review Notifications:**

- Poll for review status every 5 minutes when app is active
- Use push notifications for review completion (if enabled)
- Cache review results locally for offline viewing

### Status Feed

**Polling Strategy:**

- Check status on app launch (cold start)
- Poll every 5 minutes when app is active
- Use background fetch for periodic checks when app is inactive
- Cache last known status for offline display

**Banner Rendering:**

- Render banner synchronously on cold start (<50ms)
- Use memoized components to prevent re-renders
- Animate banner entrance with Reanimated (60fps)

### Educational Content

**Prefetching:**

- Prefetch content summaries and thumbnails on Wi-Fi
- Defer full article/video downloads until user taps
- Respect user's "Wi-Fi only" preference
- Show estimated download size before fetching

**Content Delivery:**

- Use CDN for static content (articles, images, videos)
- Lazy load images with placeholders
- Use adaptive bitrate for videos (if supported)
- Cache content for 7 days (configurable)

## Observability & Monitoring

### Sentry Integration

**Breadcrumbs (No PII):**

```typescript
// Help Center
Sentry.addBreadcrumb({
  category: 'help',
  message: 'Article viewed',
  data: { articleId: 'redacted', category: 'calendar-tasks' },
  level: 'info',
});

// Support
Sentry.addBreadcrumb({
  category: 'support',
  message: 'Ticket submitted',
  data: { category: 'technical-issue', hasAttachments: true },
  level: 'info',
});

// Second Opinion
Sentry.addBreadcrumb({
  category: 'second-opinion',
  message: 'Review requested',
  data: { consentTraining: false },
  level: 'info',
});

// Status
Sentry.addBreadcrumb({
  category: 'status',
  message: 'Banner shown',
  data: { severity: 'critical' },
  level: 'warning',
});
```

**Error Tracking:**

- Capture all API errors with full context (excluding PII)
- Track queue processing failures with retry count
- Monitor upload failures with file size and network conditions
- Alert on high error rates (>5% of requests)

### Performance Monitoring

**Key Metrics:**

- Help search latency (p50, p95, p99)
- Support ticket submission time
- Photo upload time and success rate
- Status feed fetch time
- Queue processing throughput

**Custom Transactions:**

```typescript
const transaction = Sentry.startTransaction({
  name: 'support.ticket.submit',
  op: 'support',
});

// ... perform submission ...

transaction.setMeasurement('attachments.count', attachments.length);
transaction.setMeasurement('attachments.size_mb', totalSizeMB);
transaction.finish();
```

### Analytics (Consent-Gated)

**Events to Track:**

- Help article views (article ID, category, search query)
- Support ticket submissions (category, has attachments)
- Second opinion requests (consent flags)
- Rating prompts shown/dismissed/completed
- Educational content views (content ID, source)

**Aggregated Metrics:**

- Help article helpfulness scores
- Support ticket resolution times
- Second opinion review times
- Rating distribution (1-5 stars)
- Educational content engagement rates

## Migration & Rollout Strategy

### Phase 1: Foundation (Week 1-2)

**Goals:**

- Set up database schema (WatermelonDB + Supabase)
- Implement core data models and migrations
- Create basic UI components (no functionality)

**Deliverables:**

- WatermelonDB schema extensions
- Supabase tables with RLS policies
- MMKV storage keys defined
- Basic screen scaffolding

**Validation:**

- Schema migrations run successfully
- RLS policies tested with test users
- UI components render without errors

### Phase 2: Help Center (Week 3-4)

**Goals:**

- Implement help article caching and search
- Build help center UI with offline support
- Add article rating functionality

**Deliverables:**

- Help article cache sync
- Offline FTS search
- Help center screens (list, detail, search)
- Article rating widget

**Validation:**

- Search returns results <150ms offline
- Articles display correctly in EN/DE
- Rating submissions sync successfully

### Phase 3: Contact Support (Week 5-6)

**Goals:**

- Implement support ticket queueing and sync
- Build contact support form with validation
- Add device context capture

**Deliverables:**

- Support ticket queue with retry logic
- Contact support screen
- Support history screen
- Device context capture utility

**Validation:**

- Tickets queue offline and sync online
- Attachments compress and upload successfully
- Device context captured accurately

### Phase 4: Second Opinion & Status (Week 7-8)

**Goals:**

- Implement second opinion request flow
- Build system status feed and banner
- Add educational content integration

**Deliverables:**

- Second opinion queue with consent gates
- Status feed polling and caching
- Status banner component
- Educational content cards

**Validation:**

- Second opinions queue and upload correctly
- Status banner displays with correct severity
- Educational content links work contextually

### Phase 5: Feedback & Polish (Week 9-10)

**Goals:**

- Implement rating prompt system
- Add feedback collection
- Polish UI/UX and accessibility
- Performance optimization

**Deliverables:**

- Rating prompt with throttling
- Feedback form and history
- Accessibility improvements
- Performance optimizations

**Validation:**

- Rating prompts respect platform quotas
- Feedback routes correctly based on rating
- All flows meet accessibility standards
- Performance targets met

### Rollout Strategy

**Beta Testing (Week 11):**

- Release to internal testers (10-20 users)
- Monitor error rates and performance
- Collect feedback on UX

**Staged Rollout (Week 12-14):**

- 10% of users (Week 12)
- 50% of users (Week 13)
- 100% of users (Week 14)

**Monitoring:**

- Track adoption rates for each feature
- Monitor error rates and performance
- Collect user feedback via in-app surveys

**Rollback Plan:**

- Feature flags for each component
- Ability to disable features remotely
- Fallback to existing support channels

## Open Questions & Decisions

### 1. Support Backend Integration

**Question:** Should we use an internal support system (Supabase-based) or integrate with an external helpdesk (Zendesk, Freshdesk)?

**Options:**

- **Internal (Supabase):** Full control, lower cost, simpler integration, but requires building support dashboard
- **External (Zendesk):** Mature features, support team tools, but higher cost, complex integration, DPA required

**Recommendation:** Start with internal Supabase-based system for MVP. Evaluate external helpdesk after 3-6 months based on support volume and team needs.

**Decision:** [Pending stakeholder input]

---

### 2. Second Opinion Reviewers

**Question:** Who will perform second-opinion reviews? Internal staff or vetted community experts?

**Options:**

- **Internal Staff:** Consistent quality, liability control, but limited capacity
- **Community Experts:** Scalable, diverse expertise, but quality variance, liability concerns

**Recommendation:** Start with internal staff for MVP. Consider community expert program after establishing quality standards and legal framework.

**Decision:** [Pending stakeholder input]

---

### 3. Status Page Provider

**Question:** Should we use an external status page provider (Statuspage.io, Atlassian) or build our own?

**Options:**

- **External Provider:** Mature features, independent hosting, but monthly cost ($29-99/mo)
- **Homegrown:** Full control, no recurring cost, but requires maintenance

**Recommendation:** Use external provider (Statuspage.io) for reliability and independence from our infrastructure.

**Decision:** [Pending stakeholder input]

---

### 4. Educational Content Licensing

**Question:** What licensing model should we use for educational content? Can we embed third-party videos?

**Options:**

- **Original Content Only:** Full control, no licensing issues, but high production cost
- **Licensed Content:** Faster to build library, but ongoing licensing fees
- **Embedded Third-Party:** Free, but link rot risk, no offline support

**Recommendation:** Mix of original content (text articles) and curated third-party videos (with proper attribution and fallback links).

**Decision:** [Pending legal review]

---

### 5. Regional Compliance

**Question:** Do we need different retention policies or age gates by region (EU, US, Canada)?

**Considerations:**

- GDPR (EU): 90-day retention default, right to erasure
- CCPA (California): Similar to GDPR
- COPPA (US): Parental consent for <13
- Cannabis laws: Age 18+ (Germany), 21+ (some US states)

**Recommendation:** Use most restrictive policy globally (18+, 90-day retention, full GDPR compliance) to simplify implementation.

**Decision:** [Pending legal review]

---

### 6. AI Training Consent Default

**Question:** Should "allow AI training use" be opt-in (default off) or opt-out (default on)?

**Considerations:**

- Opt-in: Better privacy, lower training data volume
- Opt-out: More training data, but potential privacy concerns

**Recommendation:** Opt-in (default off) to align with privacy-first principles and GDPR best practices.

**Decision:** [Pending stakeholder input]

## Risk Assessment

### High-Priority Risks

#### 1. Queue Bloat on Poor Networks

**Risk:** Users on poor networks may accumulate large queues of support tickets and second opinions, leading to storage issues and sync failures.

**Mitigation:**

- Implement queue size limits (max 50 items per queue)
- Show queue status in Settings with option to clear
- Compress attachments aggressively before queueing
- Prioritize smaller items in sync queue

**Monitoring:** Track queue sizes and sync failure rates per user.

---

#### 2. PII Leakage via Screenshots

**Risk:** Users may accidentally include sensitive information (passwords, personal data) in support screenshots.

**Mitigation:**

- Warn users before attaching screenshots
- Provide EXIF stripping with clear explanation
- Show preview of screenshot before submission
- Add "Review your screenshot" step in flow

**Monitoring:** Manual review of flagged screenshots by support team.

---

#### 3. Over-Prompting for Ratings

**Risk:** Excessive rating prompts may annoy users and lead to negative reviews.

**Mitigation:**

- Strict 30-day throttling between prompts
- Respect platform quotas (Apple: 3/365 days)
- Never block core features behind ratings
- Provide clear opt-out option

**Monitoring:** Track prompt frequency and opt-out rates.

---

#### 4. Misclassification of Outages During Offline

**Risk:** Users may see false outage banners when they're offline but services are operational.

**Mitigation:**

- Check last-known status before showing banner
- Show explicit "Offline Mode" indicator
- Don't show outage banner if last-known was "All clear"
- Provide timestamp of last status check

**Monitoring:** Track false positive reports from users.

---

### Medium-Priority Risks

#### 5. Help Article Staleness

**Risk:** Cached help articles may become outdated, providing incorrect guidance.

**Mitigation:**

- Set cache expiration to 7 days
- Show "Last updated" timestamp on articles
- Force refresh on app update
- Provide "Report outdated content" option

**Monitoring:** Track article version mismatches and user reports.

---

#### 6. Second Opinion Review Backlog

**Risk:** High volume of second opinion requests may overwhelm review capacity.

**Mitigation:**

- Set clear SLA expectations (24-48 hours)
- Implement queue position indicator
- Provide auto-responses for common issues
- Consider community expert program for scaling

**Monitoring:** Track review queue depth and completion times.

---

#### 7. Storage Quota Exhaustion

**Risk:** Cached help articles and educational content may consume excessive storage.

**Mitigation:**

- Implement LRU eviction (max 100MB cache)
- Provide storage management in Settings
- Show storage usage before downloads
- Offer "Clear cache" option

**Monitoring:** Track cache sizes and eviction rates.

## Dependencies & Integration Points

### External Dependencies

**React Native Libraries:**

- `react-native-mmkv`: Persistent storage for preferences and cache
- `@nozbe/watermelondb`: Offline-first database for queues and cache
- `@supabase/supabase-js`: Backend API client
- `react-query-kit`: Data fetching and caching
- `expo-image-picker`: Photo selection for attachments
- `expo-image-manipulator`: Image compression and EXIF stripping
- `expo-notifications`: Push notifications for review completion
- `react-native-markdown-display`: Markdown rendering for articles
- `react-native-webview`: Video embeds in educational content

**Platform APIs:**

- iOS: `SKStoreReviewController` for native rating prompts
- Android: Play In-App Review API for native rating prompts
- iOS: `UserNotifications` framework for local notifications
- Android: `NotificationManager` for local notifications

**Backend Services:**

- Supabase: Database, storage, edge functions, auth
- External Status Page: Incident feed (e.g., Statuspage.io)
- Email Service: Confirmation emails (via Supabase edge function)
- CDN: Educational content delivery (optional)

### Integration Points

**Existing Features:**

- **AI Assessment:** Link to second opinion flow from assessment results
- **Calendar/Tasks:** Link to educational content from task details
- **Playbooks:** Link to educational content from playbook steps
- **Settings:** Add support, feedback, and privacy sections
- **Notifications:** Integrate review completion notifications
- **Sync Engine:** Extend to handle support queues

**Navigation:**

```typescript
// Add to src/app/_layout.tsx
<Stack.Screen name="support/help-center" />
<Stack.Screen name="support/contact" />
<Stack.Screen name="support/history" />
<Stack.Screen name="support/ticket-detail" />
<Stack.Screen name="support/second-opinion" />
<Stack.Screen name="support/status" />
<Stack.Screen name="support/feedback" />
```

**Settings Integration:**

```typescript
// Add to Settings screen
<SettingsSection title="Support & Help">
  <SettingsRow label="Help Center" onPress={navigateToHelpCenter} />
  <SettingsRow label="Contact Support" onPress={navigateToContactSupport} />
  <SettingsRow label="Support History" onPress={navigateToSupportHistory} />
  <SettingsRow label="System Status" onPress={navigateToSystemStatus} />
  <SettingsRow label="Send Feedback" onPress={navigateToFeedback} />
</SettingsSection>

<SettingsSection title="Privacy">
  <SettingsRow label="Support Data" onPress={navigateToSupportData} />
  <SettingsToggle label="Rating Prompts" value={!optedOut} onToggle={toggleRatingPrompts} />
</SettingsSection>
```

## Future Enhancements

### Phase 2 Features (Post-MVP)

**1. Live Chat Support**

- Real-time chat with support staff
- Typing indicators and read receipts
- File sharing in chat
- Chat history persistence

**2. Community Expert Program**

- Vetted community members can review second opinions
- Reputation system and badges
- Compensation/rewards for reviews
- Quality control and moderation

**3. Video Tutorials**

- In-app video player for educational content
- Offline video downloads
- Playback speed control
- Closed captions in EN/DE

**4. Interactive Troubleshooting**

- Decision tree for common issues
- Step-by-step guided troubleshooting
- Automatic diagnostic data collection
- Success/failure tracking

**5. Support Chatbot**

- AI-powered chatbot for common questions
- Natural language understanding
- Escalation to human support
- Learning from interactions

**6. Advanced Analytics**

- Support ticket trends and patterns
- Help article effectiveness metrics
- User satisfaction scores (CSAT, NPS)
- Support team performance dashboards

**7. Multi-Language Support**

- Expand beyond EN/DE to ES, FR, IT
- Automatic translation for support tickets
- Language-specific help content
- Regional support teams

**8. Proactive Support**

- Detect common issues automatically
- Suggest help articles before user asks
- Predictive support ticket creation
- Anomaly detection in user behavior

### Technical Debt & Improvements

**1. Help Search Optimization**

- Implement semantic search (vector embeddings)
- Add search suggestions and autocomplete
- Track search analytics for content gaps
- A/B test ranking algorithms

**2. Queue Processing Optimization**

- Implement priority queue (urgent tickets first)
- Batch processing for efficiency
- Parallel uploads for attachments
- Smart retry with circuit breaker

**3. Caching Strategy**

- Implement tiered caching (memory → disk → network)
- Add cache warming on app launch
- Implement stale-while-revalidate pattern
- Add cache analytics and monitoring

**4. Accessibility Enhancements**

- Voice-over optimizations
- Haptic feedback for actions
- High contrast mode support
- Reduced motion support

**5. Performance Monitoring**

- Add custom performance marks
- Track Core Web Vitals equivalents
- Monitor memory usage
- Profile render performance

## Appendix

### A. Example Help Article Structure

```markdown
# How to Create a Recurring Task

## Overview

Recurring tasks help you automate your grow schedule by creating tasks that repeat on a regular basis.

## Prerequisites

- You must have at least one plant in your inventory
- You must have calendar access enabled

## Steps

### 1. Navigate to Calendar

Tap the Calendar tab at the bottom of the screen.

### 2. Create New Task

Tap the "+" button in the top right corner.

### 3. Fill in Task Details

- **Title**: Enter a descriptive name (e.g., "Water plants")
- **Description**: Add optional notes
- **Due Date**: Select when the task should first occur
- **Plant**: Choose which plant this task is for (optional)

### 4. Enable Recurrence

Toggle the "Repeat" switch to enable recurrence.

### 5. Configure Recurrence Pattern

Choose from:

- **Daily**: Repeats every day
- **Weekly**: Repeats on specific days of the week
- **Custom**: Advanced recurrence patterns (RRULE)

### 6. Set End Condition

Choose when the recurrence should stop:

- **Never**: Task repeats indefinitely
- **After X occurrences**: Task repeats a specific number of times
- **Until date**: Task repeats until a specific date

### 7. Save Task

Tap "Create Task" to save.

## Tips

- Use recurring tasks for routine maintenance (watering, feeding, checking)
- Set reminders to get notifications before tasks are due
- You can edit or delete individual occurrences without affecting the series

## Troubleshooting

### Task not appearing in calendar

- Check that the recurrence pattern is valid
- Verify the end date hasn't passed
- Ensure the plant is still active

### Can't edit recurring task

- You may need to edit the series instead of a single occurrence
- Long-press the task and select "Edit Series"

## Related Articles

- [Understanding Recurrence Patterns](link)
- [Setting Up Task Reminders](link)
- [Managing Your Calendar](link)

## Still need help?

[Contact Support](link)
```

### B. Example Device Context Capture

```typescript
export async function captureDeviceContext(): Promise<DeviceContext> {
  const appVersion = Constants.expoConfig?.version ?? 'unknown';
  const osVersion = Platform.Version;
  const deviceModel = Device.modelName ?? 'unknown';

  // Get feature flags from remote config
  const featureFlags = await getFeatureFlags();

  // Get last screen route from navigation
  const lastScreenRoute =
    navigationRef.current?.getCurrentRoute()?.name ?? 'unknown';

  // Get last Sentry error ID if available
  const sentryLastErrorId = Sentry.lastEventId();

  return {
    appVersion,
    osVersion: `${Platform.OS} ${osVersion}`,
    deviceModel,
    featureFlags,
    lastScreenRoute,
    sentryLastErrorId,
  };
}
```

### C. Example Status Feed Response

```json
{
  "incidents": [
    {
      "id": "inc_2024_01_15_001",
      "severity": "degraded",
      "title": "Slow API Response Times",
      "description": "We're experiencing elevated API response times. Our team is investigating.",
      "affectedServices": ["api", "sync"],
      "estimatedResolution": "2024-01-15T18:00:00Z",
      "incidentUrl": "https://status.growbro.app/incidents/inc_2024_01_15_001",
      "createdAt": 1705334400000,
      "updatedAt": 1705336200000,
      "resolvedAt": null
    }
  ],
  "uptime": {
    "last24h": 99.8,
    "last7d": 99.95,
    "last30d": 99.9
  },
  "lastUpdated": 1705336200000
}
```

### D. Example Second Opinion Comparison UI

```
┌─────────────────────────────────────────────────────────┐
│  AI Assessment vs Expert Review                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [Photo of plant]                                       │
│                                                          │
├──────────────────────┬──────────────────────────────────┤
│  AI Assessment       │  Expert Review                   │
│  (Model v2.1.0)      │  (Reviewed by Expert Grower)     │
├──────────────────────┼──────────────────────────────────┤
│  ⚠️ Nitrogen         │  ✅ Nitrogen Deficiency          │
│  Deficiency          │  (Confirmed)                     │
│  Confidence: 78%     │                                  │
│                      │  Additional Notes:               │
│  Symptoms:           │  - Lower leaves yellowing        │
│  - Yellowing leaves  │  - Stunted growth                │
│  - Slow growth       │  - Recommend nitrogen boost      │
│                      │                                  │
│  Recommendations:    │  Changes from AI:                │
│  - Increase nitrogen │  - Confirmed diagnosis           │
│  - Check pH levels   │  - Added growth observation      │
│                      │  - Emphasized urgency            │
├──────────────────────┴──────────────────────────────────┤
│  Was this review helpful?  [👍 Yes]  [👎 No]           │
└─────────────────────────────────────────────────────────┘
```

---

# Design Refinements & Technical Updates

This section contains detailed technical refinements and updates based on stakeholder feedback.

## Architecture Updates

### Feature Flags & Remote Config

**Implementation:**

- Use Supabase for remote config storage
- Feature flags per capability:
  - `support.tickets`
  - `support.secondOpinion`
  - `support.statusBanner`
  - `support.helpCenter`
  - `support.education`
  - `support.ratingPrompt`
- Global kill switch for uploads via remote config

### Background Tasks

**iOS Caveats:**

- Background fetch is opportunistic, not guaranteed
- No strict SLA for queue processing
- Users should be informed that sync happens "when possible"

**Implementation:**

- Use expo-task-manager for Android
- Use background-fetch for iOS
- Fallback to foreground sync if background unavailable

## Component-Specific Refinements

### 2. Contact Support System

**Image Pipeline:**

- Use expo-image-manipulator for compression + EXIF stripping
- Warn if EXIF stripping fails, allow retry
- Max 3 images, total <10MB post-compress
- Block videos in MVP

**Device Context Enhancements:**

- Include Sentry lastEventId
- Include last 10 breadcrumb categories only (no PII)
- Add locale, timezone, network type (wifi/cellular) as labels (no SSID)

**Queue Storage Security:**

- Encrypt queued payload blobs with per-user key derived from device keystore
- Wipe on submit success
- Add `errorCode?: string` for last failure
- Add `priority?: 1|2|3` (default 2) for sync ordering

**Idempotency:**

- Require clientRequestId
- Server must respond 200 with existing ticketReference if duplicate

**Rate Limiting:**

- Show cooldown message on repeated submits
- Client-side throttling to prevent abuse

**Support History:**

- Paginate locally
- Reconcile server states on pull with "server wins" strategy

### 3. AI Assessment Second-Opinion System

**Upload Security:**

- Use signed URLs from Supabase storage
- Set content-type and content-md5 headers
- Enforce single-use URL TTL: 10 minutes
- Server validates photo size <5MB, rejects otherwise

**Consent UI:**

- Separate toggles for human review and training use
- Both recorded separately
- Default training OFF
- Present policy link inline

**Comparison View:**

- Use virtualized list if issues >10
- Highlight diffs with color-blind-safe palette
- Show model version and reviewer role

**Backoff Strategy:**

- Photo uploads use longer base backoff than metadata submits
- Respect quiet hours for push notifications

**Additional Fields:**

- Add `uploadPolicy?: { wifiOnly: boolean }` to enforce Wi-Fi default

### 4. System Status & Outage Messaging

**Source Integration:**

- Single Edge Function "status-feed" merges Statuspage + internal health
- Returns normalized incidents and severity
- Add region param (?region=eu|na) for tailored incidents

**Caching:**

- Cache-Control: max-age=60, stale-while-revalidate=120
- Client shows lastUpdated timestamp
- Add ETag and Last-Modified support

**Banner Accessibility:**

- role="status" for screen reader announcement
- Ensures focus announcement on first render
- Reduced motion: fade only, no slide animations
- Colors from theme tokens instead of raw codes

**Dismissal Policy:**

- Persistent per-incident ID
- Auto-undismiss if incident updates severity upward

### 5. Educational Content Integration

**Video Handling:**

- Favor deep links to YouTube/Vimeo with open-in-browser fallback in MVP
- In-app WebView only if necessary (privacy concerns with third-party cookies)
- Add closed captions requirement for accessibility

**Prefetch Service:**

- Respect "Wi-Fi only" setting
- Cap size per week (e.g., 50MB)
- Provide "pause prefetch" toggle in Settings

**Personalization:**

- Simple client-side rule-based recommendations
- No user profiling without explicit analytics consent

**Content Map:**

- Version content map, invalidate on app update
- Fallback language badge and switcher

### 6. Feedback Collection & Rating System

**Native Rating APIs:**

- iOS: Use `SKStoreReviewController.requestReview()`
- Android: Use Play In-App Review API
- Be prepared that dialog may not appear due to platform quota

**Throttling:**

- App-level 30-day cooldown
- Store promptCount in MMKV
- Track yearly window per user to respect Apple's 3/365 soft limit

**Low-Rating Route:**

- Open in-app FeedbackForm
- No store jump for 1-3 star ratings

**Opt-Out:**

- Permanent until toggled in Settings
- Sync to MMKV only (no server)

**Trigger Hygiene:**

- Trigger post-success screens only
- Never mid-critical paths
- Never block core features

## Data Model Refinements

### TypeScript Interface Updates

**Use const objects instead of string unions:**

```typescript
export const SupportCategory = {
  TECHNICAL_ISSUE: 'technical-issue',
  ACCOUNT_HELP: 'account-help',
  FEATURE_REQUEST: 'feature-request',
  DATA_PRIVACY: 'data-privacy',
  OTHER: 'other',
} as const;

export type SupportCategory =
  (typeof SupportCategory)[keyof typeof SupportCategory];

export const TicketStatus = {
  QUEUED: 'queued',
  SENT: 'sent',
  OPEN: 'open',
  IN_PROGRESS: 'in-progress',
  RESOLVED: 'resolved',
} as const;

export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];
```

**Add priority field to queued tables:**

```typescript
interface SupportTicket {
  // ... existing fields ...
  priority: 1 | 2 | 3; // 1=high, 2=normal, 3=low
  errorCode?: string; // Last failure error code
  blobPath?: string; // Local file staging path
  encrypted: boolean; // Encryption state flag
}
```

### Supabase DDL Refinements

**Use CHECK constraints for enums:**

```sql
-- Support Tickets with enum constraints
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('technical-issue', 'account-help', 'feature-request', 'data-privacy', 'other')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  attachments TEXT[] NOT NULL DEFAULT '{}',
  device_context JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'resolved')),
  priority SMALLINT NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  ticket_reference TEXT UNIQUE,
  article_id UUID REFERENCES help_articles(id),
  sentry_event_id TEXT,
  client_request_id TEXT NOT NULL UNIQUE,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Partial index for faster queue queries
CREATE INDEX idx_support_tickets_open ON support_tickets(status, priority) WHERE status = 'open';

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Enhanced RLS Policies:**

```sql
-- Support Tickets RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tickets" ON support_tickets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tickets" ON support_tickets
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'open'
    AND priority BETWEEN 1 AND 3
  );

-- No UPDATE policy - tickets are immutable after creation
-- Staff updates via service role only
```

**Audit Logs with Constraints:**

```sql
CREATE TABLE support_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('support_ticket', 'second_opinion', 'feedback')),
  resource_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('view', 'update', 'delete', 'export')),
  purpose TEXT NOT NULL CHECK (char_length(purpose) BETWEEN 5 AND 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_support_audit_logs_resource ON support_audit_logs(resource_type, resource_id);
CREATE INDEX idx_support_audit_logs_created_at ON support_audit_logs(created_at);
```

### WatermelonDB Schema Additions

```typescript
tableSchema({
  name: 'support_tickets_queue',
  columns: [
    // ... existing columns ...
    { name: 'priority', type: 'number' }, // 1=high, 2=normal, 3=low
    { name: 'error_code', type: 'string', isOptional: true },
    { name: 'blob_path', type: 'string', isOptional: true }, // Local file staging
    { name: 'encrypted', type: 'boolean' }, // Encryption state
  ],
}),
```

## Error Handling Refinements

### Error Normalizer

```typescript
import { AxiosError } from 'axios';
import { PostgrestError } from '@supabase/supabase-js';

export function normalizeSupportError(error: unknown): SupportError {
  // Axios errors
  if (error instanceof AxiosError) {
    if (!error.response) {
      return {
        category: 'network',
        code: 'NETWORK_ERROR',
        message: error.message,
        userMessage: 'Network connection error. Changes will sync when online.',
        isRetryable: true,
      };
    }

    const status = error.response.status;
    if (status >= 500) {
      return {
        category: 'server',
        code: `SERVER_${status}`,
        message: error.message,
        userMessage: 'Server error. Please try again later.',
        isRetryable: true,
        retryAfterMs: 5000,
      };
    }

    if (status === 401 || status === 403) {
      return {
        category: 'auth',
        code: `AUTH_${status}`,
        message: error.message,
        userMessage: 'Authentication error. Please sign in again.',
        isRetryable: false,
        recoveryActions: [
          {
            label: 'Sign In',
            action: () => navigateToLogin(),
          },
        ],
      };
    }
  }

  // Supabase errors
  if (isPostgrestError(error)) {
    return {
      category: 'server',
      code: error.code,
      message: error.message,
      userMessage: 'Database error. Please try again.',
      isRetryable: false,
    };
  }

  // Unknown errors
  return {
    category: 'unknown',
    code: 'UNKNOWN_ERROR',
    message: String(error),
    userMessage: 'An unexpected error occurred. Please try again.',
    isRetryable: false,
  };
}

function isPostgrestError(error: unknown): error is PostgrestError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}
```

### Copy Technical Details

```typescript
export function formatTechnicalDetails(error: SupportError): string {
  return `
Error Code: ${error.code}
Category: ${error.category}
Message: ${error.message}
Retryable: ${error.isRetryable}
Timestamp: ${new Date().toISOString()}
App Version: ${Constants.expoConfig?.version}
Platform: ${Platform.OS} ${Platform.Version}
  `.trim();
}

// Usage in error UI
<Button
  onPress={() => {
    Clipboard.setString(formatTechnicalDetails(error));
    showToast('Technical details copied');
  }}
>
  Copy Technical Details
</Button>
```

## Security & Privacy Refinements

### Certificate Pinning

**Decision:** Do NOT implement certificate pinning in MVP.

**Rationale:**

- Complex to implement in React Native
- expo-updates and underlying fetch don't support pinning easily
- Requires native module development
- TLS + HSTS + strict validation is sufficient for MVP

**Future Consideration:** If we adopt a native networking module, revisit pinning for Supabase endpoints.

### WatermelonDB Encryption

**Strategy:**

- Use platform-level encrypted storage for payload blobs
- iOS: Keychain for encryption keys
- Android: EncryptedSharedPreferences for encryption keys
- Keep WatermelonDB with sensitive fields minimized
- Avoid storing raw PII in database

**Implementation:**

```typescript
import * as SecureStore from 'expo-secure-store';
import CryptoJS from 'crypto-js';

async function getEncryptionKey(): Promise<string> {
  let key = await SecureStore.getItemAsync('support_encryption_key');
  if (!key) {
    key = CryptoJS.lib.WordArray.random(32).toString();
    await SecureStore.setItemAsync('support_encryption_key', key);
  }
  return key;
}

export async function encryptPayload(payload: string): Promise<string> {
  const key = await getEncryptionKey();
  return CryptoJS.AES.encrypt(payload, key).toString();
}

export async function decryptPayload(encrypted: string): Promise<string> {
  const key = await getEncryptionKey();
  const bytes = CryptoJS.AES.decrypt(encrypted, key);
  return bytes.toString(CryptoJS.enc.Utf8);
}
```

### Redaction for Screenshots

**MVP Decision:** No in-app blur tool.

**Rationale:**

- Adds significant complexity
- Users can edit screenshots externally if needed
- Warnings and previews are sufficient for MVP

**Future Enhancement:** Consider adding simple blur/redaction tool in Phase 2.

## Performance Refinements

### JS Search Index Optimization

**Size Target:** <2MB compressed

**Strategy:**

- Prune to top terms only (remove stop words, rare terms)
- Compress with LZ-string before MMKV write
- Decompress on read, cache in memory

**Implementation:**

```typescript
import LZString from 'lz-string';
import MiniSearch from 'minisearch';

export async function saveSearchIndex(index: MiniSearch): Promise<void> {
  const serialized = JSON.stringify(index.toJSON());
  const compressed = LZString.compress(serialized);
  storage.set(STORAGE_KEYS.HELP_SEARCH_INDEX, compressed);
}

export async function loadSearchIndex(): Promise<MiniSearch | null> {
  const compressed = storage.getString(STORAGE_KEYS.HELP_SEARCH_INDEX);
  if (!compressed) return null;

  const serialized = LZString.decompress(compressed);
  if (!serialized) return null;

  const data = JSON.parse(serialized);
  return MiniSearch.loadJSON(data, {
    fields: ['title', 'body', 'keywords'],
    storeFields: ['title', 'category'],
    searchOptions: {
      boost: { title: 2, keywords: 1.5 },
      fuzzy: 0.2,
    },
  });
}
```

### Queue Processing Budget

**Strategy:** Yield to JS event loop after each batch to keep UI responsive.

**Implementation:**

```typescript
export async function processQueueBatch(
  queue: SupportTicket[],
  batchSize: number = 10
): Promise<void> {
  for (let i = 0; i < queue.length; i += batchSize) {
    const batch = queue.slice(i, i + batchSize);

    // Process batch
    await Promise.all(batch.map((ticket) => submitTicket(ticket)));

    // Yield to event loop
    await new Promise((resolve) => setImmediate(resolve));
  }
}
```

### Sentry Breadcrumb Sampling

**Strategy:** Cap to 20 breadcrumbs per session for help/support flows.

**Implementation:**

```typescript
let supportBreadcrumbCount = 0;
const MAX_SUPPORT_BREADCRUMBS = 20;

export function addSupportBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, any>
): void {
  if (supportBreadcrumbCount >= MAX_SUPPORT_BREADCRUMBS) {
    return; // Skip to avoid spam
  }

  Sentry.addBreadcrumb({
    category: `support.${category}`,
    message,
    data,
    level: 'info',
  });

  supportBreadcrumbCount++;
}

// Reset on session start
export function resetSupportBreadcrumbs(): void {
  supportBreadcrumbCount = 0;
}
```

## Testing Refinements

### Jest Mocks for JSI Libraries

**Required Mocks:**

- MMKV (already exists in `__mocks__`)
- Reanimated (already exists in `__mocks__`)
- expo-secure-store (needs to be added)

**New Mock:**

```typescript
// __mocks__/expo-secure-store.ts
export const getItemAsync = jest.fn(async (key: string) => null);
export const setItemAsync = jest.fn(async (key: string, value: string) => {});
export const deleteItemAsync = jest.fn(async (key: string) => {});
```

### Maestro E2E Tests

**Priority Flows:**

1. Status banner display and dismissal
2. Offline queue submission and sync
3. Help article search and view
4. Support ticket submission (happy path)

**Example Maestro Flow:**

```yaml
# .maestro/support/offline-queue.yaml
appId: com.growbro.app
---
- launchApp
- tapOn: 'Settings'
- tapOn: 'Contact Support'
- inputText: 'Test issue'
- tapOn: 'Submit'
- assertVisible: 'Request queued'
- enableNetwork
- waitForAnimationToEnd
- assertVisible: 'Request sent'
```

## Additional Open Questions

### 1. Screenshot Redaction Tooling

**Question:** Do we require in-app blur/redaction tool for screenshots before upload?

**MVP Decision:** No, not required for MVP.

**Rationale:**

- Adds significant complexity
- Users can edit screenshots externally if needed
- Warnings and previews are sufficient

**Future:** Consider adding simple blur tool in Phase 2 if user feedback indicates need.

---

### 2. Push Notifications Provider

**Question:** Are we already using Expo Notifications with proper device tokens and backend mapping?

**Current State:** Yes, we have expo-notifications integrated with device token management.

**Action Required:**

- Extend existing notification system to support review completion notifications
- Add notification type: `second-opinion-reviewed`
- Respect quiet hours and notification preferences

---

### 3. CDN for Educational Assets

**Question:** Which CDN do we target for educational assets?

**Options:**

- Supabase Storage with public cache (built-in CDN)
- Cloudflare R2 + CDN
- Custom CDN solution

**Recommendation:** Use Supabase Storage public cache for MVP (simplest integration).

**Future:** Evaluate Cloudflare R2 if we need more control over caching or lower costs at scale.

---

## Additional Risks

### 8. Search Index Desync Across Updates

**Risk:** Search index version mismatch after app update causing crashes.

**Mitigation:**

- Version the search index with app version
- Rebuild index on version mismatch
- Graceful fallback to server search if index fails
- Log index rebuild events to Sentry

**Implementation:**

```typescript
const SEARCH_INDEX_VERSION = '1.0.0';

export async function loadOrRebuildSearchIndex(): Promise<MiniSearch> {
  const storedVersion = storage.getString('search_index_version');

  if (storedVersion !== SEARCH_INDEX_VERSION) {
    // Version mismatch, rebuild index
    await rebuildSearchIndex();
    storage.set('search_index_version', SEARCH_INDEX_VERSION);
  }

  return await loadSearchIndex();
}
```

---

### 9. WebView Privacy Leakage

**Risk:** Embedding videos in WebView may leak user data via third-party cookies.

**Mitigation:**

- Prefer external app/browser open for videos
- If WebView is necessary, use incognito mode
- Clear cookies after each session
- Add privacy notice before opening WebView

**Implementation:**

```typescript
<WebView
  source={{ uri: videoUrl }}
  incognito={true}
  sharedCookiesEnabled={false}
  thirdPartyCookiesEnabled={false}
  onNavigationStateChange={(navState) => {
    // Intercept external links
    if (navState.url !== videoUrl) {
      Linking.openURL(navState.url);
      return false;
    }
  }}
/>
```
