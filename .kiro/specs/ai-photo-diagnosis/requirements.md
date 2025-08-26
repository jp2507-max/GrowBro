# Requirements Document

## Introduction

The AI Photo Diagnosis feature enables home cannabis growers to quickly identify and address plant health issues through automated image analysis. Users can capture photos of their plants and receive AI-powered diagnoses with confidence scores and actionable guidance. This feature focuses on the most common cultivation issues including nutrient deficiencies, environmental stress, and basic pest/pathogen detection, providing growers with immediate next-best-action recommendations to resolve problems before they impact harvest quality.

## Requirements

### Requirement 1

**User Story:** As a home grower, I want to capture guided photos of my plant issues, so that I can get accurate AI analysis with proper image quality.

#### Acceptance Criteria

1. WHEN the user opens the AI diagnosis feature THEN the system SHALL display guided camera prompts for optimal photo capture
2. WHEN capturing photos THEN the system SHALL prompt for leaf top/bottom views, neutral lighting conditions, and macro focus
3. WHEN multiple shots are needed THEN the system SHALL allow capture of up to 3 photos per diagnosis case
4. WHEN photos have quality_score below threshold THEN the system SHALL block submission and show reasoned feedback (blur/exposure/white balance) with retake option
5. WHEN photos are captured THEN the system SHALL store them locally with content-addressable naming and strip EXIF data including GPS before any sharing

### Requirement 2

**User Story:** As a grower experiencing plant issues, I want to receive AI-powered diagnosis with confidence scoring, so that I can understand the reliability of the analysis.

#### Acceptance Criteria

1. WHEN photos are submitted for analysis THEN the system SHALL return results with p95 latency ≤ 5s (cloud) / ≤ 3.5s (device) on Pixel 6a & Galaxy A54 with hard timeout 8s and graceful fallback
2. WHEN inference is complete THEN the system SHALL return the top-1 predicted class with confidence percentage, including "Healthy/No Issue" and "Unknown/Out-of-Distribution" classes
3. WHEN confidence is below 70% OR class is Unknown/OOD THEN the system SHALL show "Not confident enough" UX with community CTA and retake tips
4. WHEN multiple photos are captured THEN the system SHALL use majority vote aggregation; if tie then highest confidence; if all <70% then return Unknown with community CTA
5. WHEN on-device inference is available THEN the system SHALL use local processing as primary method with cloud fallback
6. WHEN analysis completes THEN the system SHALL log results for model improvement only with user opt-in consent

### Requirement 3

**User Story:** As a grower who received an AI diagnosis, I want actionable next-best-action guidance, so that I can immediately address the identified issue.

#### Acceptance Criteria

1. WHEN a diagnosis is provided THEN the system SHALL display specific next-best-action steps for the identified issue with 1-tap "Create task(s)" option
2. WHEN showing action plans THEN the system SHALL provide 24-48 hour immediate steps and diagnostic checks, avoiding prescriptive chemical dosages
3. WHEN displaying recommendations THEN the system SHALL avoid product promotion, keep guidance generic and safe, and block potentially harmful actions unless preceded by diagnostics
4. WHEN result card is shown THEN the user SHALL be able to create prefilled tasks and optionally shift the active playbook; these actions are tracked
5. WHEN actions are complex THEN the system SHALL break them into numbered, sequential steps with measure-before-change approach (pH/EC, light PPFD)

### Requirement 4

**User Story:** As a grower using AI diagnosis, I want safety disclaimers and community backup options, so that I can make informed decisions about my plants.

#### Acceptance Criteria

1. WHEN any AI diagnosis is shown THEN the system SHALL display a disclaimer that results are suggestions, not professional advice
2. WHEN confidence is below 70% THEN the system SHALL show "Ask community / get second opinion" CTA
3. WHEN community CTA is tapped THEN the system SHALL deep-link to a prefilled community post with the diagnosis images
4. WHEN diagnosis results are uncertain THEN the system SHALL recommend consulting experienced growers
5. WHEN displaying any AI output THEN the system SHALL include appropriate legal and safety disclaimers

### Requirement 5

**User Story:** As a grower who has tried AI-suggested solutions, I want to provide feedback on diagnosis accuracy, so that the system can improve over time.

#### Acceptance Criteria

1. WHEN a diagnosis is completed THEN the system SHALL offer optional feedback collection ("Was this helpful?", "Issue resolved?")
2. WHEN feedback is provided THEN the system SHALL store it for model improvement without identifying user data
3. WHEN users report resolution THEN the system SHALL track success rates per diagnosis class
4. WHEN users report inaccuracy THEN the system SHALL flag cases for review and model retraining
5. WHEN feedback is submitted THEN the system SHALL thank the user and explain how it helps improve the service

### Requirement 6

**User Story:** As a grower, I want the AI to accurately identify the most common cannabis cultivation issues, so that I can address problems that typically affect home grows.

#### Acceptance Criteria

1. WHEN analyzing plant images THEN the system SHALL classify nutrient deficiencies including Nitrogen, Phosphorus, Potassium, Magnesium, and Calcium with per-class short descriptions and visual cues
2. WHEN detecting stress conditions THEN the system SHALL identify over-watering, under-watering, light stress/bleaching, and nutrient lockout/pH issues
3. WHEN identifying pathogens/pests THEN the system SHALL detect visual cues for powdery mildew and spider mites
4. WHEN testing on frozen hold-out dataset THEN the system SHALL achieve per-class top-1 ≥60% and overall ≥75% on ≥100 images/class with confusion matrix reporting each release
5. WHEN processing real-world images THEN the system SHALL maintain per-class performance metrics and track accuracy over time with shadow mode for model updates

### Requirement 7

**User Story:** As a grower using the app offline, I want my diagnosis requests to be queued and processed when connectivity returns, so that I can get help even without internet access.

#### Acceptance Criteria

1. WHEN the device is offline THEN the system SHALL queue diagnosis requests with captured photos locally
2. WHEN connectivity is restored THEN the system SHALL automatically process queued diagnosis requests
3. WHEN requests are queued THEN the system SHALL show clear status indicators to the user
4. WHEN processing queued requests THEN the system SHALL maintain original capture timestamps and context
5. WHEN queue processing fails THEN the system SHALL retry with exponential backoff and notify user of persistent failures

### Requirement 8

**User Story:** As a grower, I want my diagnosis history and photos to be private by default, so that I can control what information is shared with the community.

#### Acceptance Criteria

1. WHEN diagnoses are created THEN the system SHALL store them as private by default with settings toggle "Improve the model with my images" (off by default)
2. WHEN users want to share THEN the system SHALL require explicit opt-in for photo sharing and only log/store images when opted-in
3. WHEN sharing diagnosis results THEN the system SHALL create redacted community posts without sensitive metadata
4. WHEN users request deletion THEN the system SHALL purge local files, remote blobs, and telemetry tied to diagnosis_id with confirmation shown within 30 days
5. WHEN handling user data THEN the system SHALL define retention periods (raw images ≤90 days opt-in only; derived metrics 12 months) and ensure delete cascades

### Requirement 9

**User Story:** As a product team, I want comprehensive telemetry and evaluation metrics, so that I can monitor AI performance and improve the model over time.

#### Acceptance Criteria

1. WHEN diagnoses are processed THEN the system SHALL log privacy-safe metrics including device vs cloud mode, latency_ms, model_version, confidence, photo_quality_score, and user_actions
2. WHEN users provide feedback THEN the system SHALL track helpful_vote, issue_resolved status, and task/playbook creation rates
3. WHEN model updates are deployed THEN the system SHALL run shadow mode testing before flipping default and maintain rollback capability
4. WHEN evaluating performance THEN the system SHALL report per-class precision/recall and overall accuracy against frozen test sets
5. WHEN errors occur THEN the system SHALL instrument Sentry breadcrumbs with diagnosis_id (no PII), mode, and latency for debugging

### Requirement 10

**User Story:** As a developer, I want robust model lifecycle management and delivery, so that I can deploy updates safely and handle edge cases gracefully.

#### Acceptance Criteria

1. WHEN shipping models THEN the system SHALL deliver quantized TFLite/ONNX models (<20MB) with checksum validation and version tracking
2. WHEN updating models THEN the system SHALL use remote config with staged rollout and automatic rollback on error rates
3. WHEN handling edge cases THEN the system SHALL detect non-plant images, extreme close-ups, and heavy LED color cast with retake guidance
4. WHEN processing fails THEN the system SHALL gracefully degrade on low memory (skip device → cloud) and handle network errors with idempotency
5. WHEN warming up THEN the system SHALL initialize models off UI thread, cache interpreters, and release resources on app background
