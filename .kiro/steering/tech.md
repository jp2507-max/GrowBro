# Technology Stack & Build System

## Core Technologies

- **Framework**: React Native with Expo SDK 54
- **Language**: TypeScript with strict mode enabled
- **Package Manager**: pnpm (required, enforced via preinstall hook)
- **Navigation**: Expo Router v6 with typed routes
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **State Management**: Zustand
- **Data Fetching**: TanStack React Query with react-query-kit
- **Database**: WatermelonDB (offline-first local database)
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Forms**: React Hook Form with Zod validation
- **Internationalization**: i18next with react-i18next
- **Animations**: Moti and React Native Reanimated
- **Error Tracking**: Sentry

## Development Tools

- **Linting**: ESLint with TypeScript, Prettier, Tailwind, and custom rules
- **Testing**: Jest with React Native Testing Library
- **E2E Testing**: Maestro
- **Git Hooks**: Husky with commitlint (conventional commits)
- **Code Quality**: Lint-staged for pre-commit checks

## Environment Management

### Security Guidelines

- **Never expose secrets to client bundles**: Do not use `NEXT_PUBLIC` or equivalent prefixes for sensitive values
- **Store secrets securely**: Use EAS/CI secret store or server-only environment variables (never in repo or client .env files)
- **Validate at correct times**: Client-side values validated at build-time only; server-only envs validated at both build-time and runtime startup

### Environment Configuration

- Environment-specific configs via `.env.{APP_ENV}` files (e.g., `.env.development`, `.env.staging`, `.env.production`)
- **Client-safe files**: `.env.development`, `.env.staging` (can contain non-sensitive values)
- **Server-only files**: `.env.production` (should contain only secrets, validated at runtime)
- Zod validation for environment variables in `env.js`
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

- **Metro**: Custom config for React Native bundling
- **EAS Build**: Configured for multiple environments with different distribution channels
- **Babel**: Module resolver for path aliases (`@/*` → `./src/*`); WatermelonDB requires legacy decorator semantics - add plugins in this order: `@babel/plugin-proposal-decorators` with `{ legacy: true }` before `@babel/plugin-proposal-class-properties` with `{ loose: true }` (plugin ordering is critical to avoid breakage)
- **TypeScript**: Strict mode with path mapping and experimental decorators; WatermelonDB requires `experimentalDecorators: true` and `useDefineForClassFields: false` in tsconfig for consistent decorator and class field compilation

## Key Dependencies

- **UI Components**: Custom component library with Tailwind variants
- **Database**: WatermelonDB with SQLite adapter and Expo plugin
- **Networking**: Axios with React Query for API calls
- **Storage**: MMKV for fast key-value storage, AsyncStorage as fallback
- **Notifications**: Expo Notifications with background task support
- **Image Handling**: Expo Image with manipulation capabilities
