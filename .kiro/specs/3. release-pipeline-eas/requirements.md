# Requirements Document

## Introduction

The Release Pipeline (EAS) feature will establish an automated, reliable, and efficient build and deployment system for GrowBro using Expo Application Services (EAS). This system will streamline the process of building, testing, and distributing the app across multiple environments (development, staging, production) and platforms (iOS, Android), while ensuring code quality and compliance with store requirements.

## Requirements

### Requirement 1

**User Story:** As a developer, I want an automated build pipeline that triggers on code changes, so that I can ensure consistent builds without manual intervention.

#### Acceptance Criteria

1. WHEN code is pushed to the main branch THEN the system SHALL automatically trigger a staging build using GitHub Actions with Expo GitHub Action
2. WHEN code is pushed to a release branch THEN the system SHALL automatically trigger a production build with remote auto-increment
3. WHEN a pull request is created THEN the system SHALL create a preview dev client build and publish an EAS Update to a preview channel
4. WHEN a PR build completes THEN the system SHALL post install links and QR codes back to the PR
5. WHEN builds are triggered THEN the system SHALL use concurrency controls to cancel superseded runs
6. WHEN triggering remote builds THEN the system SHALL use --no-wait for non-blocking CI
7. IF the build process fails THEN the system SHALL notify the development team with detailed error information

### Requirement 2

**User Story:** As a developer, I want automated code quality checks before builds, so that only high-quality code reaches production.

#### Acceptance Criteria

1. WHEN a build is triggered THEN the system SHALL run npx expo-doctor before other checks to fail fast on config/SDK drift
2. WHEN expo-doctor runs THEN the system SHALL fail the build if errors or incompatible SDK/React Native versions are reported
3. WHEN a build is triggered THEN the system SHALL run linting checks and fail the build if errors are found
4. WHEN a build is triggered THEN the system SHALL run TypeScript type checking and fail the build if type errors exist
5. WHEN a build is triggered THEN the system SHALL run the full test suite and fail the build if tests fail
6. WHEN a build is triggered THEN the system SHALL validate translation files and fail the build if syntax errors exist
7. IF any quality check fails THEN the system SHALL provide detailed feedback and prevent the build from proceeding

### Requirement 3

**User Story:** As a developer, I want environment-specific builds with proper configuration, so that each environment has the correct settings and features.

#### Acceptance Criteria

1. WHEN managing environment variables THEN the system SHALL centralize secrets via EAS Secrets and GitHub Actions secrets
2. WHEN handling secrets THEN the system SHALL store secrets only in EAS/CI and use EXPO*PUBLIC*\* for public runtime values
3. WHEN building for development THEN the system SHALL use development environment variables and enable debug features
4. WHEN building for staging THEN the system SHALL use staging environment variables and include testing features
5. WHEN building for production THEN the system SHALL use production environment variables and disable debug features
6. WHEN building for any environment THEN the system SHALL validate that all required environment variables are present
7. WHEN secrets are used THEN the system SHALL ensure secrets are never printed in logs (masked in CI)
8. IF required environment variables are missing THEN the system SHALL fail the build with clear error messages

### Requirement 4

**User Story:** As a developer, I want automated version management, so that builds have consistent and traceable version numbers.

#### Acceptance Criteria

1. WHEN managing versions THEN the system SHALL use EAS remote versions with autoIncrement for dev-facing version identifiers (androidVersionCode for Android, iosBuildNumber for iOS)
2. WHEN managing user-facing versions THEN the system SHALL use git tags for semver and sync to EAS with eas build:version:set/sync
3. WHEN a production build is triggered THEN the system SHALL auto-increment native versions and tag the commit
4. WHEN a staging build is triggered THEN the system SHALL use prerelease identifiers
5. WHEN a development build is triggered THEN the system SHALL embed commit SHA in build metadata
6. WHEN any build is created THEN the system SHALL maintain traceability between versions, commits, and builds
7. IF version conflicts exist THEN the system SHALL resolve them automatically or fail with clear guidance

### Requirement 5

**User Story:** As a developer, I want automated distribution to testing platforms, so that stakeholders can easily access and test new builds.

#### Acceptance Criteria

1. WHEN distributing builds THEN the system SHALL use --auto-submit to pipe builds to TestFlight/Play Internal automatically
2. WHEN configuring distribution THEN the system SHALL use submission profiles in eas.json to gate submissions
3. WHEN distributing to iOS THEN the system SHALL use ASC API key for authentication
4. WHEN distributing to Android THEN the system SHALL use Play Service Account for authentication
5. WHEN builds are submitted THEN the system SHALL validate submission profiles in CI
6. WHEN a staging build completes THEN the system SHALL automatically distribute it to internal testing groups
7. WHEN a development build completes THEN the system SHALL make it available for developer testing
8. WHEN a production build completes THEN the system SHALL prepare it for store submission
9. WHEN builds are distributed THEN the system SHALL send notifications with download links and release notes
10. IF distribution fails THEN the system SHALL retry with exponential backoff and alert on persistent failures

### Requirement 6

**User Story:** As a developer, I want integration with store compliance checks, so that builds meet platform requirements before submission.

#### Acceptance Criteria

1. WHEN validating iOS compliance THEN the system SHALL verify Privacy manifests and Required Reason APIs are present for app and SDKs
2. WHEN validating Android compliance THEN the system SHALL enforce targetSdk = 35 (deadline Aug 31 2025)
3. WHEN validating Android permissions THEN the system SHALL scan merged manifests for restricted permissions (QUERY_ALL_PACKAGES, MANAGE_EXTERNAL_STORAGE, exact-alarm)
4. WHEN restricted permissions are found THEN the system SHALL fail builds without documented justification
5. WHEN managing store metadata THEN the system SHALL use EAS Metadata to preflight store listing rules
6. WHEN compliance checks run THEN the system SHALL produce a compliance report
7. WHEN compliance violations are found THEN the system SHALL block production submissions
8. WHEN compliance checks fail THEN the system SHALL provide detailed feedback on required fixes
9. WHEN builds pass compliance THEN the system SHALL generate store-ready metadata and assets
10. IF critical compliance issues are found THEN the system SHALL block the build and require manual review

### Requirement 7: Sentry Release Health Gates (Adjustments A13)

**User Story:** As a release engineering team, we want hard gates based on crash-free metrics so that we protect users from bad releases.

#### Acceptance Criteria

1. WHEN evaluating release health THEN the system SHALL block release if crash-free users < 98% OR crash-free sessions < 99.5% OR ANR rate > 1%
2. WHEN thresholds are violated THEN the system SHALL trigger an auto-pause via an authenticated API (scope: releases:write or org-admin), record on-call owner, and annotate the run
3. WHEN sourcemap upload fails or is missing THEN the pipeline SHALL fail the build

### Requirement 8: Synthetic Flows (Maestro) (Adjustments A14)

**User Story:** As a QA engineer, I want automated synthetic flows so that critical user journeys remain healthy.

#### Acceptance Criteria

1. WHEN the CI runs THEN it SHALL execute Maestro flows for Offline Sync, AI Assessment, and Data Export and require green status before promotion
2. WHEN synthetic flows complete THEN logs and artifacts SHALL be uploaded for review

### Requirement 7

**User Story:** As a developer, I want build monitoring and alerting, so that I can quickly respond to pipeline issues.

#### Acceptance Criteria

1. WHEN integrating monitoring THEN the system SHALL use EAS Webhooks to send notifications to Slack for build/submit completion
2. WHEN integrating error tracking THEN the system SHALL upload native sourcemaps to Sentry on EAS Build and update sourcemaps on EAS Update
3. WHEN builds start THEN the system SHALL log the start time and configuration details
4. WHEN builds complete THEN the system SHALL log completion time, status, and performance metrics
5. WHEN builds fail THEN the system SHALL send Slack alerts including build URL and last 100 lines of logs
6. WHEN creating Sentry releases THEN the system SHALL include commit SHA and build IDs
7. WHEN build times exceed thresholds THEN the system SHALL alert about performance degradation
8. WHEN the pipeline is healthy THEN the system SHALL provide dashboard visibility into build status and trends

### Requirement 8

**User Story:** As a developer, I want rollback capabilities, so that I can quickly revert to previous stable builds if issues are discovered.

#### Acceptance Criteria

1. WHEN rolling back JS/OTA updates THEN the system SHALL use eas update:rollback to previous or embedded version
2. WHEN rolling back updates THEN the system SHALL support per-update rollouts with percentage controls for safe ramps
3. WHEN rolling back store binaries THEN the system SHALL support iOS Phased Release (pause/resume) and Play staged rollouts
4. WHEN rollback procedures are needed THEN the system SHALL provide documented halt/resume steps
5. WHEN rollback is requested THEN the system SHALL identify the last known good build
6. WHEN rolling back THEN the system SHALL restore the previous version's configuration and code
7. WHEN a rollback completes THEN the system SHALL update version tracking and notify stakeholders
8. WHEN rollback is initiated THEN the system SHALL preserve the current build for investigation
9. WHEN providing rollback access THEN the system SHALL ensure runbook links appear in pipeline output
10. WHEN rollback is needed THEN the system SHALL be executable in <5 minutes with no code changes
11. IF rollback fails THEN the system SHALL provide manual recovery instructions and escalate to senior developers

### Requirement 9

**User Story:** As a developer, I want proper EAS Update channel management, so that I can safely distinguish between building new binaries and shipping JS/asset updates.

#### Acceptance Criteria

1. WHEN configuring runtime versions THEN the system SHALL set runtimeVersion policy (e.g., "appVersion")
2. WHEN mapping channels THEN the system SHALL map channels to branches: production, staging, preview
3. WHEN using eas channel:view THEN the system SHALL show production↔production, staging↔staging, preview↔preview mappings
4. WHEN publishing to production THEN the system SHALL require manual approval in CI and include release notes
5. WHEN builds are created THEN the system SHALL embed the correct channel and runtime
6. WHEN channel/runtime mismatches occur THEN the system SHALL fail the build
7. WHEN managing updates THEN the system SHALL implement guardrails to prevent publishing to wrong channels

### Requirement 10

**User Story:** As a developer, I want automated submission with proper track management, so that builds reach the right distribution channels automatically.

#### Acceptance Criteria

1. WHEN configuring submission THEN the system SHALL use --auto-submit with per-env submission profiles
2. WHEN submitting to internal tracks THEN the system SHALL use Play Internal/TestFlight profiles
3. WHEN submitting to production THEN the system SHALL use staged rollout on Play and optional phased release on iOS
4. WHEN setting up credentials THEN the system SHALL configure ASC API key and Play service account for first-time setup
5. WHEN credentials are configured THEN the system SHALL validate them in CI
6. WHEN submissions complete THEN the system SHALL post store links and rollout status to Slack

### Requirement 11

**User Story:** As a developer, I want secure secret and signing management, so that sensitive credentials are never exposed in the repository.

#### Acceptance Criteria

1. WHEN managing secrets THEN the system SHALL store all secrets only in EAS Secrets/CI secrets
2. WHEN handling signing credentials THEN the system SHALL use EAS credentials manager with no repo storage
3. WHEN scanning repositories THEN the system SHALL ensure no secrets exist in git history
4. WHEN logging builds THEN the system SHALL ensure build logs contain no secret values (masked)
5. WHEN accessing credentials THEN the system SHALL use secure credential management practices

### Requirement 12

**User Story:** As a developer, I want comprehensive artifact traceability, so that I can track builds back to their source code and configuration.

#### Acceptance Criteria

1. WHEN creating builds THEN the system SHALL attach --message "<semver> · <shortSHA> · <track>" to builds
2. WHEN storing artifacts THEN the system SHALL store artifact URLs and checksums
3. WHEN linking builds THEN the system SHALL auto-link builds to commits
4. WHEN documenting builds THEN the system SHALL ensure every build has message and release notes
5. WHEN providing visibility THEN the system SHALL show commit, branch, channel, runtime, and test summary in dashboard

### Requirement 13

**User Story:** As a developer, I want intelligent build decisions, so that the system only creates new binaries when necessary and uses updates for JS/asset changes.

#### Acceptance Criteria

1. WHEN managing native generation THEN the system SHALL use Continuous Native Generation and expo prebuild only in EAS
2. WHEN deciding build vs update THEN the system SHALL run expo-doctor and fingerprint-style checks
3. WHEN only JS/assets changed and runtime unchanged THEN the system SHALL use EAS Update
4. WHEN native changes are detected THEN the system SHALL trigger a new build
5. WHEN tracking performance THEN the system SHALL monitor median build queue time and build duration
6. WHEN performance degrades THEN the system SHALL send alerts on regressions

### Requirement 14

**User Story:** As a developer, I want comprehensive crash and error observability, so that I can quickly identify and fix issues in production builds.

#### Acceptance Criteria

1. WHEN integrating Sentry THEN the system SHALL upload native sourcemaps on build and update sourcemaps on publish
2. WHEN creating releases THEN the system SHALL use release names that include platform-specific build identifiers, e.g. `<os>-<iosBuildNumber>-<sha>` for iOS and `<os>-<androidVersionCode>-<sha>` for Android
3. WHEN crashes occur THEN the system SHALL provide symbolicated crashes within 5 minutes of first error
4. WHEN sourcemap uploads fail THEN the system SHALL fail the pipeline
5. WHEN errors are tracked THEN the system SHALL maintain full traceability from crashes to source code
