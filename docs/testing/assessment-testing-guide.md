# AI Photo Assessment Testing Guide

## Overview

This guide covers the comprehensive test suite for the AI Photo Assessment feature (Spec 19). The test suite includes unit tests, integration tests, and end-to-end tests to ensure quality, performance, and reliability.

## Test Coverage

### Unit Tests

#### Quality Assessment Engine (`src/lib/quality/analyzers/__tests__/`)

- **Blur Detection** (`blur.test.ts`)
  - Tests Laplacian variance computation
  - Validates sharp vs. blurred image detection
  - Verifies threshold sensitivity
  - Coverage: blur detection algorithm, edge cases, performance

- **Exposure Assessment** (`exposure.test.ts`)
  - Tests histogram analysis
  - Validates underexposed/overexposed detection
  - Verifies acceptable range scoring
  - Coverage: exposure metrics, threshold handling, edge cases

- **White Balance** (`white-balance.test.ts`)
  - Tests chromaticity deviation computation
  - Validates color cast detection (warm, cool, green LED)
  - Verifies severity classification
  - Coverage: white balance algorithm, LED grow light scenarios

- **Composition** (`composition.test.ts`)
  - Tests plant matter detection
  - Validates center coverage computation
  - Verifies framing issue detection
  - Coverage: composition scoring, coverage thresholds

#### ML Inference Engine (`src/lib/assessment/__tests__/`)

- **Confidence Calibration** (`confidence-calibration.test.ts`)
  - Tests temperature scaling
  - Validates calibration config
  - Verifies multi-prediction aggregation
  - Coverage: majority vote, highest confidence, threshold logic

- **Result Aggregation** (`result-aggregation.test.ts`)
  - Tests multi-photo aggregation
  - Validates aggregation methods
  - Verifies Unknown/OOD handling
  - Coverage: aggregation rules, edge cases

- **Execution Providers** (`execution-providers.test.ts`)
  - Tests XNNPACK/NNAPI/CoreML detection
  - Validates CPU fallback
  - Verifies provider logging
  - Coverage: delegate selection, fallback logic

- **Model Manager** (`model-manager.test.ts`)
  - Tests model loading and validation
  - Validates checksum verification
  - Verifies version tracking
  - Coverage: model lifecycle, integrity checks

#### Action Plan Generator (`src/lib/assessment/__tests__/`)

- **Action Plan Generator** (`action-plan-generator.test.ts`)
  - Tests all 12 assessment classes
  - Validates safety guardrails
  - Verifies contextual adjustments
  - Coverage: plan generation, validation, context adaptation

#### Image Processing (`src/lib/assessment/__tests__/`)

- **Image Processing** (`image-processing.test.ts`)
  - Tests EXIF stripping
  - Validates thumbnail generation
  - Verifies image size computation
  - Coverage: EXIF removal, privacy compliance

#### Offline Queue (`src/lib/assessment/__tests__/`)

- **Offline Queue Manager** (`offline-queue-manager.test.ts`)
  - Tests request queuing
  - Validates retry logic
  - Verifies queue status tracking
  - Coverage: offline handling, exponential backoff

### Integration Tests

#### E2E Assessment Flow (`src/lib/assessment/__tests__/integration/`)

- **E2E Assessment Flow** (`e2e-assessment-flow.test.ts`)
  - Tests complete flow: capture → quality → inference → results → actions
  - Validates multi-photo aggregation
  - Verifies contextual action plan generation
  - Coverage: full assessment pipeline, performance requirements

### End-to-End Tests (Maestro)

#### Assessment E2E (`.maestro/assessment/`)

- **Complete Assessment Flow** (`assessment-flow.yaml`)
  - Tests camera capture
  - Validates quality gating
  - Verifies result display
  - Coverage: user journey, UI interactions

## Running Tests

### Unit Tests

```bash
# Run all assessment tests
pnpm test src/lib/assessment

# Run quality analyzer tests
pnpm test src/lib/quality/analyzers

# Run specific test file
pnpm test src/lib/quality/analyzers/__tests__/blur.test.ts

# Run with coverage
pnpm test src/lib/assessment -- --coverage
```

### Integration Tests

```bash
# Run integration tests
pnpm test src/lib/assessment/__tests__/integration

# Run E2E assessment flow
pnpm test e2e-assessment-flow.test.ts
```

### Maestro E2E Tests

```bash
# Run assessment E2E tests
maestro test .maestro/assessment/assessment-flow.yaml

# Run on specific device
maestro test --device "Pixel 6a" .maestro/assessment/assessment-flow.yaml
```

## Test Requirements Mapping

### Requirement 2.1: Performance (p95 latency ≤ 5s cloud / ≤ 3.5s device)

- **Tests**: `e2e-assessment-flow.test.ts` (performance requirements section)
- **Coverage**: Latency benchmarks, processing time validation

### Requirement 3.1: Action Plan Generation

- **Tests**: `action-plan-generator.test.ts`, `e2e-assessment-flow.test.ts`
- **Coverage**: Plan generation, task creation, safety guardrails

### Requirement 6.4: Model Accuracy (per-class ≥60%, overall ≥75%)

- **Tests**: `confidence-calibration.test.ts`, `result-aggregation.test.ts`
- **Coverage**: Calibration validation, aggregation logic

### Requirement 7.1: Offline Queue Management

- **Tests**: `offline-queue-manager.test.ts`
- **Coverage**: Request queuing, sync logic, retry handling

### Requirement 9.4: Telemetry and Metrics

- **Tests**: `assessment-analytics.test.ts`, `assessment-telemetry-service.test.ts`
- **Coverage**: Metrics collection, privacy-safe logging

### Requirement 10.1: Model Lifecycle Management

- **Tests**: `model-manager.test.ts`, `model-validation.test.ts`
- **Coverage**: Checksum validation, version tracking, delivery

## Coverage Goals

- **Unit Tests**: >80% coverage on core modules
- **Integration Tests**: Complete flow coverage
- **E2E Tests**: Critical user journeys

### Current Coverage

```bash
# Generate coverage report
pnpm test:assessment -- --coverage --coverageReporters="text" "html"

# View HTML report
open coverage/index.html
```

## Adding New Tests

### Unit Test Template

```typescript
import { functionToTest } from '../module';

describe('Module Name', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('function name', () => {
    it('should handle normal case', () => {
      const result = functionToTest(input);
      expect(result).toBeDefined();
    });

    it('should handle edge case', () => {
      const result = functionToTest(edgeInput);
      expect(result).toMatchExpectedBehavior();
    });
  });
});
```

### Integration Test Template

```typescript
import { ComponentA } from '../component-a';
import { ComponentB } from '../component-b';

describe('Integration: Feature Name', () => {
  it('should complete full flow', async () => {
    // Step 1: Setup
    const input = createTestInput();

    // Step 2: Execute
    const intermediateResult = await ComponentA.process(input);
    const finalResult = await ComponentB.process(intermediateResult);

    // Step 3: Verify
    expect(finalResult).toMatchExpectedOutput();
  });
});
```

## Test Data and Fixtures

### Synthetic Test Images

Quality analyzer tests use programmatically generated test images:

- **Sharp images**: Checkerboard patterns for high Laplacian variance
- **Blurred images**: Smooth gradients for low variance
- **Exposure variants**: Controlled brightness distributions
- **Color casts**: Simulated LED grow light scenarios

### Mock Model Responses

ML inference tests use predefined mock responses:

- **High confidence**: 0.85-0.95 range
- **Low confidence**: 0.50-0.69 range
- **Multiple predictions**: For aggregation testing

## Performance Testing

### Latency Benchmarks

```typescript
it('should complete within latency budget', async () => {
  const startTime = Date.now();

  await performAssessment();

  const duration = Date.now() - startTime;
  expect(duration).toBeLessThan(3500); // 3.5s for device inference
});
```

### Memory Monitoring

```typescript
it('should handle large images without OOM', async () => {
  const largeImage = createMockImage(1920, 1080);

  const result = await processImage(largeImage);

  expect(result).toBeDefined();
  // Memory usage tracked via profiling tools
});
```

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Assessment Tests

on:
  pull_request:
    paths:
      - 'src/lib/assessment/**'
      - 'src/lib/quality/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm test:assessment -- --coverage
      - uses: codecov/codecov-action@v3
```

## Troubleshooting

### Common Issues

1. **Mock not working**: Ensure `jest.clearAllMocks()` in `beforeEach`
2. **Async timeout**: Increase Jest timeout for slow tests
3. **Coverage gaps**: Check for untested edge cases
4. **Flaky tests**: Add proper cleanup in `afterEach`

### Debug Tips

```typescript
// Enable verbose logging
process.env.DEBUG = 'assessment:*';

// Log intermediate results
console.log('Intermediate result:', JSON.stringify(result, null, 2));

// Use Jest's --verbose flag
pnpm test --verbose
```

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Maestro Documentation](https://maestro.mobile.dev/)
- [GrowBro Testing Standards](../testing/standards.md)
