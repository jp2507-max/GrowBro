# Tech Stack & Build System

## Core Technologies

- **React Native 0.79.5** with **Expo ~53.0.22** (managed workflow)
- **TypeScript** (strict mode enabled)
- **Expo Router 5** for file-based navigation
- **NativeWind 4** for styling (Tailwind CSS for React Native)
- **React Query 5** (@tanstack/react-query) for data fetching
- **WatermelonDB** for offline-first local storage
- **Supabase** for backend services and real-time features
- **Zustand** for state management
- **React Hook Form** with Zod validation

## Key Libraries

- **UI/Animation**: Reanimated 3, Moti, @gorhom/bottom-sheet, @shopify/flash-list v2
- **Forms**: react-hook-form, @hookform/resolvers, zod
- **Internationalization**: i18next, react-i18next, expo-localization
- **Storage**: react-native-mmkv, WatermelonDB
- **Testing**: Jest, @testing-library/react-native

## Package Manager

- **pnpm** (required) - enforced via preinstall script
- Use `pnpm` for all dependency management

## Common Commands

### Development

```bash
# Start development server
pnpm start

# Run on specific platforms
pnpm ios
pnpm android
pnpm web

# Environment-specific builds
pnpm start:staging
pnpm start:production
```

### Building & Deployment

```bash
# Prebuild for native platforms
pnpm prebuild
pnpm prebuild:staging
pnpm prebuild:production

# EAS builds
pnpm build:development:ios
pnpm build:staging:android
pnpm build:production:ios
```

### Code Quality

```bash
# Linting and type checking
pnpm lint
pnpm type-check
pnpm lint:translations

# Testing
pnpm test
pnpm test:watch
pnpm test:ci

# Run all checks
pnpm check-all
```

### Utilities

```bash
# Expo doctor for health checks
pnpm doctor

# E2E testing with Maestro
pnpm e2e-test

# Release management
pnpm app-release
```

## Environment Configuration

- **Multi-environment setup**: development, staging, production
- Environment files: `.env.development`, `.env.staging`, `.env.production`
- Use `APP_ENV` variable to switch environments
- Client vs build-time environment variables are strictly separated

## Build System Notes

- **Expo development build required** for WatermelonDB
- **Not compatible with Expo Go** due to native dependencies
- Uses **Metro bundler** with NativeWind integration
- **New Architecture enabled** (React Native's new architecture)
- **Typed routes** enabled for Expo Router
