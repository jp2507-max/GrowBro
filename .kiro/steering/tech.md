# Technology Stack & Build System

## Core Technologies

- **Framework**: React Native with Expo SDK 54 (expo@~54.0.10, react-native@0.81.4)
- **Language**: TypeScript with strict mode enabled (typescript@^5.9.2)
- **Package Manager**: pnpm (required, enforced via preinstall hook; packageManager: pnpm@10.17.0)
- **Navigation**: Expo Router with typed routes (expo-router@~6.0.8)
- **Styling**: NativeWind (Tailwind CSS for React Native) (nativewind@^4.2.1, tailwindcss@3.4.4)
- **State Management**: Zustand (zustand@^5.0.8)
- **Data Fetching**: TanStack React Query with react-query-kit (@tanstack/react-query@^5.90.1, react-query-kit@^3.3.2)
- **Database**: WatermelonDB (offline-first local database) (@nozbe/watermelondb@^0.28.0, @morrowdigital/watermelondb-expo-plugin@^2.3.3)
- **Backend**: Supabase (PostgreSQL, Auth, Storage) (@supabase/supabase-js@^2.57.4)
- **Forms**: React Hook Form with Zod validation (react-hook-form@^7.63.0, zod@^3.25.76, @hookform/resolvers@^3.10.0)
- **Internationalization**: i18next with react-i18next (i18next@^23.16.8, react-i18next@^15.7.3)
- **Animations**: Moti and React Native Reanimated (moti@^0.29.0, react-native-reanimated@~4.1.0)
- **Error Tracking**: Sentry (@sentry/react-native@^6.20.0)

## Development Tools

- **Linting**: ESLint with TypeScript, Prettier, Tailwind, and custom rules (eslint@^9.36.0, @typescript-eslint/\*@^8.44.1, prettier@^3.6.2, eslint-plugin-tailwindcss@^3.18.2)
- **Testing**: Jest with React Native Testing Library (jest@^29.7.0, @testing-library/react-native@^12.9.0, jest-expo@~54.0.12)
- **E2E Testing**: Maestro (CLI install provided via script in package.json)
- **Git Hooks**: Husky with commitlint (conventional commits) (husky@^9.1.7, @commitlint/cli@^19.8.1)
- **Code Quality**: Lint-staged for pre-commit checks (lint-staged@^15.5.2)

## Environment Management

### Security Guidelines

- **Never expose secrets to client bundles**: Do not use `NEXT_PUBLIC` or equivalent prefixes for sensitive values
- **Store secrets securely**: Use EAS/CI secret store or server-only environment variables (never in repo or client .env files)
- **Validate at correct times**: Client-side values validated at build-time only; server-only envs validated at both build-time and runtime startup

### Environment Configuration

- Environment-specific configs via `.env.{APP_ENV}` files (e.g., `.env.development`, `.env.staging`, `.env.production`)
- **Client-safe files**: `.env.development`, `.env.staging` (can contain non-sensitive values)
- **Server-only files**: `.env.production` (should contain only secrets, validated at runtime)
- Zod validation for environment variables in `env.js` (zod@^3.25.76)
- Three environments: development, staging, production
- Environment variables split into client-side and build-time variables

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
# Prebuild for different environments
pnpm prebuild:development
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
pnpm i18n:validate
pnpm lint:translations
```

### Testing

```bash
# Unit tests
pnpm test
pnpm test:watch
pnpm test:ci

# E2E tests
pnpm e2e-test
```

## Build Configuration

- **Metro**: Custom config for React Native bundling (uses @expo/metro-runtime@~6.1.2)
- **EAS Build**: Configured for multiple environments with different distribution channels
- **Babel**: Module resolver for path aliases (`@/*` → `./src/*`); WatermelonDB requires legacy decorator semantics — add plugins in this order: `@babel/plugin-proposal-decorators` (@babel/plugin-proposal-decorators@^7.28.0) with `{ legacy: true }` before `@babel/plugin-transform-class-properties` (@babel/plugin-transform-class-properties@^7.27.1) with `{ loose: true }` (plugin ordering is critical to avoid breakage)
- **TypeScript**: Strict mode with path mapping and experimental decorators; WatermelonDB requires `experimentalDecorators: true` and `useDefineForClassFields: false` in tsconfig for consistent decorator and class field compilation (typescript@^5.9.2)

## Key Dependencies

- **UI Components**: Custom component library with Tailwind variants (tailwind-variants@^0.2.1)
- **Database**: WatermelonDB with SQLite adapter and Expo plugin (@nozbe/watermelondb@^0.28.0, @morrowdigital/watermelondb-expo-plugin@^2.3.3)
- **Networking**: Axios with React Query for API calls (axios@^1.12.2, @tanstack/react-query@^5.90.1)
- **Storage**: MMKV for fast key-value storage, AsyncStorage as fallback (react-native-mmkv@~3.1.0, @react-native-async-storage/async-storage@^2.2.0)
- **Notifications**: Expo Notifications with background task support (expo-notifications@~0.32.11, expo-task-manager@~14.0.7)
- **Image Handling**: Expo Image with manipulation capabilities (expo-image@~3.0.8, expo-image-manipulator@~14.0.7)
