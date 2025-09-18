# Implementation Plan

- [ ] 1. Set up core notification infrastructure and platform-specific foundations

  - Create notification service architecture with proper TypeScript interfaces
  - Set up WatermelonDB schemas for notifications, preferences, and tokens
  - Configure Expo notifications with platform-specific channels and categories
  - _Requirements: 1.6, 3.7, 5.1_

- [ ] 1.1 Create WatermelonDB schemas and models for notification system

  - Write notification, preference, and token table schemas with proper indexing
  - Implement WatermelonDB models with validation and relationships
  - Create database migrations for notification tables
  - Write unit tests for model operations and constraints
  - _Requirements: 6.6, 10.7_

- [ ] 1.2 Implement Android notification channels with immutable configuration

  - Create Android channel configuration with versioned IDs (v1 suffix)
  - Implement channel creation service with proper importance levels and grouping
  - Add channel migration strategy for future updates
  - Write tests for channel creation and validation
  - _Requirements: 1.6, 3.7_

- [ ] 1.3 Implement iOS notification categories and actions

  - Create iOS category configuration with proper action definitions
  - Set up UNNotificationCategory with reply and action buttons
  - Implement category registration service
  - Write tests for category setup and action handling
  - _Requirements: 1.7, 2.7_

- [ ] 2. Build push notification token management system with Expo Push Service

  - Implement Expo push token registration and refresh handling
  - Create token sync service with Supabase backend
  - Add token lifecycle management with cleanup and rotation
  - _Requirements: Platform-Specific Foundation (Token Management)_

- [ ] 2.1 Implement Expo push token registration and lifecycle management

  - Create token registration service using expo-notifications (getExpoPushTokenAsync)
  - Implement token refresh handling with automatic retry logic
  - Add Expo token validation (ExponentPushToken[...] format)
  - Write unit tests for Expo token operations and edge cases
  - _Requirements: Platform-Specific Foundation (Token Management)_

- [ ] 2.2 Create token sync service with Supabase backend

  - Implement Expo token storage and retrieval from Supabase push_tokens table
  - Add token synchronization with timestamp tracking and RLS policies
  - Create token cleanup service for DeviceNotRegistered errors from Expo receipts
  - Write integration tests for token sync operations and error handling
  - _Requirements: Platform-Specific Foundation (Token Management)_

- [ ] 3. Implement local notification scheduling with platform constraints

  - Create local notification service with iOS 64-notification limit handling
  - Implement Android exact alarm permission flow with WorkManager fallback
  - Add rolling scheduler for iOS and Doze mode handling for Android
  - _Requirements: 2.2, 2.3, 2.6, 2.7_

- [ ] 3.1 Create iOS rolling notification scheduler for 64-notification limit

  - Implement rolling scheduler that maintains max 48 pending notifications (enforced by iOS)
  - Add notification refresh logic on app start/resume and background task completion
  - Create priority-based scheduling for upcoming tasks with automatic rescheduling
  - Write tests for notification limit handling, refresh cycles, and edge cases
  - _Requirements: 2.2, 2.7_

- [ ] 3.2 Implement Android exact alarm system with permission handling

  - Create exact alarm permission request flow with educational UI (Android 14+ denies by default)
  - Implement SCHEDULE_EXACT_ALARM permission checking and settings intent
  - Add fallback to WorkManager for inexact scheduling when permission denied
  - Show foreground sync on app open when using inexact alarms
  - Write tests for permission flows, fallback behavior, and user education
  - _Requirements: 2.3, 2.6, 5.6_

- [ ] 3.3 Build local notification scheduling service with platform-specific logic

  - Create unified scheduling interface with platform-specific implementations
  - Implement notification cancellation and rescheduling
  - Add Doze mode and battery optimization handling for Android
  - Write unit tests for scheduling operations and platform differences
  - _Requirements: 2.1, 2.4, 2.5_

- [ ] 4. Create deep link handling system with security validation

  - Implement URL parsing and validation with allowlist security
  - Create navigation handler with authentication gate for protected content
  - Set up Universal Links and App Links with domain verification
  - _Requirements: 4.1, 4.2, 4.3, 4.5, 8.1, 8.2, 8.3, 8.8_

- [ ] 4.1 Implement secure deep link URL parser and validator

  - Create URL parser with host and path allowlist validation
  - Implement parameter sanitization to prevent injection attacks
  - Add validation for HTTPS and custom scheme URLs
  - Write comprehensive tests for URL validation and security edge cases
  - _Requirements: 4.5, 8.3, 11.2_

- [ ] 4.2 Create navigation handler with authentication gate

  - Implement deferred navigation pattern for protected content
  - Create authentication gate that stashes target URL during login
  - Add navigation service that integrates with Expo Router
  - Write tests for authentication flows and deferred navigation
  - _Requirements: 4.4, 8.3_

- [ ] 4.3 Set up Universal Links and App Links with domain verification

  - Host AASA at /.well-known/apple-app-site-association (no file extension, correct content-type)
  - Host assetlinks.json at /.well-known/assetlinks.json with SHA-256 fingerprints for release keys
  - Implement domain verification checking and testing for both platforms
  - Create web fallback page with Smart App Banner (iOS) and store buttons (Android)
  - Write integration tests for link verification, fallback behavior, and store redirects
  - _Requirements: 8.1, 8.2, 8.6, 8.7, 8.8_

- [ ] 5. Build notification preference management system

  - Create preference service with channel/category mapping
  - Implement quiet hours functionality with app-level suppression
  - Add permission management with educational flows and deep links to settings
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 5.7, 10.1, 10.2, 10.3, 10.5, 10.7_

- [ ] 5.1 Implement notification preference service with platform mapping

  - Create preference management service that maps to Android channels and iOS categories
  - Implement preference validation and default value handling
  - Add preference sync with WatermelonDB and Supabase backend
  - Write unit tests for preference operations and platform mapping
  - _Requirements: 3.3, 10.3, 10.7_

- [ ] 5.2 Create permission management with educational flows

  - Implement pre-permission education screens following Apple HIG
  - Add contextual permission requests for community and cultivation features
  - Create deep links to system settings for denied permissions
  - Write tests for permission flows and educational UI
  - _Requirements: 3.1, 3.2, 3.7, 5.7, 10.1, 10.2, 10.5_

- [ ] 5.3 Build quiet hours functionality with app-level suppression

  - Implement quiet hours configuration with time range selection
  - Add app-level notification suppression during quiet hours
  - Create quiet hours validation and timezone handling
  - Write tests for quiet hours logic and edge cases
  - _Requirements: 3.4_

- [ ] 6. Create in-app notification center with offline support

  - Implement notification storage and retrieval with WatermelonDB
  - Create notification list UI with read/unread states and badge management
  - Add pagination and archiving for notification history
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [ ] 6.1 Implement notification storage service with WatermelonDB

  - Create notification storage service with read/unread tracking
  - Implement notification archiving after 30 days (configurable)
  - Add notification cleanup and GDPR deletion functionality
  - Write unit tests for storage operations and data lifecycle
  - _Requirements: 6.1, 6.3, 6.5, 6.7_

- [ ] 6.2 Build notification list UI with pagination and filtering

  - Create notification list component with date organization
  - Implement cursor-based pagination for efficient loading
  - Add read/unread visual states and mark-as-read functionality
  - Write component tests for UI interactions and state management
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 6.3 Create badge management system with platform constraints

  - Implement badge count calculation based on unread notifications
  - Add badge display for in-app notification center (Android: no numeric icon badges)
  - Create badge sync with server unread count
  - Write tests for badge counting and platform-specific behavior
  - _Requirements: 6.4_

- [ ] 7. Implement push notification handling with grouping and deduplication

  - Create push notification receiver with foreground/background handling
  - Implement notification grouping for Android and threading for iOS
  - Add notification deduplication using collapse keys and thread IDs
  - _Requirements: 1.1, 1.2, 1.4, 1.5, 9.1, 9.2, 9.3, 9.6, 9.7_

- [ ] 7.1 Create push notification receiver service

  - Implement foreground and background message handling
  - Add notification presentation logic with channel/category routing
  - Create notification tap handling with deep link integration
  - Write tests for message handling and notification presentation
  - _Requirements: 1.1, 9.1, 9.2_

- [ ] 7.2 Implement notification grouping and deduplication

  - Server sets collapse_key (Android) and apns-collapse-id (iOS) with per-post thread-id
  - Create Android notification grouping with group summary notifications on client
  - Implement iOS notification threading with thread identifiers for visual grouping
  - Add unit tests that verify 5 notifications in 5 minutes coalesce properly
  - Write tests for grouping behavior and server-side deduplication logic
  - _Requirements: 1.4, 1.5_

- [ ] 7.3 Build background notification processing with platform constraints

  - Implement background message handling respecting platform limitations
  - Add data sync operations for background notifications
  - Create background processing with Doze mode and battery optimization handling
  - Write tests for background processing and platform constraint handling
  - _Requirements: 9.3, 9.5, 9.6, 9.7_

- [ ] 8. Create Supabase Edge Function for push notification delivery

  - Implement Edge Function for FCM/APNs integration with user preference checking
  - Create notification payload formatting for Android and iOS platforms
  - Add delivery tracking and analytics with database logging
  - _Requirements: 7.1, 7.2, 7.4, 7.5, 7.6_

- [ ] 8.1 Implement Supabase Edge Function for Expo Push Service delivery

  - Create Edge Function that posts to Expo Push API with user token retrieval and preference checking
  - Implement Expo push ticket handling and receipt polling for delivery status
  - Add token invalidation on DeviceNotRegistered errors from Expo receipts
  - Write Edge Function tests for Expo Push integration and error handling
  - _Requirements: 7.1, 7.5_

- [ ] 8.2 Create notification delivery tracking with Expo receipts

  - Implement delivery tracking using Expo push tickets and receipts
  - Add notification_queue status transitions: pending → sent → opened/failed
  - Create analytics service with "delivery rate" = sent/attempted (document receipt limitations)
  - Alert if sent/attempted ratio falls below 95%
  - Write tests for Expo receipt processing and analytics data collection
  - _Requirements: 7.1, 7.2, 7.4, 7.6_

- [ ] 8.3 Set up database triggers for automatic community notifications

  - Create database triggers for post replies and likes
  - Implement automatic Edge Function calls from database events
  - Add trigger configuration for different notification types
  - Write integration tests for trigger-based notifications
  - _Requirements: 1.1, 1.2_

- [ ] 9. Build notification analytics and monitoring system

  - Implement delivery and engagement tracking with platform limitations
  - Create analytics dashboard for notification performance metrics
  - Add error tracking and alerting for delivery failures
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6_

- [ ] 9.1 Implement analytics tracking service with platform constraints

  - Create analytics service using notification_queue for server acceptance tracking and client open events
  - Add platform-specific tracking limitations (no per-device delivery receipts on iOS; Expo receipts report handoff only)
  - Implement message ID correlation for push-to-open tracking in Supabase
  - Write tests for analytics collection and platform-specific behavior
  - _Requirements: 7.1, 7.2, 7.6_

- [ ] 9.2 Create notification performance monitoring

  - Implement delivery rate monitoring with 95% threshold alerting
  - Add latency tracking for end-to-end notification delivery
  - Create error tracking for failed deliveries and token issues
  - Write monitoring tests and alert validation
  - _Requirements: 7.6, 11.1_

- [ ] 10. Implement error handling and graceful degradation

  - Create comprehensive error handling for all notification scenarios
  - Implement fallback strategies for permission denials and delivery failures
  - Add user-friendly error messages and recovery flows
  - _Requirements: All error handling scenarios from requirements_

- [ ] 10.1 Create notification error handling service

  - Implement error categorization and handling strategies
  - Add graceful degradation for permission denials and delivery failures
  - Create user-friendly error messages and recovery flows
  - Write tests for error scenarios and fallback behavior
  - _Requirements: Error Handling section from design_

- [ ] 10.2 Implement fallback notification strategies

  - Create in-app notification fallbacks when push notifications fail
  - Add local notification fallbacks for critical reminders
  - Implement badge-only mode for users who opt out of notifications
  - Write tests for fallback scenarios and degraded functionality
  - _Requirements: Error Handling section from design_

- [ ] 11. Create comprehensive testing suite for all notification scenarios

  - Implement unit tests for all notification services and components
  - Create integration tests for end-to-end notification flows
  - Add platform-specific testing for Android channels and iOS categories
  - _Requirements: Testing Strategy from design_

- [ ] 11.1 Write unit tests for notification services

  - Create comprehensive unit tests for all notification service classes
  - Add mock implementations for platform-specific APIs
  - Test error scenarios and edge cases for each service
  - Achieve >90% code coverage for notification system
  - _Requirements: Testing Strategy from design_

- [ ] 11.2 Create integration tests for notification flows

  - Implement end-to-end tests for push notification delivery and handling
  - Add tests for deep link navigation from notifications
  - Create tests for preference changes affecting notification behavior
  - Test offline/online scenarios and data synchronization
  - _Requirements: Testing Strategy from design_

- [ ] 11.3 Build platform-specific testing suite

  - Create Android-specific tests for channels, permissions, and exact alarms
  - Implement iOS-specific tests for categories, actions, and notification limits
  - Add tests for Universal Links and App Links verification
  - Test background processing and platform constraint handling
  - _Requirements: Testing Strategy from design_

- [ ] 12. Integrate notification system with existing GrowBro features

  - Connect notification system with community features (posts, replies, likes)
  - Integrate with cultivation calendar for task reminders
  - Add notification preferences to user settings screens
  - _Requirements: Integration with existing app features_

- [ ] 12.1 Integrate with community features

  - Connect notification system to post reply and like events
  - Add notification triggers for community interactions
  - Implement community notification preferences in user settings
  - Write integration tests for community notification flows
  - _Requirements: 1.1, 1.2_

- [ ] 12.2 Integrate with cultivation calendar system

  - Connect notification system to task scheduling and reminders
  - Add cultivation reminder preferences and scheduling options
  - Implement task completion notification cancellation
  - Write integration tests for cultivation notification flows
  - _Requirements: 2.1, 2.4, 2.5_

- [ ] 12.3 Add notification preferences to user settings UI

  - Create notification settings screen with category toggles
  - Add quiet hours configuration UI
  - Implement permission management UI with deep links to system settings
  - Write UI tests for settings interactions and preference updates
  - _Requirements: 3.2, 3.4, 3.7, 5.7, 10.5_

- [ ] 13. Implement additional platform-specific constraints and optimizations

  - Add payload size limits and truncation policies
  - Implement PendingIntent audit for Android 12+ trampoline compliance
  - Create badge count limitations for Android launchers
  - _Requirements: Platform-specific constraints from design_

- [ ] 13.1 Implement payload size limits and truncation policy

  - Add server-side payload validation with 4KB limit for APNs and FCM
  - Implement automatic body truncation and move long content behind deep links
  - Create payload size testing and validation
  - Write tests for payload truncation and size limit enforcement
  - _Requirements: Platform-specific constraints_

- [ ] 13.2 Implement PendingIntent audit for Android 12+ compliance

  - Ensure FLAG_IMMUTABLE default for all PendingIntents
  - Remove notification trampolines and use direct Activity launches
  - Add PendingIntent validation and compliance checking
  - Write tests for Android 12+ trampoline compliance
  - _Requirements: Android 12+ trampoline restrictions_

- [ ] 13.3 Handle platform-specific badge limitations

  - Document that numeric icon badges aren't guaranteed across Android launchers
  - Implement in-app badge counts only for Android
  - Add iOS badge count management with proper clearing
  - Write tests for badge behavior across platforms
  - _Requirements: Platform-specific badge constraints_

- [ ] 13.4 Add background processing constraints and realistic SLAs
  - Document iOS background updates as best-effort with reconciliation on foreground
  - Implement realistic SLAs for background notification processing
  - Add foreground reconciliation for missed background updates
  - Write tests for background processing limitations and recovery
  - _Requirements: 9.5, Background processing constraints_
