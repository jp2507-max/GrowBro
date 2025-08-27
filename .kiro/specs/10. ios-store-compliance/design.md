# Design Document

## Overview

**Implementation Details / Responsibility split**:

- TypeScript responsibility (JS/TS pipeline):

  - Produce machine-readable manifest inputs: `privacy-manifests/privacy-manifest-inputs.json` and a human-readable `privacy-manifests/PrivacyInfo.xcprivacy` that list declared APIs, purpose strings, and SDK mapping metadata.
  - Maintain the mapping of source-level API usage to purpose strings and suggested Required‑Reason categories for audit and developer review.
  - Provide auxiliary files used by native validation (e.g. `privacy-manifests/rrapi-symbols.txt` and `privacy-manifests/rrapi-exclusions.txt`).

- Native responsibility (Xcode / prebuild):

  - Detect Required‑Reason API usage from compiled/native symbols and linked frameworks. Detection must run against the binary and frameworks (using `nm`/`otool` or equivalent) rather than source-only heuristics.
  - Validate that `PrivacyInfo.xcprivacy` (and Info.plist entries) include matching declarations and justifications for detected RRAPI symbols.
  - Emit a machine-readable validation report (`ios/privacy-validation/privacy-validation.json`) that CI can consume and that makes the prebuild/pass/fail decision.

- Audit & build behavior:
  - Maintain human-readable mapping documentation generated from TS inputs for reviewers and App Store submission notes.
  - Native validation failures are surfaced during prebuild/build and must fail the build (non‑zero exit) when required-reason declarations are missing or SDK manifests are invalid.

```
iOS Compliance System
├── Privacy Manifest Manager
│   ├── PrivacyInfo.xcprivacy Generator
│   ├── Required Reason API Mapper
│   ├── SDK Inventory Tracker
│   └── App Privacy Sync Validator
├── Age Verification System
│   ├── Age Gate Component
│   ├── Verification Storage (MMKV)
│   ├── App Rating Configuration
│   └── Enhanced Age Rating Handler
├── UGC Moderation Framework
│   ├── Content Filter Engine
│   ├── Report Management System
│   ├── Block/Mute Controls
│   ├── Support Contact Integration
│   └── Cannabis Content Guardrails
├── AI Assessment Compliance
│   ├── Disclaimer Manager
│   ├── Confidence Threshold Handler
│   ├── Medical Claims Prevention
│   └── Review Mode Checker
├── Permission & Account Management
│   ├── Purpose String Manager
│   ├── Account Deletion Flow
│   ├── Login Service Compliance
│   ├── PHPicker Integration
│   └── ATT Compliance Handler
├── EU DSA Compliance
│   ├── Trader Status Validator
│   ├── Contact Information Manager
│   └── EU Storefront Checker
├── Export Control Compliance
│   ├── Encryption Declaration Handler
│   └── CCATS Documentation Manager
└── Compliance Documentation System
    ├── Review Notes Generator
    ├── Screenshot Manager
    ├── Audit Trail Tracker
    └── Submission Checklist Generator
```

### Data Flow

1. **App Launch**: Age verification check → Privacy manifest validation → Permission requests
2. **Content Interaction**: UGC moderation → AI assessment disclaimers → Compliance logging
3. **Account Management**: Privacy-preserving login → Data handling → Deletion capabilities
4. **Submission Preparation**: Documentation generation → Review notes → Compliance validation

## Components and Interfaces

### Privacy Manifest Manager

**Purpose**: Generates and maintains Apple Privacy Manifest files with required-reason API declarations.

**Interface**:

```typescript
interface PrivacyManifestManager {
  generateMainAppManifest(): PrivacyManifest;
  validateSDKManifests(): ValidationResult[];
  mapRequiredReasonAPIs(): RequiredReasonMapping[];
  updateManifestForNewSDK(sdk: SDKInfo): void;
  validateAppPrivacySync(): SyncValidationResult;
  enforceSDKCompliance(): ComplianceResult[];
}

interface PrivacyManifest {
  NSPrivacyTracking: boolean;
  NSPrivacyTrackingDomains: string[];
  NSPrivacyCollectedDataTypes: DataType[];
  NSPrivacyAccessedAPITypes: APIType[];
}

interface RequiredReasonMapping {
  api: string;
  category:
    | 'FileTimestamp'
    | 'SystemBootTime'
    | 'DiskSpace'
    | 'UserDefaults'
    | 'ActiveKeyboards';
  reason: string;
  justification: string;
  sdkSource?: string;
}

interface SDKComplianceCheck {
  name: string;
  hasManifest: boolean;
  hasValidSignature: boolean;
  isOnAppleList: boolean;
  complianceStatus:
    | 'compliant'
    | 'missing_manifest'
    | 'invalid_signature'
    | 'not_required';
}
```

**Implementation Details**:

- TypeScript system generates PrivacyInfo.xcprivacy inputs with proper XML structure
- TypeScript system maintains SDK mapping documentation for audit purposes
- Native prebuild system scans project for Required Reason API usage
- Native prebuild system validates third-party SDK manifests during build

### Age Verification System

**Purpose**: Implements mandatory 18+ age-gating with secure storage and App Store 17+ rating compliance.

**Interface**:

```typescript
interface AgeVerificationSystem {
  showAgeGate(): Promise<boolean>;
  verifyAge(birthDate: Date): boolean;
  storeVerificationStatus(verified: boolean): void;
  checkVerificationStatus(): boolean;
  resetVerification(): void;
  handleEnhancedAgeRating(): void;
}

interface AgeGateComponent {
  title: string;
  description: string;
  minimumAge: number;
  minAppStoreAge: number; // Can be set higher than computed rating
  onVerified: (verified: boolean) => void;
  onDenied: () => void;
}

interface EnhancedAgeRating {
  computedRating: number;
  minimumAge: number;
  cannabisContentDisclaimer: string;
  consumptionPreventionMeasures: string[];
}
```

**Implementation Details**:

- Modal overlay that blocks all app functionality until verified
- Secure storage using react-native-mmkv for verification status
- Clear messaging for users under 18 with app exit options
- Integration with App Store Connect 17+ rating configuration

### UGC Moderation Framework

**Purpose**: Implements all four required UGC safeguards per Apple Guideline 1.2.

**Interface**:

```typescript
interface UGCModerationFramework {
  filterContent(content: UserContent): FilterResult;
  reportContent(contentId: string, reason: string): Promise<ReportResult>;
  blockUser(userId: string): Promise<void>;
  muteUser(userId: string): Promise<void>;
  getSupportContact(): ContactInfo;
  reportAbuse(contactEmail: string): void;
  validateCannabisContentCompliance(content: string): ComplianceResult;
}

interface ContentFilter {
  keywordFilter: string[];
  imageAnalysis: boolean;
  moderationQueue: boolean;
  autoReject: boolean;
  cannabisComplianceFilter: string[]; // Block consumption encouragement
}

interface ReportSystem {
  // Avoid binding SLA commitment here - this is just our expectation of how quickly we can review
  reviewPromise: string; // e.g., 'timely review' — avoid hard SLA language
  categories: ReportCategory[];
  escalationRules: EscalationRule[];
  publishedContactMethod: ContactInfo;
}
```

**Implementation Details**:

- Real-time content filtering with keyword detection
- Image analysis integration for inappropriate visual content
- Report flow with visible timely review commitment (avoid hard SLA language)
- Block/mute functionality with persistent user preferences
- In-app support contact with external Support URL

### AI Assessment Compliance

**Purpose**: Ensures AI Photo Diagnosis feature complies with medical guidance restrictions.

**Interface**:

```typescript
interface AIAssessmentCompliance {
  formatAssessmentResult(result: AIResult): CompliantResult;
  validateConfidenceThreshold(confidence: number): boolean;
  addDisclaimers(content: string): string;
  preventMedicalClaims(text: string): string;
  reviewModeCheck(content: string): ReviewModeResult;
  blockMedicalTerminology(text: string): string;
}

interface CompliantResult {
  assessment: string; // Never "diagnosis" - hard-banned term
  confidence: number;
  disclaimer: string;
  recommendedAction: string;
  isLowConfidence: boolean;
  medicalClaimsBlocked: boolean;
}

interface ReviewModeResult {
  containsMedicalAdvice: boolean;
  containsHealthMeasurements: boolean;
  blockedTerms: string[];
  safeForSubmission: boolean;
}
```

**Implementation Details**:

- Automatic replacement of "diagnosis" with "assessment"
- Confidence threshold enforcement (70% minimum)
- Standardized disclaimer text for all AI outputs
- Routing to community features for low-confidence results

### Permission & Account Management

**Purpose**: Handles privacy-preserving authentication and proper permission requests.

**Interface**:

```typescript
interface PermissionManager {
  requestCameraPermission(): Promise<PermissionResult>;
  requestMicrophonePermission(): Promise<PermissionResult>;
  requestPhotoAddOnlyPermission(): Promise<PermissionResult>; // PHPicker preferred
  requestPhotoLibraryPermission(): Promise<PermissionResult>; // Full library access
  requestTrackingPermission(): Promise<PermissionResult>; // ATT - only if actually tracking
  getPurposeString(permission: PermissionType): string;
  getLocalizedPurposeString(permission: PermissionType, locale: string): string;
}

interface AccountManager {
  provideSignInWithApple(): Promise<AuthResult>; // First-class option
  deleteAccount(userId: string): Promise<DeletionResult>;
  exportUserData(userId: string): Promise<UserDataExport>;
  revokeSignInWithAppleToken(userId: string): Promise<void>;
  handleOfflineAccountDeletion(userId: string): Promise<void>;
}

interface PHPickerIntegration {
  selectPhotos(maxCount: number): Promise<PhotoResult[]>;
  requiresPhotoLibraryPermission: boolean;
}
```

**Implementation Details**:

- Clear, specific purpose strings for all permissions with localization
  **Implementation Details**:

- Clear, specific purpose strings for all permissions with localization
- PHPicker preferred over full Photo Library access to reduce permission friction
- Default behavior: PHPicker integration should default to not requiring full Photo Library permission (i.e., requiresPhotoLibraryPermission defaults to false). Only request full photo library access when the app explicitly needs it.
- Sign in with Apple as first-class authentication option
- In-app account deletion with data removal confirmation (≤2 taps from settings)
- ATT prompt only shown if actually tracking users across apps/websites
- Compliance with data portability requirements

### EU DSA Compliance

**Purpose**: Ensures compliance with EU Digital Services Act for EU market availability.

**Interface**:

```typescript
interface EUDSACompliance {
  validateTraderStatus(): Promise<TraderStatusResult>;
  setContactInformation(info: TraderContactInfo): Promise<void>;
  checkEUStorefrontCompliance(): Promise<ComplianceResult>;
}

interface TraderContactInfo {
  address: string;
  phone: string;
  email: string;
  isVerified: boolean;
}
```

**Implementation Details**:

- Trader status verification in App Store Connect
- Contact information display on EU product pages
- Compliance validation for EU distribution

### Export Control Compliance

**Purpose**: Handles encryption declarations and export control requirements.

**Interface**:

```typescript
interface ExportControlCompliance {
  answerEncryptionQuestions(): EncryptionDeclaration;
  generateCCATSDocumentation(): Promise<CCATSResult>;
  setITSAppUsesNonExemptEncryption(uses: boolean): void;
}

interface EncryptionDeclaration {
  usesEncryption: boolean;
  usesExemptEncryption: boolean;
  requiresCCATS: boolean;
  requiresFrenchDeclaration: boolean;
}
```

**Implementation Details**:

- Automatic encryption usage detection
- CCATS documentation generation for non-standard crypto
- French declaration handling for EU distribution

## Data Models

### Compliance Configuration

```typescript
interface ComplianceConfig {
  privacyManifest: {
    tracking: boolean;
    trackingDomains: string[];
    dataTypes: DataTypeConfig[];
    sdkAllowlist: string[];
    sdkDenylist: string[];
  };
  ageVerification: {
    minimumAge: number;
    minAppStoreAge: number;
    storageKey: string;
    resetOnUpdate: boolean;
    cannabisContentWarning: string;
  };
  ugcModeration: {
    filterEnabled: boolean;
    timelyReview: boolean;
    supportContact: ContactInfo;
    cannabisComplianceTerms: string[];
  };
  aiCompliance: {
    confidenceThreshold: number;
    disclaimerText: string;
    medicalTerms: string[];
    bannedTerms: string[]; // Including "diagnosis"
    reviewModeEnabled: boolean;
  };
  permissions: {
    preferPHPicker: boolean;
    showATTPrompt: boolean;
    localizedPurposeStrings: Record<string, string>;
  };
  euDSA: {
    traderStatusRequired: boolean;
    contactInfo: TraderContactInfo;
  };
  exportControl: {
    usesNonExemptEncryption: boolean;
    requiresCCATS: boolean;
    requiresFrenchDeclaration: boolean;
  };
}
```

### Audit Trail

```typescript
interface ComplianceAuditEntry {
  timestamp: Date;
  component: string;
  action: string;
  details: Record<string, any>;
  userId?: string;
  compliance: boolean;
}
```

## Error Handling

### Privacy Manifest Errors

- **Missing SDK Manifest**: Log warning, document in compliance report
- **Invalid Required Reason**: Prevent build, require developer action
- **API Usage Without Declaration**: Build-time validation failure

### Age Verification Errors

- **Storage Failure**: Fallback to session-only verification
- **Invalid Birth Date**: Clear error messaging, retry option
- **Verification Bypass Attempt**: Log security event, maintain gate

### UGC Moderation Errors

- **Filter Service Down**: Queue content for manual review
- **Report Submission Failure**: Retry mechanism with user notification
- **Block/Mute Sync Issues**: Local storage with background sync

### AI Assessment Errors

- **Low Confidence Results**: Automatic community routing
- **Medical Claims Detection**: Content modification with logging
- **Disclaimer Missing**: Automatic injection with audit trail

## Testing Strategy

### Unit Testing

- Privacy manifest generation with various SDK configurations
- Age verification logic with edge cases (leap years, timezone issues)
- Content filtering with known problematic content samples
- AI assessment compliance with medical terminology detection

### Integration Testing

- End-to-end age verification flow
- UGC moderation pipeline from report to resolution
- Account deletion with data verification
- Permission request flows with various system states

### Compliance Testing

- App Store Connect submission simulation
- Privacy manifest validation against Apple's requirements
- Age-rating questionnaire accuracy verification
- UGC safeguard functionality demonstration
- Required-reason API build failure simulation
- EU DSA product page verification
- Privacy labels ↔ manifest consistency validation
- PHPicker vs full Photo Library permission verification

### Manual Testing Scenarios

- Age gate bypass attempts
- Content moderation edge cases
- AI assessment disclaimer presence
- Account deletion completeness (≤2 taps from settings)
- Permission purpose string clarity and localization
- Cannabis content compliance (no consumption encouragement)
- Medical terminology blocking in AI outputs
- EU storefront contact information display

## Implementation Notes

### Build Integration

- Privacy manifest generation remains integrated into the JS/TS (Expo) pipeline: TypeScript generates manifest inputs and human-readable artifacts under `privacy-manifests/`.
- Required‑Reason API scanning and validation are performed during native prebuild (Xcode run‑script or Expo config plugin that hooks `prebuild`) so detection is performed against compiled symbols and Info.plist / `PrivacyInfo.xcprivacy` metadata.

### Native Build Validation (RRAPI)

Purpose: ensure Required‑Reason APIs are detected from the compiled/native assets and that the final `PrivacyInfo.xcprivacy` and Info.plist entries include required declarations and justifications.

Recommended approaches (pick based on project type):

1. Xcode Run Script (native projects / CI)

- Hook: add a Run Script phase in the app target executed during prebuild (before packaging/archiving). For CI, run the script before `xcodebuild archive`.
- Tools: `xcrun nm` (or `nm`), `otool -L`, `jq`.
- Files produced/consumed:
  - Consumed: `privacy-manifests/privacy-manifest-inputs.json`, `privacy-manifests/rrapi-symbols.txt`, `privacy-manifests/rrapi-exclusions.txt`.
  - Produced: `ios/privacy-validation/privacy-validation.json`, console logs.

Minimal script flow:

1. Resolve `BIN_PATH` (the built executable) from `${BUILT_PRODUCTS_DIR}/${EXECUTABLE_PATH}` or accept a `--binary` CLI arg for local runs.
2. Use `xcrun nm -gU "$BIN_PATH"` to list exported symbols and filter against `rrapi-symbols.txt` to build `detectedSymbols`.
3. Use `xcrun otool -L "$BIN_PATH"` to enumerate linked frameworks and inspect their `Info.plist`/`PrivacyInfo.xcprivacy` if present.
4. Load `privacy-manifest-inputs.json` and assert that each `detectedSymbol` has a corresponding declaration (or an SDK manifest that covers it).
5. Create `ios/privacy-validation/privacy-validation.json` with structure:

```
{
  "detectedSymbols": ["symbolA","symbolB"],
  "declarations": [{"api":"symbolA","declared":true}],
  "missingDeclarations": ["symbolB"],
  "invalidSDKManifests": [],
  "result":"pass|fail",
  "errorMessages": []
}
```

6. If `result == fail`, exit non‑zero (recommended code 2) so Xcode/CI surfaces the build failure.

Example local CLI wrapper (POSIX):

```
./scripts/ios-rrapi-validate.sh \
  --binary "build/Release-iphoneos/GrowBro.app/GrowBro" \
  --inputs privacy-manifests/privacy-manifest-inputs.json \
  --symbols privacy-manifests/rrapi-symbols.txt \
  --out ios/privacy-validation/privacy-validation.json
```

2. Expo Config Plugin (Expo managed or prebuild flows)

- Hook: a config plugin that runs during `expo prebuild` and either injects an Xcode Run Script phase or runs a node-based validator against the generated native project in `ios/`.
- Behavior: copy TS-generated `privacy-manifests/*` into `ios/privacy-manifests/`, run validator, write `ios/privacy-validation/privacy-validation.json`, and throw a plugin error to fail `prebuild` when validation fails.

Surface & CI behavior:

- Fail early: validation errors should fail prebuild/CI with a clear, human-friendly message and a pointer to the JSON artifact.
- Machine-readable output: `ios/privacy-validation/privacy-validation.json` is required for CI automation and debugging.
- Console summary: print top missing declarations and suggested fixes, e.g. "Missing declarations: Camera.FileTimestamp - add to PrivacyInfo.xcprivacy or provide justification in SDK manifest".

Failure modes and how to handle them:

- Missing declaration (hard fail): detected symbol with no matching PrivacyInfo entry. Action: exit 2, list missingDeclarations in JSON, print summary.
- Invalid SDK manifest (hard fail): SDK-provided manifest missing required fields or failing signature validation. Action: exit 2, include details under `invalidSDKManifests`.
- Tooling missing (soft/hard fail depending on CI): missing `xcrun`/`nm`/`otool` → exit 3 with clear message instructing to install Xcode CLT.
- False positives: allow `privacy-manifests/rrapi-exclusions.txt` to list symbol patterns to ignore. Excluded matches should be logged at warning level and not cause hard failure unless configured.
- Parsing errors: unparsable `PrivacyInfo.xcprivacy` or `privacy-manifest-inputs.json` should cause fail with parsing errors reported in `errorMessages`.

Exit codes:

- 0: pass
- 2: validation fail (missing/invalid declarations)
- 3: environment/tooling error

Developer ergonomics:

- Provide a local CLI wrapper (`scripts/ios-rrapi-validate.sh` or node script) for devs to run quickly against a built binary or an app in the simulator.
- Document how to generate the build artifact path on macOS Xcode so the script can be run locally: e.g. `xcodebuild -workspace GrowBro.xcworkspace -scheme GrowBro -configuration Release -sdk iphoneos build` then use the binary at derived data path.

### Monitoring & Alerting

- Compliance violation logging with Sentry integration
- Age verification bypass attempt tracking
- UGC moderation queue monitoring
- AI assessment confidence distribution analysis

### Documentation Requirements

- Review Notes template with all compliance points and demo credentials
- Screenshot guidelines covering age gate, UGC controls, permissions, deletion flow, AI disclaimers
- Privacy policy URL and support URL validation
- Audit trail export for compliance reviews
- Team training materials for ongoing compliance
- Submission checklist with all 2025 requirements

### Submission Checklist

**Privacy & Manifests**:

- [ ] PrivacyInfo.xcprivacy present with all required-reason APIs declared
- [ ] Third-party SDK manifests and signatures validated
- [ ] App Privacy questionnaire matches manifest declarations
- [ ] PII/health data scrubbing documented in logging config

**Age Rating & Content**:

- [ ] Age rating questionnaire answered with 17+ rating
- [ ] Minimum age set to 18+ in App Store Connect
- [ ] In-app age gate screenshot attached
- [ ] Cannabis content compliance verified (no consumption encouragement)

**UGC & Community**:

- [ ] Report/block/mute functionality visible and documented
- [ ] Support contact method in app and on store page
- [ ] Content moderation queue and filtering active

**Account & Permissions**:

- [ ] Account deletion flow recorded (≤2 taps from settings)
- [ ] Demo account credentials provided
- [ ] Permission purpose strings localized and specific
- [ ] Sign in with Apple implemented as first-class option

**EU & Export Control**:

- [ ] DSA trader status verified in App Store Connect (if EU distribution)
- [ ] Export control questions answered with documentation if needed

**AI & Medical Claims**:

- [ ] AI outputs use "assessment" terminology (never "diagnosis")
- [ ] Medical terminology blocking active and tested
- [ ] Confidence thresholds and disclaimers implemented

### Maintenance Considerations

- Quarterly compliance requirement reviews
- SDK update impact assessment process
- Privacy manifest update procedures
- Age verification storage migration planning
