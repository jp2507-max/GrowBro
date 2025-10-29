# Performance Monitoring Infrastructure

This directory contains the performance monitoring infrastructure for the GrowBro application, implementing comprehensive performance tracking and profiling capabilities.

## Overview

The performance monitoring system integrates:

- **Sentry RN Performance**: Production monitoring with 10% sampling
- **@shopify/react-native-performance**: Deterministic TTI/TTFD measurement
- **React Navigation Instrumentation**: Screen transition tracking
- **Standardized Transaction Names**: Consistent naming across monitoring tools

## Features

### 1. Sentry Performance Monitoring

Configured with production-grade settings:

- 10% sampling rate in production (configurable)
- 100% sampling in development
- React Navigation instrumentation for transition spans
- App start tracking
- Native frames tracking
- Stall tracking

### 2. RN Performance Integration

Provides deterministic performance metrics:

- Time to Interactive (TTI)
- Time to First Display (TTFD)
- Render pass counting
- Component render timing

### 3. Standardized Transaction Names

All performance transactions use consistent naming:

- `app.startup` - Application cold/warm start
- `agenda.scroll` - Calendar/agenda list scrolling
- `navigation.push:<Screen>` - Screen transitions
- `sync.pull` / `sync.push` - Data synchronization
- `ai.infer` - AI photo analysis
- `image.decode` - Image processing

## Usage

### Wrapping Screens with Performance Tracking

```typescript
import { PerformanceTracker } from '@/lib/performance';

export default function MyScreen() {
  return (
    <PerformanceTracker screenName="MyScreen">
      <View>
        {/* Your screen content */}
      </View>
    </PerformanceTracker>
  );
}
```

### Tracking Custom Operations

```typescript
import { trackDBRead, trackNetworkRequest } from '@/lib/performance';

// Track database reads
await trackDBRead('Load user profile', async () => {
  const user = await database.get('users', userId);
  return user;
});

// Track network requests
await trackNetworkRequest('https://api.example.com/data', 'GET', async () => {
  const response = await fetch('https://api.example.com/data');
  return response.json();
});
```

### Using Performance Markers

```typescript
import { PerformanceMarker } from '@/lib/performance';

// Start timing
PerformanceMarker.start('heavy-operation');

// ... perform operation ...

// End timing and log duration
const duration = PerformanceMarker.end('heavy-operation');
console.log(`Operation took ${duration}ms`);
```

### Component Render Performance

```typescript
import { useRenderPerformance } from '@/lib/performance';

function MyComponent() {
  useRenderPerformance('MyComponent');

  return <View>{/* component content */}</View>;
}
```

## Local Profiling

Run the performance profiling script to collect detailed metrics:

```bash
# Profile Android
pnpm perf:profile android

# Profile iOS
pnpm perf:profile ios
```

This command:

1. Launches a release build with performance monitoring enabled
2. Enables Sentry tracing
3. Provides instructions for collecting Perfetto traces (Android) or Instruments data (iOS)
4. Outputs performance artifacts to `performance-artifacts/` directory

## Performance Budgets

The system enforces the following performance budgets:

### Startup

- **Pixel 6a**: TTI ≤ 1.8s (cold start)
- **iPhone 12**: TTI ≤ 1.3s (cold start)

### List Scrolling

- Average FPS ≥ 58
- Dropped frames ≤ 1%
- P95 frame time ≤ 16.7ms
- 0 blank cells

### Navigation

- P95 transition time ≤ 250ms

### Sync

- 500 item sync P95 ≤ 2.5s on LTE

### Gestures

- Input-to-render latency P95 ≤ 50ms

## Files Structure

```
src/lib/performance/
├── constants.ts              # Transaction names, operations, thresholds
├── types.ts                  # TypeScript type definitions
├── navigation-instrumentation.ts  # React Navigation integration
├── rn-performance.ts         # RN Performance utilities
├── index.ts                  # Public API exports
└── __tests__/
    └── constants.test.ts     # Unit tests
```

## CI/CD Integration

Performance metrics are automatically collected in CI/CD:

- RN Performance JSON reports attached to artifacts
- Sentry transaction URLs logged
- Perfetto traces collected on Android
- Performance budgets enforced with automatic failure on violations

## Best Practices

1. **Always wrap screens** with `PerformanceTracker` for automatic TTI/TTFD measurement
2. **Use standardized transaction names** from `PERFORMANCE_TRANSACTIONS` constants
3. **Track critical operations** with appropriate span operations (DB_READ, NETWORK_REQUEST, etc.)
4. **Monitor in development** with 100% sampling to catch issues early
5. **Check Sentry dashboards** regularly for performance trends
6. **Use local profiling** to investigate performance bottlenecks

## Troubleshooting

### Performance data not appearing in Sentry

1. Verify Sentry DSN is configured in environment variables
2. Check that user has granted crash reporting consent
3. Ensure `tracesSampleRate` is > 0
4. Check Sentry dashboard for transaction data

### TTI/TTFD metrics not collected

1. Verify screen is wrapped with `PerformanceTracker`
2. Check that `@shopify/react-native-performance` is installed
3. Run in release mode (performance metrics are more accurate in release builds)

### High performance overhead

1. Reduce `tracesSampleRate` in production (default: 0.1 = 10%)
2. Disable detailed component render tracking if not needed
3. Use `PerformanceMarker` sparingly in hot code paths

## Related Documentation

- [Sentry Performance Documentation](https://docs.sentry.io/platforms/react-native/performance/)
- [@shopify/react-native-performance](https://github.com/Shopify/react-native-performance)
- [React Navigation Performance](https://reactnavigation.org/docs/performance/)
- [Design Document](.kiro/specs/21. performance-and-reliability/design.md)
- [Requirements Document](.kiro/specs/21. performance-and-reliability/requirements.md)
