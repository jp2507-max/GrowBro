# Requirements Document

## Introduction

The Harvest Workflow feature enables home cannabis growers to systematically track their harvest process from initial harvest through drying, curing, and final inventory management. This feature addresses the critical post-harvest phase where proper tracking ensures quality preservation and provides valuable data for future growing cycles. The workflow guides users through staged processes with target durations, weight tracking, and quality assessments, ultimately creating comprehensive inventory records for harvest management.

## Requirements

### Requirement 1

**User Story:** As a grower, I want to record my harvest details including weights and quality notes, so that I can track the initial harvest data and monitor my growing success.

#### Acceptance Criteria

1. WHEN a user initiates harvest recording THEN the system SHALL present a harvest modal with input fields for wet weight, dry weight, trimmings weight, and quality notes
2. WHEN a user enters harvest data THEN the system SHALL validate that wet weight is greater than or equal to dry weight if both are provided
3. WHEN a user submits harvest data THEN the system SHALL save the record with a timestamp and link it to the specific plant
4. WHEN a user accesses harvest data offline THEN the system SHALL allow full read/write operations and sync when connectivity is restored
5. IF a user provides invalid weight data THEN the system SHALL display clear validation messages and prevent submission

### Requirement 2

**User Story:** As a grower, I want to track my harvest through distinct stages (Harvest → Drying → Curing → Inventory), so that I can follow proper post-harvest procedures and ensure quality preservation.

#### Acceptance Criteria

1. WHEN a harvest is created THEN the system SHALL initialize it in the "Harvest" stage with a timestamp
2. WHEN a user advances to the next stage THEN the system SHALL record the stage transition with completion timestamp and allow optional notes
3. WHEN a stage is active THEN the system SHALL display target duration guidance and elapsed time
4. WHEN the Curing stage is completed THEN the system SHALL automatically create an inventory record
5. IF a user attempts to skip stages THEN the system SHALL prevent the action and display appropriate guidance
6. WHEN a user views stage history THEN the system SHALL display all stage transitions with timestamps and notes

### Requirement 3

**User Story:** As a grower, I want the system to automatically create inventory records when my harvest is complete, so that I have a final summary of my harvest with accurate weights and completion dates.

#### Acceptance Criteria

1. WHEN the Curing stage is marked complete THEN the system SHALL create an inventory record with final dry weight and all stage completion dates
2. WHEN an inventory record is created THEN the system SHALL link it to both the original plant and harvest records
3. WHEN inventory sync occurs THEN the system SHALL update the record atomically to prevent data inconsistency
4. WHEN a user views inventory THEN the system SHALL display final weights, harvest date, and total processing duration
5. IF inventory creation fails THEN the system SHALL retry automatically and notify the user of any persistent issues

### Requirement 4

**User Story:** As a grower, I want to view charts showing weight changes over time for my plants and batches, so that I can analyze harvest performance and identify trends.

#### Acceptance Criteria

1. WHEN a user accesses harvest charts THEN the system SHALL display a line chart showing weight progression over time
2. WHEN chart data spans 0-365 days THEN the system SHALL render the chart without performance issues
3. WHEN a user selects a specific plant THEN the system SHALL filter chart data to show only that plant's harvest history
4. WHEN a user selects a batch view THEN the system SHALL aggregate and display data for multiple plants harvested together
5. WHEN no harvest data exists THEN the system SHALL display an appropriate empty state with guidance
6. IF chart rendering fails THEN the system SHALL display an error message and fallback to tabular data view

### Requirement 5

**User Story:** As a grower, I want to receive guidance on target durations for each harvest stage, so that I can optimize my drying and curing process for better quality.

#### Acceptance Criteria

1. WHEN a user enters a harvest stage THEN the system SHALL display recommended duration ranges for that stage
2. WHEN a stage duration exceeds recommended time THEN the system SHALL provide gentle notifications with guidance
3. WHEN a user requests stage information THEN the system SHALL provide educational content about optimal conditions
4. WHEN environmental factors may affect timing THEN the system SHALL adjust recommendations based on user-provided conditions
5. IF a user wants to override recommendations THEN the system SHALL allow manual progression with confirmation

### Requirement 6

**User Story:** As a grower, I want to add quality notes and observations during each harvest stage, so that I can document important details and learn from each harvest cycle.

#### Acceptance Criteria

1. WHEN a user is in any harvest stage THEN the system SHALL provide a notes field for observations
2. WHEN a user adds notes THEN the system SHALL timestamp the entry and associate it with the current stage
3. WHEN a user views harvest history THEN the system SHALL display all notes organized by stage and date
4. WHEN notes are entered offline THEN the system SHALL store them locally and sync when connectivity returns
5. IF notes exceed character limits THEN the system SHALL provide clear feedback and allow editing

### Requirement 7

**User Story:** As a grower, I want my harvest data to work seamlessly offline, so that I can record information in my grow space without worrying about internet connectivity.

#### Acceptance Criteria

1. WHEN the app is offline THEN the system SHALL allow full harvest workflow operations including stage transitions
2. WHEN connectivity is restored THEN the system SHALL sync all harvest data using last-write-wins conflict resolution
3. WHEN sync conflicts occur THEN the system SHALL apply server timestamps as authoritative and log conflicts for review
4. WHEN images are captured during harvest THEN the system SHALL store them locally and sync metadata when online
5. IF sync fails repeatedly THEN the system SHALL queue operations and retry with exponential backoff

### Requirement 8

**User Story:** As a grower, I want to capture and associate photos with my harvest stages, so that I can visually document the process and quality changes over time.

#### Acceptance Criteria

1. WHEN a user is recording harvest data THEN the system SHALL provide options to capture or select photos
2. WHEN photos are added THEN the system SHALL store them in the file system with metadata in the database
3. WHEN viewing harvest history THEN the system SHALL display associated photos organized by stage
4. WHEN storage space is limited THEN the system SHALL implement LRU cleanup while preserving recent harvest photos
5. IF photo capture fails THEN the system SHALL allow users to continue without photos and retry later

### Requirement 9

**User Story:** As a grower, I want the system to enforce proper stage progression with clear state management, so that I can follow the correct harvest workflow without skipping critical steps.

#### Acceptance Criteria

1. WHEN the harvest workflow is initiated THEN the system SHALL implement a finite state machine: Harvest → Drying → Curing → Inventory
2. WHEN a user attempts to skip a stage THEN the system SHALL require an Override & Skip action with mandatory reason
3. WHEN a stage is entered THEN the system SHALL record stage_started_at with server-authoritative UTC timestamp
4. WHEN a stage is completed THEN the system SHALL record stage_completed_at and display timestamps in user locale
5. WHEN a user makes a stage change THEN the system SHALL support Undo within 15 seconds
6. IF more than 15 seconds have passed THEN the system SHALL require a Revert Stage flow with audit note

### Requirement 10

**User Story:** As a grower, I want inventory creation to be atomic and reliable, so that my final harvest data is always consistent and complete.

#### Acceptance Criteria

1. WHEN Curing stage is completed THEN the system SHALL create/update Inventory record transactionally with Harvest update in single server call
2. WHEN partial failure occurs THEN the system SHALL rollback and retry with exponential backoff
3. WHEN any create/update/delete request is made THEN the system SHALL accept an Idempotency-Key (UUID)
4. WHEN retries occur with same key THEN the system SHALL apply changes at most once and return prior result
5. IF inventory creation requires dry weight THEN the system SHALL block finalization and provide single-tap fix CTA when missing

### Requirement 11

**User Story:** As a grower, I want precise weight tracking with proper validation, so that my harvest data is accurate and reliable.

#### Acceptance Criteria

1. WHEN weights are stored THEN the system SHALL store all weights as integer grams internally
2. WHEN weights are displayed THEN the system SHALL handle metric/imperial unit conversion in UI and round to 1 decimal place
3. WHEN numeric inputs are provided THEN the system SHALL validate non-negative values within bounds (≤100,000g)
4. WHEN both wet and dry weights exist THEN the system SHALL enforce dry weight ≤ wet weight
5. WHEN database queries occur THEN the system SHALL use indexed (user_id, updated_at) and plant_id for optimal sync performance

### Requirement 12

**User Story:** As a grower, I want robust offline capabilities with reliable sync, so that I can work in my grow space without connectivity concerns.

#### Acceptance Criteria

1. WHEN working offline THEN the system SHALL support full read/write Harvest flow with outbox queue
2. WHEN connectivity returns THEN the system SHALL sync via WatermelonDB synchronize() using pullChanges/pushChanges
3. WHEN pushing changes THEN the system SHALL follow order: created → updated → deleted with last_pulled_at checkpoint
4. WHEN conflicts occur THEN the system SHALL use Last-Write-Wins by server updated_at timestamp
5. WHEN conflicts are detected THEN the system SHALL mark row conflict_seen=true and show "Updated elsewhere — review changes"
6. WHEN sync operations occur THEN the system SHALL capture telemetry for sync duration, checkpoint age, queued mutations, and rejection rate

### Requirement 13

**User Story:** As a grower, I want efficient photo storage and management, so that my visual documentation doesn't consume excessive device storage.

#### Acceptance Criteria

1. WHEN photos are captured THEN the system SHALL save files to device file system with only URIs and metadata in database
2. WHEN photos are processed THEN the system SHALL generate original, resized (~1280px), and thumbnail variants
3. WHEN app starts THEN the system SHALL run background LRU janitor for cache management and orphan detection
4. WHEN storage is full THEN the system SHALL offer "Free up space" action to users
5. IF photo storage fails THEN the system SHALL gracefully degrade and allow workflow continuation

### Requirement 14

**User Story:** As a grower, I want helpful timing notifications and guidance, so that I can optimize my drying and curing process.

#### Acceptance Criteria

1. WHEN entering each stage THEN the system SHALL schedule local notification for target duration
2. WHEN duration exceeds recommendation THEN the system SHALL send gentle reminder notifications
3. WHEN app starts THEN the system SHALL rehydrate notifications from persisted state
4. WHEN notifications are needed THEN the system SHALL use expo-notifications without network requirement
5. IF timing recommendations are not suitable THEN the system SHALL allow user override with confirmation

### Requirement 15

**User Story:** As a grower, I want smooth performance when viewing charts and history, so that I can quickly analyze my harvest data.

#### Acceptance Criteria

1. WHEN viewing weight-over-time charts THEN the system SHALL render smoothly for 0-365 days of data
2. WHEN large datasets exist THEN the system SHALL downsample on device and provide tabular fallback on render errors
3. WHEN viewing harvest history lists THEN the system SHALL use FlashList v2 with maintainVisibleContentPosition enabled
4. WHEN lists are rendered THEN the system SHALL target 60fps performance on mid-tier Android devices
5. IF chart rendering fails THEN the system SHALL provide accessible tabular data alternative

### Requirement 16

**User Story:** As a grower, I want accessible and internationalized interfaces, so that the app works well for all users regardless of language or accessibility needs.

#### Acceptance Criteria

1. WHEN interacting with UI elements THEN the system SHALL provide hit targets ≥44pt with accessible labels
2. WHEN no data exists THEN the system SHALL show appropriate empty states for harvests, charts, and photos
3. WHEN displaying text THEN the system SHALL route all strings through i18n with EN/DE parity
4. WHEN accessibility features are enabled THEN the system SHALL provide proper labels like "Advance to Drying"
5. IF content is missing THEN the system SHALL never show hardcoded production strings

### Requirement 17

**User Story:** As a grower, I want clear error handling and recovery options, so that I can resolve issues and continue my workflow.

#### Acceptance Criteria

1. WHEN input errors occur THEN the system SHALL show inline validation messages
2. WHEN transient sync errors happen THEN the system SHALL use toast notifications
3. WHEN persistent sync issues exist THEN the system SHALL show banner with "Retry now" and "View details"
4. WHEN server errors occur THEN the system SHALL map codes to actions: 401 (re-auth), 403 (permission), 413 (split uploads)
5. WHEN server rejection occurs THEN the system SHALL append audit note with error code and timestamp

### Requirement 18

**User Story:** As a grower, I want my harvest data to be secure and private, so that my growing information remains confidential.

#### Acceptance Criteria

1. WHEN accessing harvest data THEN the system SHALL protect all Harvest/Inventory rows with Supabase RLS
2. WHEN RLS is applied THEN the system SHALL allow owners to select/insert/update/delete only their own rows
3. WHEN photos are stored THEN the system SHALL keep them private by default with no public reads
4. WHEN sharing flows are used THEN the system SHALL redact private data appropriately
5. IF Supabase Storage is used THEN the system SHALL restrict object access to owner with explicit SELECT/UPDATE permissions

### Requirement 19

**User Story:** As a grower, I want the system to handle edge cases gracefully, so that unusual scenarios don't break my workflow.

#### Acceptance Criteria

1. WHEN multiple harvests exist per plant THEN the system SHALL support them with explicit override for overlapping open harvests
2. WHEN back-dated stage edits occur THEN the system SHALL recompute derived durations consistently
3. WHEN weights are missing THEN the system SHALL allow wet-only at start but require dry weight to finalize
4. WHEN device clock skew exists THEN the system SHALL use server timestamps as authoritative for ordering and conflicts
5. IF unusual data states occur THEN the system SHALL provide clear guidance for resolution
