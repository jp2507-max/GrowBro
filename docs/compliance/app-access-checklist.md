# App Access Reviewer Checklist

This document accompanies compliance/app-access.json and summarises the reviewer access package for Google Play App Access submissions.

## Credentials workflow

- Credentials are held only in Play Console (App content > App access).
- CI secrets expose env keys APP_ACCESS_REVIEWER_EMAIL and APP_ACCESS_REVIEWER_PASSWORD.
- AppAccessManager.provideTestCredentials masks values during automation to avoid leaks.
- Rotate the reviewer account after every release and update the env secrets.

## Demo flow overview

1. Sign in with reviewer credentials and acknowledge the 18+ gate.
2. Follow AppAccessManager.generateDemoFlow() steps for assessment, community, and reminders features.
3. Capture screen recording evidence for each feature prior to submission.

### Feature checkpoints

- **Assessment**: Insights -> AI Assessment. Run the guided walkthrough on demo plant Aurora Borealis.
- **Community**: Community tab. Demonstrate the actions menu (Report, Mute, Block) on the pinned compliance post.
- **Reminders**: Calendar tab. Open the seeded reminder and show notification settings.

## Deep link entry points

The following deep links are validated via DeepLinkValidator:

- growbro://app-access/assessment-overview
- https://growbro.app/app-access/assessment-overview
- growbro://feed
- https://growbro.app/feed
- growbro://calendar
- https://growbro.app/calendar

## Submission checklist

- Run `pnpm compliance:app-access` to confirm credentials, instructions, and deep links are valid.
- Attach the latest compliance/app-access.json and this checklist to the release package.
- Verify the reviewer account can reach all gated features within three taps after login.
- Update Play Console App access notes with any temporary demo flow changes.
