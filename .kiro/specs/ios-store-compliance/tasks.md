# Implementation Plan

- [ ] 1. Set up Privacy Manifest infrastructure and Required Reason API detection

  - Create PrivacyInfo.xcprivacy generator with XML structure for main app
  - Implement Required Reason API scanner using Apple's canonical categories: NSPrivacyAccessedAPICategoryFileTimestamp, NSPrivacyAccessedAPICategorySystemBootTime, NSPrivacyAccessedAPICategoryDiskSpace, NSPrivacyAccessedAPICategoryUserDefaults, NSPrivacyAccessedAPICategoryActiveKeyboard
  - Build SDK inventory tracker that validates against Apple's live "commonly used SDKs" list (Firebase, Facebook, Alamofire, GoogleSignIn, etc.)
  - Create build-time validation that fails CI if any transitive Swift Package/XCFramework references Required Reason APIs without approved reasons
  - Implement scanner that checks every embedded SDK (SPM/XCFramework/CocoaPods) for privacy manifest compliance
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 2. Implement SDK compliance enforcement and App Privacy sync validation

  - Create SDK manifest validator that treats missing privacy manifest or missing SDK signature as build error
  - Build App Privacy sync validator that compares declared collection/usage in App Store Connect with each manifest's NSPrivacyCollectedDataTypes
  - Implement automatic SDK compliance checking that surfaces offending binary names in CI logs
  - Create compliance reporting system that flags drift between App Privacy questionnaire and manifest declarations
  - Add linter that validates App Privacy answers stay in sync with privacy manifests
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 3. Create comprehensive age verification system with 18+ rating support

  - Implement age gate modal component that blocks all app functionality until verified
  - Create secure age verification storage using react-native-mmkv
  - Build enhanced age rating handler using new rating tiers (13+/16+/18+) and set Store rating to 18+ to mirror in-app gate
  - Implement age verification bypass prevention with security event logging
  - Create clear messaging and exit options for users under 18 (exit or educational content only, no encouragement/products)
  - Add checklist item to re-answer Apple's new rating questions required by Jan 31, 2026
  - Implement metadata compliance that keeps icons/screenshots neutral per 2.3.8 even with 18+ rating
  - Add lint rule to block cannabis imagery in App Store screenshots
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 4. Build UGC moderation framework with all four Apple-required safeguards

  - Implement content filter engine with keyword detection and image analysis (Guideline 1.2 safeguard 1)
  - Create report management system with "timely review" promise (avoid hard SLA commitment) (Guideline 1.2 safeguard 2)
  - Build block/mute functionality with persistent user preferences (Guideline 1.2 safeguard 3)
  - Implement published support contact integration (in-app + external URL) (Guideline 1.2 safeguard 4)
  - Create cannabis content compliance filter to prevent consumption encouragement
  - Add test that all four safeguards are reachable in ≤2 taps from a post
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 5. Implement AI assessment compliance with medical claims prevention

  - Create AI result formatter that replaces "diagnosis" with "assessment" terminology everywhere including screenshots and review notes
  - Build confidence threshold handler that routes low-confidence results to community
  - Implement automated text-linter that catches "diagnose/diagnosis/treatment/cure" and replaces with educational guidance + disclaimer
  - Create review mode checker that validates content for medical advice/measurements and blocks medical claims
  - Add standardized disclaimers to all AI outputs with audit trail
  - Rename "AI Photo Diagnosis" to "AI Photo Assessment" consistently in all Store-facing copy
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 6. Create permission management system with PHPicker integration

  - Implement PHPicker for photo imports to avoid full library permission (modern replacement for UIImagePickerController)
  - Create localized purpose string manager for camera, microphone, and photo permissions with specific, clear descriptions
  - Build ATT compliance handler that only shows tracking prompt when actually tracking (include NSUserTrackingUsageDescription)
  - Implement runtime guard that prevents calling ATT APIs until tracking is truly needed
  - Create permission usage documentation and validation system
  - Add integration test that verifies PHPicker path doesn't request Photo Library access
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 7. Build account management system with in-app deletion and SIWA compliance

  - Implement Sign in with Apple as mandatory first-class option if any third-party sign-in (Google/Facebook/etc.) is offered
  - Create in-app account deletion flow accessible within 2 taps from Settings (not a link to website)
  - Build account deletion confirmation system with data removal verification that works on-device
  - Implement Sign in with Apple token revocation handling
  - Create offline account deletion queue with background sync
  - Add static analyzer that fails when any 3P login is enabled without SIWA
  - Add integration test that completes deletion flow offline → queued deletion
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 8. Implement commerce prevention and push notification compliance

  - Create content validation system that prevents ordering, delivery, affiliate links to controlled substances (Guideline 1.4.3)
  - Build push notification permission handler that doesn't require enablement for core features (2024 clarification)
  - Implement marketing push opt-in system with in-app toggle (explicit opt-in required)
  - Create consumption encouragement prevention in all app content and messaging
  - Add educational content disclaimers throughout the app
  - Add pre-submission check that app remains fully usable with notifications denied
  - Add static copy checks that block content encouraging consumption and any commerce/affiliate links
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 9. Create EU DSA compliance system for European market access

  - Implement trader status validation integration with App Store Connect
  - Build contact information management system for EU storefront display (phone/email/address)
  - Create EU compliance checker that validates trader verification status
  - Add hard stop in submission simulator if Trader status isn't provided/verified in ASC (Apple removes EU availability if missing since Feb 17, 2025)
  - Implement automated screenshot check that phone/email/address appear on EU product page
  - Add EU-specific compliance documentation and audit trail
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 10. Build export control compliance system

  - Create encryption usage detection with decision tree: OS-provided crypto (HTTPS via URLSession) → usually no doc upload
  - Implement CCATS documentation generator for proprietary crypto → CCATS + French declaration
  - Build ITSAppUsesNonExemptEncryption configuration management with correct boolean values
  - Create French declaration handler for standard algorithms outside OS when distributing in France
  - Add CLI that writes ITSAppUsesNonExemptEncryption correctly and reminds to attach App Encryption key once Apple approves docs
  - Implement export control questionnaire automation with proper documentation attachment
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 11. Create comprehensive compliance documentation and review preparation system

  - Build Review Notes generator that auto-inserts demo account, server status URL, and explicit notes about age gate, UGC controls, permissions copy, and account deletion path
  - Create screenshot management system for age gate, UGC controls, permissions, deletion flow, AI assessment with disclaimer
  - Implement Accessibility Nutrition Labels exporter that generates checklist of supported features (VoiceOver, Larger Text, Switch Control, etc.)
  - Build compliance audit trail with exportable reports
  - Create submission checklist generator with all 2025 requirements validation
  - Add privacy policy URL and support URL validation
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 12. Implement compliance testing and validation framework

  - Create Required Reason API build failure simulation tests (upload build that intentionally uses RR-API without reason to assert build fails)
  - Build privacy manifest validation tests against Apple's current requirements
  - Implement UGC safeguard functionality tests with edge case coverage
  - Create age verification bypass attempt detection and prevention tests
  - Build AI assessment compliance tests with medical terminology validation
  - Add tests for new age-rating flow (13/16/18 questions) and test that raises error if in-app age gate (18) and Store rating (<18) diverge
  - Add EU DSA product page check (contact info displays on EU storefronts after trader verification)
  - Add privacy labels ↔ manifest diff test (fails if inconsistent)
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1_

- [ ] 13. Create compliance monitoring and alerting system

  - Implement compliance violation logging with Sentry integration
  - Build age verification bypass attempt tracking and alerting
  - Create UGC moderation queue monitoring with performance metrics
  - Implement AI assessment confidence distribution analysis
  - Add compliance status dashboard for ongoing monitoring
  - Track ATT prompt rate vs. tracking actually performed
  - Monitor SDK privacy manifest drift and trigger Sentry alerts if build ships with missing RR-API reasons
  - Alert if third-party SDKs from Apple's list lack signatures
  - _Requirements: 1.5, 3.4, 4.2, 5.2, 8.5_

- [ ] 14. Build compliance configuration management and maintenance system

  - Create centralized compliance configuration with environment-specific settings
  - Implement compliance requirement update notification system
  - Build SDK update impact assessment automation
  - Create privacy manifest update procedures with version control
  - Implement quarterly compliance review automation that refreshes SDK list from Apple, re-answers age-rating questions if Apple adds more, and re-pulls DSA trader verification status
  - _Requirements: 1.4, 2.5, 8.5_

- [ ] 15. Integrate all compliance systems and perform end-to-end validation
  - Wire together all compliance components with proper error handling
  - Create comprehensive integration tests covering full compliance workflow
  - Implement App Store Connect submission simulation with all requirements
  - Build final compliance validation system that verifies hard blocks before submission: no undeclared Required-Reason APIs, all SDKs on Apple's list have manifests + signatures, age rating = 18+ with clean metadata, SIWA present if any third-party login present, trader status verified for EU distribution, export compliance answers resolved
  - Create compliance documentation export system for audit and review purposes
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1_
