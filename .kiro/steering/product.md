# Product Overview

GrowBro is a React Native mobile application built with Expo, designed as a cannabis plant growth tracking and management app. The app supports multiple environments (development, staging, production) and includes features for:

- Plant telemetry and monitoring
- Calendar and scheduling functionality
- Sync capabilities with offline support
- Multi-language support (English, German)
- Privacy settings and consent management
- Template management system
- Background task processing
- Push notifications

## Key Principles

- **Educational Focus**: All content is educational; no commerce or product sales
- **Privacy-First**: Default-private data, explicit opt-ins for sharing, minimal retention, clear data export/delete
- **Offline-First**: Core functionality works offline; queue-and-sync for posts/tasks; predictable conflict resolution
- **Age-Gated**: 18+ or 21+ where required; regional/legal disclaimers; geofencing where mandated
- **Compliance**: Adheres to app store policies and regional regulations; legal review for jurisdictional restrictions
- **Content Moderation & Safety**: Reporting, blocking, rate limiting, and transparent enforcement workflow
- **Accessibility**: WCAG-inspired mobile a11y (screen reader labels, contrast, larger text, focus order)

The app uses Supabase as the backend service and includes comprehensive error tracking with Sentry. It's designed to work across iOS, Android, and web platforms with a focus on offline-first architecture using WatermelonDB for local data persistence.
