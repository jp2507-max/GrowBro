# Implementation Plan

## .cbk Format Version and Schema

- **Format Version**: 1.0
- **Manifest Schema**: JSON with type, version, encryption (kdf, cipher, chunkSize), integrity (hashAlgorithm, manifestSignature)
- **Default KDF**: Argon2id (m=64MB, t=3, p=1) with fallback to scrypt
- **Default Cipher**: AES-256-GCM with XChaCha20-Poly1305 fallback
- **Chunk Size**: 64KB for streaming operations
- **Hash Algorithm**: SHA-256 with BLAKE3 option

## Phase 1: Risk Spikes (Must Pass to Proceed)

- [ ] 1. Crypto spike - Prove encryption performance and compatibility

  - Implement Argon2id/AES-GCM or XChaCha20-Poly1305 with streaming on iOS/Android dev builds
  - Measure performance baseline (MB/s) and memory ceiling on mid-tier Android device
  - Test constant-time MAC comparison and secure memory zeroing
  - **Exit Criteria**: 10MB/s encryption rate, <100MB memory usage, passes on both platforms
  - _Requirements: R2 AC1, R2 AC6, R2 AC7_

- [ ] 2. File I/O spike - Prove platform file system integration

  - Test Expo FileSystem + SAF with persistable folder permissions on Android
  - Verify iOS Data Protection with NSFileProtectionComplete on created files
  - Test export sharing flows and re-launch persistence across both platforms
  - **Exit Criteria**: Persistent folder access after reboot, successful file protection on iOS
  - _Requirements: R1 AC7, R6 AC1_

- [ ] 3. Resumable uploads spike - Prove TUS integration reliability
  - Push 500MB file with tus-js-client to Supabase Storage in flaky network conditions
  - Test resume after app kill/restart with persisted upload URL
  - Measure upload progress accuracy and resumption success rate
  - **Exit Criteria**: 95% resumption success rate, accurate progress reporting
  - _Requirements: R2 AC4, R4 AC2_

## Phase 2: Core Services Foundation

- [ ] 4. Set up development build configuration

  - Create EAS build profiles with dev build requirement for WatermelonDB (JSI), libsodium, zip-archive
  - Configure Expo plugins for react-native-libsodium with platform-specific settings
  - Set up TypeScript interfaces aligned with .cbk format v1.0 schema
  - **Exit Criteria**: Successful dev builds on both platforms with all native dependencies
  - _Requirements: R2 AC7, R6 AC1_

- [ ] 5. Implement CryptoService with streaming AEAD

  - [ ] 5.1 Create key derivation with Argon2id/scrypt

    - Implement Argon2id (m=64MB, t=3, p=1) as primary KDF with scrypt fallback
    - Create secure salt generation and parameter storage in manifest
    - Add constant-time MAC verification and secure buffer zeroing
    - **Exit Criteria**: KDF consistency across platforms, secure memory handling
    - _Requirements: R2 AC1, R2 AC6_

  - [ ] 5.2 Build streaming encryption with AES-GCM/XChaCha20

    - Implement streaming API (init → push(chunk) → finalize) for large files
    - Create AES-256-GCM as primary cipher with XChaCha20-Poly1305 fallback
    - Add per-file checksum generation (SHA-256 primary, BLAKE3 option)
    - **Exit Criteria**: Stream 100MB+ files without memory spikes, AEAD verification passes
    - _Requirements: R2 AC1, R5 AC1, R5 AC3_

  - [ ] 5.3 Add manifest signature with HMAC
    - Derive HMAC key from passphrase using HKDF/Argon2id subkey
    - Record signature algorithm in manifest ("manifest_sig": {"alg":"HMAC-SHA256"})
    - Implement tamper detection before decryption attempts
    - **Exit Criteria**: Manifest tampering detected 100% of time, signature verification passes
    - _Requirements: R5 AC1, R5 AC3, R5 AC5_

- [ ] 6. Create platform-specific file system services

  - [ ] 6.1 Implement Android SAF with persistent permissions

    - Use ACTION_OPEN_DOCUMENT_TREE + takePersistableUriPermission
    - Test folder access persistence after device reboot
    - Create cleanup routine for old grants (128 grant limit)
    - Add "Re-pick storage location" flow for permission loss
    - **Exit Criteria**: Folder access survives reboot, graceful permission loss handling
    - _Requirements: R1 AC7, R6 AC1, R6 AC5_

  - [ ] 6.2 Implement iOS Data Protection and sharing

    - Enable Data Protection entitlement and set NSFileProtectionComplete on created files
    - Implement Expo Sharing integration for export delivery
    - Test file access during device lock scenarios
    - **Exit Criteria**: Files protected when device locked, sharing works across apps
    - _Requirements: R2 AC7, R1 AC4, R6 AC1_

  - [ ] 6.3 Build StorageService with TUS resumable uploads
    - Integrate tus-js-client for Supabase Storage with upload URL persistence
    - Implement per-file progress callbacks and automatic retry with exponential backoff
    - Add storage quota monitoring and cleanup prompts
    - **Exit Criteria**: Resume 95% success rate, accurate progress, quota management works
    - _Requirements: R2 AC4, R4 AC2, R4 AC5_

- [ ] 7. Create streaming ZIP service
  - Implement incremental ZIP creation using react-native-zip-archive (dev build required)
  - Add streaming file addition without loading entire files to JS memory
  - Create content-addressed media file handling with SHA-256 deduplication
  - **Exit Criteria**: 10k records + 2k media ZIP creation without OOM
  - _Requirements: R2 AC3, R4 AC2_

## Phase 3: Export Path (Human-Readable)

- [ ] 8. Build CSV/JSON data formatter

  - [ ] 8.1 Implement CSV generation with Excel compatibility

    - Output UTF-8 with BOM for Excel compatibility across locales
    - Support configurable delimiters (comma/semicolon) based on locale
    - Follow RFC 4180 quoting rules with CRLF line endings
    - **Exit Criteria**: CSV opens correctly in Excel across DE/ES/FR locales
    - _Requirements: R1 AC1, R1 AC6_

  - [ ] 8.2 Create JSON export with media manifest
    - Generate pretty-printed JSON for human readability
    - Create media manifest with file metadata and hash references
    - Include content types and record counts in export manifest
    - **Exit Criteria**: Valid JSON structure, complete media references
    - _Requirements: R1 AC2, R1 AC3, R1 AC6_

- [ ] 9. Implement ExportManager with GDPR compliance
  - Create data minimization controls (exclude media URIs/diagnoses by default)
  - Generate export manifest with proper metadata and content types
  - Implement export packaging with system share sheet/SAF integration
  - Add export progress tracking with cancellation support
  - **Exit Criteria**: GDPR-compliant export format, data minimization works
  - _Requirements: R1 AC1, R1 AC2, R1 AC4, R1 AC5, R6 AC6_

## Phase 4: Backup Path (Machine-Restorable)

- [ ] 10. Create BackupManager with WatermelonDB integration

  - [ ] 10.1 Implement sync management with LWW semantics

    - Pause WatermelonDB sync during restore operations
    - Run full pull using server timestamps (LWW) instead of zeroing last_pulled_at
    - Create pre-restore snapshot for rollback capability
    - **Exit Criteria**: No sync conflicts, successful rollback capability
    - _Requirements: R3 AC4, R3 AC6_

  - [ ] 10.2 Build delta backup query system
    - Query changed records since last backup timestamp
    - Generate NDJSON streaming for memory-efficient serialization
    - Create backup metadata with integrity checksums
    - **Exit Criteria**: Delta backups contain only changed data, NDJSON streams efficiently
    - _Requirements: R4 AC1, R4 AC2, R5 AC1_

- [ ] 11. Implement backup creation and validation
  - Create full and delta backup workflows with proper .cbk format v1.0
  - Add media file processing with content-addressed storage and deduplication
  - Implement dry-run validation with manifest verification and schema compatibility
  - **Exit Criteria**: Backup creation completes for 10k records + 2k media, validation catches corruption
  - _Requirements: R2 AC1, R2 AC2, R2 AC3, R3 AC2, R5 AC1_

## Phase 5: Restore Path with Safety Features

- [ ] 12. Build selective restore system

  - [ ] 12.1 Create restore options interface

    - Implement selective restore by entity, date range, and media inclusion
    - Add restore mode selection (replace device vs merge with LWW)
    - Create restore preview with summary of changes
    - **Exit Criteria**: Selective restore works correctly, preview shows accurate changes
    - _Requirements: R3 AC2, R3 AC3_

  - [ ] 12.2 Implement restore execution with batching
    - Process restore in batched transactions to avoid memory issues
    - Handle missing media files gracefully with "missing media" flags
    - Add restore progress tracking with detailed phase reporting
    - **Exit Criteria**: Large restores complete without OOM, missing media handled gracefully
    - _Requirements: R3 AC4, R3 AC6_

## Phase 6: Scheduling and Retention

- [ ] 13. Create opportunistic backup scheduler

  - Use Expo BackgroundFetch/TaskManager with iOS limitations documented
  - Trigger on app foreground + Wi-Fi/charging as primary path (background best-effort)
  - Add backup failure notifications with "tap to continue" prompts
  - **Exit Criteria**: Backups trigger reliably on foreground, notifications work
  - _Requirements: R4 AC1, R4 AC4_

- [ ] 14. Implement retention and consolidation
  - Create retention policy presets (space saver, balanced, comprehensive)
  - Add weekly full backup consolidation from deltas with space validation
  - Implement storage quota monitoring with cleanup prompts
  - **Exit Criteria**: Retention policies work correctly, quota management prevents storage issues
  - _Requirements: R4 AC3, R4 AC5, R5 AC4_

## Phase 7: User Interface and Experience

- [ ] 15. Build backup management UI

  - Create backup settings with frequency, retention, and destination options
  - Implement backup status dashboard with last backup date and storage usage
  - Add backup history with integrity status and management options
  - Create operation progress UI with stage-wise progress and cancellation
  - **Exit Criteria**: Settings validation works, progress UI responsive during operations
  - _Requirements: R6 AC1, R6 AC2, R6 AC3, R6 AC4_

- [ ] 16. Create export interface with UX improvements

  - Build export type selection with clear "human readable" vs "restorable" distinction
  - Add data minimization controls with GDPR portability help text
  - Implement CSV delimiter and encoding options for Excel compatibility
  - **Exit Criteria**: Export options clear to users, GDPR help text accessible
  - _Requirements: R1 AC1, R1 AC4, R1 AC5, R6 AC6_

- [ ] 17. Implement restore interface with safety features
  - Create restore file selection with backup validation preview
  - Add passphrase entry with hint display and retry handling
  - Implement selective restore options UI with clear explanations
  - **Exit Criteria**: Restore workflow intuitive, passphrase hints work securely
  - _Requirements: R3 AC1, R3 AC2, R3 AC3_

## Phase 8: Error Handling and Recovery

- [ ] 18. Build comprehensive error recovery system
  - Map technical errors to user-friendly messages with specific guidance
  - Implement automatic retry with exponential backoff for transient errors
  - Add platform-specific error handling (SAF permission loss, iOS file protection)
  - Create recovery actions (retry, cleanup, reauthenticate, re-pick location)
  - **Exit Criteria**: All common error scenarios have clear user guidance
  - _Requirements: R2 AC5, R4 AC4, R4 AC5, R6 AC5_

## Phase 9: Security and Compliance

- [ ] 19. Implement secure key management

  - Use Expo SecureStore for small hints/flags only (≤2KB limit, never passphrase)
  - Add biometric unlock support for passphrase hints
  - Implement secure memory management with proper cleanup
  - **Exit Criteria**: No passphrase storage, secure memory handling verified
  - _Requirements: R2 AC6, R2 AC7_

- [ ] 20. Add compliance and audit features
  - Create backup format documentation and CLI verification tool
  - Implement privacy-safe telemetry collection (opt-in, no PII)
  - Add data portability documentation for GDPR compliance
  - **Exit Criteria**: CLI tool verifies backups, telemetry respects privacy
  - _Requirements: R5 AC6, R6 AC6_

## Phase 10: Performance and Testing

- [ ] 21. Implement performance monitoring and optimization

  - Add phase-level timers (scan, pack, encrypt, upload) with ETA calculations
  - Enforce performance budgets for local phases (5s package, 10s encrypt on mid-tier Android)
  - Create memory usage monitoring during large operations
  - **Exit Criteria**: Performance budgets met, memory usage stays under 100MB
  - _Requirements: R1 AC5, R6 AC4_

- [ ] 22. Create comprehensive test suite

  - [ ] 22.1 Build unit and integration tests

    - Test crypto service (encryption roundtrip, key derivation, integrity)
    - Test backup/restore workflows with mock WatermelonDB
    - Test file system operations for both iOS and Android platforms
    - **Exit Criteria**: 90%+ code coverage, all crypto operations tested
    - _Requirements: All requirements - comprehensive test coverage_

  - [ ] 22.2 Add end-to-end and device tests
    - Test full backup/restore workflow with real data (10k records + 2k media)
    - Test cross-platform compatibility (iOS backup → Android restore)
    - Test device conditions (flight mode, low battery, device lock, reboot)
    - Test Excel integration across different locales (DE/ES/FR)
    - **Exit Criteria**: E2E workflows pass, cross-platform compatibility verified
    - _Requirements: All requirements - end-to-end validation_

## Phase 11: Documentation and Tools

- [ ] 23. Create developer documentation and CLI tools
  - Document .cbk format specification with technical details and version schema
  - Create Node.js CLI tool for backup verification, decryption, and manifest inspection
  - Write integration guide for WatermelonDB sync management
  - Document platform-specific considerations and troubleshooting
  - **Exit Criteria**: CLI tool works independently, documentation complete
  - _Requirements: Developer ergonomics and maintainability_

## Milestone Gates

**Gate 1 (After Phase 1)**: All risk spikes pass with demo builds and device videos
**Gate 2 (After Phase 4)**: Core backup/export functionality working end-to-end
**Gate 3 (After Phase 7)**: Complete UI/UX with user testing feedback incorporated
