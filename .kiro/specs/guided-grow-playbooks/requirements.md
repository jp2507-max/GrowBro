# Requirements Document

## Introduction

The Guided Grow Playbooks feature provides new and experienced cannabis growers with structured, step-by-step cultivation schedules tailored to their specific setup and strain type. This feature transforms the complex process of cannabis cultivation into manageable, time-based tasks with built-in flexibility for real-world growing conditions. The system automatically generates calendar tasks from playbook templates using RFC 5545 RRULE standards and allows dynamic adjustments when plans change or issues arise.

## Global Technical Requirements

- **RRULE Standard**: All recurrence patterns SHALL use RFC 5545 RRULE format with timezone-aware date computation and DST handling
- **Notification Reliability**: Local notifications SHALL achieve ≥95% delivery within ±5 minutes on Android (including Doze mode) and iOS
- **Offline-First**: WatermelonDB synchronize() SHALL be the only sync entry point with Last-Write-Wins conflict resolution
- **Performance**: FlashList v2 SHALL maintain 60 FPS on mid-tier Android with 1k+ items
- **Accessibility**: All interactive elements SHALL meet 44pt (iOS) / 48dp (Android) minimum touch targets
- **Internationalization**: All user-facing text SHALL use ICU MessageFormat for proper pluralization and localization
- **Schema Validation**: Playbooks SHALL validate against JSON Schema 2020-12 with CI enforcement
- **Analytics**: Key user actions SHALL emit structured events for product analytics
- **Security**: Community templates SHALL use public-read, owner-write RLS with Supabase Realtime

## Requirements

### Requirement 1

**User Story:** As a new grower, I want to select a playbook that matches my setup (Auto/Photo × Indoor/Outdoor) so that I can get a complete cultivation schedule without having to research every step myself.

#### Acceptance Criteria

1. WHEN a user accesses the playbook selection screen THEN the system SHALL display four baseline playbook options: Auto Indoor, Auto Outdoor, Photo Indoor, and Photo Outdoor
2. WHEN a user selects a playbook THEN the system SHALL display a preview showing phase durations, total weeks, task count, and unit system
3. WHEN a user confirms playbook selection THEN the system SHALL require them to associate it with a specific plant record
4. IF no plant exists THEN the system SHALL guide the user through plant creation and return to selection with plant pre-selected
5. WHEN a playbook is applied THEN the system SHALL enforce one-active-playbook-per-plant constraint
6. WHEN applying a playbook THEN the system SHALL prevent double-apply using idempotency keys
7. WHEN a playbook is applied THEN the system SHALL complete task generation within 200ms to enqueue and 1s to render
8. WHEN a playbook is applied THEN the system SHALL generate all scheduled tasks with appropriate due dates and reminders

### Requirement 2

**User Story:** As a grower, I want the playbook to automatically create calendar tasks with reminders so that I don't miss critical cultivation steps.

#### Acceptance Criteria

1. WHEN a playbook is applied to a plant THEN the system SHALL generate tasks for watering, feeding, pruning, training, and monitoring activities
2. WHEN tasks are generated THEN each task SHALL include a title, description, due date, RRULE recurrence pattern, and default reminder time
3. WHEN generating RRULE patterns THEN the system SHALL use RFC 5545 format (e.g., FREQ=DAILY;INTERVAL=2 for every 2 days)
4. WHEN tasks are created THEN they SHALL be linked to the specific plant and playbook with origin_step_id for tracking
5. WHEN generating tasks THEN the system SHALL set category-specific default reminder times (Watering: 08:00, Monitoring: 20:00 local time)
6. WHEN scheduling reminders THEN the system SHALL use inexact alarms by default with exact alarm opt-in for Android 14+
7. WHEN the app starts THEN the system SHALL rehydrate and re-schedule any future notifications found in the database
8. WHEN notifications are delivered THEN the system SHALL support foreground, background, and deep-link tap handling
9. WHEN under Android Doze mode THEN the system SHALL implement fallback re-scheduling strategies with ±5 minute tolerance

### Requirement 3

**User Story:** As a grower, I want to shift my entire playbook schedule when my grow timeline changes so that all tasks remain properly sequenced without manual adjustment.

#### Acceptance Criteria

1. WHEN a user accesses playbook management THEN the system SHALL provide a "Shift Schedule" option
2. WHEN a user initiates schedule shifting THEN the system SHALL default to future, non-completed tasks with toggle for overdue tasks
3. WHEN a shift amount is entered THEN the system SHALL show preview diff with net date delta per phase and affected task count
4. WHEN previewing shifts THEN the system SHALL warn about collisions with existing reminders
5. WHEN tasks have been manually edited THEN the system SHALL flag them as "do not auto-shift" unless explicitly included
6. WHEN a user confirms the shift THEN the system SHALL update all selected task due dates, reminder times, and RRULE patterns atomically
7. WHEN a shift is applied THEN the system SHALL provide an undo option for exactly 30 seconds
8. WHEN undo is triggered THEN the system SHALL restore all dates, reminders, and RRULE patterns atomically
9. WHEN shifting occurs THEN the system SHALL maintain task dependencies and relative timing between tasks

### Requirement 4

**User Story:** As a grower, I want the app to suggest schedule adjustments when AI detects issues or when I consistently miss tasks so that my playbook stays realistic and effective.

#### Acceptance Criteria

1. WHEN AI diagnosis detects a plant issue THEN the system SHALL evaluate if schedule adjustments are recommended based on remote feature flags
2. WHEN ≥2 tasks are skipped within 7 days OR AI classifier confidence <70% THEN the system SHALL trigger adjustment suggestions
3. WHEN suggesting adjustments THEN the system SHALL present explainable proposals showing which tasks move and why
4. WHEN presenting suggestions THEN the system SHALL allow partial acceptance of proposed changes
5. WHEN a user accepts suggested adjustments THEN the system SHALL apply the changes with confirmation and log the outcome
6. WHEN a user declines suggestions THEN the system SHALL implement 7-day cool-down per root cause
7. WHEN users consistently decline THEN the system SHALL provide "Never suggest for this plant" setting
8. WHEN suggestions are made THEN the system SHALL collect "helpful" votes to improve suggestion quality

### Requirement 5

**User Story:** As a grower approaching harvest, I want access to a trichome check helper so that I can determine the optimal harvest timing based on trichome development.

#### Acceptance Criteria

1. WHEN a user is in the flowering phase THEN the system SHALL make the trichome helper accessible from the plant detail screen
2. WHEN accessing the trichome helper THEN the system SHALL display educational guide: clear (immature), milky/cloudy (peak potency), amber (more sedating trend)
3. WHEN using the helper THEN the system SHALL provide macro photography tips and lighting cautions for accurate assessment
4. WHEN using the helper THEN the system SHALL provide recommended harvest windows for different effects (energetic, balanced, sedating)
5. WHEN a user makes a trichome assessment THEN the system SHALL create time-stamped notes with optional photos
6. WHEN a trichome check is logged THEN the system SHALL offer to nudge harvest tasks ±X days with user confirmation
7. WHEN displaying trichome information THEN the system SHALL include educational disclaimer ("educational, not professional advice")

### Requirement 6

**User Story:** As a grower, I want my playbook data to work offline so that I can access my schedule and make updates even without internet connectivity.

#### Acceptance Criteria

1. WHEN playbooks are applied THEN all generated tasks and schedule data SHALL be stored locally in WatermelonDB
2. WHEN offline THEN users SHALL be able to apply playbooks, customize tasks, shift schedules, and mark tasks complete
3. WHEN offline changes are made THEN the system SHALL queue mutations and mark records with pending_push status
4. WHEN connectivity returns THEN all offline changes SHALL sync via WatermelonDB synchronize() with pullChanges/pushChanges
5. WHEN conflicts occur during sync THEN the system SHALL use Last-Write-Wins resolution with conflict notification UX
6. WHEN conflicts are detected THEN the system SHALL provide "view server version" comparison modal
7. WHEN testing offline functionality THEN the system SHALL pass flight-mode end-to-end tests covering apply → shift → customize → complete → reconnect workflow

### Requirement 7

**User Story:** As a grower, I want to customize playbook tasks and timing so that I can adapt the schedule to my specific growing conditions and preferences.

#### Acceptance Criteria

1. WHEN viewing playbook tasks THEN users SHALL be able to edit task titles, descriptions, due dates, and RRULE patterns
2. WHEN editing tasks THEN the system SHALL maintain origin linkage (tasks.playbook_id, origin_step_id) and show edited badge
3. WHEN tasks are manually edited THEN the system SHALL determine which fields break inheritance from bulk operations
4. WHEN editing tasks THEN users SHALL be able to add custom notes (text only) and modify per-task reminder overrides
5. WHEN customizing playbooks THEN users SHALL be able to add new tasks or remove unnecessary ones
6. WHEN changes are made THEN the system SHALL preserve the link between tasks and the original playbook
7. WHEN N edits are made OR ≥20% of tasks differ THEN the system SHALL offer "Save as template" with validation
8. WHEN major customizations occur THEN the system SHALL offer to save as a custom playbook template

### Requirement 8

**User Story:** As a grower, I want to track my progress through the playbook phases so that I can see how my grow is advancing and what's coming next.

#### Acceptance Criteria

1. WHEN viewing a plant with an applied playbook THEN the system SHALL display current phase (seedling, vegetative, flowering, harvest)
2. WHEN computing phases THEN the system SHALL use rules based on date windows from playbook or completion of key tasks
3. WHEN tasks are completed THEN the system SHALL update phase progress indicators
4. WHEN viewing playbook progress THEN users SHALL see completed, current, and upcoming tasks in FlashList-backed timeline view
5. WHEN rendering timeline THEN the system SHALL maintain 60 FPS performance with 1k+ items and no dropped frames in manual testing
6. WHEN a phase is completed THEN the system SHALL provide a summary of that phase's activities and outcomes
7. WHEN approaching phase transitions THEN the system SHALL notify users of upcoming changes in care requirements

### Requirement 9

**User Story:** As a grower, I want playbooks to include strain-specific guidance so that I can optimize my cultivation approach for different cannabis varieties.

#### Acceptance Criteria

1. WHEN creating a plant record THEN users SHALL be able to specify strain metadata (autoflower/photoperiod, breeder flowering range, sativa/indica lean)
2. WHEN breeder flowering range is provided THEN playbooks SHALL set phase durations accordingly with conservative defaults if missing
3. WHEN strain assumptions are made THEN the system SHALL surface "assumptions" chip to indicate default values used
4. WHEN strain-specific guidance exists THEN tasks SHALL include relevant educational tips and considerations
5. WHEN providing guidance THEN the system SHALL keep content non-commercial and educational without product links
6. WHEN multiple strains are grown THEN each plant SHALL maintain its own customized playbook schedule
7. WHEN strain information is incomplete THEN the system SHALL use conservative defaults with options to refine later

### Requirement 10

**User Story:** As a grower, I want to share successful playbook customizations with the community so that other growers can benefit from proven approaches.

#### Acceptance Criteria

1. WHEN a playbook is significantly customized and successful THEN users SHALL have the option to share it as a community template
2. WHEN sharing playbooks THEN the system SHALL strip all PII and include only normalized steps schema plus author handle
3. WHEN sharing templates THEN users SHALL be able to add license field (e.g., CC-BY-SA) to clarify community reuse terms
4. WHEN sharing playbooks THEN users SHALL be able to add descriptions, growing conditions, and outcome notes
5. WHEN browsing community playbooks THEN users SHALL see ratings, success stories, and growing condition requirements with Realtime updates
6. WHEN managing community templates THEN the system SHALL enforce RLS (owner can delete own templates)
7. WHEN adopting community playbooks THEN users SHALL be able to further customize them for their specific needs
8. WHEN sharing occurs THEN personal plant data and identifying information SHALL be excluded from shared templates

## Cross-Cutting Acceptance Criteria

### RRULE Validation

- WHEN RRULE patterns are created THEN invalid rules SHALL be rejected with localized error messages
- WHEN validating RRULE THEN unit tests SHALL cover daily/weekly/every-N-days and BYDAY combinations
- WHEN processing RRULE THEN the system SHALL handle timezone conversions and DST transitions correctly

### Notification Matrix Testing

- WHEN testing on Moto G-class Android and iPhone SE/8/13 THEN ≥95% of reminders SHALL be delivered within ±5 minutes
- WHEN testing notifications THEN the system SHALL work correctly with screen off, Doze mode, and low power mode
- WHEN notifications fail THEN automated snapshot checks SHALL verify delivery in E2E tests

### Accessibility Requirements

- WHEN designing interactive controls THEN all actionable elements SHALL meet ≥44pt (iOS) / ≥48dp (Android) minimum size
- WHEN implementing UI THEN automated snapshot checks SHALL verify accessibility compliance in E2E tests
- WHEN providing content THEN all user-facing text SHALL include proper focus order and voice labels

### Offline End-to-End Testing

- WHEN testing offline functionality THEN the system SHALL pass flight-mode tests covering: apply playbook offline → shift +3 days → customize 5 tasks → mark 10 complete → reconnect
- WHEN reconnecting after offline changes THEN all changes SHALL be visible on second device after sync completes
- WHEN testing sync THEN the system SHALL handle large datasets (1k+ tasks) and power-saving modes correctly

## Data Schema Requirements

### Playbook Schema (JSON Schema 2020-12)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://canabro.app/schemas/playbook.json",
  "type": "object",
  "required": ["id", "name", "setup", "locale", "steps"],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "name": { "type": "string", "minLength": 1 },
    "setup": {
      "enum": ["auto_indoor", "auto_outdoor", "photo_indoor", "photo_outdoor"]
    },
    "locale": { "type": "string", "pattern": "^[a-z]{2}(-[A-Z]{2})?$" },
    "phaseOrder": {
      "type": "array",
      "items": { "enum": ["seedling", "veg", "flower", "harvest"] }
    },
    "steps": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "phase", "title", "relativeDay", "taskType"],
        "properties": {
          "id": { "type": "string" },
          "phase": { "enum": ["seedling", "veg", "flower", "harvest"] },
          "title": { "type": "string" },
          "descriptionIcu": { "type": "string" },
          "relativeDay": { "type": "integer" },
          "rrule": { "type": "string" },
          "defaultReminderLocal": {
            "type": "string",
            "pattern": "^\\d{2}:\\d{2}$"
          },
          "taskType": {
            "enum": [
              "water",
              "feed",
              "prune",
              "train",
              "monitor",
              "note",
              "custom"
            ]
          },
          "durationDays": { "type": "integer" },
          "dependencies": { "type": "array", "items": { "type": "string" } }
        }
      }
    }
  }
}
```

### Generated Task Schema (Client DB)

```json
{
  "id": "uuid",
  "plant_id": "uuid",
  "playbook_id": "uuid",
  "origin_step_id": "string",
  "title": "string",
  "description": "string",
  "due_date": "YYYY-MM-DD",
  "recurrence_rule": "RRULE string or null",
  "reminder_at": "YYYY-MM-DDTHH:mm",
  "status": "pending|done|skipped",
  "flags": {
    "manualEdited": true,
    "excludeFromBulkShift": false
  }
}
```

## Analytics Events

The system SHALL emit the following structured analytics events:

- `playbook_apply` - When a playbook is applied to a plant
- `playbook_shift_preview` - When user previews schedule shift
- `playbook_shift_apply` - When schedule shift is applied
- `playbook_shift_undo` - When schedule shift is undone
- `playbook_task_customized` - When individual tasks are modified
- `playbook_saved_as_template` - When custom playbook is saved as template
- `ai_adjustment_suggested` - When AI suggests schedule adjustments
- `ai_adjustment_applied` - When user accepts AI suggestions
- `ai_adjustment_declined` - When user declines AI suggestions
- `trichome_helper_open` - When trichome helper is accessed
- `trichome_helper_logged` - When trichome assessment is recorded

## Compliance Requirements

### Content Guidelines

- WHEN providing AI outputs THEN all results SHALL include disclaimer: "educational, not professional advice"
- WHEN displaying trichome information THEN content SHALL remain educational without consumption encouragement
- WHEN sharing community templates THEN content SHALL exclude any commercial product recommendations

### Privacy & Security

- WHEN handling user data THEN minimal PII SHALL be included in sync operations
- WHEN sharing templates THEN personal plant data and identifying information SHALL be stripped
- WHEN implementing RLS THEN per-user isolation SHALL be enforced for private data
- WHEN providing community features THEN shared templates SHALL use public-read, owner-write permissions
