# Implementation Plan

- [ ] 1. Set up core data models and database schema

  - Create WatermelonDB schema for diagnoses table with all required fields (status, inference_mode, model_version, raw_confidence, calibrated_confidence, quality_scores, etc.)
  - Implement DiagnosisRecord model with proper relationships to plants table
  - Add database indexes for (user_id, created_at) and (status) for efficient querying
  - Create DiagnosisClassRecord model including "healthy" and "unknown/OOD" classes with explicit OOD flag
  - Add sha256 column for images and implement content-addressable naming with expo-crypto
  - Write database migration scripts for new tables and indexes
  - Ensure WatermelonDB Expo plugin is configured in app.json for dev build compatibility
  - Create dev-client smoke test to validate WatermelonDB integration
  - _Requirements: 6.1, 6.4, 9.1, 9.2_

- [ ] 2. Implement image capture and quality assessment system

  - [ ] 2.1 Create guided camera capture component with multi-shot support

    - Build CaptureComponent with guided prompts for leaf positioning (top/bottom views)
    - Implement real-time quality feedback UI for lighting, focus, and framing guidance
    - Add support for capturing up to 3 photos per diagnosis case with progress indicators
    - Integrate with react-native-camera or expo-camera for cross-platform compatibility
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 2.2 Build automated image quality assessment engine

    - Implement blur detection using variance of Laplacian with tuned kernel size (threshold >100 as baseline)
    - Create exposure assessment using histogram analysis for over/under-exposure detection
    - Add white balance validation with color temperature estimation and deviation checks
    - Build composition validation for plant matter detection and framing
    - Make quality thresholds remote-configurable and device-tuned via Remote Config
    - Show specific failure reason (blur/exposure/WB/composition) with one-tap "Retake" CTA
    - _Requirements: 1.4, 2.1, 2.3_

  - [ ] 2.3 Implement EXIF data stripping and secure image storage
    - Use expo-camera for managed workflow compatibility and validate supported params on target devices
    - Add explicit EXIF stripping step after capture using expo-image-manipulator with automated test validation
    - Create content-addressable file naming using sha256 hashes computed with expo-crypto
    - Implement thumbnail generation pipeline with efficient compression
    - Build LRU cache management for local images with configurable storage limits
    - _Requirements: 1.5, 8.1, 8.5_

- [ ] 2.5. Milestone: Calibration and thresholding baseline

  - Implement temperature scaling for confidence calibration with offline validation
  - Deploy calibrated thresholds per class/locale/device to Remote Config
  - Validate that device vs cloud inference + confidence calibration works before Action Plans
  - _Requirements: 2.2, 2.3_

- [ ] 3. Build ML inference engine with dual-mode support

  - [ ] 3.1 Implement on-device ML inference with ONNX Runtime React Native

    - Integrate ONNX Runtime React Native with EfficientNet-Lite0/1 or MobileNetV3-Small models (<20MB)
    - Implement model loading with checksum validation, cryptographic signatures, and version tracking
    - Add NNAPI/Metal execution providers with CPU fallback and log active delegate for telemetry
    - Create model warm-up system off UI thread with tensor caching and memory management
    - Implement deadline budget (3.5s total) with cloud fallback using same idempotency key
    - _Requirements: 2.2, 2.4, 10.1, 10.5_

  - [ ] 3.2 Create cloud-based ML inference fallback system

    - Build Supabase Edge Function for cloud inference using EfficientNet-B4/ResNet-50 via ONNX Runtime with MANDATORY zero-retention-by-default policy for all uploaded images and inference artifacts
    - Always use getUser() from JWT bearer token and enforce RLS on all tables (never service key)
    - IMPLEMENT default TTL=0 (immediate ephemeral storage) for all uploaded images and inference artifacts - NO data shall persist by default
    - REQUIRE explicit user opt-in parameter to trigger persistent storage with recorded consent tracking and timestamped audit trail
    - STRICTLY AVOID writing inference inputs/outputs to permanent tables or object storage unless opt-in flag is present and validated
    - Configure Supabase Storage with automatic deletion policies and TTL=0 enforcement for temporary data - temporary storage must be immediately ephemeral
    - Add RLS policies that PREVENT accidental persistence and enforce zero-retention boundaries by default
    - Create secure opt-in parameter validation with consent timestamp recording, audit trail, and cryptographic verification
    - Implement automatic deletion jobs that purge temporary inference data immediately after processing completion or within <30s TTL
    - Add comprehensive tests verifying zero-retention default behavior, correct opt-in persistence flow, and immediate cleanup of temporary data
    - Add request batching and deduplication for network optimization
    - Create idempotency handling with exponential backoff retry logic
    - Implement end-to-end timeout <5s p95 on Pixel 6a/Galaxy A54 including upload with proper error handling
    - Add auth failure test to validate JWT handling and RLS enforcement
    - Add data retention compliance tests ensuring no artifacts persist without explicit opt-in
    - _Requirements: 2.2, 2.4, 8.1, 8.2, 8.4, 8.5, 10.4_

  - [ ] 3.3 Implement confidence calibration and result aggregation
    - Build temperature scaling system for confidence calibration (offline training)
    - Store both raw_confidence and calibrated_confidence in results
    - Implement multi-photo aggregation: majority vote → highest confidence → Unknown if all <0.70
    - Create Unknown/OOD class handling with automatic community CTA triggering
    - Add per-image result tracking with quality scores and class predictions
    - _Requirements: 2.2, 2.3, 6.4, 6.5_

- [ ] 4. Create action plan generation and task integration system

  - [ ] 4.1 Build action plan generator with safety guardrails

    - Create ActionPlanGenerator that maps diagnosis classes to specific action templates
    - Implement immediate steps (0-24h) and short-term actions (24-48h) generation
    - Enforce "measure-before-change" preconditions (pH/EC, light PPFD) as blocking steps for corrective actions
    - Add safety rails that block potentially harmful actions unless preceded by diagnostics with unit tests per class
    - Build generic, product-agnostic guidance with JSON templates and placeholders (no hardcoded dosages)
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

  - [ ] 4.2 Implement task creation and playbook integration
    - Build one-tap task creation from diagnosis results with prefilled details
    - Create task templates for common diagnosis-driven actions (pH measurement, light adjustment)
    - Implement playbook shift suggestions based on AI findings and user acceptance
    - Add tracking for task creation and playbook adjustment rates for analytics
    - Integrate with existing calendar system for seamless task scheduling
    - _Requirements: 3.4, 9.2_

- [ ] 5. Build offline queue management and sync system

  - [ ] 5.1 Create offline diagnosis request queue

    - Implement DiagnosisRequest model with job state machine (pending → processing → succeeded/failed)
    - Build request queuing system that stores photos, plant context, and timestamps locally
    - Create queue status tracking with user-visible indicators and manual retry options
    - Use image sha256 as duplicate key for request detection and deduplication
    - Add queue size limits and cleanup policies for storage management
    - _Requirements: 7.1, 7.3, 7.4_

  - [ ] 5.2 Implement intelligent sync and retry logic
    - Build exponential backoff with jitter for failed request retries
    - Create batch processing system for efficient network usage when online
    - Implement sync conflict resolution using last-write-wins with server timestamps
    - Add network state monitoring and automatic queue processing on connectivity restore
    - Create persistent failure handling with user notification and manual retry options
    - _Requirements: 7.2, 7.5, 10.4_

- [ ] 6. Implement user feedback and telemetry system

  - [ ] 6.1 Create user feedback collection interface

    - Build feedback UI for "Was this helpful?" and "Issue resolved?" collection
    - Implement optional feedback notes collection with character limits
    - Create feedback submission system that respects user privacy preferences
    - Add feedback tracking to diagnosis records for model improvement analytics
    - Implement feedback aggregation for per-class accuracy and helpfulness metrics
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 6.2 Build comprehensive telemetry and analytics system
    - Implement privacy-safe telemetry logging (device vs cloud mode, latency, model version, confidence)
    - Create user action tracking (task creation, playbook shifts, community CTA usage)
    - Add Sentry integration with diagnosis_id breadcrumbs (no PII) for error debugging
    - Build performance metrics collection (p95 latency tracking per device and mode)
    - Implement model performance monitoring with per-class accuracy tracking
    - _Requirements: 9.1, 9.3, 9.4, 9.5_

- [ ] 7. Create model lifecycle management and remote configuration

  - [ ] 7.1 Implement model delivery and update system

    - Build remote config system for model version management and staged rollouts
    - Create secure model download with checksum validation and cryptographic signatures
    - Implement A/B testing framework for model updates with shadow mode testing
    - Add automatic rollback capability based on error rate monitoring
    - Create model caching system with efficient storage and cleanup
    - _Requirements: 10.1, 10.2, 9.3_

  - [ ] 7.2 Build edge case handling and graceful degradation
    - Implement non-plant image detection with educational prompts and retake guidance
    - Create extreme close-up and heavy LED color cast detection with specific feedback
    - Add low memory handling with graceful degradation (skip device → cloud inference)
    - Implement duplicate photo detection within diagnosis cases with user prompts
    - Build timeout handling with user-visible countdown and cancellation options
    - _Requirements: 10.3, 10.4_

- [ ] 8. Implement privacy controls and data management

  - [ ] 8.1 Create privacy settings and consent management

    - Build settings toggle for "Improve the model with my images" (default off)
    - Implement explicit opt-in flow for photo sharing with clear retention policies
    - Create data retention management (90 days raw images opt-in only, 12 months metrics)
    - Add user data export functionality for GDPR compliance
    - Implement consent tracking and withdrawal mechanisms
    - _Requirements: 8.1, 8.2, 8.5_

  - [ ] 8.2 Build data deletion and GDPR compliance system
    - Implement comprehensive deletion that purges local files, remote blobs, and telemetry
    - Create delete cascade system keyed by diagnosis_id across all storage systems
    - Add deletion confirmation system with 30-day completion guarantee
    - Build audit trail for deletion requests and completion status
    - Implement "right to be forgotten" compliance with proper data removal verification
    - _Requirements: 8.4, 8.5_

- [ ] 9. Create community integration and uncertainty handling

  - [x] 9.1 Build community CTA and post creation system

    - ✅ Implement automatic community CTA triggering for confidence <70% or Unknown class
    - ✅ Create prefilled community post generation with diagnosis images and context
    - ✅ Build redacted post creation that removes sensitive metadata while preserving helpful context
    - ✅ Add deep-linking from diagnosis results to community post creation flow
    - ✅ Implement community post tracking for diagnosis follow-up and resolution
    - ✅ Add explicit preflight checks, default-safe behavior (no automatic sharing)
    - ✅ Implement robust redaction step that strips EXIF and other sensitive metadata while keeping clinically relevant context
    - ✅ Require explicit user confirmation/consent action before any post is sent or deep-linked
    - ✅ Add tracking hooks to log post creation, submission, and follow-up resolution events for diagnosis follow-up metrics
    - _Requirements: 4.1, 4.2, 4.3, 8.3_

  - [ ] 9.2 Create uncertainty and "not confident" result handling
    - Build neutral result card UI for low confidence or Unknown classifications
    - Implement retake guidance with specific tips for improving photo quality
    - Create generic diagnostic checklist (pH, EC, light height) for uncertain cases
    - Add educational content about when to seek community help or expert advice
    - Implement result card that balances uncertainty communication with actionable next steps
    - _Requirements: 4.4, 2.3_

- [ ] 10. Build comprehensive testing and quality assurance

  - [ ] 10.1 Create unit tests for core ML and quality assessment components

    - Write tests for quality assessment engine with synthetic blur, exposure, and white balance samples
    - Create ML inference engine tests with mock model responses and aggregation logic validation
    - Build action plan generator tests for each diagnosis class and safety guardrail validation
    - Add golden-set test that validates temperature scaling improves ECE without accuracy loss
    - Add model download integrity tests that verify checksums and signatures before loading
    - Create delegate/execution provider coverage tests that assert NNAPI/Metal vs CPU fallback works and logs correctly
    - Add automated EXIF stripping test that confirms metadata removal after manipulator steps
    - _Requirements: 6.4, 2.1, 3.1, 10.1_

  - [ ] 10.2 Implement integration and end-to-end testing
    - Create end-to-end diagnosis flow tests (capture → quality → inference → results → actions)
    - Build offline queue and sync testing with flight-mode simulation
    - Implement cross-feature integration tests (task creation, playbook adjustments, community posts)
    - Add performance testing for p95 latency SLOs on target devices (Pixel 6a, Galaxy A54)
    - Create device matrix testing with various Android/iOS versions and hardware configurations
    - _Requirements: 2.1, 7.1, 3.4, 9.4_

- [ ] 11. Implement accessibility and localization support

  - [ ] 11.1 Add comprehensive accessibility features

    - Implement screen reader support with descriptive labels for camera controls and guidance
    - Create result announcements with confidence levels and action plan navigation
    - Add high contrast mode support for camera UI and result displays
    - Ensure all interactive elements meet 44pt minimum touch target requirements
    - Build voice-over support for camera capture and alternative gesture controls
    - _Requirements: All requirements (accessibility compliance)_

  - [ ] 11.2 Create localization infrastructure for diagnosis content
    - Externalize all diagnosis class names, descriptions, and action plan templates to JSON/YAML
    - Implement server-delivered action plans with locale support (EN/DE)
    - Create legal disclaimer management per jurisdiction with proper legal review
    - Build confidence level descriptions adapted to cultural context
    - Add error message and guidance text localization with validation scripts
    - _Requirements: All requirements (localization compliance)_

- [ ] 12. Final integration and polish

  - [ ] 12.1 Integrate AI diagnosis with existing app features

    - Connect diagnosis results to plant records in existing database schema
    - Integrate with existing calendar system for seamless task creation and scheduling
    - Link diagnosis history to plant profiles with timeline and progress tracking
    - Connect to existing community feed for diagnosis-driven post creation
    - Ensure consistent UI/UX with existing app design system and navigation patterns
    - _Requirements: 3.4, 4.3, 9.1_

  - [ ] 12.2 Implement final testing, optimization, and release preparation
    - Conduct comprehensive device testing on target hardware with real plant images
    - Perform load testing for cloud inference endpoints with concurrent user simulation
    - Execute accessibility audit with screen reader testing and contrast validation
    - Run security audit for data handling, privacy controls, and authentication flows
    - Complete localization testing for EN/DE with native speaker validation
    - _Requirements: All requirements (final validation)_
