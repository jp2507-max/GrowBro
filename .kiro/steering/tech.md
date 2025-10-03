# Tech Stack

## Core Technologies

- **React Native**: 0.81.4
- **Expo**: ~54.0.10 with custom development builds (not Expo Go)
- **TypeScript**: 5.9.2 (strict mode enabled)
- **Package Manager**: pnpm 10.17.0 (enforced via preinstall hook)

## Key Libraries

### UI & Styling

- **NativeWind**: 4.2.1 (Tailwind CSS for React Native)
- **Reanimated**: ~4.1.2 (animations, follow best practices, cancel on unmount)
- **Gesture Handler**: ~2.28.0
- **FlashList**: 2.0.2 (use for all lists, follow perf helpers in `lib/utils/flashlist-performance.ts`)
- **Bottom Sheet**: @gorhom/bottom-sheet 5.2.6
- **Moti**: 0.29.0 (declarative animations)

### Navigation & Routing

- **Expo Router**: ~6.0.8 (file-based routing)
- **React Navigation**: 7.1.8

### State & Data

- **React Query**: @tanstack/react-query 5.90.1 with react-query-kit 3.3.2
- **Zustand**: 5.0.8 (global state)
- **WatermelonDB**: 0.28.0 (offline-first local database, requires dev build)
- **Supabase**: 2.57.4 (backend, auth, realtime)

### Forms & Validation

- **React Hook Form**: 7.63.0
- **Zod**: 3.25.76 (schema validation)
- **@hookform/resolvers**: 3.10.0

### Internationalization

- **i18next**: 23.16.8
- **react-i18next**: 15.7.3
- **expo-localization**: ~17.0.7

### Monitoring & Error Tracking

- **Sentry**: @sentry/react-native 7.1.0

## Build & Development Commands

### Development

```bash
pnpm start                    # Start Expo dev server
pnpm android                  # Run on Android
pnpm ios                      # Run on iOS
pnpm prebuild                 # Generate native projects
pnpm xcode                    # Open iOS project in Xcode
pnpm doctor                   # Run expo-doctor diagnostics
```

### Environment-Specific

```bash
pnpm start:staging            # Start with staging env
pnpm start:production         # Start with production env
pnpm prebuild:development     # Prebuild for development
pnpm prebuild:staging         # Prebuild for staging
pnpm prebuild:production      # Prebuild for production
```

### EAS Builds

```bash
pnpm build:development:ios
pnpm build:development:android
pnpm build:staging:ios
pnpm build:staging:android
pnpm build:production:ios
pnpm build:production:android
pnpm build:production:ios:sentry      # With Sentry source maps
pnpm build:production:android:sentry  # With Sentry source maps
```

### Quality Checks

```bash
pnpm lint                     # ESLint
pnpm type-check               # TypeScript type checking
pnpm lint:translations        # Validate translation files
pnpm i18n:validate            # Validate i18next syntax
pnpm test                     # Run Jest tests
pnpm test:ci                  # Run tests with coverage
pnpm test:watch               # Run tests in watch mode
```

### Compliance & Validation

```bash
pnpm check-all                # Run all checks (lint, type, compliance, tests)
pnpm privacy:validate         # Validate privacy manifest
pnpm privacy-policy:validate  # Validate privacy policy
pnpm data-safety:generate     # Generate data safety draft
pnpm data-safety:validate     # Validate data safety
pnpm compliance:att-guard     # Check ATT compliance
pnpm compliance:siwa-guard    # Check Sign in with Apple
pnpm compliance:cannabis      # Cannabis policy scan
pnpm compliance:target-api    # Target API validation
pnpm compliance:media-audit   # Media usage audit
pnpm compliance:audit         # Full compliance audit
```

### E2E Testing

```bash
pnpm install-maestro          # Install Maestro
pnpm e2e-test                 # Run Maestro tests
```

## Configuration Files

- **TypeScript**: `tsconfig.json` (strict mode, path aliases `@/*` → `./src/*`)
- **Babel**: `babel.config.js` (Expo preset, NativeWind, module resolver)
- **ESLint**: `eslint.config.mjs` (flat config, Expo, Prettier, Tailwind, a11y plugins)
- **Jest**: `jest.config.js` (jest-expo preset, coverage reporting)
- **Tailwind**: `tailwind.config.js` (NativeWind preset, custom colors from `src/components/ui/colors`)
- **Metro**: `metro.config.js` (bundler config)
- **EAS**: `eas.json` (build profiles)
- **Expo**: `app.config.cjs` (dynamic config based on APP_ENV)

## Environment Variables

Create `.env.development`, `.env.staging`, `.env.production` files. Schema defined in `env.js`.

Required keys:

- `APP_ENV`: development | staging | production
- `API_URL`: Backend API URL
- `EXPO_PUBLIC_API_BASE_URL`: Public API base URL
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `SENTRY_DSN`: (optional) Sentry DSN for error tracking

## Code Quality Tools

- **Husky**: Git hooks (pre-commit, commit-msg, post-merge)
- **Commitlint**: Conventional commits enforced
- **Lint-staged**: Run linters on staged files
- **Prettier**: Code formatting (integrated with ESLint)

## Performance Guidelines

- Use FlashList for all lists (never FlatList)
- Target 60fps on mid-tier Android devices
- Batch database operations
- Keep writes off UI thread
- Avoid N+1 queries
- Cancel animations on unmount
- Use Reanimated worklets for smooth animations

## Offline-First Architecture

- **Local Database**: WatermelonDB (SQLite, background thread)
- **Sync Engine**: Custom pull/push with Supabase Edge Functions
- **Conflict Resolution**: Last-Write-Wins (server authoritative)
- **Image Storage**: File system (not in DB), content-addressable names
- **Notifications**: Local scheduled notifications, independent of network
