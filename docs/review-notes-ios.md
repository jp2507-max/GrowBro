# iOS Reviewer Notes (GrowBro)

Generated: 2025-09-23T15:17:49.486Z

> Purpose: Provide App Review with quick verification notes — demo login, age-gate, UGC safeguards, permissions, and account deletion. GrowBro is an educational app for home cannabis cultivation (no commerce).

## Test Account / Access

- Request credentials via App Access or use environment variables during test builds:
  - Username env: `APP_ACCESS_REVIEWER_EMAIL`
  - Password env: `APP_ACCESS_REVIEWER_PASSWORD`
- The reviewer flow and deep links are documented below.

## Age Gate (18+)

- App requires users to confirm they are 18+ before proceeding.
- Rationale: educational cannabis content; no shopping, ordering, pickup, or delivery features.
- Flow: Age confirmation is shown on first launch; adults proceed, underage users are blocked.

## Core Features

- Calendar & Task Reminders: Works fully even if notifications are denied (reminders still visible in-app).
- AI Photo Assessment: Optional; photos captured for plant diagnosis guidance.
- Community Feed: User-generated posts; moderation controls described below.
- Harvest Workflow: Track drying/curing and inventory (no sales).

## UGC Safeguards (Report / Mute / Block)

- Long-press or overflow menu on posts exposes moderation actions:
  - Report: Submit a report; content is auto-hidden at a threshold of multiple reports.
  - Mute: Hide another user's content from the feed.
  - Block: Prevent interaction from a specific user.
- Pinned feed post is pre-moderated for safe review.
- Content sharing is opt-in; photos are private by default.

## Permissions (iOS)

- Camera: Capture plant photos for AI assessment.
- Photos: Uses the iOS photo picker (PHPicker) to select images — no full photo library permission is requested.
- Notifications: Optional; used for local task reminders. App remains usable with permission denied.
- Tracking: Not used; no ATT prompt; no IDFA/AdSupport references.
- Privacy Manifests: Repository includes privacy manifest and CI validation.

Privacy policy: https://growbro.app/privacy

## Account Deletion (≤ 3 taps)

- In-app path: Settings → Privacy & Data → Delete Account (≤ 3 taps).
- Behavior: Deletes account and data; signs out.
- Web deletion fallback: https://growbro.app/delete-account

## Useful Deep Links for Review

- AI assessment:
  - growbro://app-access/assessment-overview
  - https://growbro.app/app-access/assessment-overview
- Community feed:
  - growbro://feed
  - https://growbro.app/feed
- Reminders calendar:
  - growbro://calendar
  - https://growbro.app/calendar

## Contact

- Support: https://growbro.app/privacy
- Notes: If any feature requires clarification during review, we can temporarily disable Community/AI features via remote flags and provide a focused reviewer build.
