# Implementation Plan

- [ ] 1. Setup core GitHub Actions workflow structure and EAS configuration

  - Create `.github/workflows/` directory structure with permissions blocks and concurrency controls
  - Configure comprehensive `eas.json` with CLI version pinning, appVersionSource: "remote", and runtime version policy
  - Set up GitHub Environment for production with manual approval requirements
  - Pin EAS CLI, Node 20, and pnpm versions for SDK 53 compatibility
  - Add branch→channel contract validation (release/\* → production, main → staging, PR → preview)
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 11.1, 11.2_

- [ ] 2. Implement quality gates pipeline component

  - [ ] 2.1 Create expo-doctor validation step

    - Write GitHub Action step that runs `npx expo-doctor` as first quality check with fail-fast behavior
    - Configure step to fail fast on SDK/config drift or incompatible versions
    - Add error reporting with actionable feedback and exact documentation hints in logs
    - _Requirements: 2.1, 2.2_

  - [ ] 2.2 Implement lint and TypeScript validation

    - Create GitHub Action steps for `pnpm lint` and type-only quick check (`tsc --noEmit`)
    - Configure steps to fail build on linting errors or TypeScript type errors
    - Add detailed error reporting with specific line numbers and fix suggestions
    - Run type check before full tests for faster feedback
    - _Requirements: 2.3, 2.4_

  - [ ] 2.3 Add test suite and translation validation
    - Create GitHub Action step for `pnpm test` with full test suite execution
    - Add translation validation and i18n missing keys checks running in parallel for speed
    - Configure both steps to fail build on test failures or translation syntax errors
    - _Requirements: 2.5, 2.6_

- [ ] 3. Create PR preview workflow with EAS Update integration

  - [ ] 3.1 Implement PR workflow with concurrency controls

    - Create `.github/workflows/pr-preview.yml` with pull request triggers
    - Add GitHub Actions concurrency configuration to cancel superseded runs
    - Integrate Expo GitHub Action for built-in authentication and caching
    - _Requirements: 1.3, 1.6_

  - [ ] 3.2 Add EAS Update publishing to preview channel

    - Configure EAS Update publishing to preview channel with branch→channel guard (PR → preview only)
    - Add runtime version compatibility checks before publishing updates
    - If runtime mismatch detected, post PR comment explaining why dev build is required
    - _Requirements: 9.3, 9.6, 9.7_

  - [ ] 3.3 Implement PR comment integration
    - Create GitHub Action step to post QR codes, eas update:view links, and runtime version info
    - Add build decision rationale ("BUILD because native diff detected" / "UPDATE only")
    - Include channel info, rollout percentage (100% for previews), and testing guidance
    - _Requirements: 1.4, 12.4_

- [ ] 4. Build staging workflow with intelligent build decisions

  - [ ] 4.1 Create staging workflow with quality gates

    - Create `.github/workflows/staging.yml` triggered on main branch pushes
    - Integrate all quality gates (expo-doctor, lint, tests, translations)
    - Add GitHub Actions concurrency controls and Expo GitHub Action integration
    - _Requirements: 1.1, 2.1-2.7_

  - [ ] 4.2 Implement build vs update decision engine

    - Base decision on Expo's runtime version rules and native runtime fingerprint changes
    - If native runtime fingerprint changes, force binary build; otherwise use OTA update
    - With runtimeVersion policy "appVersion", every new app version implies new runtime
    - Add "what changed" rationale note in job summary and prefer build as safe default
    - After staging OTA, roll out to small percentage first (20%), then promote to 100% automatically
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [ ] 4.3 Add EAS Build integration for staging

    - Configure EAS Build execution for staging profile when build is required
    - Add build metadata attachment with semver, commit SHA, and track information
    - Implement artifact storage with URLs and checksums for traceability
    - _Requirements: 1.5, 12.1, 12.2_

  - [ ] 4.4 Implement auto-submission to testing platforms
    - Configure EAS Submit with --auto-submit for TestFlight and Play Internal on binary builds only
    - Add submission profile validation in CI before submission (never auto-submit OTA paths)
    - Implement credential validation for ASC API key and Play service account
    - _Requirements: 5.1, 5.2, 5.5, 10.4, 10.5_

- [ ] 5. Create production workflow with compliance validation

  - [ ] 5.1 Build production workflow foundation

    - Create `.github/workflows/production.yml` triggered on release/\* branches
    - Gate workflow with GitHub Environment: production requiring manual approval
    - Integrate comprehensive quality gates and GitHub Actions optimizations
    - _Requirements: 1.2, 9.4_

  - [ ] 5.2 Implement store compliance checking

    - Add Apple privacy manifest check (PrivacyInfo.xcprivacy exists + Required Reason APIs present)
    - Add Android targetSdk check (≥35) and restricted permissions diff using expo prebuild analysis
    - Keep EAS Metadata validation ahead of submit to block missing screenshots/descriptions
    - Generate compliance reports with exact policy links and block builds on violations
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.7, 6.8_

  - [ ] 5.3 Add version management automation

    - Use cli.appVersionSource: "remote" and autoIncrement on production builds
    - Tag commit after successful production submit with semantic versioning
    - Add version conflict resolution and validation logic
    - _Requirements: 4.1, 4.2, 4.3, 4.7_

  - [ ] 5.4 Configure production submission with rollouts
    - Set up EAS Submit for production with staged rollout configuration
    - Implement App Store phased release and Play staged rollout controls
    - Add post-submission notifications with store links and rollout status
    - _Requirements: 5.3, 5.4, 10.2, 10.3, 10.6_

- [ ] 6. Implement monitoring and alerting system

  - [ ] 6.1 Set up EAS Webhooks and Slack integration

    - Configure EAS Webhooks for build/update/submit with success/fail notifications and deep links
    - Include exact updateId/buildId and last 100 lines of logs on failure
    - Add build status and performance metrics tracking
    - _Requirements: 7.1, 7.5_

  - [ ] 6.2 Integrate Sentry error tracking

    - Upload sourcemaps for both Build and Update to Sentry with consistent release naming (app@<semver>+<buildNumber>-<shortSHA>)
    - Break pipeline if sourcemap upload fails
    - Implement Sentry release creation with commit SHA and build IDs
    - _Requirements: 7.2, 7.6, 14.1, 14.2, 14.4_

  - [ ] 6.3 Create build dashboard and performance monitoring
    - Track build duration, queue time, failure rate per profile with alerting on regression vs rolling 7-day median
    - Build dashboard component to display build status, metrics, and trends
    - Add performance regression detection and notification system
    - _Requirements: 7.7, 7.8, 13.5_

- [ ] 7. Implement security and secret management

  - [ ] 7.1 Configure secure credential management

    - Manage signing and store credentials in EAS, not GitHub (prefer EAS Credentials for ASC API key, Play service account)
    - Keep GitHub environment secrets for non-signing items only, pass EAS token in CI
    - Bake credential audit job that runs eas credentials in read-only mode and posts state to job summary
    - _Requirements: 3.2, 3.7, 11.1, 11.4_

  - [ ] 7.2 Add git history and log security scanning
    - Create automated scanning to detect secrets in git history
    - Implement log scrubbing to ensure no secret values appear in build logs
    - Add credential security audit procedures and validation
    - _Requirements: 11.3, 11.4_

- [ ] 8. Build rollback and recovery system

  - [ ] 8.1 Implement OTA rollback capabilities

    - Ship rollback job (eas update:rollback --channel production) and rollout percentage editing job
    - Add percentage-based rollout controls for safe update deployment (default 10% rollout, promote via eas update:edit)
    - Implement automatic rollback triggers on high error rates
    - _Requirements: 8.1, 8.2, 8.10_

  - [ ] 8.2 Add binary rollback procedures

    - Document phased release/staged rollout pause/resume commands with links in failure Slack messages
    - Create Play staged rollout management (pause/expand/stop distribution)
    - Build runbook automation with recovery procedures accessible in <5 minutes
    - _Requirements: 8.3, 8.4, 8.9, 8.10_

  - [ ] 8.3 Create emergency recovery procedures
    - Implement manual override capabilities with approval workflows
    - Create emergency rollback procedures with detailed runbooks
    - Add backup credential management and recovery procedures
    - _Requirements: 8.5, 8.6, 8.11_

- [ ] 9. Add comprehensive testing and validation

  - [ ] 9.1 Create unit tests for pipeline components

    - Add unit tests for the decision engine (mock "native changed" vs "JS-only" scenarios)
    - Test version management logic and build decision engine
    - Add unit tests for compliance checker rules and validation
    - _Requirements: All requirements validation_

  - [ ] 9.2 Implement integration testing

    - Add integration test that publishes to throwaway channel and verifies runtime compatibility & rollback
    - Add EAS service integration testing with dry-run modes
    - Test store submission workflows and rollback procedures
    - _Requirements: Pipeline reliability validation_

  - [ ] 9.3 Add channel mapping and runtime compatibility tests
    - Create EAS Update Debug tests for channel→branch mapping validation
    - Test runtime version compatibility before update publishing
    - Add automated testing for compliance validation accuracy
    - _Requirements: 9.1, 9.2, 9.6_

- [ ] 10. Optimize performance and finalize documentation

  - [ ] 10.1 Implement build optimization features

    - Add actions/setup-node@v4 + pnpm/action-setup@v4 with caching for faster CI
    - Attach build artifacts with retention-days and checksums
    - Add matrix by platform (ios, android) with separate logs
    - _Requirements: 13.5, Performance optimization_

  - [ ] 10.2 Create comprehensive documentation

    - Write runbooks for: prod OTA, rollback, resubmission, and Apple/Google compliance check failures
    - Copy exact CLI commands and links into runbooks for immediate execution
    - Create troubleshooting guides for common pipeline issues
    - _Requirements: 8.9, Knowledge transfer_

  - [ ] 10.3 Final integration and testing
    - Perform end-to-end testing of complete pipeline
    - Validate all compliance checks and security measures
    - Test rollback procedures and emergency recovery workflows
    - _Requirements: Complete system validation_
