# Requirements Document

## Introduction

The Strains Browser feature enables users to discover, explore, and save cannabis strain information within the GrowBro app. This feature integrates with "The Weed DB" API to provide comprehensive strain data including genetics, effects, growing characteristics, and detailed descriptions. The feature supports the app's educational mission by helping users make informed decisions about strain selection for their growing activities.

## Requirements

### Requirement 1

**User Story:** As a home grower, I want to browse a comprehensive list of cannabis strains, so that I can discover new varieties suitable for my growing setup and preferences.

#### Acceptance Criteria

1. WHEN the user opens the strains tab THEN the system SHALL display a scrollable list of cannabis strains with infinite loading using FlashList
2. WHEN the user scrolls to 70% of the current content THEN the system SHALL preload the next page of results
3. WHEN strain data is loading THEN the system SHALL display skeleton placeholders to maintain visual consistency
4. WHEN the user pulls down on the list THEN the system SHALL refresh the strain data from the API
5. WHEN each strain is displayed THEN the system SHALL show stable strain_id, name, race badge, THC/CBD range, difficulty level, and thumbnail image
6. WHEN strain data includes synonyms THEN the system SHALL handle naming variants and duplicates appropriately
7. WHEN FlashList renders 1,000+ items THEN the system SHALL maintain ≥55 FPS on mid-tier Android devices with no more than 1 frame >32ms
8. IF the API is unavailable THEN the system SHALL display cached strain data from WatermelonDB when available

### Requirement 2

**User Story:** As a user researching strains, I want to search for specific strains by name, so that I can quickly find information about strains I've heard about.

#### Acceptance Criteria

1. WHEN the user enters text in the search field THEN the system SHALL filter strains by name with a 300ms debounce
2. WHEN search results are returned THEN the system SHALL display matching strains in the same list format
3. WHEN the user clears the search field THEN the system SHALL return to the full strain list
4. WHEN no search results are found THEN the system SHALL display an appropriate empty state message

### Requirement 3

**User Story:** As a grower with specific preferences, I want to filter strains by characteristics like effects, flavors, and grow difficulty, so that I can find strains that match my needs and experience level.

#### Acceptance Criteria

1. WHEN the user opens the filter modal THEN the system SHALL display filter options for type, effects, flavors, grow difficulty, and THC content
2. WHEN the user selects filter criteria THEN the system SHALL apply filters and update the strain list accordingly
3. WHEN multiple filters are applied THEN the system SHALL combine filters appropriately based on API capabilities
4. WHEN the user clears filters THEN the system SHALL return to the unfiltered strain list
5. IF complex filter combinations are not supported by the API THEN the system SHALL fall back to client-side filtering of cached results

### Requirement 4

**User Story:** As a user interested in strain details, I want to view comprehensive information about a specific strain, so that I can understand its characteristics, genetics, and growing requirements.

#### Acceptance Criteria

1. WHEN the user taps on a strain card THEN the system SHALL navigate to a detailed strain view
2. WHEN the strain detail page loads THEN the system SHALL display all available strain information including descriptions, genetics, cannabinoid content, effects, flavors, and growing characteristics
3. WHEN strain data includes numeric values THEN the system SHALL display them with appropriate units and formatting
4. WHEN strain data includes qualitative values THEN the system SHALL display them as labeled pills or badges
5. WHEN strain descriptions are lengthy THEN the system SHALL provide expandable sections for better readability

### Requirement 5

**User Story:** As a user who finds interesting strains, I want to save strains to my favorites, so that I can easily reference them later for growing or research purposes.

#### Acceptance Criteria

1. WHEN the user taps the favorite button on a strain THEN the system SHALL add the strain to their favorites list in WatermelonDB
2. WHEN the user taps the favorite button on a favorited strain THEN the system SHALL remove it from their favorites
3. WHEN the user views their favorites THEN the system SHALL display all saved strains in a dedicated favorites section
4. WHEN the user is authenticated THEN the system SHALL sync favorites to Supabase within 5 seconds of reconnecting
5. WHEN the user reinstalls the app and logs in THEN the system SHALL restore favorites from Supabase
6. WHEN the app is offline THEN the system SHALL still allow users to view and manage their favorited strains from local storage

### Requirement 6

**User Story:** As a user concerned about privacy and app store compliance, I want the app to handle strain information appropriately, so that I can use the feature within legal and policy guidelines.

#### Acceptance Criteria

1. WHEN the user first accesses strain information THEN the system SHALL display an age verification gate requiring confirmation of 18+ age
2. WHEN strain information is displayed THEN the system SHALL focus on educational content without encouraging commerce
3. WHEN API keys are used THEN the system SHALL protect them through serverless proxy functions in production
4. WHEN user data is collected THEN the system SHALL follow privacy-first principles with explicit consent
5. WHEN the feature is used THEN the system SHALL comply with app store policies regarding cannabis-related content

### Requirement 7

**User Story:** As a user with accessibility needs, I want the strains feature to be fully accessible, so that I can navigate and use all functionality regardless of my abilities.

#### Acceptance Criteria

1. WHEN using screen readers THEN the system SHALL provide descriptive labels for all interactive elements
2. WHEN strain cards are displayed THEN the system SHALL include appropriate accessibility states for favorite status
3. WHEN images are shown THEN the system SHALL provide meaningful alt text descriptions
4. WHEN the interface is navigated via keyboard or assistive technology THEN the system SHALL maintain logical focus order
5. WHEN text is displayed THEN the system SHALL ensure sufficient color contrast and readable font sizes

### Requirement 8

**User Story:** As a user in different regions, I want the strains feature to support multiple languages, so that I can use the app in my preferred language.

#### Acceptance Criteria

1. WHEN the app language is set to English THEN the system SHALL display all interface text in English
2. WHEN the app language is set to German THEN the system SHALL display all interface text in German
3. WHEN strain data is displayed THEN the system SHALL use localized formatting for numbers, percentages, and units
4. WHEN error messages occur THEN the system SHALL display them in the user's selected language
5. WHEN the user switches languages THEN the system SHALL update all strain interface text immediately

### Requirement 9

**User Story:** As a user expecting smooth performance, I want the strains feature to load quickly and respond smoothly, so that I can browse strains without frustration.

#### Acceptance Criteria

1. WHEN strain lists are displayed THEN the system SHALL use FlashList with estimatedItemSize and getItemType for optimal scrolling performance
2. WHEN images are loaded THEN the system SHALL cache thumbnails on disk with LRU eviction policy and Cache-Control header respect
3. WHEN search is performed THEN the system SHALL debounce input to avoid excessive API calls
4. WHEN list data is fetched THEN the system SHALL implement 5-minute staleTime and appropriate gcTime for React Query caching
5. WHEN detail data is fetched THEN the system SHALL implement 24-hour staleTime for individual strain details
6. WHEN list cache is fresh (within staleTime) THEN the system SHALL not make network calls and SHALL not trigger background refetch
7. WHEN API errors occur THEN the system SHALL implement exponential backoff with jitter and retry failed requests once before showing error states
8. WHEN tab loads initially THEN the system SHALL achieve time-to-interactive <600ms on mid-tier Android devices

### Requirement 10

**User Story:** As a developer maintaining the app, I want reliable data normalization and API integration, so that the strain data is consistent and the feature is maintainable.

#### Acceptance Criteria

1. WHEN API responses are received THEN the system SHALL normalize data through a serverless proxy with field mapping for race, THC/CBD percentages, terpenes, difficulty, and growing characteristics
2. WHEN API responses have missing THC or inconsistent units THEN the system SHALL normalize to thc_pct_min/max in percentage units with source metadata
3. WHEN strain data is stored THEN the system SHALL include source, source_updated_at, and attribution_url for provenance tracking
4. WHEN "The Weed DB" API is rate-limited or unavailable THEN the system SHALL route through proxy to secondary dataset with graceful degradation
5. WHEN API rate limits are hit (429 response) THEN the system SHALL display visual countdown or "Try again in a minute" message
6. WHEN pagination is implemented THEN the system SHALL define consistent pagination shape and handle empty fields behavior
7. WHEN proxy processes requests THEN the system SHALL implement response compression and caching headers for images

### Requirement 11

**User Story:** As a user browsing strain details, I want comprehensive and actionable information, so that I can make informed decisions about strain selection.

#### Acceptance Criteria

1. WHEN strain detail page loads THEN the system SHALL display at-a-glance banner with race badge, THC/CBD range, difficulty, and indoor/outdoor suitability
2. WHEN terpene data is available THEN the system SHALL show top terpenes with visual bars and tooltips with plain-English aroma descriptions
3. WHEN strain data fields are missing THEN the system SHALL show "Not reported" rather than hiding sections to build trust
4. WHEN strain images are broken or unavailable THEN the system SHALL display placeholder with retry option and image credit when present
5. WHEN strain detail is viewed THEN the system SHALL provide "Use this strain in a playbook" CTA that preselects Auto/Photo and Indoor/Outdoor options
6. WHEN strain descriptions are lengthy THEN the system SHALL provide expandable sections with clear visual hierarchy

### Requirement 12

**User Story:** As a user with specific search needs, I want advanced search and filtering capabilities, so that I can find strains that match my exact requirements.

#### Acceptance Criteria

1. WHEN no search results are found THEN the system SHALL show active filter chips with one-tap clear and suggest nearby matches for typos
2. WHEN multiple filters are applied THEN the system SHALL prefer server-side query parameters and fall back to client-side filtering only on cached page window
3. WHEN sort options are available THEN the system SHALL support sorting by THC, CBD, popularity, and alphabetical order
4. WHEN user applies filters THEN the system SHALL optionally allow saving filter presets using MMKV storage
5. WHEN complex filter combinations exceed API capabilities THEN the system SHALL document trade-offs and implement appropriate fallback behavior

### Requirement 13

**User Story:** As a user in regions with cannabis restrictions, I want appropriate content handling, so that I can use the app within local legal guidelines.

#### Acceptance Criteria

1. WHEN user locale indicates restricted region THEN the system SHALL display limited descriptions with no glamorization and no outbound commerce links
2. WHEN age-gate is not confirmed THEN the system SHALL show no strain content whatsoever
3. WHEN age-gate is confirmed (18+) THEN the system SHALL display educational copy with no commerce links or sales facilitation
4. WHEN user signs out or after 12 months THEN the system SHALL re-display age-gate verification
5. WHEN strain content is displayed THEN the system SHALL comply with Apple's 1.4.3 and Google Play's restricted-content policies

### Requirement 14

**User Story:** As a product team, I want comprehensive analytics and testing coverage, so that we can monitor feature performance and ensure quality.

#### Acceptance Criteria

1. WHEN users interact with strains THEN the system SHALL track search terms, filter counts, result counts, time-to-first-result, detail CTR, and favorite actions
2. WHEN offline usage occurs THEN the system SHALL track offline browsing patterns and API error classifications
3. WHEN unit tests run THEN the system SHALL cover API response mapping/normalization from API to app model
4. WHEN contract tests run THEN the system SHALL verify proxy behavior using MSW or similar tools
5. WHEN E2E tests run THEN the system SHALL cover pagination, pull-to-refresh, filter combinations, and offline flows including flight-mode scenarios
6. WHEN performance tests run THEN the system SHALL measure FPS and JS thread frame drops on long lists with synthetic data
