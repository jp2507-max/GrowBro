# Strains Feature E2E Tests

This directory contains end-to-end tests for the Strains Browser feature using Maestro.

## Test Files

### Core Functionality Tests

- **browse-strains.yaml** - Tests basic browsing with infinite scroll
- **search-strains.yaml** - Tests search functionality with debouncing
- **filter-strains.yaml** - Tests filter modal and state management
- **favorite-workflow.yaml** - Tests adding, viewing, and removing favorites
- **strain-detail.yaml** - Tests comprehensive strain information display

### Compliance & Performance Tests

- **age-gate.yaml** - Tests age verification flow (18+ requirement)
- **infinite-scroll-performance.yaml** - Tests pagination, maxPages eviction, and scroll position restoration
- **offline-mode.yaml** - Tests offline functionality with cached data (requires adb)

### Test Suite

- **strains-test-suite.yaml** - Runs all tests in sequence (except offline-mode)

## Running Tests

### Prerequisites

1. Install Maestro:

   ```bash
   pnpm install-maestro
   ```

2. Build and install the app on a device/emulator:
   ```bash
   pnpm build:development:android
   # or
   pnpm build:development:ios
   ```

### Run Individual Tests

```bash
# Run a specific test
maestro test .maestro/strains/browse-strains.yaml

# Run with specific app ID
APP_ID=com.growbro.dev maestro test .maestro/strains/browse-strains.yaml
```

### Run Full Test Suite

```bash
# Run all strains tests
maestro test .maestro/strains/strains-test-suite.yaml

# Run with environment variables
APP_ID=com.growbro.dev maestro test .maestro/strains/strains-test-suite.yaml
```

### Run Offline Mode Test (Android Only)

The offline mode test requires adb commands and should be run separately:

```bash
# Ensure device is connected
adb devices

# Run offline test
APP_ID=com.growbro.dev maestro test .maestro/strains/offline-mode.yaml
```

## Test Coverage

### Requirement Coverage

These E2E tests cover the following requirements from the spec:

- **Requirement 1**: Browse strains with infinite loading
- **Requirement 2**: Search strains by name
- **Requirement 3**: Filter strains by characteristics
- **Requirement 4**: View detailed strain information
- **Requirement 5**: Save and manage favorites
- **Requirement 6**: Age gate and compliance
- **Requirement 9**: Performance and caching
- **Requirement 14.5**: E2E testing scenarios

### Test Scenarios

1. **Browse & Scroll**
   - Initial load
   - Infinite scroll pagination
   - Scroll position restoration
   - Pull-to-refresh

2. **Search**
   - Search with debouncing
   - Search results display
   - Clear search
   - Empty state handling

3. **Filters**
   - Open filter modal
   - Select race, difficulty, effects, flavors
   - Apply filters
   - Clear filters
   - Filter chips display

4. **Favorites**
   - Add to favorites from detail page
   - View favorites list
   - Remove from favorites
   - Empty state

5. **Detail Page**
   - Banner with at-a-glance info
   - Quick facts
   - Terpene visualization
   - Growing information
   - Expandable sections
   - Playbook CTA

6. **Compliance**
   - Age gate modal on first access
   - Decline handling
   - Confirm and persist (12 months)
   - Compliance banner

7. **Performance**
   - Infinite scroll with hasNextPage
   - maxPages eviction
   - Scroll position restoration
   - Cache hit rates

8. **Offline Mode**
   - Browse cached strains
   - View cached details
   - Manage favorites offline
   - Sync on reconnection

## Debugging Tests

### View Test Execution

```bash
# Run with verbose output
maestro test --debug .maestro/strains/browse-strains.yaml
```

### Record Test Execution

```bash
# Record video of test
maestro test --record .maestro/strains/browse-strains.yaml
```

### Interactive Mode

```bash
# Run Maestro Studio for interactive testing
maestro studio
```

## Known Issues & Limitations

1. **Offline Mode Test**: Requires adb and only works on Android. iOS requires manual airplane mode toggle.

2. **Network Simulation**: Maestro doesn't have built-in network throttling. Use device settings or adb for network simulation.

3. **Timing**: Some tests use `waitForAnimationToEnd` with timeouts. Adjust timeouts if tests are flaky on slower devices.

4. **Test Data**: Tests assume certain strains exist in the database. May need to seed test data.

## CI/CD Integration

To run these tests in CI:

```yaml
# Example GitHub Actions workflow
- name: Run Strains E2E Tests
  run: |
    maestro test .maestro/strains/strains-test-suite.yaml
  env:
    APP_ID: com.growbro.dev
```

## Maintenance

- Update test IDs when component IDs change
- Add new tests for new features
- Keep tests independent and idempotent
- Use explicit waits instead of fixed delays
- Clean up test data after runs
