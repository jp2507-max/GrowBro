# Design Document: UI Refinement and Visual QA

## Overview

This design document outlines the architecture and implementation approach for a comprehensive UI refinement and Visual QA system for GrowBro. The system will integrate automated visual regression testing, design system compliance validation, accessibility auditing, cross-platform consistency checks, performance monitoring, and comprehensive reporting into the existing development workflow.

The solution leverages React Native ecosystem tools including Storybook for component isolation, Detox for E2E testing with screenshot capabilities, ESLint plugins for static analysis, and performance monitoring libraries to create a robust quality assurance pipeline.

## Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Development Environment"
        A[Developer Code Changes] --> B[Storybook Stories]
        B --> C[Local Testing]
    end

    subgraph "CI/CD Pipeline"
        D[PR Created] --> E[Lint & Static Analysis]
        E --> F[Unit Tests]
        F --> G[A11y Testing]
        G --> H[Visual Regression Tests]
        H --> I[Performance Tests]
        I --> J[Report Generation]
    end

    subgraph "Testing Infrastructure"
        K[Device Matrix]
        L[Baseline Storage]
        M[Artifact Storage]
        N[Performance Metrics DB]
    end

    subgraph "Quality Gates"
        O[Design Review Gate]
        P[Baseline Approval Gate]
        Q[Performance Budget Gate]
    end

    A --> D
    H --> K
    H --> L
    I --> N
    J --> M
    J --> O
    J --> P
    J --> Q
```

### Component Architecture

The system consists of several interconnected components:

1. **Storybook Integration Layer**: Component isolation and story management
2. **Visual Testing Engine**: Screenshot capture and comparison
3. **Accessibility Auditing Engine**: WCAG compliance validation
4. **Performance Monitoring Engine**: Runtime performance metrics collection
5. **Design System Validator**: Token compliance enforcement
6. **Cross-Platform Consistency Checker**: Platform-specific validation
7. **Reporting Engine**: Comprehensive quality reports
8. **CI/CD Integration Layer**: Workflow orchestration

## Components and Interfaces

### 1. Storybook Integration Layer

**Purpose**: Provides component isolation and story management for comprehensive testing coverage.

**Key Components**:

- **Story Generator**: Automatically generates required stories for components
- **Addon Manager**: Manages Storybook addons for accessibility, viewport, and interactions
- **Story Validator**: Ensures all required component states are covered

**Interface**:

```typescript
interface StoryConfig {
  component: React.ComponentType;
  requiredStates: ComponentState[];
  propMatrix: PropCombination[];
  a11yNotes: AccessibilityNote[];
  tokenMapping: TokenMapping;
}

interface ComponentState {
  name: string;
  props: Record<string, any>;
  description: string;
  isRequired: boolean;
}
```

**Integration Points**:

- React Native components via Storybook React Native
- Design system tokens via NativeWind configuration
- Accessibility testing via @storybook/addon-a11y

### 2. Visual Testing Engine

**Purpose**: Captures screenshots and performs visual regression testing across device matrix.

**Key Components**:

- **Screenshot Orchestrator**: Manages screenshot capture across devices and configurations
- **Baseline Manager**: Handles baseline storage, versioning, and approval workflows
- **Diff Engine**: Performs visual comparisons using SSIM and pixel-diff algorithms
- **Quarantine Manager**: Handles flaky test detection and management

**Interface**:

```typescript
interface VisualTestConfig {
  deviceMatrix: DeviceConfig[];
  locales: string[];
  themes: Theme[];
  textScales: number[];
  ignoredRegions: Region[];
}

interface ScreenshotResult {
  deviceId: string;
  locale: string;
  theme: Theme;
  textScale: number;
  imagePath: string;
  metadata: ScreenshotMetadata;
}

interface ComparisonResult {
  ssimScore: number;
  pixelDiffPercentage: number;
  passed: boolean;
  diffImagePath?: string;
  quarantined: boolean;
}
```

**Integration Points**:

- Detox for device screenshot capture
- jest-image-snapshot for comparison algorithms
- GitHub API for baseline approval workflows
- Cloud storage for baseline and artifact management

### 3. Accessibility Auditing Engine

**Purpose**: Validates WCAG compliance and React Native accessibility best practices.

**Key Components**:

- **Contrast Analyzer**: Validates color contrast ratios in light and dark themes
- **Touch Target Validator**: Ensures proper touch target sizes per platform
- **Screen Reader Validator**: Checks accessibility labels, roles, and focus order
- **Dynamic Type Validator**: Tests layouts at various text scales

**Interface**:

```typescript
interface AccessibilityAudit {
  componentId: string;
  violations: A11yViolation[];
  score: number;
  recommendations: string[];
}

interface A11yViolation {
  type: 'contrast' | 'touch-target' | 'screen-reader' | 'dynamic-type';
  severity: 'blocker' | 'major' | 'minor';
  element: string;
  description: string;
  remediation: string;
}
```

**Integration Points**:

- eslint-plugin-react-native-a11y for static analysis
- @storybook/addon-a11y for runtime testing
- react-native-accessibility-engine for comprehensive auditing

### 4. Performance Monitoring Engine

**Purpose**: Measures and monitors UI performance metrics in release builds.

**Key Components**:

- **Render Time Profiler**: Measures time-to-interactive and render performance
- **Animation Profiler**: Monitors frame rates and dropped frames
- **Memory Profiler**: Tracks memory usage and garbage collection
- **List Performance Profiler**: Specialized testing for large lists and scrolling

**Interface**:

```typescript
interface PerformanceMetrics {
  timeToInteractive: number;
  renderTime: number;
  frameRate: FrameRateMetrics;
  memoryUsage: MemoryMetrics;
  scrollPerformance?: ScrollMetrics;
}

interface FrameRateMetrics {
  averageFps: number;
  droppedFramesP95: number;
  jsFrameTimeP95: number;
}

interface PerformanceBudget {
  timeToInteractiveMax: number;
  droppedFramesP95Max: number;
  jsFrameTimeP95Max: number;
  gcPauseMax: number;
}
```

**Integration Points**:

- @shopify/react-native-performance for render timing
- Sentry Performance for production monitoring
- React Native DevTools for profiling data
- Custom performance probes for specific metrics

### 5. Design System Validator

**Purpose**: Enforces design system compliance and token usage.

**Key Components**:

- **Token Validator**: Ensures only approved design tokens are used
- **Style Analyzer**: Detects inline styles and hardcoded values
- **Typography Validator**: Enforces approved text variants
- **Coverage Reporter**: Tracks token usage across components

**Interface**:

```typescript
interface DesignSystemViolation {
  file: string;
  line: number;
  column: number;
  property: string;
  value: string;
  suggestedToken: string;
  severity: 'error' | 'warning';
}

interface TokenCoverage {
  componentId: string;
  usedTokens: string[];
  missingTokens: string[];
  coveragePercentage: number;
}
```

**Integration Points**:

- Custom ESLint rules for token enforcement
- eslint-plugin-react-native/no-inline-styles
- NativeWind configuration for token mapping
- Storybook documentation generation

### 6. Cross-Platform Consistency Checker

**Purpose**: Validates UI consistency across iOS and Android platforms.

**Key Components**:

- **Layout Comparator**: Compares layout hierarchy and spacing
- **Platform Adaptation Validator**: Ensures proper platform-specific implementations
- **Safe Area Validator**: Validates edge-to-edge and insets handling
- **Responsive Layout Tester**: Tests across different screen sizes and orientations

**Interface**:

```typescript
interface PlatformConsistencyResult {
  screenId: string;
  platforms: PlatformResult[];
  inconsistencies: Inconsistency[];
  intentionalDifferences: IntentionalDifference[];
}

interface Inconsistency {
  type: 'layout' | 'spacing' | 'content' | 'safe-area';
  description: string;
  platforms: string[];
  severity: 'major' | 'minor';
}
```

**Integration Points**:

- Detox for cross-platform screenshot capture
- Platform-specific testing configurations
- Safe area and insets validation utilities

### 7. Reporting Engine

**Purpose**: Generates comprehensive quality reports with trends and actionable insights.

**Key Components**:

- **Report Generator**: Creates HTML reports with visualizations
- **Trend Analyzer**: Tracks quality metrics over time
- **Issue Tracker Integration**: Creates and manages GitHub issues
- **Notification System**: Alerts stakeholders of quality regressions

**Interface**:

```typescript
interface QualityReport {
  timestamp: Date;
  summary: QualitySummary;
  visualRegression: VisualRegressionReport;
  accessibility: AccessibilityReport;
  performance: PerformanceReport;
  designSystem: DesignSystemReport;
  trends: TrendAnalysis;
}

interface QualitySummary {
  overallScore: number;
  blockers: number;
  majorIssues: number;
  minorIssues: number;
  regressions: number;
  improvements: number;
}
```

**Integration Points**:

- GitHub API for issue creation and PR comments
- Chart.js for trend visualizations
- CI artifact storage for report hosting
- CODEOWNERS for automatic issue assignment

## PII and Secret Scrubbing

**Purpose**: Ensures all generated artifacts, screenshots, logs, and metadata are sanitized to prevent exposure of sensitive information.

### Sensitive Data Types to Redact

The system must identify and redact the following sensitive data types:

1. **Personally Identifiable Information (PII)**:

   - Email addresses, phone numbers, names
   - Physical addresses, postal codes
   - Date of birth, social security numbers
   - Profile photos, avatars with identifiable faces

2. **Authentication & Security**:

   - API keys, access tokens, refresh tokens
   - Session IDs, JWT tokens, OAuth credentials
   - Passwords, PINs, biometric data
   - Device identifiers (UDID, IMEI)

3. **Financial Information**:

   - Credit card numbers, bank account details
   - Payment processor tokens, transaction IDs
   - Billing addresses, payment methods

4. **Application-Specific Sensitive Data**:
   - User-generated content (grow logs, photos)
   - Location data, GPS coordinates
   - Device-specific identifiers
   - Internal system identifiers

### Artifact Preprocessing Pipeline

**Screenshot Sanitization**:

```typescript
interface ScreenshotSanitizer {
  maskSensitiveRegions(screenshot: Buffer, maskingRules: MaskingRule[]): Buffer;
  blurIdentifiableContent(screenshot: Buffer, confidence: number): Buffer;
  redactTextFields(
    screenshot: Buffer,
    fieldTypes: SensitiveFieldType[]
  ): Buffer;
}

interface MaskingRule {
  selector: string;
  maskType: 'blur' | 'solid' | 'pattern';
  color?: string;
  intensity?: number;
}
```

**Metadata Scrubbing**:

```typescript
interface MetadataScrubber {
  stripExifData(imageBuffer: Buffer): Buffer;
  sanitizeDeviceInfo(metadata: DeviceMetadata): SanitizedDeviceMetadata;
  redactUserIdentifiers(metadata: TestMetadata): SanitizedTestMetadata;
}

interface SanitizedDeviceMetadata {
  platform: string;
  osVersion: string;
  screenResolution: string;
  // Removed: deviceId, serialNumber, advertisingId
}
```

### Log Sanitization Middleware

**Implementation**:

```typescript
class LogSanitizer {
  private sensitivePatterns: RegExp[];
  private replacementTokens: Map<string, string>;

  constructor(config: SanitizationConfig) {
    // Use explicit flags rather than inline mixes. Make email case-insensitive.
    this.sensitivePatterns = [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi, // Email (global + case-insensitive)
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
      /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, // Credit card
      /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, // Bearer tokens (case-insensitive)
      /api[_-]?key['":\s]*[A-Za-z0-9]{20,}/gi, // API keys
      // Custom patterns from config (assumed to be RegExp)
      ...config.customPatterns,
    ];
  }

  sanitizeLog(logEntry: string): string {
    let sanitized = logEntry;

    this.sensitivePatterns.forEach((pattern) => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });

    return sanitized;
  }

  sanitizeObject(obj: any): any {
    // Iterative recursive traversal that preserves Dates, BigInts, Maps, Sets
    // and avoids circular references using a WeakSet of visited objects.
    const visited = new WeakSet();

    const sanitize = (value: any): any => {
      // Primitives
      if (value == null) return value;
      const t = typeof value;

      if (t === 'string') return this.sanitizeLog(value);
      if (t === 'number' || t === 'boolean' || t === 'bigint') return value;

      // Preserve Dates
      if (value instanceof Date) return new Date(value.getTime());

      // Avoid revisiting same object (circular)
      if (t === 'object' || Array.isArray(value)) {
        if (visited.has(value)) return '[Circular]';
        visited.add(value);
      }

      // Arrays
      if (Array.isArray(value)) return value.map((v) => sanitize(v));

      // Maps
      if (value instanceof Map) {
        const m = new Map();
        for (const [k, v] of value.entries()) m.set(k, sanitize(v));
        return m;
      }

      // Sets
      if (value instanceof Set) {
        const s = new Set();
        for (const v of value.values()) s.add(sanitize(v));
        return s;
      }

      // Plain objects
      if (value && typeof value === 'object') {
        const out: any = {};
        for (const [k, v] of Object.entries(value)) {
          if (this.isSensitiveKey(k)) out[k] = '[REDACTED]';
          else out[k] = sanitize(v);
        }
        return out;
      }

      // Fallback
      return value;
    };

    try {
      return sanitize(obj);
    } catch (e) {
      // As a safe fallback, when structuredClone exists we try it and then post-process
      if (typeof structuredClone === 'function') {
        try {
          const cloned = structuredClone(obj);
          return sanitize(cloned);
        } catch (_) {
          // last-resort stringify safe fallback (won't preserve special types)
          try {
            return this.recursiveSanitizeFallback(obj);
          } catch (__) {
            return '[UNSANITIZABLE]';
          }
        }
      }

      return '[UNSANITIZABLE]';
    }
  }

  // Small fallback used only if traversal throws for unexpected hosts
  private recursiveSanitizeFallback(obj: any): any {
    try {
      const sanitized = JSON.parse(JSON.stringify(obj));
      // Best-effort pass to sanitize strings
      const walk = (o: any): any => {
        if (o == null) return o;
        if (typeof o === 'string') return this.sanitizeLog(o);
        if (Array.isArray(o)) return o.map(walk);
        if (o && typeof o === 'object') {
          const r: any = {};
          for (const [k, v] of Object.entries(o)) {
            r[k] = this.isSensitiveKey(k) ? '[REDACTED]' : walk(v);
          }
          return r;
        }
        return o;
      };

      return walk(sanitized);
    } catch (e) {
      throw e;
    }
  }

  private isSensitiveKey(key: string): boolean {
    // Match whole tokens only to avoid substring over-redaction (e.g. 'monkey')
    const sensitiveKeys = new Set([
      'password',
      'token',
      'secret',
      'key',
      'auth',
      'email',
      'phone',
      'ssn',
      'credit',
      'payment',
      'session',
      'cookie',
      'bearer',
      'oauth',
    ]);

    const normalized = (key || '').toLowerCase();
    const tokens = normalized.split(/[^a-z0-9]+/g).filter(Boolean);
    return tokens.some((t) => sensitiveKeys.has(t));
  }
}
```

### Configuration and Retention Rules

**Configuration Flags**:

```typescript
interface PIIScrubingConfig {
  enabled: boolean;
  strictMode: boolean; // Fail builds if PII detected

  // Opt-in toggles
  enableScreenshotMasking: boolean;
  enableLogSanitization: boolean;
  enableMetadataStripping: boolean;

  // Access controls
  rawArtifactAccess: {
    allowedRoles: string[];
    requiresApproval: boolean;
    auditLog: boolean;
  };

  // Retention policies
  retention: {
    sanitizedArtifacts: number; // days
    rawArtifacts: number; // days (shorter)
    auditLogs: number; // days
  };

  // Custom patterns and rules
  customSensitivePatterns: string[];
  maskingRules: MaskingRule[];
  exemptedComponents: string[];
}
```

**Environment-Specific Configuration**:

```typescript
// .env.development
PII_SCRUBBING_ENABLED = false;
PII_SCRUBBING_STRICT_MODE = false;

// .env.staging
PII_SCRUBBING_ENABLED = true;
PII_SCRUBBING_STRICT_MODE = false;

// .env.production
PII_SCRUBBING_ENABLED = true;
PII_SCRUBBING_STRICT_MODE = true;
```

### CI/QA Checklist

**Pre-Artifact Generation**:

- [ ] PII scrubbing middleware is enabled and configured
- [ ] Screenshot masking rules are applied for sensitive components
- [ ] Log sanitization patterns are up-to-date
- [ ] Test data uses only synthetic/anonymized information

**Artifact Validation**:

- [ ] All screenshots have been processed through sanitization pipeline
- [ ] Metadata has been stripped of device-specific identifiers
- [ ] Logs contain no sensitive patterns (automated scan)
- [ ] Raw artifacts are stored with restricted access controls

**Monitoring and Compliance**:

- [ ] PII detection alerts are configured and tested
- [ ] Retention policies are enforced automatically
- [ ] Access to raw artifacts is logged and auditable
- [ ] Regular audits of sanitization effectiveness

### Sentry and Session Replay Configuration

**Sentry Configuration for PII Protection**:

```typescript
// sentry.config.ts
Sentry.init({
  // Disable PII capture
  sendDefaultPii: false,

  // Custom data scrubbing
  beforeSend(event) {
    // Remove sensitive data from event
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }

    // Sanitize breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
        ...breadcrumb,
        data: sanitizeObject(breadcrumb.data),
      }));
    }

    return event;
  },

  // Configure session replay with PII protection
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    new Sentry.Replay({
      // Mask all text content by default
      maskAllText: true,

      // Block specific selectors
      blockSelector: [
        '[data-sensitive]',
        '.user-content',
        '.grow-log-entry',
        'input[type="password"]',
        'input[type="email"]',
      ],

      // Mask additional selectors
      maskSelector: ['.user-avatar', '.profile-info', '.location-data'],
    }),
  ],
});
```

**Session Replay Sanitization**:

```typescript
interface SessionReplayConfig {
  maskAllText: boolean;
  maskAllInputs: boolean;
  blockSelector: string[];
  maskSelector: string[];

  // Custom sanitization
  beforeAddRecordingEvent?: (event: RecordingEvent) => RecordingEvent | null;
}
```

### Integration Points

- **CI Pipeline**: Automated PII scanning before artifact storage
- **Storybook**: Component-level masking rules and sanitization
- **Detox/Maestro**: Screenshot preprocessing with sensitive region masking
- **Sentry**: PII-safe error reporting and session replay configuration
- **GitHub**: Sanitized artifacts in PR comments and checks
- **Storage**: Encrypted storage with access controls and retention policies

This comprehensive PII and secret scrubbing system ensures that all generated artifacts maintain user privacy and security compliance while providing valuable QA insights to the development team.

## Data Models

### Configuration Models

```typescript
interface UIQAConfig {
  devices: DeviceConfig[];
  locales: LocaleConfig[];
  themes: ThemeConfig[];
  textScales: number[];
  performanceBudgets: PerformanceBudget;
  baselineApprovers: string[];
  reportingConfig: ReportingConfig;
}

interface DeviceConfig {
  id: string;
  platform: 'ios' | 'android';
  name: string;
  resolution: Resolution;
  pixelRatio: number;
  safeAreaInsets: SafeAreaInsets;
}
```

### Test Result Models

```typescript
interface TestRun {
  id: string;
  timestamp: Date;
  commitSha: string;
  branch: string;
  status: 'running' | 'passed' | 'failed' | 'quarantined';
  results: TestResult[];
  artifacts: Artifact[];
}

interface TestResult {
  type: 'visual' | 'accessibility' | 'performance' | 'design-system';
  componentId: string;
  status: 'passed' | 'failed' | 'warning';
  details: any;
  artifacts: string[];
}
```

## Error Handling

### Error Categories

1. **Infrastructure Errors**: Device unavailability, network issues, storage failures
2. **Test Execution Errors**: Screenshot capture failures, timeout issues
3. **Comparison Errors**: Baseline missing, comparison algorithm failures
4. **Configuration Errors**: Invalid device configs, missing tokens
5. **Integration Errors**: GitHub API failures, CI/CD pipeline issues

### Error Handling Strategy

```typescript
interface ErrorHandler {
  handleInfrastructureError(error: InfrastructureError): Promise<void>;
  handleTestExecutionError(error: TestExecutionError): Promise<void>;
  handleComparisonError(error: ComparisonError): Promise<void>;
  handleConfigurationError(error: ConfigurationError): Promise<void>;
  handleIntegrationError(error: IntegrationError): Promise<void>;
}

class UIQAErrorHandler implements ErrorHandler {
  async handleInfrastructureError(error: InfrastructureError): Promise<void> {
    // Retry with exponential backoff
    // Fallback to alternative devices/services
    // Alert infrastructure team
  }

  async handleTestExecutionError(error: TestExecutionError): Promise<void> {
    // Retry failed tests once
    // Mark as quarantined if consistently failing
    // Collect debug artifacts
  }
}
```

### Retry and Fallback Mechanisms

- **Screenshot Capture**: Retry once with 30-second timeout, fallback to alternative device
- **Baseline Comparison**: Retry with different comparison algorithms, mark as needs-review
- **Performance Tests**: Retry with clean device state, adjust budgets for low-end devices
- **CI Integration**: Exponential backoff for API calls, graceful degradation for non-critical features

## Testing Strategy

### Unit Testing

- **Component Validators**: Test individual validation logic
- **Comparison Algorithms**: Test SSIM and pixel-diff accuracy
- **Configuration Parsers**: Test config validation and parsing
- **Report Generators**: Test report generation with mock data

### Integration Testing

- **Storybook Integration**: Test story generation and addon functionality
- **Detox Integration**: Test screenshot capture and device interaction
- **CI Pipeline**: Test end-to-end workflow with sample projects
- **GitHub Integration**: Test issue creation and PR comment functionality

### End-to-End Testing

- **Full Pipeline**: Test complete workflow from PR creation to report generation
- **Multi-Device**: Test across full device matrix with real components
- **Performance**: Test performance monitoring with actual app scenarios
- **Error Scenarios**: Test error handling and recovery mechanisms

### Test Data Management

```typescript
interface TestDataManager {
  generateMockComponents(): ComponentConfig[];
  createBaselineFixtures(): BaselineFixture[];
  setupTestDevices(): Promise<DeviceConfig[]>;
  cleanupTestArtifacts(): Promise<void>;
}
```

### Continuous Testing

- **Nightly Runs**: Full device matrix testing with comprehensive reporting
- **PR Testing**: Focused testing on changed components and dependencies
- **Release Testing**: Complete validation before production releases
- **Monitoring**: Continuous performance monitoring in production

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

- Set up Storybook with React Native
- Implement basic screenshot capture with Detox
- Create ESLint rules for design system compliance
- Set up CI pipeline structure

### Phase 2: Core Testing (Weeks 3-4)

- Implement visual regression testing engine
- Add accessibility auditing with eslint-plugin-react-native-a11y
- Create performance monitoring with @shopify/react-native-performance
- Develop basic reporting system

### Phase 3: Advanced Features (Weeks 5-6)

- Add cross-platform consistency checking
- Implement baseline management and approval workflows
- Create comprehensive HTML reports with trends
- Add GitHub integration for issues and PR comments

### Phase 4: Optimization (Weeks 7-8)

- Optimize test execution performance
- Add quarantine management for flaky tests
- Implement advanced error handling and retry logic
- Create comprehensive documentation and training materials

## Design Enhancements and Platform-Specific Considerations

### Platform-Specific Touch Target Standards

The design implements platform-specific touch target validation:

- **iOS**: ≥44×44 pt (Apple HIG compliance)
- **Android**: ≥48×48 dp (Material Design compliance)
- **WCAG 2.2 AA Generic**: ≥24×24 CSS px with spacing exception for web surfaces

### Android 15 Edge-to-Edge Enforcement

With Android 15 (API 35) enforcing edge-to-edge by default, the design includes:

- Automatic edge-to-edge enablement in test configurations
- Insets verification for all screens
- Screenshot capture with translucent system bars
- Merge blocking if critical content overlaps system UI

### Enhanced Screenshot Strategy

**Primary Tool**: Maestro for E2E screenshots on Expo (more predictable device orchestration)
**Secondary Tool**: Detox for white-box React Native hooks when needed
**Comparison Method**:

- SSIM with failureThresholdType: 'percent' at 0.5-1.0%
- Pixelmatch fallback for color accuracy shifts
- Masked dynamic regions (time, counters, system bars, blinking cursors)

### Expanded Locale Matrix

Beyond en/de, includes:

- **Android**: en-XA/ar-XB pseudolocales for expansion and RTL testing
- **iOS**: Pseudolanguages for string expansion validation
- **Requirement**: No clipping or overlap in pseudolocales with 30-40% string expansion

### Dual Storybook Strategy

- **React Native Storybook**: Device testing and screenshot capture
- **React Native Web Storybook**: Published to CI artifacts for browser-based design review with axe-core integration
- **Requirement**: Every component visible in hosted Storybook; axe violations fail CI

### Enhanced Accessibility Auditing

**Contrast Requirements**:

- Text: ≥4.5:1 (normal), ≥3:1 (large text)
- UI components/graphics: ≥3:1
- Theme-aware validation for both light and dark modes

**Touch Target Validation**:

- Platform-specific minimums with hitSlop equivalent support
- WCAG 2.2 2.5.8 compliance with spacing exceptions

**Screen Reader Integration**:

- accessibilityRole, accessibilityLabel, accessibilityHint enforcement
- Focus order and visibility validation
- Screen reader traversal E2E testing

### Performance Monitoring Enhancements

**Measurement Tools**:

- @shopify/react-native-performance for TTI/TTFD measurement
- Sentry Performance with refresh-rate aware thresholds
- FlashList profiler utilities for list performance

**Budgets**:

- TTI cold start mid-tier Android ≤2000ms (measured in release builds with Hermes)
- dropped_frames_p95 ≤1% and js_frame_time_p95 ≤10ms per animation
- List scroll 60fps sustained with performance helper integration

### GitHub Integration Enhancement

**GitHub Checks API**: Replaces inline PR comments with consolidated Checks featuring:

- Images and annotations per story/screen
- Deep links to artifacts, diffs, a11y reports, and performance data
- Pass/fail status per component with actionable feedback
- Single consolidated Check with comprehensive quality gates

### Safe Area and Insets Handling

**Integration**: react-native-safe-area-context hooks (preferred over basic SafeAreaView)
**Testing**: Verify safe area padding/insets on notched devices in portrait and landscape
**Edge-to-Edge**: Validate proper insets with translucent system bars enabled

### Deterministic Testing Environment

**Stability Measures**:

- Seed pseudorandoms and freeze clock during screenshot capture
- Pin font set in app bundle to prevent anti-aliasing drift
- Disable animations or use "Reduce Motion" styled variants
- Pre-render hooks to remove dynamic elements before capture

### Implementation Refinements

**Error Handling**: Enhanced retry logic with exponential backoff for infrastructure failures
**Quarantine Management**: Automatic flaky test detection with tagging system
**Baseline Governance**: Design-review role enforcement with commit SHA tracking
**Artifact Management**: Masked and raw diff storage with 30-day retention

This enhanced design provides a production-ready foundation for comprehensive UI refinement and Visual QA that aligns with current iOS/Android platform standards, WCAG 2.2 guidelines, and modern React Native ecosystem best practices.
