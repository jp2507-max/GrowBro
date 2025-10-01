# Implementation Plan

- [x] 1. Set up core data types and utilities
  - Create TypeScript interfaces for Strain, FavoriteStrain, and related types
  - Implement data normalization utilities with unit tests for parsing THC/CBD ranges, yields, and flowering times
  - Add constants for default values, BlurHash placeholders, and error messages
  - _Requirements: 10.1, 10.2, 11.3_

- [x] 2. Implement API client with proxy integration
- [x] 2.1 Create base API client with proper URL handling
  - Write StrainsApiClient class with URL encoding and AbortSignal support
  - Verify and map to actual The Weed DB endpoints (query params vs path params)
  - Add HTTP caching with ETag/If-None-Match and Cache-Control headers
  - Implement truncated exponential backoff with jitter, capped max delay
  - _Requirements: 10.1, 10.2, 10.6_

- [x] 2.2 Add API response normalization
  - Create normalizeStrain function to handle inconsistent API data
  - Implement parsePercentageRange and formatPercentageDisplay with Intl.NumberFormat
  - Add FormatJS polyfills for Hermes compatibility on iOS
  - Add unit tests for all normalization functions with edge cases and locale formatting
  - _Requirements: 10.1, 10.2, 11.3_

- [x] 3. Set up React Query hooks for data fetching
- [x] 3.1 Implement infinite query hook for strains list
  - Create useStrainsInfinite hook with explicit initialPageParam and placeholderData: keepPreviousData
  - Add AbortSignal integration to cancel in-flight requests on query changes
  - Implement truncated exponential backoff with jitter for 429/5xx errors only
  - Add queryClient.ensureInfiniteQueryData for prefetching list pages
  - _Requirements: 1.1, 1.2, 9.4, 9.5, 9.6_

- [x] 3.2 Create single strain detail query hook
  - Implement useStrain hook with 24-hour staleTime
  - Add proper error handling and loading states
  - Create prefetch utilities for detail pages
  - _Requirements: 4.1, 9.5_

- [x] 4. Build WatermelonDB schema and models
- [x] 4.1 Create database schema for favorites and cached strains
  - Define favorites table with strain_id, snapshot, and sync fields
  - Create cached_strains table for offline browsing support
  - Add proper indexing for query performance
  - _Requirements: 5.1, 5.4, 5.5_

- [x] 4.2 Implement WatermelonDB models and repositories
  - Configure Expo config plugin and JSI for dev builds
  - Create Favorite model with JSON snapshot parsing and LWW semantics
  - Implement CachedStrain model with composite indexes for (query_hash, page_number)
  - Add repository pattern for CRUD operations with batch support to avoid N+1 queries
  - _Requirements: 5.1, 5.4, 5.6_

- [x] 5. Create Zustand favorites store with persistence
- [x] 5.1 Implement favorites state management
  - Create useFavorites store with serializable array/object structure for MMKV persistence
  - Add addFavorite, removeFavorite, and isFavorite methods with proper hydration
  - Integrate with WatermelonDB for local persistence with batch operations
  - Add composite indexes for (strain_id) and query performance optimization
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 5.2 Add Supabase sync for authenticated users
  - Implement syncToCloud method for favorites synchronization
  - Add conflict resolution for favorites sync
  - Create background sync on app foreground/network reconnection
  - _Requirements: 5.4, 5.5_

- [x] 6.  Build core UI components with accessibility
- [x] 6.1 Create StrainCard component with expo-image
- Implement memoized StrainCard with proper accessibility labels
- Add expo-image with BlurHash placeholders and caching
- Include race, THC, and difficulty badges with proper styling
- _Requirements: 1.5, 7.1, 7.2, 8.1, 8.2_

- [x] 6.2 Implement FavoriteButton with accessibility states
- Create toggle button with accessibilityRole="togglebutton"
- Add accessibilityState={{ checked }} and descriptive accessibilityHint
- Implement haptic feedback and animation on toggle
- Add accessibilityLiveRegion="polite" for count changes announcements
- _Requirements: 5.1, 5.2, 7.1, 7.2_

- [x] 6.3 Build badge components for strain characteristics
- Create RaceBadge, THCBadge, and DifficultyBadge components
- Implement proper color contrast for WCAG AA compliance
- Add localized number formatting for THC/CBD ranges
- _Requirements: 1.5, 7.4, 8.3_

- [ ] 7. Implement FlashList-based strains listing
- [ ] 7.1 Create StrainsList component with infinite scroll
  - Build FlashList with FlashList v2 patterns (review V2 changes documentation)
  - Add getItemType and overrideItemLayout for constant heights to avoid layout passes
  - Measure real row heights and apply recommended sizing patterns
  - Implement onEndReached with 70% threshold and hasNextPage + maxPages eviction testing
  - _Requirements: 1.1, 1.2, 1.7, 9.1_
  - TODO (follow-up): Align list interaction polish with Plants parallax pattern. Reuse a CustomCellRendererComponent to inject per-item itemY shared values and apply subtle scale (≈0.96) and translateY (~1px) transforms tied to the shared scroll offset. Add an iOS-only blur overlay (expo-blur) behind a feature flag and keep intensity conservative for performance. When finalizing Strains, revisit the Plants screen to ensure both lists feel consistent.

- [ ] 7.2 Add loading states and error handling
  - Create skeleton placeholders for loading states
  - Implement error boundaries with retry functionality
  - Add empty state component for no results
  - _Requirements: 1.3, 2.3, 12.1_

- [ ] 7.3 Integrate search and filter functionality
  - Add debounced search input with 300ms delay
  - Create filter modal with multi-select for effects and flavors
  - Implement filter chips with one-tap clear functionality
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 12.1, 12.2_

- [ ] 8. Build strain detail page with comprehensive information
- [ ] 8.1 Create StrainDetail component with at-a-glance banner
  - Implement detail page with race badge, THC/CBD range, and difficulty
  - Add indoor/outdoor suitability indicators
  - Create expandable description sections with proper typography
  - _Requirements: 4.1, 4.2, 11.1, 11.6_

- [ ] 8.2 Add terpene visualization and growing information
  - Create TerpeneSection with visual bars and aroma tooltips
  - Implement GrowingInfo component with flowering time and yield data
  - Add "Not reported" handling for missing data fields
  - _Requirements: 4.3, 11.2, 11.3_

- [ ] 8.3 Integrate playbook CTA and favorite functionality
  - Add "Use this strain in a playbook" button with Auto/Photo preselection
  - Integrate favorite toggle with proper state management
  - Implement share functionality for strain information
  - _Requirements: 4.5, 5.1, 11.5_

- [ ] 9. Implement search and filtering system
- [ ] 9.1 Create search input with debouncing
  - Build search component with 300ms debounce and AbortSignal cancellation
  - Cancel in-flight queries via AbortSignal when query changes to avoid flicker
  - Add search history and suggestions
  - Implement "Did you mean?" functionality for typos using Levenshtein distance
  - _Requirements: 2.1, 2.2, 12.1_

- [ ] 9.2 Build comprehensive filter modal
  - Create filter interface with race, effects, flavors, and difficulty
  - Add THC/CBD range sliders with qualitative fallbacks
  - Document server-side vs client-side filter combinations with UI banner for partial results
  - Implement saved filter presets with MMKV storage
  - _Requirements: 3.1, 3.2, 3.3, 12.2, 12.4_

- [ ] 9.3 Add sort functionality
  - Implement sort by THC, CBD, popularity, and alphabetical order
  - Add sort direction toggle (ascending/descending)
  - Integrate with API endpoints and client-side fallbacks
  - _Requirements: 12.3_

- [ ] 10. Create favorites management system
- [ ] 10.1 Build favorites list view
  - Create dedicated favorites screen with FlashList
  - Add grid layout option with numColumns support
  - Implement empty state for no favorites
  - _Requirements: 5.3, 5.6_

- [ ] 10.2 Add favorites organization features
  - Implement favorites sorting by date added, name, or THC content
  - Add bulk actions for removing multiple favorites
  - Create favorites export functionality
  - _Requirements: 5.3_

- [ ] 11. Implement offline-first functionality
- [ ] 11.1 Add cached browsing support
  - Implement page caching in WatermelonDB with TTL
  - Create offline indicator when network is unavailable
  - Add cached page navigation with scroll position restoration
  - _Requirements: 1.8, 9.8_

- [ ] 11.2 Build offline favorites management
  - Ensure favorites work completely offline
  - Implement sync queue for offline favorite changes
  - Add conflict resolution for favorites sync
  - _Requirements: 5.6_

- [ ] 12. Add compliance and age-gating features
- [ ] 12.1 Implement age verification system
  - Create age-gate modal with 18+ verification
  - Add local persistence with 12-month re-verification
  - Implement legal disclaimer and privacy policy links
  - _Requirements: 6.1, 6.2, 13.1, 13.2, 13.3_

- [ ] 12.2 Add regional compliance handling
  - Implement conservative mode for restricted regions
  - Add educational-only content filtering per Apple 1.4.3 and Google Play policies
  - Remove commerce links and promotional language completely
  - Create internal policy linter checklist for PR reviews
  - _Requirements: 13.1, 13.4_

- [ ] 13. Implement analytics and monitoring
- [ ] 13.1 Add user interaction tracking
  - Track search terms, filter usage, and result interactions
  - Monitor detail page views and favorite actions
  - Add offline usage pattern analytics
  - _Requirements: 14.1, 14.2_

- [ ] 13.2 Implement performance monitoring
  - Add FlashList performance metrics (FPS, frame drops)
  - Monitor API response times and error rates
  - Track image loading performance and cache hit rates
  - _Requirements: 14.6_

- [ ] 14. Create comprehensive test suite
- [ ] 14.1 Write unit tests for utilities and hooks
  - Test all normalization functions with edge cases
  - Add tests for React Query hooks with MSW mocking
  - Test favorites store state management
  - _Requirements: 14.3_

- [ ] 14.2 Implement component testing
  - Test StrainCard rendering with various data states
  - Add StrainsList interaction and loading state tests
  - Test filter modal functionality and state management
  - _Requirements: 14.4_

- [ ] 14.3 Add E2E testing scenarios
  - Test complete browse, search, and favorite workflows with Detox official setup recipes
  - Add infinite scroll assertions for hasNextPage behavior and maxPages eviction
  - Verify scroll position restoration from cache works correctly
  - Add offline mode testing with network simulation and explicit waits to reduce flakiness
  - Test age-gate and compliance flows
  - _Requirements: 14.5_

- [ ] 15. Performance optimization and polish
- [ ] 15.1 Optimize FlashList performance
  - Fine-tune estimatedItemSize based on actual measurements
  - Implement getItemType for heterogeneous content
  - Add recycleBufferedViews for low-memory devices
  - _Requirements: 1.7, 9.1, 9.7_

- [ ] 15.2 Implement image optimization
  - Add image prefetching for visible-next thumbnails via expo-image Image.prefetch
  - Implement progressive image loading with BlurHash placeholders
  - Use separate URIs for thumbnails (list) vs full images (detail) to maximize cache hits
  - Add conservative LRU limits for low-RAM devices
  - _Requirements: 9.2_

- [ ] 15.3 Add final accessibility improvements
  - Implement dynamic type scaling support up to 200%
  - Add high contrast mode support
  - Test with screen readers and voice control
  - _Requirements: 7.3, 7.4, 7.5_

- [ ] 16. Integration and deployment preparation
- [ ] 16.1 Set up serverless proxy function
  - Create Supabase Edge Function for API proxy with function-level rate limiting
  - Implement ETag/Last-Modified caching and CDN cache headers where safe
  - Add API key protection and request normalization to uniform response format
  - Map actual The Weed DB endpoints and add escape hatch for unknown filters
  - _Requirements: 10.3, 10.4, 10.7_

- [ ] 16.2 Configure environment and deployment
  - Set up environment variables for different stages
  - Configure EAS build profiles for strains feature
  - Add feature flags for gradual rollout
  - _Requirements: 6.3, 6.4_

- [ ] 16.3 Final integration testing
  - Test complete feature integration with existing app
  - Verify navigation and deep linking functionality
  - Conduct performance testing on target devices
  - _Requirements: 9.7, 9.8_
