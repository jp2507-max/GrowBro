# Design Document

## Overview

The iOS Store Compliance feature implements a comprehensive compliance system that ensures GrowBro meets all Apple App Store requirements as of August 2025. The design focuses on privacy manifests with required-reason API declarations, accurate App Privacy questionnaire completion, 18+ age-rating with 18+ in-app age-gating, UGC content moderation, AI assessment disclaimers, and proper permission handling.

The system is designed to be maintainable, auditable, and easily updatable as Apple's guidelines evolve. All compliance measures are implemented with clear documentation and automated validation where possible.

## Architecture

### Core Components

```
iOS Compliance System
├── Privacy Manifest Manager
│   ├── PrivacyInfo.xcprivacy Generator
│   ├── Required Reason API Mapper
│   ├── SDK Inventory Tracker
│   └── App Privacy Sync Validator
├── Age Verification System
│   ├── Age Gate Component
│   ├── Secure Verification Storage (Keychain + Encrypted MMKV)
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

- Automatically scans project for Required Reason API usage
- Generates PrivacyInfo.xcprivacy with proper XML structure
- Validates third-party SDK manifests during build
- Maintains mapping documentation for audit purposes

### Age Verification System

**Purpose**: Implements mandatory 18+ age-gating with secure storage and App Store 18+ rating compliance.

**Interface**:

```typescript
interface AgeVerificationSystem {
  showAgeGate(): Promise<boolean>;
  verifyAge(birthDate: Date): boolean;
  storeVerificationStatus(verified: boolean): Promise<void>;
  checkVerificationStatus(): Promise<boolean>;
  resetVerification(): Promise<void>;
  handleEnhancedAgeRating(): void;
  initializeSecureStorage(): Promise<void>;
  migrateExistingVerification(): Promise<void>;
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
  setMinimumAge: number;
  cannabisContentDisclaimer: string;
  consumptionPreventionMeasures: string[];
}
```

**Implementation Details**:

- Modal overlay that blocks all app functionality until verified
- Secure age verification storage using iOS Keychain + encrypted MMKV:
  - (1) Verification flag stored in encrypted MMKV with Keychain-protected encryption key
  - (2) Encryption key generated and stored in iOS Keychain on first app launch
  - (3) Migration of existing unencrypted MMKV flags to encrypted storage on app launch
  - (4) Keychain access restrictions with fallback behavior for access failures
- Clear messaging for users under 18 with app exit options
- Integration with App Store Connect 18+ rating configuration

**Secure Storage Implementation**:

The age verification status is stored using a hybrid approach combining iOS Keychain and encrypted MMKV storage for maximum security and compliance:

1. **Key Generation & Storage**: On first app launch, generate a 256-bit encryption key using `SecRandomCopyBytes` and store it in iOS Keychain with service identifier `"growbro.age.encryption"` and accessibility `kSecAttrAccessibleAfterFirstUnlock`.

2. **Encrypted MMKV Storage**: Initialize MMKV instance with the Keychain-retrieved encryption key using `MMKVConfiguration` with encryption enabled. Store verification status as boolean value under key `"age_verified"`.

3. **Migration Strategy**: On app launch, check for existing unencrypted MMKV verification data. If found, migrate to encrypted storage and delete unencrypted data. Log migration success/failure for audit purposes.

4. **Key Lifecycle Management**:

   - **Rotation**: Generate new encryption key annually or on major app updates
   - **Deletion**: Remove encryption key from Keychain on account deletion or app uninstall
   - **Recovery**: No key recovery mechanism - users must re-verify age if Keychain access fails

5. **Fallback Behavior**: If Keychain access fails (device lock state, biometrics disabled), fall back to session-only verification requiring re-verification on next app launch. Log security events for monitoring.

6. **Access Restrictions**: Keychain item configured with `kSecAttrAccessibleAfterFirstUnlock` ensuring key is only accessible after device unlock, protecting against unauthorized access when device is locked.

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
  reviewPromise: 'timely review'; // Avoid binding SLA commitment
  categories: ReportCategory[];
  escalationRules: EscalationRule[];
  publishedContactMethod: ContactInfo;
}
```

**Implementation Details**:

- Real-time content filtering with keyword detection
- Image analysis integration for inappropriate visual content
- Report flow with visible 24-hour SLA commitment
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
  requiresPhotoLibraryPermission: false; // PHPicker doesn't need full permission
}
```

**Implementation Details**:

- Clear, specific purpose strings for all permissions with localization
- PHPicker preferred over full Photo Library access to reduce permission friction
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

- **Keychain Access Failure**: Fallback to session-only verification with security event logging
- **Encryption Key Generation Failure**: Log critical error, maintain age gate with session-only verification
- **Migration Failure**: Log warning, retain unencrypted data temporarily, retry migration on next launch
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
- Secure storage initialization and key management
- Encrypted MMKV storage with Keychain integration
- Migration of existing unencrypted verification data
- Keychain access failure fallback behavior
- Content filtering with known problematic content samples
- AI assessment compliance with medical terminology detection

### Integration Testing

- End-to-end age verification flow with secure storage
- Keychain encryption key lifecycle (generation, rotation, deletion)
- Migration flow from unencrypted to encrypted storage
- Keychain access failure scenarios and fallback behavior
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

- Privacy manifest generation integrated into Expo build process
- Required Reason API scanning during TypeScript compilation
- SDK manifest validation in pre-build hooks

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

- [ ] Age rating questionnaire answered with 18+ rating
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
- Age verification secure storage maintenance:
  - Annual encryption key rotation
  - Keychain access monitoring and fallback testing
  - Migration verification for existing installations
  - Security audit of encryption implementation
