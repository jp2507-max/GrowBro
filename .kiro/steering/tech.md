# Technology Stack

## Core Framework

- **React Native 0.79** with **Expo 53** (managed workflow)
- **TypeScript** (strict mode enabled)
- **Expo Router** for file-based navigation with typed routes
- **New Architecture** enabled for performance

## UI & Styling

- **NativeWind 4** (Tailwind CSS for React Native)
- **Reanimated 3.17+** for animations and gestures
- **React Native Gesture Handler** for touch interactions
- **Bottom Sheet** (@gorhom/bottom-sheet) for modal interfaces
- **FlashList** for performant lists (replace FlatList)

## State Management & Data

- **React Query 5** (@tanstack/react-query) for server state
- **Zustand** for client state management
- **WatermelonDB** for offline-first local database (SQLite)
- **Supabase** for backend services and real-time features
- **React Hook Form** with Zod validation for forms

## Development Tools

- **pnpm** as package manager (required - enforced via preinstall)
- **ESLint** with TypeScript, Prettier, Tailwind, and custom rules
- **Jest** with React Native Testing Library for unit tests
- **Maestro** for E2E testing
- **Husky** for git hooks with lint-staged

## Build & Deployment

- **EAS Build** for native builds across environments (dev/staging/production)
- **Sentry** for error tracking and performance monitoring
- **Environment-based configuration** with strict validation

## Common Commands

### Development

```bash
# Start development server
pnpm start

# Run on specific platforms
pnpm ios
pnpm android
pnpm web

# Environment-specific development
pnpm start:staging
pnpm start:production
```

### Building

```bash
# Prebuild for native development
pnpm prebuild
pnpm prebuild:staging
pnpm prebuild:production

# EAS builds
pnpm build:development:ios
pnpm build:staging:android
pnpm build:production:ios:sentry
```

### Quality Assurance

```bash
# Run all checks
pnpm check-all

# Individual checks
pnpm lint
pnpm type-check
pnpm test
pnpm lint:translations

# Testing
pnpm test:watch
pnpm test:ci
pnpm e2e-test
```

### Utilities

```bash
# Expo doctor for health checks
pnpm doctor

# Open native projects
pnpm xcode  # iOS project in Xcode

# Release management
pnpm app-release
```

## Architecture Patterns

### Offline-First Design

- WatermelonDB for local SQLite storage with background sync
- Supabase sync via pull/push changes protocol
- Image storage in filesystem with DB metadata references
- Local notifications independent of network

### Performance Requirements

- 60fps on mid-tier Android devices
- FlashList for all large datasets (>50 items)
- Reanimated worklets for smooth animations
- Background thread operations for database

### Code Organization

- Absolute imports via `@/*` aliases
- Strict TypeScript with consistent imports
- Component co-location pattern
- API layer separation with React Query

## Environment Management

- Multi-environment support (development/staging/production)
- Strict environment variable validation with Zod
- Bundle ID and package name suffixing per environment
- Separate Supabase projects per environment
