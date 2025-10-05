# Playbook Test Suite Summary

This document provides an overview of the comprehensive test suite created for the Guided Grow Playbooks feature (Task 17).

## Test Coverage Overview

### 1. RRULE Unit Tests ✅

**Location:** `src/lib/rrule/generator.test.ts` (existing) + `src/lib/rrule/rrule.test.ts` (existing)

**Coverage:**

- ✅ Daily recurrence patterns
- ✅ Weekly recurrence patterns with BYDAY
- ✅ Custom RRULE generation
- ✅ RRULE validation (RFC 5545 compliance)
- ✅ DST boundary handling (spring/fall transitions)
- ✅ Timezone-aware calculations
- ✅ Multiple timezone support (US Pacific, Europe/Berlin, UTC)
- ✅ Error handling for invalid patterns

**DST Test Vectors:**

- Spring forward (US Pacific): March 9, 2025
- Fall back (US Pacific): November 2, 2025
- Spring forward (Europe/Berlin): March 30, 2025
- Fall back (Europe/Berlin): October 26, 2025

**Status:** PASSING (existing tests cover DST boundaries)

### 2. Notification Tests ✅

**Location:** `src/lib/notifications/playbook-notification-scheduler.test.ts` (existing)

**Coverage:**

- ✅ Channel creation (Android)
- ✅ Exact alarm permissions (Android 12+)
- ✅ Inexact alarm scheduling (default)
- ✅ Exact alarm scheduling with fallback
- ✅ Notification cancellation
- ✅ Notification rescheduling
- ✅ Rehydration on app start
- ✅ Delivery tracking and metrics
- ✅ Error handling

**Manual Testing Required:**

- Device matrix testing (Pixel 6, Moto G, iPhone SE/13)
- Doze mode testing (Android)
- Low Power Mode testing (iOS)
- Battery Saver mode testing
- Airplane mode recovery
- Force stop recovery (Android)

**Test Guide:** `src/lib/notifications/__tests__/notification-matrix.test.md`

**Status:** PASSING (automated tests), MANUAL TESTING REQUIRED (device matrix)

### 3. Sync Integration Tests ✅

**Location:** `src/lib/__tests__/playbook-sync-integration.test.ts`

**Coverage:**

- ✅ Offline playbook application
- ✅ Offline schedule shifting
- ✅ Offline task customization
- ✅ Sync on reconnection
- ✅ Conflict resolution (Last-Write-Wins)
- ✅ Conflict diff generation
- ✅ User conflict resolution
- ✅ Undo sync operations
- ✅ Idempotency keys
- ✅ Performance with large datasets
- ✅ Batch operations
- ✅ Error handling and retries
- ✅ Exponential backoff

**Status:** CREATED (needs mocks to be implemented)

### 4. Schema Validation Tests ✅

**Location:** `src/lib/playbooks/__tests__/schema-validation.test.ts`

**Coverage:**

- ✅ JSON Schema 2020-12 compliance
- ✅ Valid playbook schemas (minimal, complete, all task types)
- ✅ Invalid schema rejection (missing fields, invalid formats)
- ✅ UUID format validation
- ✅ Setup enum validation
- ✅ Locale pattern validation
- ✅ Reminder time format validation (HH:mm)
- ✅ Phase enum validation
- ✅ Task type enum validation
- ✅ RRULE string validation
- ✅ Edge cases (empty steps, many steps, complex RRULEs)

**Status:** CREATED (needs Ajv dependency)

### 5. Accessibility Tests ✅

**Location:** `src/lib/accessibility/__tests__/touch-target-validation.test.ts`

**Coverage:**

- ✅ Platform-specific minimums (44pt iOS, 48dp Android)
- ✅ Single target validation
- ✅ Batch target validation
- ✅ Playbook-specific components (cards, buttons, checkboxes)
- ✅ Error reporting with testID
- ✅ Summary reports
- ✅ Edge cases (zero, negative, decimal dimensions)

**Status:** CREATED (needs touch-target utility implementation)

### 6. FlashList Performance Tests ✅

**Location:** `src/lib/utils/__tests__/flashlist-performance.test.tsx`

**Coverage:**

- ✅ Rendering performance (100, 1000, 5000 items)
- ✅ Memory usage monitoring
- ✅ Scroll performance with rapid updates
- ✅ Auto-sizing without estimatedItemSize (FlashList v2)
- ✅ Variable item heights
- ✅ Playbook timeline with 1000+ tasks
- ✅ Phase-grouped tasks
- ✅ Filtered task views
- ✅ Render count tracking
- ✅ Frame drop measurement (60 FPS target)
- ✅ Edge cases (empty, single item, large items)

**Performance Targets:**

- 100 items: < 1 second
- 1000 items: < 2 seconds
- 5000 items: < 5 seconds
- Frame time: < 16.67ms (60 FPS)
- Frame drops: < 20% of updates

**Status:** CREATED (needs React Native Testing Library setup)

### 7. E2E Offline Workflow Test ✅

**Location:** `.maestro/playbooks/offline-workflow.yaml`

**Test Flow:**

1. Login and create test plant
2. **Offline:** Apply playbook → verify tasks generated
3. **Offline:** Shift schedule +3 days → verify shift applied
4. **Offline:** Customize 5 tasks → verify edited badges
5. **Offline:** Complete 10 tasks → verify completion
6. **Offline:** Verify offline indicator and queued changes
7. **Online:** Reconnect → wait for sync
8. **Online:** Verify all changes persisted
9. **Online:** Logout/login → verify changes on "second device"
10. Cleanup

**Status:** CREATED (needs Maestro setup and manual execution)

## Test Execution

### Unit Tests

```bash
# Run all playbook tests
pnpm test src/lib/playbooks

# Run RRULE tests
pnpm test src/lib/rrule

# Run notification tests
pnpm test src/lib/notifications

# Run sync tests
pnpm test src/lib/__tests__/playbook-sync-integration.test.ts

# Run accessibility tests
pnpm test src/lib/accessibility

# Run performance tests
pnpm test src/lib/utils/__tests__/flashlist-performance.test.tsx
```

### E2E Tests

```bash
# Run Maestro offline workflow
maestro test .maestro/playbooks/offline-workflow.yaml

# Run on specific device
maestro test --device "Pixel 6" .maestro/playbooks/offline-workflow.yaml
```

### Manual Tests

Follow the guide in `src/lib/notifications/__tests__/notification-matrix.test.md` for device matrix testing.

## Dependencies Required

### For Schema Validation Tests

```bash
pnpm add -D ajv ajv-formats
```

### For Touch Target Validation

Implement the utility functions in `src/lib/accessibility/touch-target.ts`:

- `MINIMUM_TOUCH_TARGET_SIZE`
- `validateTouchTarget()`
- `validateTouchTargets()`

### For Sync Integration Tests

Implement mock classes:

- `SyncCoordinator`
- `ConflictResolver`

Or update tests to use existing sync implementation.

## Success Criteria

### Definition of Done (from Task 17)

- ✅ RRULE/DST tests pass
- ⏳ Notification matrix succeeds (manual testing required)
- ✅ E2E offline workflow created
- ✅ Performance tests created (60 FPS verification)
- ✅ Sync integration tests created
- ✅ Accessibility tests created
- ✅ Schema validation tests created

### Coverage Targets

- Unit test coverage: ≥80%
- Integration test coverage: ≥70%
- E2E critical paths: 100%
- Accessibility compliance: 100%

## Known Issues / TODOs

1. **Sync Integration Tests:** Need to implement or mock `SyncCoordinator` and `ConflictResolver` classes
2. **Schema Validation Tests:** Need to add `ajv` and `ajv-formats` dependencies
3. **Touch Target Tests:** Need to implement utility functions in `src/lib/accessibility/touch-target.ts`
4. **Notification Matrix:** Requires manual testing on physical devices
5. **E2E Tests:** Require Maestro setup and execution environment

## Next Steps

1. Install missing dependencies (`ajv`, `ajv-formats`)
2. Implement missing utility functions (touch-target validation)
3. Run unit tests and fix any failures
4. Set up Maestro for E2E testing
5. Execute manual notification matrix tests
6. Document test results and coverage metrics

## Test Maintenance

### When to Update Tests

- **RRULE changes:** Update DST boundary tests if timezone handling changes
- **Notification changes:** Update matrix tests if scheduling logic changes
- **Sync changes:** Update integration tests if conflict resolution changes
- **Schema changes:** Update validation tests if playbook schema evolves
- **UI changes:** Update accessibility tests if touch targets change
- **Performance changes:** Update FlashList tests if rendering logic changes

### Continuous Integration

Add to CI pipeline:

```yaml
- name: Run Unit Tests
  run: pnpm test --coverage

- name: Run E2E Tests
  run: maestro test .maestro/playbooks/

- name: Check Coverage
  run: pnpm test:coverage-check
```

## References

- [RFC 5545 (iCalendar)](https://tools.ietf.org/html/rfc5545)
- [rrule.js Documentation](https://github.com/jakubroztocil/rrule)
- [FlashList v2 Documentation](https://shopify.github.io/flash-list/)
- [Maestro Documentation](https://maestro.mobile.dev/)
- [JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema)
- [WCAG 2.1 Touch Target Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
