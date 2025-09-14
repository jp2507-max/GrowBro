# Design Document

## Overview

This design establishes a clean, performant home UI foundation for GrowBro using Expo SDK 54 and Expo Router tabs. The architecture focuses on proper tab navigation with Home, Calendar, Community, Plants, and Strains tabs, shared header components for connectivity/sync status, and robust state management for the Community feed. The design leverages existing components while introducing new patterns for FlashList v2, improved error handling, and accessibility compliance.

## Architecture

### Router Structure

The app uses Expo Router file-based routing with the following structure:

```
src/app/
├── (app)/                    # Authenticated app group (tabs)
│   ├── _layout.tsx          # Tabs navigator with tabBarHideOnKeyboard: true
│   ├── index.tsx            # Home screen (updated)
│   ├── calendar.tsx         # Calendar screen (existing)
│   ├── community.tsx        # Community feed (new)
│   ├── plants.tsx           # Plants inventory (new)
│   └── strains.tsx          # Strains browser (new)
├── (modals)/                # Modal screens group
│   ├── _layout.tsx          # Stack with presentation: 'modal'
│   ├── add-post.tsx         # Create post modal
│   └── sync-diagnostics.tsx # Sync diagnostics modal
├── settings/                # Settings outside tabs
│   └── index.tsx
└── strains/
    └── [id].tsx            # Strain detail screen (auto-linked)
```

### Navigation Flow

- **Primary Navigation**: Bottom tabs (Home, Calendar, Community, Plants, Strains)
- **Secondary Navigation**: Settings accessible via Home header
- **Modal Navigation**: Modals live in `src/app/(modals)` with Stack `screenOptions={{ presentation: 'modal' }}`
- **Deep Links**: Expo Router auto-links screens by file path (e.g., `/strains/[id]`, `/community?postId=...`)

### State Management Architecture

```typescript
// Existing patterns maintained
const { data, isPending, isError, error } = usePosts(); // React Query
const theme = useThemeConfig(); // Zustand theme store
const [networkState, setNetworkState] = useState<NetworkState>(); // Local state
```

## Components and Interfaces

### Core Tab Layout Component

**File**: `src/app/(app)/_layout.tsx`

```typescript
interface TabLayoutProps {
  // Uses Expo Router Tabs component
}

interface SharedHeaderProps {
  showConnectivity?: boolean;
  showSync?: boolean;
  rightComponent?: React.ReactNode;
}
```

**Key Features**:

- Expo Router `<Tabs>` as root component with `tabBarHideOnKeyboard: true` at Tabs level
- Re-tap tab behavior: `useScrollToTop` and `tabPress` handler for scroll-to-top
- Shared header with ConnectivityBanner + SyncStatus and explicit `headerStyle.height`
- Per-screen header customization via `screenOptions`
- Performance options: `freezeOnBlur` and `detachInactiveScreens` for memory optimization

### FlashList v2 Optimizations

**File**: `src/components/ui/list.tsx` (updated)

```typescript
interface FlashListV2Props<T> {
  data: T[];
  renderItem: ({
    item,
    index,
  }: {
    item: T;
    index: number;
  }) => React.ReactElement;
  keyExtractor: (item: T, index: number) => string;
  ListEmptyComponent?: React.ComponentType<{ isLoading: boolean }>;
  ListErrorComponent?: React.ComponentType<{
    error: Error;
    onRetry: () => void;
  }>;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
}

interface ListStateProps {
  isLoading: boolean;
  isEmpty: boolean;
  error?: Error;
  onRetry?: () => void;
}
```

**Enhanced Features**:

- FlashList v2 optimizations (no estimates, stable keys, parent flex:1)
- Skeleton loading states with 1.2s timeout
- Inline error handling with retry functionality
- Cursor-based pagination support with `onEndReachedThreshold ≈ 0.4`

### Community Feed State Management

**File**: `src/app/(app)/community.tsx` (new)

```typescript
interface CommunityFeedState {
  posts: Post[];
  isLoading: boolean;
  isEmpty: boolean;
  error: Error | null;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}

interface FeedActions {
  loadMore: () => void;
  retry: () => void;
  refresh: () => void;
}
```

**Community-Specific Features**:

- Replace spinner with skeleton rows for loading
- Inline error card with Retry button
- Empty state with CTA → Create Post
- Cursor-based pagination with footer spinner only
- Optimistic likes with background reconciliation
- Heavy realtime subscription only on Community tab (not Home)

### Strains Browser Component

**File**: `src/app/(app)/strains.tsx` (new)

```typescript
interface StrainsBrowserState {
  strains: Strain[];
  searchQuery: string;
  isSearching: boolean;
  searchResults: Strain[];
  isOffline: boolean;
  cachedResults: Strain[];
}

interface SearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  debounceMs: number; // ~300ms
}
```

**Strains-Specific Features**:

- Searchable with ~300ms debounce and FlashList v2
- Deep links to `/strains/[id]` (Expo Router auto-links)
- Offline behavior: cache last query results with "Showing saved strains" banner
- No blocking spinners while typing

## Data Models

### Enhanced Post Model

```typescript
interface Post {
  id: string;
  title: string;
  content: string;
  author: User;
  createdAt: string;
  updatedAt: string;
  mediaUrls?: string[];
  tags?: string[];
}
```

### Strain Model

```typescript
interface Strain {
  id: string;
  name: string;
  type: 'indica' | 'sativa' | 'hybrid';
  thcContent?: number;
  cbdContent?: number;
  description: string;
  effects: string[];
  flavors: string[];
  imageUrl?: string;
  genetics?: {
    parent1?: string;
    parent2?: string;
  };
}
```

### Network State Model

```typescript
interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
}

interface SyncState {
  lastSyncAt: number | null;
  pendingChangesCount: number;
  isInFlight: boolean;
  lastError?: Error;
}
```

## Error Handling

### Error Boundary Strategy

```typescript
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

// Per-screen error handling
interface ScreenErrorState {
  type: 'network' | 'data' | 'permission' | 'unknown';
  message: string;
  retryable: boolean;
  onRetry?: () => void;
}
```

### Error Display Patterns

1. **Inline Errors**: For list items and form fields
2. **Banner Errors**: For connectivity issues
3. **Modal Errors**: For critical failures
4. **Toast Errors**: For transient issues

### Localized Error Messages

```typescript
interface ErrorMessages {
  'network.offline': string;
  'network.timeout': string;
  'data.not_found': string;
  'data.load_failed': string;
  'permission.denied': string;
}
```

## Testing Strategy

### Unit Testing Approach

**Test Files**:

- `src/app/(app)/__tests__/tabs-layout.test.tsx`
- `src/app/(app)/__tests__/community.test.tsx`
- `src/app/(app)/__tests__/strains.test.tsx`
- `src/components/ui/__tests__/list-v2.test.tsx`

### Test Scenarios

1. **Tab Navigation**:

   - Tab switching preserves state
   - Keyboard hides tab bar
   - Deep linking works correctly
   - Accessibility roles are present

2. **Community Feed**:

   - Loading states render skeletons
   - Empty states show appropriate messaging
   - Error states provide retry functionality
   - Pagination works without double-fetch

3. **Strains Browser**:

   - Search debouncing works correctly
   - Deep links to strain details function
   - Empty search results handled gracefully

4. **Shared Header**:

   - ConnectivityBanner shows/hides based on network state
   - SyncStatus updates within 1 second
   - Per-screen header customization works

5. **Tab Behavior**:
   - Re-tapping a tab scrolls to top
   - Tab bar hides on keyboard
   - Deep link navigation to `/strains/[id]` and `/community?postId=...` works

### Performance Testing

```typescript
interface PerformanceMetrics {
  homeScreenTTI: number; // Target: ≤ 1200ms P95
  listScrollPerformance: number; // Target: 60fps
  themeChangeLatency: number; // Target: ≤ 100ms
  searchDebounceAccuracy: number; // Target: ~300ms ±50ms
}
```

**Performance Guardrails**:

- P95 Home cold start ≤ 1200ms on mid-tier Android
- Lists maintain 60fps scrolling performance
- Verify SDK 54 (RN 0.81) alignment with Reanimated v4 and new platform targets

### Accessibility Testing

- Screen reader navigation flow with VoiceOver/TalkBack validation
- Touch target size validation (≥ 44×44 pt iOS / ≥ 48×48 dp Android, aiming for WCAG AAA)
- Color contrast compliance
- Focus management across tabs
- ICU plurals for count-based strings (e.g., 0/1/n posts)

## Implementation Notes

### FlashList v2 Migration

**Key Changes from v1**:

- FlashList v2 no longer uses `estimatedItemSize` (or any size estimates)
- Use stable `keyExtractor` and v2 APIs
- Ensure list's parent has `flex: 1` (avoid "rendered size is not usable" error)
- Don't rely on `contentContainerStyle={{flexGrow: 1}}` for general lists
- Consider `useBottomTabBarHeight()` for absolute tab bar layouts

### Expo Router Tabs Configuration

```typescript
// screenOptions for shared header
const sharedScreenOptions = {
  header: ({ route, options }) => (
    <SharedHeader
      title={options.title}
      rightComponent={options.headerRight?.()}
    />
  ),
  headerStyle: { height: 100 }, // Explicit height to avoid async measurement glitches
  tabBarHideOnKeyboard: true, // Set at Tabs level
  freezeOnBlur: true, // Reduce re-renders
  detachInactiveScreens: true, // Memory optimization
};
```

### Theme Integration

```typescript
// Respect existing useThemeConfig
const theme = useThemeConfig();
const tabBarStyle = {
  backgroundColor: theme.colors.background,
  borderTopColor: theme.colors.border,
};
```

### Internationalization Strategy

**New Translation Keys**:

```json
{
  "tabs": {
    "home": "Home",
    "calendar": "Calendar",
    "community": "Community",
    "plants": "Plants",
    "strains": "Strains"
  },
  "community": {
    "empty_state": "No posts yet. Be the first to share!",
    "create_post": "Create Post",
    "load_error": "Failed to load posts. Tap to retry.",
    "loading": "Loading posts..."
  },
  "strains": {
    "search_placeholder": "Search strains...",
    "no_results": "No strains found",
    "empty_state": "No strains available"
  }
}
```

### Analytics Integration

```typescript
interface AnalyticsEvents {
  screen_view: { screen_name: string };
  community_view: { post_count: number };
  community_empty: { user_id?: string };
  community_error: { error_type: string };
  home_view: { widgets_shown: string[] };
  strain_search: { query: string; results_count: number };
}

// Noop implementation when disabled
const analytics = useAnalytics(); // Returns noop if disabled
```

This design maintains compatibility with the existing GrowBro architecture while introducing the new tab structure, enhanced error handling, and performance optimizations required for the Home UI v1 feature.
