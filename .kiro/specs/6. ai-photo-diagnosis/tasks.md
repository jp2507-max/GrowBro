# Implementation Plan

- [ ] 1. Set up core data models and database schema

  - Create WatermelonDB schema for assessments table with all required fields (status, inference_mode, model_version, raw_confidence, calibrated_confidence, quality_scores, etc.)
  - Implement AssessmentRecord model with proper relationships to plants table
  - Add database indexes for (user_id, created_at) and (status) for efficient querying
  - Create AssessmentClassRecord model including "healthy" and "unknown/OOD" classes with explicit OOD flag
  - Add image integrity and filename key columns:
    - `integrity_sha256`: raw SHA-256 of the image bytes (unsalted) used for integrity/verification and local deduplication when appropriate
    - `filename_key`: per-install/user keyed filename key used for content-addressable filenames
  - Compute `filename_key` as HMAC-SHA256(secret, imageBytes) where `secret` is a per-install or per-user secret stored securely on-device
    - Use `filename_key` for on-disk blob/object filenames (e.g. `images/{filename_key}.jpg`) to avoid cross-user correlation
    - Update database migration scripts to add both columns and backfill `integrity_sha256` from existing data; backfilling `filename_key` requires access to image bytes and the device secret (see migration notes below)
  - Write database migration scripts for new tables and indexes
  - Ensure WatermelonDB Expo plugin is configured in app.json for dev build compatibility
  - Create dev-client smoke test to validate WatermelonDB integration
  - _Requirements: 6.1, 6.4, 9.1, 9.2_

- [ ] 2. Implement image capture and quality assessment system

  - [ ] 2.1 Create guided camera capture component with multi-shot support

    - Build CaptureComponent with guided prompts for leaf positioning (top/bottom views)
    - Implement real-time quality feedback UI for lighting, focus, and framing guidance

  - Add support for capturing up to 3 photos per assessment case with progress indicators

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
  - Create content-addressable file naming using per-install/user salted keys computed with HMAC-SHA256(secret, imageBytes) using an implementation of HMAC-SHA256 (for example, crypto-js or a native binding) — expo-crypto does not provide an HMAC API and therefore cannot be used for this purpose.
    - Continue to compute and store the unsalted `integrity_sha256`(imageBytes) for verification and optional local deduplication
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

    - Build Supabase Edge Function for cloud inference using EfficientNet-B4/ResNet-50 via ONNX Runtime
    - Always use getUser() from JWT bearer token and enforce RLS on all tables (never service key)
    - Add request batching and deduplication for network optimization
    - Create idempotency handling with exponential backoff retry logic
    - Implement end-to-end timeout <5s p95 on Pixel 6a/Galaxy A54 including upload with proper error handling
    - Add auth failure test to validate JWT handling and RLS enforcement
    - _Requirements: 2.2, 2.4, 10.4_

  - [ ] 3.3 Implement confidence calibration and result aggregation
    - Build temperature scaling system for confidence calibration (offline training)
    - Store both raw_confidence and calibrated_confidence in results
    - Implement multi-photo aggregation: majority vote → highest confidence → Unknown if all <0.70
    - Create Unknown/OOD class handling with automatic community CTA triggering
    - Add per-image result tracking with quality scores and class predictions
    - _Requirements: 2.2, 2.3, 6.4, 6.5_

- [ ] 4. Create action plan generation and task integration system

  - [ ] 4.1 Build action plan generator with safety guardrails

  - Create ActionPlanGenerator that maps assessment classes to specific action templates

    - Implement immediate steps (0-24h) and short-term actions (24-48h) generation

  - Enforce "measure-before-change" preconditions (pH/EC, light PPFD) as blocking steps for corrective actions
  - Add safety rails that block potentially harmful actions unless preceded by assessments with unit tests per class

    - Build generic, product-agnostic guidance with JSON templates and placeholders (no hardcoded dosages)
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

  - [ ] 4.2 Implement task creation and playbook integration
  - Build one-tap task creation from assessment results with prefilled details
  - Create task templates for common assessment-driven actions (pH measurement, light adjustment)
    - Implement playbook shift suggestions based on AI findings and user acceptance
    - Add tracking for task creation and playbook adjustment rates for analytics
    - Integrate with existing calendar system for seamless task scheduling
    - _Requirements: 3.4, 9.2_

- [ ] 5. Build offline queue management and sync system

  - [ ] 5.1 Create offline assessment request queue

  - Implement AssessmentRequest model with job state machine (pending → processing → succeeded/failed)

    - Build request queuing system that stores photos, plant context, and timestamps locally
    - Create queue status tracking with user-visible indicators and manual retry options

  - Use per-install/user salted `filename_key` for on-disk/object filenames and for cross-session deduplication where appropriate. Use `integrity_sha256` for intra-device deduplication and integrity verification when you need raw-image equivalence (note: using raw sha256 as an identifier across users is disallowed because it enables cross-user correlation).

    - Add queue size limits and cleanup policies for storage management
    - _Requirements: 7.1, 7.3, 7.4_

  - [ ] 5.2 Implement intelligent sync and retry logic
    - Build exponential backoff with jitter for failed request retries
    - Create batch processing system for efficient network usage when online
    - Implement sync conflict resolution using last-write-wins with server timestamps
    - Add network state monitoring and automatic queue processing on connectivity restore
    - Create persistent failure handling with user notification and manual retry options
    - _Requirements: 7.2, 7.5, 10.4_

## Migration notes: salted filename keys and integrity column

- Rationale: using raw SHA-256(imageBytes) as a filename/key enables cross-user correlation when images are uploaded or synced. To protect privacy, compute on-disk/object filenames using a per-install or per-user secret salt (keyed HMAC). Keep an unsalted `integrity_sha256` column if you need to detect exact duplicate images on a single device or verify integrity.

- Steps to implement and migrate:

  1. Generate and persist a per-install or per-user secret:

  - Generate a 32-byte (or longer) random secret on first run/first use of the assessment feature.
  - Persist the secret using a secure on-device keystore: prefer platform secure storage (iOS Keychain, Android Keystore) or a managed secure store (Expo SecureStore, react-native-keychain, or MMKV with encryption). Document storage choice and threat model.

  2. Compute filename keys at time-of-capture/upload:

  - filename_key MUST be computed as HMAC-SHA256(secret, imageBytes).
  - Use `filename_key` for all filenames and object keys (e.g. `images/{filename_key}.jpg`). This prevents the same image from being linkable across installs/users.

  3. Continue storing raw SHA-256(imageBytes) in `integrity_sha256`:

  - Compute `integrity_sha256 = SHA256(imageBytes)` and store it in the record for integrity checks and local deduplication only.
  - Do NOT expose `integrity_sha256` in any cross-user or server-side index unless explicitly required and privacy-reviewed.

  4. Migration strategy for existing data:

  - Add new columns (`filename_key`, `integrity_sha256`) via a migration script.
  - Backfill `integrity_sha256` from existing blobs where possible by reading the image bytes and hashing them.
  - Backfilling `filename_key` requires the device secret; if the secret cannot be recovered (e.g., reinstall), you cannot reliably compute prior filename keys. In that case:
  - Keep existing raw filenames in a temporary mapping table and reingest blobs under new keys when they are next accessed/uploaded.
  - Or mark old records as needing rekeying; when user next opens/edits the image, compute the new `filename_key` and store it.

  5. Tests and examples to update:

  - Update unit tests that assert filenames equal raw SHA256(image) to instead expect the HMAC-derived `filename_key` and verify `integrity_sha256` separately.
  - Add tests for secret generation, persistence, and migration edge cases (missing secret, secret rotation, rekeying on reinstall).
  - Update any example upload code or Supabase/Edge Function examples to use `filename_key` for object keys and to send `integrity_sha256` as metadata if the server needs to verify payload integrity.

### Example pseudocode (capture → store)

```
// 1. ensure secret exists
secret = await getOrCreateDeviceSecret()

// 2. capture and strip exif
imageBytes = await captureImageAndStripExif()

// 3. compute hashes
integrity = SHA256(imageBytes) // store this in DB for verification
filenameKey = HMAC_SHA256(secret, imageBytes) // use this for filename

// 4. write file and DB record
writeFile(`images/${filenameKey}.jpg`, imageBytes)
db.assessments.create({ filename_key: filenameKey, integrity_sha256: integrity, ... })
```

Notes:

When implementing the HMAC, be aware that expo-crypto does not provide a built-in HMAC API (it offers digest/digestStringAsync and random utilities but no hmac\* methods) and therefore cannot be used for HMAC-SHA256. For HMAC-SHA256 you should use a well-tested JS library such as `crypto-js` (HmacSHA256) or `asmcrypto.js` which accept binary input (Uint8Array) and produce a hex or base64 signature, or implement a thin native/JSI module (native bindings) that calls platform crypto (CommonCrypto on iOS, BoringSSL/OpenSSL on Android) if you need native performance or integration with secure key storage.

Expect HMAC input to be raw binary (Uint8Array) for image blobs and the output to be a stable hex string (lowercase) or base64 string; pick one format (hex is recommended) and document it across clients. Treat the HMAC secret as a credential (store it in secure storage / Keychain / Android Keystore / SecureStore) and, if you support secret rotation, provide an explicit rekey strategy (on-access rekeying or a background re-encryption job that rewrites blobs under the new key while preserving `integrity_sha256`).

- [ ] 6. Implement user feedback and telemetry system

  - [ ] 6.1 Create user feedback collection interface

    - Build feedback UI for "Was this helpful?" and "Issue resolved?" collection
    - Implement optional feedback notes collection with character limits
    - Create feedback submission system that respects user privacy preferences

  - Add feedback tracking to assessment records for model improvement analytics

    - Implement feedback aggregation for per-class accuracy and helpfulness metrics
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 6.2 Build comprehensive telemetry and analytics system
    - Implement privacy-safe telemetry logging (device vs cloud mode, latency, model version, confidence)
    - Create user action tracking (task creation, playbook shifts, community CTA usage)
  - Add Sentry integration with assessment_id breadcrumbs (no PII) for error debugging
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
  - Implement duplicate photo detection within assessment cases with user prompts
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
  - Create delete cascade system keyed by assessment_id across all storage systems
    - Add deletion confirmation system with 30-day completion guarantee
    - Build audit trail for deletion requests and completion status
    - Implement "right to be forgotten" compliance with proper data removal verification
    - _Requirements: 8.4, 8.5_

- [ ] 9. Create community integration and uncertainty handling

  - [ ] 9.1 Build community CTA and post creation system

    - Implement automatic community CTA triggering for confidence <70% or Unknown class

  - Create prefilled community post generation with assessment images and context
  - Build redacted post creation that removes sensitive metadata and writes a re-encoded copy under a random, non-linkable filename (never reuse filename_key)

  - Add deep-linking from assessment results to community post creation flow
  - Implement community post tracking for assessment follow-up and resolution

    - _Requirements: 4.1, 4.2, 4.3, 8.3_

  - [ ] 9.2 Create uncertainty and "not confident" result handling
    - Build neutral result card UI for low confidence or Unknown classifications
    - Implement retake guidance with specific tips for improving photo quality
  - Create generic assessment checklist (pH, EC, light height) for uncertain cases
    - Add educational content about when to seek community help or expert advice
    - Implement result card that balances uncertainty communication with actionable next steps
    - _Requirements: 4.4, 2.3_

- [ ] 10. Build comprehensive testing and quality assurance

  - [ ] 10.1 Create unit tests for core ML and quality assessment components

    - Write tests for quality assessment engine with synthetic blur, exposure, and white balance samples
    - Create ML inference engine tests with mock model responses and aggregation logic validation

  - Build action plan generator tests for each assessment class and safety guardrail validation

    - Add golden-set test that validates temperature scaling improves ECE without accuracy loss
    - Add model download integrity tests that verify checksums and signatures before loading
    - Create delegate/execution provider coverage tests that assert NNAPI/Metal vs CPU fallback works and logs correctly
    - Add automated EXIF stripping test that confirms metadata removal after manipulator steps
    - _Requirements: 6.4, 2.1, 3.1, 10.1_

  - [ ] 10.2 Implement integration and end-to-end testing
  - Create end-to-end assessment flow tests (capture → quality → inference → results → actions)
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

  - [ ] 11.2 Create localization infrastructure for assessment content
    - Externalize all assessment class names, descriptions, and action plan templates to JSON/YAML
    - Implement server-delivered action plans with locale support (EN/DE)
    - Create legal disclaimer management per jurisdiction with proper legal review
    - Build confidence level descriptions adapted to cultural context
    - Add error message and guidance text localization with validation scripts
    - _Requirements: All requirements (localization compliance)_

- [ ] 12. Final integration and polish

  - [ ] 12.1 Integrate AI assessment with existing app features

    - Connect assessment results to plant records in existing database schema
    - Integrate with existing calendar system for seamless task creation and scheduling
    - Link assessment history to plant profiles with timeline and progress tracking
    - Connect to existing community feed for assessment-driven post creation
    - Ensure consistent UI/UX with existing app design system and navigation patterns
    - _Requirements: 3.4, 4.3, 9.1_

  - [ ] 12.2 Implement final testing, optimization, and release preparation
    - Conduct comprehensive device testing on target hardware with real plant images
    - Perform load testing for cloud inference endpoints with concurrent user simulation
    - Execute accessibility audit with screen reader testing and contrast validation
    - Run security audit for data handling, privacy controls, and authentication flows
    - Complete localization testing for EN/DE with native speaker validation
    - _Requirements: All requirements (final validation)_
