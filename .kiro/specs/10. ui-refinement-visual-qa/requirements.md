# Requirements Document

## Introduction

This feature focuses on implementing comprehensive UI refinement and Visual QA processes for GrowBro to ensure consistent, polished, and accessible user interfaces across all screens. The goal is to establish systematic visual quality assurance practices that catch UI inconsistencies, accessibility issues, and design deviations before they reach users, ultimately improving the overall user experience and maintaining design system integrity.

## Cross-Cutting Requirements

### Deterministic Test Environment

- **Fixed Configuration**: Date.now frozen, random seeded, fonts embedded in bundle, locale locked (en, de, en-XA, ar-XB), timezone (Europe/Berlin), theme (light/dark), text scale (100% & 130%)
- **Device Matrix**: iOS iPhone SE (375×667), iPhone 12 (1170×2532 @3x), iPhone Pro Max; Android Pixel 6 (1080×2400 @3.5x), high-DPI device (1440×3120)
- **Visual Diff Thresholds**: SSIM ≥ 0.995 OR ≤ 0.1% changed pixels with anti-aliasing tolerance and ignored regions (status bar, clock, battery)
- **Baseline Governance**: Only design-review role members may approve baseline updates; keep last 30 baselines with commit SHA
- **PII Safety**: No real user names/avatars in screenshots; use fixtures only
- **Platform Standards**: Touch targets ≥44pt on iOS, ≥48dp on Android; WCAG AA contrast for text (≥4.5:1 normal, ≥3:1 large) and UI components (≥3:1)
- **Edge-to-Edge Support**: Validate Android 15 (API 35) edge-to-edge and iOS safe areas with proper insets handling
- **Pseudolocales**: Test string expansion (30-40%) with Android en-XA/ar-XB and iOS pseudolanguages for i18n robustness

## Requirements

### Requirement 1

**User Story:** As a developer, I want automated visual regression testing, so that I can catch unintended UI changes during development and ensure visual consistency across app updates.

#### Acceptance Criteria

1. WHEN UI code changes THEN CI SHALL run on device matrix (iPhone SE/12/Pro Max, Pixel 6, high-DPI Android) in light & dark for en/de/en-XA/ar-XB locales
2. WHEN screenshots are compared THEN system SHALL use Detox + jest-image-snapshot with SSIM ≥ 0.995 and anti-aliasing tolerance, masking dynamic regions
3. WHEN diff exceeds threshold THEN CI SHALL post inline PR comment with side-by-side images and block merge with required "Design Review" check
4. WHEN tests pass on default branch THEN baselines SHALL update only with baseline-approved label and store masked diffs by default. Raw diffs MUST NOT be stored unless explicitly approved; when explicitly approved they MUST be encrypted at rest, accessible only via strict access control lists (ACLs), access MUST be logged, and retention SHALL be limited to a short configurable window (for example, 7 days) after which they are deleted. Prefer eliminating raw diffs entirely unless there is a compelling, documented reason.
5. WHEN snapshots fail non-deterministically THEN system SHALL retry once and mark as quarantined with flaky tags for known issues

### Requirement 2

**User Story:** As a designer, I want design system compliance validation, so that I can ensure all UI components follow established design tokens and patterns.

#### Acceptance Criteria

1. WHEN components render THEN system SHALL enforce no inline styles using eslint-plugin-react-native/no-inline-styles and custom token rules with suggested token in error message
2. WHEN violations occur THEN CI SHALL output exact node path (file:line, prop) and the correct token to use instead
3. WHEN new components are added THEN they SHALL include token mapping tables (color/space/typography) and "Don't use" examples in Storybook docs
4. WHEN typography is used THEN only text variants (display, headline, title, body, label) mapped to design tokens SHALL be allowed
5. IF design token deviations are detected THEN merge SHALL be blocked until compliance is achieved

### Requirement 3

**User Story:** As a QA engineer, I want comprehensive accessibility auditing, so that I can ensure the app meets WCAG guidelines and is usable by all users.

#### Acceptance Criteria

1. WHEN contrast is checked THEN automated validation SHALL ensure text/icons meet WCAG AA (≥4.5:1 normal, ≥3:1 large) and UI components (≥3:1) in both light and dark themes
2. WHEN touch targets are analyzed THEN all tap areas SHALL be ≥44pt on iOS and ≥48dp on Android (or hitSlop equivalent) verified by static analyzer and runtime probe
3. WHEN screen reader compatibility is tested THEN each interactive element SHALL have accessibilityRole, accessibilityLabel, and accessibilityHint with proper focus visibility and order
4. WHEN dynamic type is enabled THEN layouts at 130% text scale SHALL not clip or overflow, with Reduce Motion compatibility for major animations
5. WHEN accessibility violations are found THEN CI SHALL output exact story id/element path with remediation snippet and eslint-plugin-react-native-a11y integration

### Requirement 4

**User Story:** As a developer, I want cross-platform UI consistency validation, so that I can ensure the app looks and behaves consistently across iOS and Android platforms.

#### Acceptance Criteria

1. WHEN screens render on iOS and Android THEN layout hierarchy and spacing SHALL match within ±2dp/pt with 100% content parity, allowing platform-native components
2. WHEN platform adaptations are implemented THEN they SHALL follow Material on Android and HIG on iOS with explicit safe-area/insets verification
3. WHEN responsive layouts are tested THEN portrait/landscape at small/medium breakpoints SHALL render without truncation with proper edge-to-edge handling
4. WHEN intentional platform differences exist THEN stories SHALL include "Why different?" notes and platform-intentional tags
5. IF cross-platform inconsistencies are detected THEN system SHALL flag for review with side-by-side comparison including insets verification

### Requirement 5

**User Story:** As a product manager, I want UI performance monitoring, so that I can identify and address performance bottlenecks that affect user experience.

#### Acceptance Criteria

1. WHEN screens load THEN time_to_interactive SHALL be ≤2000ms (cold start mid-tier Android), ≤1200ms warm, measured in release builds with Hermes and Dev Mode OFF
2. WHEN animations play THEN dropped_frames_p95 SHALL be ≤1% per animation with frame_time_js_p95 ≤10ms using @shopify/react-native-performance and Sentry Performance
3. WHEN large lists scroll THEN system SHALL maintain 60fps sustained with on_scroll_js_work_p95 ≤6ms and no GC pause >8ms during fling with 1k mixed media items
4. WHEN performance budgets are exceeded THEN system SHALL flag in CI with per-screen budgets and annotate release with perf regression tags
5. IF violations occur THEN automated perf tickets SHALL be opened with specific metrics, battery saver ON/OFF context, and remediation suggestions

### Requirement 6

**User Story:** As a developer, I want automated UI testing workflows, so that I can integrate visual QA into the development process without manual overhead.

#### Acceptance Criteria

1. WHEN PRs are created THEN system SHALL run: lint → unit → a11y → visual snapshots → perf micro-bench in sequence with Expo Dev Client/Continuous Native Generation for Detox
2. WHEN tests complete THEN system SHALL post single PR summary with pass/fail status, HTML UI QA Report, and links to Detox artifacts (video, screens, logs)
3. WHEN issues are found THEN CI SHALL open GitHub issues auto-tagged to owners based on CODEOWNERS with actionable recommendations
4. WHEN tests pass on main THEN baselines SHALL update only with baseline-approved label and attach changelog of visual deltas
5. WHEN reports are generated THEN they SHALL include annotated diffs, a11y violations with node paths, perf metrics table, and integration with existing Obytes CI scaffolding

### Requirement 7

**User Story:** As a developer, I want component-level visual testing, so that I can validate individual UI components in isolation before integration.

#### Acceptance Criteria

1. WHEN components are developed THEN they SHALL have stories for default, loading, error, disabled, long-content, empty-state, skeleton/shimmer, focus-visible, offline, and RTL variants
2. WHEN critical visual props exist THEN they SHALL be enumerated (intent=primary|secondary|destructive, size=sm|md|lg) and snapshot-tested with @testing-library/react-native a11y queries
3. WHEN dynamic content is used THEN stories SHALL include short/long/multiline and emoji variants with proper text wrapping and error with retry states
4. WHEN component tests fail THEN system SHALL point to exact story id + prop combo and attach visual diff with react-native-accessibility-engine static assertions
5. WHEN components are added THEN they SHALL require at least one Docs story with usage, a11y notes, token table, and required states coverage

### Requirement 8

**User Story:** As a QA engineer, I want comprehensive UI audit reports, so that I can track visual quality metrics and identify improvement areas.

#### Acceptance Criteria

1. WHEN pipelines complete THEN system SHALL generate UI QA Report (HTML) with trend charts for visual_diffs, a11y_violations, perf_budgets_failed, component coverage %, and i18n coverage
2. WHEN issues are detected THEN they SHALL be severity-ranked (Blocker, Major, Minor) with suggested fixes and owner mapping from CODEOWNERS
3. WHEN reports display items THEN each SHALL show before/after thumbnails, links to stories/screens, and trend lines by screen/component
4. WHEN tracking over time THEN rolling 28-day trend SHALL display improvements/regressions with releases auto-annotated and pseudolocale pass rates
5. WHEN reports are published THEN they SHALL be accessible via CI artifacts, integrated with project documentation, and include strings with placeholders/pluralization coverage

## Definition of Done

- All components/screens have Storybook stories covering required states (including skeleton, focus-visible, offline, error with retry)
- Visual/A11y/Perf pipelines green on device matrix (iPhone SE/12/Pro Max, Pixel 6, high-DPI), light/dark, en/de/en-XA/ar-XB at 100% & 130% text scale
- Pseudolocale snapshots (en-XA, ar-XB) pass with no clipping/truncation from 30-40% string expansion
- Edge-to-edge/insets verified on Android 15+ & iOS notch devices with proper safe area handling
- No inline style/token violations; ESLint rules enforced (eslint-plugin-react-native/no-inline-styles, eslint-plugin-react-native-a11y)
- Release-build perf run (Hermes, Dev Mode OFF) meets budgets on Pixel-class device + iPhone class; report attached
- UI QA Report published for latest main commit with i18n coverage and trend analysis; no Blockers open
  -- Baselines updated with approval, commit SHA, and diffs archived with masked diffs by default. Raw diffs MUST only be stored when explicitly approved and, if stored, MUST be encrypted at rest, restricted by strict access controls with logged access, and retained only for a short configurable window (for example, 7 days) or eliminated.
