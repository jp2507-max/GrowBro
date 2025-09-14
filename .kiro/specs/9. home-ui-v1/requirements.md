# Requirements Document

## Introduction

This feature establishes a clean base home UI with tab navigation for the GrowBro app using Expo SDK 54. The implementation focuses on creating a robust foundation with proper Expo Router tabs setup, shared header with connectivity and sync status, and comprehensive Community feed states handling. The feature includes full internationalization support (EN/DE) and accessibility compliance while maintaining performance best practices with FlashList v2.

## Requirements

### Requirement 1

**User Story:** As a user, I can switch between the main areas of the app using a bottom tab bar, so that I can easily access Home, Calendar, Community, Plants, and Strains.

#### Acceptance Criteria

1. WHEN the app launches THEN the system SHALL display a bottom tab bar with Home, Calendar, Community, Plants, Strains in that order (no Settings tab)
2. WHEN I tap on any tab THEN the system SHALL navigate to the corresponding screen with preserved state
3. WHEN I re-tap the active tab THEN the system SHALL scroll to top and trigger a light refresh
4. WHEN the keyboard opens THEN the system SHALL hide the tab bar automatically using tabBarHideOnKeyboard: true
5. WHEN the app starts THEN the system SHALL default to the Home tab (index route)
6. WHEN tabs are rendered THEN each tab SHALL have an accessible label, testID, and consistent 24px icons with content descriptions

### Requirement 2

**User Story:** As a user, I want to see connectivity and sync status on each tab, so that I'm always aware of my connection and data sync state.

#### Acceptance Criteria

1. WHEN I'm on any tab screen THEN the system SHALL render a shared header with ConnectivityBanner and SyncStatus components unless headerShown: false is set
2. WHEN connectivity or sync status changes THEN the system SHALL update the header information within 1 second
3. WHEN I click the connectivity banner THEN the system SHALL open a Sync Details screen (not a tab)

### Requirement 3

**User Story:** As a user in Community, I want to understand loading, empty, and error states, so that I know what's happening with my feed data.

#### Acceptance Criteria

1. WHEN the Community feed is loading THEN the system SHALL display skeleton rows (no full-screen spinner) that timeout after 1.2 seconds if data arrives
2. WHEN the Community feed has no data THEN the system SHALL show localized empty copy with a CTA to Create Post
3. WHEN the Community feed encounters an error THEN the system SHALL show a localized inline error card with Retry button using non-blocking layout
4. WHEN the Community feed has data THEN the system SHALL render posts with FlashList v2 using a stable keyExtractor without requiring estimatedItemSize
5. WHEN implementing pagination THEN the system SHALL use cursor-based pagination with footer spinner only and guard against double-fetch using onEndReachedThreshold ≈ 0.4

### Requirement 4

**User Story:** As a user, I want to create posts from Community and Home screens, so that I can share updates easily.

#### Acceptance Criteria

1. WHEN I'm on the Community screen THEN the system SHALL display a "Create" button in the headerRight that navigates to /community/add-post
2. WHEN I'm on the Home screen THEN the system SHALL show a secondary "Share update" quick action
3. WHEN Create buttons are displayed THEN the system SHALL provide accessibilityRole="button" and localized labels

### Requirement 5

**User Story:** As a user, I want the app interface to respect my theme preferences, so that I have a consistent visual experience.

#### Acceptance Criteria

1. WHEN the app renders THEN the system SHALL follow the current theme from useThemeConfig
2. WHEN the theme changes THEN the system SHALL re-render without jank and avoid per-frame class toggling

### Requirement 6

**User Story:** As a user, I want to use the app in English or German, so that I can interact in my preferred language.

#### Acceptance Criteria

1. WHEN the app displays text THEN the system SHALL use localized strings from translations/en.json or translations/de.json
2. WHEN the language changes THEN the system SHALL hot-swap visible text immediately
3. WHEN new UI elements are added THEN the system SHALL include keys in both locales using ICU plurals for counts

### Requirement 7

**User Story:** As a user with accessibility needs, I want proper screen reader support and accessible navigation, so that I can use the app effectively.

#### Acceptance Criteria

1. WHEN interactive elements are rendered THEN the system SHALL specify accessibilityRole, labels, and hints
2. WHEN empty and error components are displayed THEN the system SHALL expose readable text to screen readers
3. WHEN designing touch targets THEN the system SHALL ensure they are ≥ 44pt with logical focus order across tabs

### Requirement 8

**User Story:** As a user, I want the app to perform smoothly without lag or stuttering, so that I have a pleasant user experience.

#### Acceptance Criteria

1. WHEN rendering lists THEN the system SHALL use FlashList v2 best practices with stable keys and recycling enabled without hard dependency on item size estimates
2. WHEN measuring performance THEN the system SHALL achieve P95 home cold start ≤ 1200ms on mid-tier Android and log home_tti_ms
3. WHEN errors or theme changes occur THEN the system SHALL prevent layout shift

### Requirement 9

**User Story:** As a user, I want the app to handle errors gracefully, so that I can continue using the app even when something goes wrong.

#### Acceptance Criteria

1. WHEN an error occurs THEN the system SHALL show friendly, localized error messages without stack traces
2. WHEN errors are displayed THEN the system SHALL maintain stable UI layout during error states
3. WHEN errors are shown THEN the system SHALL include a Retry path and log errors with screen and network context

### Requirement 10

**User Story:** As a product owner, I want optional analytics tracking for user interactions, so that I can understand how users engage with the app.

#### Acceptance Criteria

1. WHEN screens are viewed THEN the system MAY track community_view, community_empty, community_error, and home_view analytics events
2. WHEN analytics is disabled THEN the system SHALL use a noop implementation that prevents runtime errors

### Requirement 11

**User Story:** As a user, I want to browse strains from the Strains tab, so that I can discover and learn about different cannabis strains.

#### Acceptance Criteria

1. WHEN I'm on the Strains tab THEN the system SHALL show a searchable, paginated list using FlashList v2 with a stable keyExtractor
2. WHEN the Strains tab is loading THEN the system SHALL display skeleton on load
3. WHEN no strains are found THEN the system SHALL show localized empty state with "No strains found" message
4. WHEN an error occurs THEN the system SHALL display inline error with Retry button
5. WHEN I use the search input THEN the system SHALL debounce input by ≈300ms with no blocking spinners while typing
6. WHEN I tap a strain THEN the system SHALL open /strains/[id] route that accepts deep links (e.g., growbro://strains/{id})

### Requirement 12

**User Story:** As a user, I want to reach Settings from the Home screen easily, so that I can access app configuration without cluttering the tab bar.

#### Acceptance Criteria

1. WHEN I'm on the Home screen THEN the system SHALL show a Settings icon in headerRight that navigates to /settings
2. WHEN Settings is accessed THEN the system SHALL NOT display it as a tab but as a separate screen
3. WHEN the Settings icon is displayed THEN the system SHALL include an accessible label "Open Settings"
