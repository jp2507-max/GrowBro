# Project Structure

## Root Organization

```
├── src/                      # Application source code
├── android/                  # Native Android project
├── ios/                      # Native iOS project (generated)
├── assets/                   # Static assets (fonts, images)
├── supabase/                 # Backend functions and migrations
├── scripts/                  # Build, compliance, and validation scripts
├── docs/                     # Documentation and compliance docs
├── compliance/               # Compliance configuration files
├── __mocks__/                # Jest mocks for native modules
├── .kiro/                    # Kiro AI assistant configuration
├── .maestro/                 # E2E test flows
└── plugins/                  # Expo config plugins
```

## Source Directory (`src/`)

### `src/app/` - Expo Router File-Based Routing

- `_layout.tsx` - Root layout with providers
- `(app)/` - Main authenticated app screens
- `(modals)/` - Modal screens
- `community/` - Community feature screens
- `feed/` - Feed screens
- `notifications/` - Notification screens
- `settings/` - Settings screens
- `age-gate.tsx`, `login.tsx`, `onboarding.tsx` - Auth flows

### `src/components/` - UI Components

- `ui/` - Base UI components (buttons, inputs, typography)
- `calendar/` - Calendar and task components
- `community/` - Community feed components
- `home/` - Home screen components
- `navigation/` - Navigation components
- `notifications/` - Notification components
- `plants/` - Plant management components
- `settings/` - Settings components
- `shared/` - Shared/common components
- `strains/` - Strain-related components
- `sync/` - Sync status components

### `src/api/` - Data Fetching Layer

- `common/` - Shared API utilities
- `moderation/` - Moderation endpoints
- `notifications/` - Notification endpoints
- `plants/` - Plant CRUD operations
- `posts/` - Community post operations
- `strains/` - Strain data operations
- `index.tsx` - API client setup
- `types.ts` - API type definitions

Uses React Query (via react-query-kit) for data fetching, caching, and mutations.

### `src/lib/` - Core Utilities & Business Logic

- `alarms/` - Local alarm scheduling
- `animations/` - Animation utilities
- `auth/` - Authentication logic
- `compliance/` - Compliance checks and validators
- `hooks/` - Custom React hooks
- `i18n/` - Internationalization setup
- `ics/` - Calendar export utilities
- `media/` - Image/video handling
- `moderation/` - Content moderation
- `navigation/` - Navigation utilities
- `notifications/` - Push notification logic
- `permissions/` - Permission handling
- `privacy/` - Privacy controls
- `rrule/` - Recurring task rules
- `storage/` - Local storage (MMKV)
- `strains/` - Strain data utilities
- `sync/` - Sync engine logic
- `tasks/` - Task management
- `uploads/` - File upload utilities
- `utils/` - General utilities
- `watermelon-models/` - WatermelonDB models
- `watermelon-schema.ts` - Database schema
- `watermelon-migrations.ts` - Database migrations
- `watermelon.ts` - Database initialization
- `supabase.ts` - Supabase client setup
- `env.js` - Environment variable validation

### `src/translations/` - i18n Files

- `en.json` - English translations
- `de.json` - German translations

All keys must be identical across files (enforced by ESLint).

### `src/types/` - TypeScript Type Definitions

- `agenda.ts` - Agenda/calendar types
- `calendar.ts` - Calendar types
- `strains.ts` - Strain types
- `templates.ts` - Template types
- `index.ts` - Exported types
- `*.d.ts` - Module declarations

## Backend (`supabase/`)

- `functions/` - Supabase Edge Functions (Deno)
- `migrations/` - Database migrations (SQL)

Edge Functions use `jsr:` and `npm:` specifiers (Deno-style imports).

## Scripts (`scripts/`)

Node.js scripts for:

- Compliance validation (`ci-*.js`)
- Privacy manifest validation
- Data safety generation
- Design token coverage
- Android manifest scanning
- Cannabis policy checks

## Key Conventions

### File Naming

- **kebab-case** for all files (enforced by ESLint)
- Components: `my-component.tsx`
- Tests: `my-component.test.tsx` or `my-component.spec.tsx`
- Types: `my-types.ts`

### Import Aliases

- `@/*` maps to `src/*`
- `@env` maps to `src/lib/env`

### Component Organization

- One component per file
- Co-locate tests with components
- Export named exports (not default exports preferred)
- Keep components under 70 lines (enforced by ESLint)
- Max 3 function parameters (enforced by ESLint)

### State Management

- **Local state**: React useState/useReducer
- **Server state**: React Query (via react-query-kit)
- **Global state**: Zustand stores
- **Persistent state**: MMKV (via `src/lib/storage`)
- **Database**: WatermelonDB models in `src/lib/watermelon-models/`

### Styling

- Use NativeWind (Tailwind) classes
- Custom colors defined in `src/components/ui/colors`
- No inline styles (warned by ESLint)
- Design tokens enforced by custom ESLint plugin

### Testing

- Jest with jest-expo preset
- React Native Testing Library
- Tests co-located with source files
- Mocks in `__mocks__/` directory
- Coverage reports in `coverage/`

### Accessibility

- All interactive elements need accessibility labels
- Enforced by react-native-a11y ESLint plugin
- 44pt minimum touch targets
- Proper ARIA roles and states

### Internationalization

- No hardcoded strings in UI code
- Use `useTranslation()` hook from react-i18next
- Keys validated by custom ESLint plugin
- Syntax validation via `pnpm i18n:validate`
