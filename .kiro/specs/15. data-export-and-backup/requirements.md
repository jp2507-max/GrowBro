# Requirements Document

## Introduction

The Data Export and Backup feature enables GrowBro users to export their cultivation data in standard formats and create secure backups of their complete grow history including media files. This feature ensures data portability, provides peace of mind through backup protection, and enables users to maintain control over their data with self-service restore capabilities. The system will support both full and incremental backups with integrity verification to ensure data reliability.

## Requirements

### Requirement 1

**User Story:** As a GrowBro user, I want to export my cultivation data in standard formats for GDPR data portability, so that I can use my data in other applications or keep personal records.

#### Acceptance Criteria

1. WHEN a user initiates export THEN the system SHALL generate CSV per entity (plants, tasks, harvests, inventory, playbooks, diagnoses) using UTF-8, ISO-8601 timestamps (UTC), and documented headers
2. WHEN exporting THEN the system SHALL also generate a read-only JSON snapshot (export.json) for cross-app use with no guarantees for restore
3. WHEN generating exports THEN the system SHALL include a media-manifest.json (record-id → file URI, width/height, byte-hash)
4. WHEN export completes THEN the system SHALL package everything into canabro-export\_<ISO8601>Z_v1.zip and present via system share sheet/file picker
5. WHEN exporting ≤1k records (no media) THEN the system SHALL complete under 30s on mid-tier Android baseline, otherwise show progress UI with cancel
6. WHEN creating export package THEN the system SHALL include manifest.json with type:"canabro-export", version, created_at, app_version, timezone, tables, and counts
7. WHEN implementing export delivery THEN the system SHALL use Expo FileSystem + Sharing, allowing user to pick SAF folder on Android

### Requirement 2

**User Story:** As a GrowBro user, I want to create encrypted backups of my data including media files, so that I can protect my cultivation history from loss.

#### Acceptance Criteria

1. WHEN creating backups THEN the system SHALL use zip-then-encrypt: first package NDJSON per table, manifest.json, checksums.json into a ZIP; then encrypt the ZIP payload with AES-GCM-256 using the user passphrase to produce a single `.cbk` file (encrypted envelope).
   1. WHEN implementing encryption THEN the system SHALL use Argon2id as primary KDF (fallback to scrypt) with minimum 16-byte salt, 64MB memory cost, 2 iterations, and 1-second time cost; store KDF parameters in backup file header for restoration compatibility
   2. WHEN generating backup files THEN the system SHALL use a portable envelope header placed before the ciphertext: 8-byte magic ("CANA_BKP"), 4-byte version, 1-byte KDF id (0x01=Argon2id, 0x02=scrypt), KDF params (length-prefixed), 16-byte salt, 12-byte AES-GCM nonce, 8-byte payload length, 16-byte auth tag.
   3. WHEN encrypting payload THEN the system SHALL generate a unique random 12-byte nonce per backup, derive a 256-bit key via the specified KDF, and write [header‖ciphertext] to `.cbk`. No outer ZIP container after encryption.
2. WHEN offering backup options THEN the system SHALL provide Compact (no media) and Full (include resized ≤1280px media + media-index.json)
3. WHEN handling media files THEN the system SHALL use content-addressed filenames (<sha256>.<ext>) and store sha256 in index for deduplication
4. WHEN uploading to cloud THEN the system SHALL use Supabase resumable (TUS) with progress and auto-retry (exponential backoff, 3 attempts)
5. IF a backup fails THEN the system SHALL retry automatically up to 3 times before notifying the user
6. WHEN storing passphrases THEN the system SHALL store passphrase nowhere by default; optional keychain/biometric unlock hint only
7. WHEN creating temporary files on iOS THEN the system SHALL write artifacts with NSFileProtectionComplete

### Requirement 3

**User Story:** As a GrowBro user, I want to restore my data from a backup, so that I can recover my cultivation history after device changes or data loss.

#### Acceptance Criteria

1. WHEN a user initiates a restore THEN the system SHALL prompt for backup passphrase and validate before proceeding
2. WHEN restoring THEN the system SHALL run dry-run validation: verify manifest version, per-file SHA-256, and schema compatibility; present summary (rows per table, media count, app version)
3. WHEN offering restore options THEN the system SHALL provide Restore Mode: Replace This Device (wipe local DB) or Merge (upsert by id, LWW on updated_at)
4. WHEN performing restore THEN the system SHALL disable WatermelonDB sync, import in batched transactions, then reset checkpoints (last_pulled_at) and re-enable sync
5. IF restore fails THEN the system SHALL maintain the current data state and provide detailed error information
6. IF media files are missing THEN the system SHALL restore data anyway and mark entries with "missing media" flag

### Requirement 4

**User Story:** As a GrowBro user, I want automatic incremental backups, so that my recent changes are protected without manual intervention.

#### Acceptance Criteria

1. WHEN scheduling backups THEN the system SHALL create opportunistic delta backups (changed since last backup) on app foreground/device charging/Wi-Fi, at most once per 24h
2. WHEN creating delta packages THEN the system SHALL include only NDJSON diffs + new media; cloud side supports resumable continuation
3. WHEN conditions are suitable THEN the system SHALL auto-consolidate into full backup weekly when app next runs
4. WHEN automatic backup fails THEN the system SHALL notify the user and provide manual backup options
5. IF storage quota is exceeded THEN the system SHALL prompt user to manage backup retention settings

### Requirement 5

**User Story:** As a GrowBro user, I want to verify backup integrity and manage my backup history, so that I can trust my backups and control storage usage.

#### Acceptance Criteria

1. WHEN creating backups THEN the system SHALL generate SHA-256 for every file plus top-level checksum; store in checksums.json
2. WHEN viewing backup history THEN the system SHALL show date, size, mode (Full/Delta), location (local/cloud), and latest integrity result
3. WHEN performing integrity check THEN the system SHALL re-hash files and report per-file failures with suggested remediation (re-download/new backup)
4. WHEN managing backups THEN the system SHALL allow users to delete old backups to free storage space
5. IF backup corruption is detected THEN the system SHALL alert the user and suggest creating a new backup
6. WHEN telemetry is enabled THEN the system SHALL send durations, bytes, failure codes to Sentry (no PII)

### Requirement 6

**User Story:** As a GrowBro user, I want a self-service backup management interface, so that I can control my backup settings and monitor backup status without technical assistance.

#### Acceptance Criteria

1. WHEN accessing settings THEN the system SHALL provide backup mode (manual/automatic), frequency, retention (e.g., keep last 5 local), destination (device folder via SAF/iOS share, or Supabase Storage), media inclusion, and encryption (passphrase)
2. WHEN viewing status THEN the system SHALL show last success, next planned window, last error, and cloud quota if applicable
3. WHEN validating settings THEN the system SHALL show estimated storage and connectivity checks (Wi-Fi requirement)
4. WHEN operations are running THEN the system SHALL show stage-wise progress (scan → pack → encrypt → upload), throughput, ETA, and Cancel
5. IF backup settings are invalid THEN the system SHALL provide clear error messages and suggested corrections
6. WHEN explaining options THEN the system SHALL clarify "Export (GDPR) – structured, commonly used, machine-readable; Backup – lossless restore"

## Acceptance Testing Criteria

### Scale Testing

- **Large Dataset**: 10k tasks + 2k media; export (Compact) completes without OOM; restore succeeds with batch size ≤1k rows
- **Performance**: Export/backup operations maintain responsive UI and don't block main thread

### Resilience Testing

- **Interruption Recovery**: Kill app mid-backup; resumable upload continues on next launch
- **Network Failures**: Handle connectivity loss gracefully with retry mechanisms

### Platform Compliance

- **Android Permissions**: Can write to user-selected SAF folder under scoped storage
- **iOS Security**: Files use Data Protection (NSFileProtectionComplete)
- **Cross-Platform**: Consistent behavior across iOS and Android

## Implementation Notes

### Technical Constraints

- Use Expo FileSystem + SAF for Android destinations and Sharing.shareAsync for iOS exports
- Avoid assumptions about raw paths under Android 11+ scoped storage
- Prefer encrypt-then-zip (AES-GCM) because ZIP AES support is inconsistent in RN/Expo (especially iOS)
- During restore, pause WatermelonDB synchronize(), import in background thread, then reset sync state before re-enabling

### Mobile Platform Realities

- Background scheduling limits on iOS/Android require opportunistic backup timing
- SAF/user prompts required for destinations on Android
- True 24h background jobs are unreliable; design for foreground/charging/Wi-Fi opportunities
