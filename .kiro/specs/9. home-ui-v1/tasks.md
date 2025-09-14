# Implementation Plan

- [ ] 1. Set up enhanced tab navigation structure with SDK 54 compliance

  - Confirm project targets Expo SDK 54 / RN 0.81 and follow official upgrade notes (Reanimated v4, platform targets)
  - Create (app)/\_layout.tsx with initialRouteName="index" and screenOptions={{ tabBarHideOnKeyboard: true }}
  - Implement Home, Calendar, Community, Plants, Strains tabs in correct order
  - Configure freezeOnBlur: true for heavy tabs (avoid unmountOnBlur unless state reset needed)
  - Add re-tap scroll-to-top with useScrollToTop(ref) on each scrollable root (FlashList/ScrollView)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 2. Implement shared header with connectivity and sync status

  - Create SharedHeader component that renders ConnectivityBanner and SyncStatus
  - Configure explicit headerStyle.height to prevent layout jank on first paint
  - Set up per-screen header customization via screenOptions
  - Ensure header updates within 1 second of connectivity/sync changes
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 3. Create Community feed with FlashList v2 and proper state handling

  - Implement Community tab with FlashList v2 using stable keyExtractor (remove all size estimate props)
  - Ensure FlashList parent has flex:1 (avoid contentContainerStyle={{flexGrow:1}} to prevent "rendered size not usable" error)
  - Replace spinner with skeleton loading components that timeout after 1.2 seconds
  - Build inline error card component with Retry functionality and localized copy
  - Add empty state component with "Create Post" CTA
  - Implement cursor-based pagination with onEndReachedThreshold ≈ 0.4 and guard double-fetch
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 4. Build Strains browser with search and deep linking

  - Create Strains tab with searchable, paginated list using FlashList v2 (no size estimates, stable keys)
  - Implement search input with ~300ms debounce and non-blocking UI while typing
  - Add offline behavior with cached results and "Showing saved strains" banner
  - Configure app scheme in app.json/app.config for deep linking to /strains/[id] (Expo Router auto-routes)
  - Create skeleton, empty state, and inline error handling for Strains
  - Consider lazy image thumbnails for large lists to protect scroll performance
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [ ] 5. Implement Plants inventory tab

  - Create Plants tab screen with basic structure
  - Add FlashList v2 for plant inventory display (mirror Community/Strains list patterns)
  - Implement skeleton → empty → inline error states consistent with other tabs
  - Consider lazy image thumbnails for large plant lists to protect scroll performance
  - _Requirements: 1.1_

- [ ] 6. Add Create Post functionality and navigation

  - Create "Create" button in Community headerRight that navigates to /community/add-post
  - Add "Share update" quick action on Home screen
  - Implement modal presentation for add-post screen in (modals) group with presentation: 'modal'
  - Ensure all Create buttons have proper accessibilityRole and localized labels
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 7. Set up Settings access from Home header

  - Add Settings icon in Home headerRight that navigates to /settings
  - Move Settings screen outside of tabs structure to keep tab bar consistent
  - Ensure Settings icon has accessible label "Open Settings" and ≥44×44pt touch target
  - _Requirements: 12.1, 12.2, 12.3_

- [ ] 8. Enhance Home screen with overview content

  - Update Home screen to show light overview/dashboard content (snapshot + quick actions)
  - Add "Share update" quick action component
  - Implement proper loading and error states for Home content
  - Avoid realtime subscriptions on Home (reserve for Community to save battery)
  - _Requirements: 4.2_

- [ ] 9. Update existing UI components for FlashList v2 compatibility

  - Modify src/components/ui/list.tsx to support FlashList v2 patterns (remove all size estimates)
  - Add stable keyExtractor support and ensure parent containers have flex: 1
  - Update EmptyList component to support skeleton loading with timeout
  - Add minimal ListErrorComponent for inline error handling with Retry and localized copy
  - Verify no contentContainerStyle={{flexGrow:1}} usage that could cause sizing issues
  - _Requirements: 3.4, 8.1_

- [ ] 10. Implement theme integration and performance optimizations

  - Ensure all new components respect useThemeConfig dark/light settings
  - Avoid per-frame class toggling during theme changes
  - Implement proper tab bar styling with theme colors
  - Track and log P95 Home TTI ≤ 1200ms (e.g., home_tti_ms metric)
  - Verify lists maintain 60fps scrolling performance
  - _Requirements: 5.1, 5.2, 8.1, 8.2, 8.3_

- [ ] 11. Add comprehensive internationalization support

  - Create new translation keys for tabs, community, and strains in en.json and de.json
  - Implement ICU plurals for count-based strings (e.g., 0/1/n posts, strains)
  - Ensure Expo Router tab labels are localized
  - Test language hot-swapping functionality at runtime
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 12. Implement accessibility compliance

  - Add proper accessibilityRole, labels, and hints to all interactive elements
  - Enforce touch targets ≥ 48×48dp (Android) and ≥ 44×44pt (iOS) for all tappables (tabs, header icons, CTAs)
  - Implement readable text for screen readers in empty and error states
  - Test logical focus order across tabs with VoiceOver/TalkBack validation
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 13. Add comprehensive error handling

  - Implement friendly, localized error messages without stack traces
  - Ensure stable UI layout during error states (no content jumps)
  - Add Retry functionality to all error states with proper logging
  - Include screen and network context in error logs
  - _Requirements: 9.1, 9.2, 9.3_

- [ ] 14. Set up optional analytics tracking

  - Implement analytics events for community_view, community_empty, community_error, home_view
  - Add strain_search analytics with query and results_count
  - Create noop implementation when analytics is disabled (ensure tree-shaking works)
  - Ensure zero runtime crashes when analytics is not configured
  - _Requirements: 10.1, 10.2_

- [ ] 15. Create comprehensive test suite
  - Write unit tests for tab navigation, state preservation, and keyboard behavior
  - Test re-tap scroll-to-top and tab bar hides on keyboard (frequent regressions)
  - Test Community feed loading, empty, error, and pagination states
  - Test Strains search debouncing and deep linking functionality
  - Add deep-link tests for /strains/[id] after configuring app scheme
  - Test shared header connectivity and sync status updates
  - Test accessibility compliance with VoiceOver/TalkBack
  - _Requirements: 1.2, 1.3, 2.2, 3.1, 3.2, 3.3, 11.5, 7.1, 7.2, 7.3_
