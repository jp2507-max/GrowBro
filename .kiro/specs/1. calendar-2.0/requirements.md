# Requirements Document

## Introduction

Calendar 2.0 is a comprehensive task management system for cannabis growers that enables recurring tasks, local push notifications, drag-and-drop rescheduling, and template-based schedule creation. This feature aims to increase daily active usage through reliable reminders and a cleaner agenda interface, helping growers maintain consistent cultivation practices.

## Requirements

### Requirement 1

**User Story:** As a grower, I want to create recurring tasks with customizable intervals so that I can automate my regular cultivation activities without manual scheduling.

#### Acceptance Criteria

1. WHEN a user creates a task THEN the system SHALL provide options for daily, weekly, and custom interval recurrence
2. WHEN a user selects weekly recurrence THEN the system SHALL allow selection of specific weekdays
3. WHEN a user sets custom intervals THEN the system SHALL accept "every N days" format where N is 1-365
4. WHEN a user creates recurring tasks THEN the system SHALL provide optional end date or occurrence count limits
5. WHEN recurrence is defined THEN the system SHALL store it as RFC-5545 RRULE + DTSTART format internally
6. WHEN end dates are specified THEN the system SHALL store UNTIL values in UTC to avoid timezone conflicts
7. WHEN a user skips a recurring instance THEN the system SHALL create an exception (EXDATE equivalent) without affecting future occurrences
8. WHEN DST transitions occur THEN reminder times SHALL remain stable at local time (e.g., 08:00 Europe/Berlin)

### Requirement 2

**User Story:** As a grower, I want to receive local push notifications for my tasks so that I never miss important cultivation activities.

#### Acceptance Criteria

1. WHEN a user creates or edits a task THEN the system SHALL allow setting a custom reminder time
2. WHEN the app starts on Android 13+ THEN the system SHALL request POST_NOTIFICATIONS permission
3. WHEN notification permission is denied THEN the system SHALL show in-app banner with Settings deep-link
4. WHEN a reminder time is reached THEN the system SHALL fire a local push notification using expo-notifications
5. WHEN the app starts THEN the system SHALL verify and re-plan all scheduled notifications
6. WHEN device enters Doze mode THEN the system SHALL accept potential delivery delays; metrics MUST be recorded only after explicit user opt-in, with PII-free payloads.
7. WHEN notifications fire under battery optimization THEN the system SHALL measure and log delivery latency ONLY if analytics consent is granted.
8. WHEN a task is completed or deleted THEN the system SHALL cancel associated notifications

### Requirement 3

**User Story:** As a grower, I want a high-performance agenda view that can handle large numbers of tasks so that I can efficiently manage my cultivation schedule.

#### Acceptance Criteria

1. WHEN the agenda displays 1,000+ tasks THEN the system SHALL maintain 95th percentile frame time <16.7ms
2. WHEN the agenda loads THEN the system SHALL display initial visible content within 300ms
3. WHEN scrolling through the agenda THEN the system SHALL show no blank cells or tearing artifacts
4. WHEN loading the agenda THEN the system SHALL use FlashList v2 or equivalent for optimal performance
5. WHEN displaying on mid-tier Android THEN the system SHALL maintain smooth scrolling under manual testing
6. WHEN the agenda loads THEN the system SHALL prioritize current and upcoming days for immediate display

### Requirement 4

**User Story:** As a grower, I want to drag and drop tasks between days so that I can easily reschedule activities when my plans change.

#### Acceptance Criteria

1. WHEN a user drags a task to another day THEN the system SHALL update the task's due date immediately with optimistic UI
2. WHEN dragging near viewport edges THEN the system SHALL auto-scroll the agenda view
3. WHEN a task is being dragged THEN the system SHALL provide haptic feedback and visual drop zone indicators
4. WHEN a task is dropped THEN the system SHALL provide accessible drag handles for screen readers
5. WHEN a task is rescheduled THEN the system SHALL persist the change with idempotency protection
6. WHEN a task is moved THEN the system SHALL provide a 5-second undo option that restores exact original date/time
7. WHEN undo is triggered THEN the system SHALL restore the task to its precise original timestamp

### Requirement 5

**User Story:** As a grower, I want to apply task templates from playbooks so that I can quickly set up cultivation schedules based on proven growing methods.

#### Acceptance Criteria

1. WHEN a user selects a playbook template THEN the system SHALL generate associated tasks with idempotency protection
2. WHEN tasks are generated from templates THEN the system SHALL link them to the specific plant and strain record
3. WHEN calculating due dates THEN the system SHALL use plant start date or growth stage as anchor point
4. WHEN template tasks are created THEN the system SHALL include default reminder settings from the playbook
5. WHEN bulk shifting is requested THEN the system SHALL provide preview of +/- X days with undo option
6. WHEN partial template creation occurs THEN the system SHALL cleanup incomplete task sets automatically
7. IF template application fails THEN the system SHALL provide clear error messages and complete rollback

### Requirement 6

**User Story:** As a grower, I want my calendar data to work offline so that I can manage tasks even without internet connectivity.

#### Acceptance Criteria

1. WHEN the device is offline THEN the system SHALL allow full read and write access to calendar data via WatermelonDB
2. WHEN tasks are created offline THEN the system SHALL queue changes with maximum queue size limits
3. WHEN pull sync succeeds THEN the system SHALL update last_pulled_at checkpoint atomically
4. WHEN sync conflicts occur THEN the system SHALL use last-write-wins with server updated_at timestamps
5. WHEN server has newer updated_at THEN the system SHALL show conflict badge in UI for needs_review items
6. WHEN sync completes THEN the system SHALL differentially re-plan affected scheduled notifications
7. WHEN deleted items sync THEN the system SHALL process tombstones and remove local records

### Requirement 7

**User Story:** As a grower, I want task completion tracking so that I can monitor my cultivation consistency and identify patterns.

#### Acceptance Criteria

1. WHEN a user completes a task THEN the system SHALL mark it as completed with precise timestamp
2. WHEN a recurring task is completed THEN the system SHALL materialize the next visible instance based on RRULE
3. WHEN viewing completed tasks THEN the system SHALL display completion history with sorting options
4. WHEN a task is overdue THEN the system SHALL provide red color/icon indicators and sort overdue tasks first
5. WHEN a user skips a recurring instance THEN the system SHALL create exception without affecting future occurrences
6. WHEN watering tasks are completed THEN the system SHALL update plant's last_watered_at field
7. WHEN feeding tasks are completed THEN the system SHALL update plant's last_fed_at field

### Requirement 8

**User Story:** As a grower, I want proper permission handling and fallback UX so that I understand when features are limited and how to enable them.

#### Acceptance Criteria

1. WHEN notification permission is missing THEN the system SHALL display persistent banner with "Enable notifications" CTA
2. WHEN user taps enable notifications THEN the system SHALL deep-link to device Settings app
3. WHEN battery optimization is enabled THEN the system SHALL show informational hint without blocking functionality
4. WHEN permissions are granted THEN the system SHALL immediately re-plan all pending notifications
5. WHEN running on devices with aggressive power management THEN the system SHALL provide educational tooltips about potential delays
6. WHEN notification delivery fails THEN the system SHALL track failure metrics for debugging
