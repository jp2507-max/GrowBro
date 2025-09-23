# Play Store submission checklist (Android)

This checklist must be completed for every release to the Google Play Store. Link the PR to this checklist and attach CI artifacts.

Sections

- Target SDK and Manifest compliance
- Runtime permissions and fallbacks
- Data Safety and Privacy Policy
- Cannabis policy and UGC moderation
- Account deletion (in-app + web)
- App access for reviewers
- Pre-launch report checks
- Telemetry/consent compliance

Required artifacts (paths)

- build/reports/target-sdk-compliance/<variant>.json (AGP Variant API)
- build/reports/compliance/cannabis-policy.json
- build/reports/compliance/compliance-audit.json
- compliance/data-inventory.json
- compliance/privacy-policy.json (policyUrl, deletionUrl)
- compliance/deletion-methods.json
- docs/compliance/policy-deadlines.md

Reviewer steps (summary)

1. Verify targetSdk = 35 for release variants and no restricted permissions without justification
2. Validate no notifications before POST_NOTIFICATIONS grant; exact alarms not requested unless justified
3. Generate Data Safety draft and ensure privacy policy matches
4. Run cannabis policy scanner on store listing + resources
5. Confirm in-app deletion path ≤3 taps and public web deletion URL
6. Provide Play Console App access credentials/instructions
7. Ensure pre-launch report is green with zero warnings

CI gates (must pass)

- pnpm compliance:docs:validate
- pnpm data-safety:generate && pnpm data-safety:validate
- pnpm privacy-policy:validate
- pnpm compliance:scan:android
- pnpm compliance:cannabis
- pnpm compliance:audit

Ownership and sign-off

- Compliance Owner: @release
- Security/Privacy Owner: @privacy
- Due dates tracked in docs/compliance/policy-deadlines.md
