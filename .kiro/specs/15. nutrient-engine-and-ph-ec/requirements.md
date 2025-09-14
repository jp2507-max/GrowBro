# Requirements Document

## Introduction

The Nutrient Engine and pH/EC feature provides GrowBro users with comprehensive feeding management capabilities. This system enables users to create and follow feeding templates based on their growing medium and plant phase, track pH and EC levels with automated alerts, and receive intelligent guidance for nutrient deficiencies and toxicities. The feature combines templated feeding schedules with real-time monitoring and rule-based diagnostics to help growers optimize their plant nutrition.

## Technical Definitions

- **EC Units**: EC (mS/cm) is the canonical stored unit. PPM is displayed as a conversion with user-selectable scale (ppm500/NaCl or ppm700/442), showing active scale wherever ppm appears (e.g., "1,000 ppm [500]")
- **Temperature Compensation**: All EC readings require temperature capture and normalize to EC@25°C (ATC). System tracks whether values came ATC-corrected by meter or corrected in-app
- **pH Targets**: Default soilless substrate pH band ~5.4–6.4; playbooks may override by medium/strain/stage
- **Source Water**: Baseline EC@25°C, alkalinity mg/L as CaCO₃, hardness, with high alkalinity (>~100 mg/L) triggering pH drift warnings

## Requirements

### Requirement 1

**User Story:** As a grower, I want to select feeding templates based on my growing medium and plant phase, so that I can follow proven nutrient schedules without guesswork.

#### Acceptance Criteria

1. WHEN a user creates a new grow THEN the system SHALL present feeding template options based on selected medium (soil, coco, hydro, etc.)
2. WHEN a user selects a growing medium THEN the system SHALL display available feeding templates for that medium
3. WHEN a user selects a plant phase (seedling, vegetative, flowering, flush) THEN the system SHALL adjust the feeding template accordingly
4. WHEN a feeding template is applied THEN the system SHALL generate a schedule of feeding tasks with specific nutrient ratios and concentrations
5. IF a user has multiple strains THEN the system SHALL allow per-strain feeding adjustments within the same medium template
6. WHEN templates are created THEN they MUST specify target bands (not single points) for pH and EC@25°C, per stage and medium, with defaults aligned to soilless norms
7. WHEN template is applied THEN the system SHALL capture reservoir volume to compute dose guidance and create measurement checkpoints alongside feeding tasks
8. WHEN schedules need adjustment THEN the system SHALL support bulk shift of template schedules (±N days) with undo capability

### Requirement 2

**User Story:** As a grower, I want to log pH and EC measurements with target ranges and deviation alerts, so that I can maintain optimal growing conditions and catch issues early.

#### Acceptance Criteria

1. WHEN a user logs pH measurements THEN the system SHALL store the value with timestamp and associated grow/plant
2. WHEN a user logs EC measurements THEN the system SHALL store temp_c, atc_on, ec_raw, and ec_25c with UI displaying both raw and normalized values
3. WHEN pH or EC values are outside target ranges THEN the system SHALL trigger immediate deviation alerts (local notification within ≤5s when app is foreground/background)
4. WHEN target ranges are exceeded THEN the system SHALL provide correction playbook suggestions (CalMag addition, flush procedures, etc.)
5. WHEN measurements are logged THEN the system SHALL display historical trends (7/30/90 day views) with shaded target bands and annotations for reservoir changes
6. IF measurements show consistent deviations THEN the system SHALL suggest feeding template adjustments
7. WHEN last calibration > X days or temp ≥28°C THEN the system SHALL label reading "low confidence" with info badge
8. WHEN user provides stock concentration and reservoir volume THEN the system MAY compute conservative stepwise additions to return EC into band with safety disclaimers
9. WHEN calibration data is available THEN the system SHALL track meter calibration logs (pH 4/7/10; EC 1.413/12.88 mS/cm) with slope/offset and nudge users when stale

### Requirement 3

**User Story:** As a grower, I want rule-based classification of nutrient toxicities and deficiencies, so that I can quickly identify and address plant health issues.

#### Acceptance Criteria

1. WHEN plant symptoms are reported or detected THEN the system SHALL apply rule-based classification considering history + measurements + source-water alkalinity to avoid false positives
2. WHEN a deficiency is classified THEN the system SHALL provide specific nutrient recommendations and feeding adjustments
3. WHEN a toxicity is classified THEN the system SHALL recommend flush procedures and feeding schedule modifications
4. WHEN multiple symptoms are present THEN the system SHALL prioritize the most likely causes based on feeding history and measurements
5. IF AI photo assessment is available AND confidence ≥ threshold THEN AI SHALL take precedence; otherwise show both rule and AI hypotheses with rationale
6. WHEN corrections are applied THEN the system SHALL track effectiveness and suggest template refinements
7. WHEN confidence <70% THEN the system SHALL include disclaimers and "Get second opinion" CTA to community
8. WHEN resolution outcomes are provided THEN the system SHALL track helpful/not helpful feedback to refine thresholds

### Requirement 4

**User Story:** As a grower, I want strain-specific and medium-specific feeding adjustments, so that I can optimize nutrition for different plant varieties and growing setups.

#### Acceptance Criteria

1. WHEN a user selects a strain THEN the system SHALL allow customization of base feeding templates
2. WHEN strain-specific adjustments are made THEN the system SHALL preserve the base template while applying modifications
3. WHEN multiple strains are grown in the same medium THEN the system SHALL manage separate feeding schedules per strain
4. WHEN adjustments prove successful THEN the system SHALL offer to save them as custom strain profiles
5. IF feeding history shows consistent patterns THEN the system SHALL suggest automatic strain-specific optimizations
6. WHEN user deviates from template repeatedly AND outcomes are positive THEN the system SHALL prompt to save custom strain profile and optionally publish privately across grows
7. WHEN strain adjustments are made THEN the system SHALL provide per-strain target band offsets (e.g., EC band +0.2 mS/cm in late flower) rather than forking entire templates

### Requirement 5

**User Story:** As a grower, I want integrated feeding task management with my calendar system, so that feeding schedules align with my overall grow management workflow.

#### Acceptance Criteria

1. WHEN feeding templates are applied THEN the system SHALL create calendar tasks for each feeding event
2. WHEN feeding tasks are due THEN the system SHALL send notifications with specific nutrient instructions including units resolved to user preferences (EC primary; ppm shows active scale)
3. WHEN feeding tasks are completed THEN the system SHALL log the feeding event and update the schedule
4. WHEN pH/EC measurements are required THEN the system SHALL include measurement reminders in feeding tasks
5. WHEN measured values are out of band THEN the system SHALL propose edits to next 1-3 feeding tasks (dilute, hold feed, adjust pH) and ask for confirmation before bulk-updating
6. WHEN app starts THEN the system SHALL rehydrate local notifications and maintain deterministic behavior offline

### Requirement 6

**User Story:** As a grower, I want offline access to feeding schedules and measurement logging, so that I can maintain my feeding routine even without internet connectivity.

#### Acceptance Criteria

1. WHEN feeding templates are downloaded THEN the system SHALL store complete schedules locally for offline access
2. WHEN measurements are logged offline THEN the system SHALL queue them for sync with LWW (server timestamps authoritative) and de-duplicate by (plant_id, measured_at, meter_id)
3. WHEN feeding tasks are completed offline THEN the system SHALL update local schedules and sync changes later
4. WHEN correction playbooks are accessed THEN the system SHALL provide offline guidance for common issues
5. WHEN critical alerts are triggered offline THEN the system SHALL display locally and mirror to server at next sync with "delivered_at_local" stamp
6. WHEN images are captured THEN the system SHALL store on filesystem (URI in DB) and include in outbox without blocking text data sync

<!-- Review (Req6 lines 96–101): For 6.2 de-duplication, add a tolerance bucket and a server-side unique guard to avoid near-duplicate collisions. Suggested approach:
  - Use a server UNIQUE index on (plant_id, meter_id, date_trunc('second', measured_at_utc)) and accept an optional client-sent idempotency_key to make retries safe.
  - Offline uploader should bucket candidate duplicates within ±1s before enqueueing; on conflict at insert, apply LWW with server timestamps authoritative.
  - Keep delivered_at_local (6.5) as a separate field; queue media separately so text sync is never blocked (6.6).
-->

### Requirement 7

**User Story:** As a grower, I want feeding data integration with harvest tracking, so that I can correlate nutrition management with final yield and quality outcomes.

#### Acceptance Criteria

1. WHEN harvest data is recorded THEN the system SHALL correlate feeding history with yield metrics
2. WHEN feeding adjustments are made THEN the system SHALL track their impact on plant development
3. WHEN grows are completed THEN the system SHALL generate feeding performance reports computing % time within target bands by stage, median time-to-correction, and correlation with yield/quality proxies (with caveats)
4. WHEN successful feeding patterns are identified THEN the system SHALL suggest them for future grows
5. IF feeding issues correlate with harvest problems THEN the system SHALL highlight these patterns for learning
6. WHEN patterns are identified THEN the system SHALL surface insights (e.g., persistent high pH during veg linked with issues) and include "apply learnings to next grow" button that seeds template tweaks

### Requirement 8

**User Story:** As a grower, I want source water profile management and calibration tracking, so that I can maintain measurement accuracy and understand my baseline growing conditions.

#### Acceptance Criteria

1. WHEN setting up grows THEN the system SHALL capture source water profile (baseline EC@25°C, alkalinity mg/L as CaCO₃, hardness, last test date)
2. WHEN alkalinity > ~100 mg/L CaCO₃ THEN the system SHALL trigger "pH drift likely" warning and show link to mitigation guidance
3. WHEN calibrating meters THEN the system SHALL store calibration logs with points, slope, offset, temperature, and performed date
4. WHEN calibration becomes stale THEN the system SHALL nudge users to recalibrate
5. WHEN annual reminder triggers THEN the system SHALL prompt to update source water testing with checklist link
6. WHEN all dosing/diagnosis content is displayed THEN it SHALL be phrased as educational guidance, not product promotion

## Data Model Additions

### Core Tables

**ph_ec_readings**

- id, plant_id?, reservoir_id?, measured_at, ph, ec_raw, ec_25c, temp_c, atc_on, ppm_scale, meter_id?, note, created_at, updated_at

**reservoirs**

- id, name, volume_l, medium, target_ph_min/max, target_ec_min/max_25c, ppm_scale, source_water_profile_id, playbook_binding

**source_water_profiles**

- id, name, baseline_ec_25c, alkalinity_mg_per_l_caco3, hardness_mg_per_l, last_tested_at

**calibrations**

- id, meter_id, type(ph|ec), points[], slope, offset, temp_c, performed_at

## Test Plan Requirements

### Unit Handling Tests

1. EC↔ppm conversion with 500/700 scales; mid-grow scale switches preserve historical data labels
2. Temperature compensation: verify EC normalization to 25°C across 15–30°C inputs
3. Ensure ATC readings aren't double-corrected when meter provides pre-corrected values

### Calibration Workflow Tests

1. Require stabilization time during calibration process
2. Block/flag readings if calibration age > threshold
3. Store and validate slope/offset values within acceptable ranges

### Target Validation Tests

1. Defaults reflect soilless pH 5.4–6.4 ranges
2. Playbook overrides are respected and applied correctly
3. Medium-specific targets are properly applied

### Alkalinity Guardrail Tests

1. With alkalinity > ~100 mg/L CaCO₃, trigger "pH drift likely" warning
2. Show appropriate mitigation help links
3. Validate alkalinity impact calculations
