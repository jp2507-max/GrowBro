# Plant Variants Feature Testing Guide

This guide covers all testing procedures for the Plant Variants Browser feature, including unit tests, integration tests, performance tests, and E2E tests.

## Test Structure

```
src/
├── api/strains/__tests__/
│   ├── client.test.ts              # API client tests
│   ├── use-strains-infinite.test.ts # Infinite query hook tests
│   └── utils.test.ts               # Normalization tests
├── components/strains/__tests__/
│   ├── strain-card.test.tsx        # Card component tests
│   ├── strains-list.test.tsx       # List component tests
│   └── filter-modal.test.tsx       # Filter modal tests
└── lib/strains/__tests__/
    ├── use-favorites.test.ts       # Favorites store tests
    ├── accessibility.test.ts       # Accessibility tests
    ├── integration.test.ts         # Integration tests
    ├── performance.test.ts         # Performance tests
    └── navigation.test.tsx         # Navigation tests
```

## Running Tests

### All Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:ci

# Run in watch mode
pnpm test:watch
```

### Specific Test Suites

```bash
# Run only strains tests
pnpm test strains

# Run only integration tests
pnpm test integration

# Run only performance tests
pnpm test performance

# Run only accessibility tests
pnpm test accessibility
```

### Test Coverage

```bash
# Generate coverage report
pnpm test:ci

# View coverage report
open coverage/lcov-report/index.html
```

## Unit Tests

### API Client Tests

Tests for the StrainsApiClient class:

- ✅ URL construction with filters
- ✅ Request headers and authentication
- ✅ Response normalization
- ✅ Error handling
- ✅ Retry logic with exponential backoff
- ✅ Cache management (ETag, memory cache)

```bash
pnpm test src/api/strains/__tests__/client.test.ts
```

### Hook Tests

Tests for React Query hooks:

- ✅ useStrainsInfinite pagination
- ✅ useStrain detail fetching
- ✅ Cache behavior
- ✅ Error states
- ✅ Loading states

```bash
pnpm test src/api/strains/__tests__/use-strains-infinite.test.ts
```

### Component Tests

Tests for UI components:

- ✅ StrainCard rendering
- ✅ StrainsList with FlashList
- ✅ FilterModal interactions
- ✅ Accessibility labels
- ✅ User interactions

```bash
pnpm test src/components/strains/__tests__/
```

### Store Tests

Tests for Zustand stores:

- ✅ Favorites add/remove
- ✅ Persistence with MMKV
- ✅ Sync with Supabase
- ✅ State management

```bash
pnpm test src/lib/strains/__tests__/use-favorites.test.ts
```

## Integration Tests

### Feature Integration

Tests complete feature workflows:

- ✅ Data fetching integration
- ✅ Search and filter integration
- ✅ Infinite scroll integration
- ✅ Favorites integration
- ✅ Performance integration
- ✅ Error recovery integration

```bash
pnpm test src/lib/strains/__tests__/integration.test.ts
```

### Navigation Integration

Tests navigation flows:

- ✅ List to detail navigation
- ✅ Deep linking
- ✅ Tab navigation
- ✅ State preservation
- ✅ Back navigation

```bash
pnpm test src/lib/strains/__tests__/navigation.test.tsx
```

## Performance Tests

### FlashList Performance

Tests list rendering performance:

- ✅ 100 items render time < 500ms
- ✅ 1000 items render time < 1000ms
- ✅ Scroll performance
- ✅ Memory usage

```bash
pnpm test src/lib/strains/__tests__/performance.test.ts
```

### Benchmarks

Performance targets:

- **Time to Interactive**: < 600ms
- **Frame Rate**: 60fps (16.67ms per frame)
- **List Render (100 items)**: < 500ms
- **List Render (1000 items)**: < 1000ms
- **Scroll Handling**: < 50ms
- **Data Normalization (1000 items)**: < 100ms

## Accessibility Tests

### WCAG Compliance

Tests accessibility features:

- ✅ Screen reader labels
- ✅ Touch target sizes (44pt minimum)
- ✅ Color contrast ratios
- ✅ Keyboard navigation
- ✅ Focus management

```bash
pnpm test src/lib/strains/__tests__/accessibility.test.ts
```

### Manual Testing

Use screen readers to verify:

1. **iOS VoiceOver**
   - Enable: Settings > Accessibility > VoiceOver
   - Test all interactive elements
   - Verify announcement order

2. **Android TalkBack**
   - Enable: Settings > Accessibility > TalkBack
   - Test all interactive elements
   - Verify announcement order

## E2E Tests

### Maestro Tests

E2E tests using Maestro:

```bash
# Install Maestro
pnpm install-maestro

# Run E2E tests
pnpm e2e-test
```

### Test Scenarios

1. **Browse Strains**
   - Open strains tab
   - Scroll through list
   - Verify infinite loading

2. **Search Strains**
   - Enter search query
   - Verify results
   - Clear search

3. **Filter Strains**
   - Open filter modal
   - Apply filters
   - Verify filtered results
   - Clear filters

4. **View Strain Detail**
   - Tap strain card
   - Verify detail page loads
   - Navigate back

5. **Manage Favorites**
   - Add strain to favorites
   - View favorites list
   - Remove from favorites

6. **Offline Mode**
   - Enable airplane mode
   - Browse cached strains
   - Verify offline indicator
   - Disable airplane mode

## Manual Testing Checklist

### Functional Testing

- [ ] Browse strains list
- [ ] Infinite scroll loads more items
- [ ] Pull to refresh updates list
- [ ] Search by name works
- [ ] Filters apply correctly
- [ ] Sort options work
- [ ] Strain detail page loads
- [ ] Add/remove favorites
- [ ] Favorites sync to cloud
- [ ] Offline browsing works
- [ ] Deep links work
- [ ] Tab navigation preserves state

### Visual Testing

- [ ] Images load correctly
- [ ] BlurHash placeholders show
- [ ] Badges display properly
- [ ] Typography is readable
- [ ] Colors meet contrast requirements
- [ ] Layout adapts to screen sizes
- [ ] Dark mode works (if applicable)

### Performance Testing

- [ ] List scrolls smoothly (60fps)
- [ ] No frame drops during scroll
- [ ] Images load progressively
- [ ] Search is debounced
- [ ] No memory leaks
- [ ] App remains responsive

### Accessibility Testing

- [ ] Screen reader announces all elements
- [ ] Touch targets are 44pt minimum
- [ ] Focus order is logical
- [ ] Color contrast is sufficient
- [ ] Text scales with system settings
- [ ] Keyboard navigation works

### Error Handling

- [ ] Network errors show appropriate message
- [ ] API errors are handled gracefully
- [ ] Rate limit shows countdown
- [ ] Empty states display correctly
- [ ] Retry functionality works
- [ ] Offline indicator shows

### Device Testing

Test on multiple devices:

- [ ] iPhone SE (small screen)
- [ ] iPhone 14 Pro (notch)
- [ ] iPad (tablet)
- [ ] Android mid-tier (performance)
- [ ] Android low-end (compatibility)

### Network Conditions

Test under various network conditions:

- [ ] Fast WiFi
- [ ] Slow 3G
- [ ] Intermittent connection
- [ ] Offline mode
- [ ] Switching between networks

## Continuous Integration

### GitHub Actions

Tests run automatically on:

- Pull requests
- Commits to main branch
- Release tags

### CI Pipeline

1. **Lint**: ESLint checks
2. **Type Check**: TypeScript compilation
3. **Unit Tests**: Jest tests with coverage
4. **Integration Tests**: Full feature tests
5. **Build**: EAS build for staging

### Coverage Requirements

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

## Debugging Tests

### Debug Single Test

```bash
# Run specific test file
pnpm test src/lib/strains/__tests__/integration.test.ts

# Run specific test case
pnpm test -t "should fetch strains list successfully"
```

### Debug with Breakpoints

```bash
# Run tests in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand
```

Then attach debugger in VS Code or Chrome DevTools.

### View Test Output

```bash
# Verbose output
pnpm test --verbose

# Show console logs
pnpm test --silent=false
```

## Test Maintenance

### Updating Tests

When updating the strains feature:

1. Update relevant test files
2. Run tests locally
3. Verify coverage hasn't decreased
4. Update test documentation

### Adding New Tests

When adding new functionality:

1. Write tests first (TDD)
2. Ensure tests fail initially
3. Implement functionality
4. Verify tests pass
5. Check coverage

### Mocking Guidelines

- Mock external dependencies (API, storage)
- Don't mock internal modules
- Use MSW for API mocking
- Keep mocks simple and maintainable

## Troubleshooting

### Common Issues

**Tests timing out**

- Increase timeout: `jest.setTimeout(10000)`
- Check for unresolved promises
- Verify async/await usage

**Flaky tests**

- Add proper waitFor conditions
- Avoid hardcoded delays
- Use deterministic test data

**Coverage gaps**

- Identify uncovered lines
- Add missing test cases
- Remove dead code

**Performance test failures**

- Run on consistent hardware
- Disable other processes
- Use performance.now() for timing

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Maestro Documentation](https://maestro.mobile.dev/)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
