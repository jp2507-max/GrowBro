# Project Structure & Organization

## Root Directory Structure

```
├── src/                    # Source code
├── assets/                 # Static assets (images, fonts, icons)
├── .expo/                  # Expo configuration and cache
├── .husky/                 # Git hooks configuration
├── .maestro/               # E2E test flows
├── prompts/                # AI assistant prompts
├── scripts/                # Build and utility scripts
├── __mocks__/              # Jest mocks for testing
└── node_modules/           # Dependencies
```

## Source Code Organization (`src/`)

```
src/
├── api/                    # API layer and data fetching
│   ├── common/            # Shared API utilities
│   ├── posts/             # Post-related API calls
│   ├── index.tsx          # API exports
│   └── types.ts           # API type definitions
├── app/                    # Expo Router pages (file-based routing)
│   ├── (app)/             # Authenticated app routes
│   ├── feed/              # Community feed screens
│   ├── _layout.tsx        # Root layout
│   ├── login.tsx          # Authentication screen
│   └── onboarding.tsx     # User onboarding
├── components/            # Reusable UI components
│   ├── ui/                # Base UI components
│   ├── settings/          # Settings-specific components
│   └── *.tsx              # Feature components
├── lib/                   # Utilities and configuration
│   ├── auth/              # Authentication logic
│   ├── hooks/             # Custom React hooks
│   ├── i18n/              # Internationalization setup
│   ├── env.js             # Environment configuration
│   └── utils.ts           # Utility functions
├── translations/          # i18n translation files
│   ├── en.json            # English translations
│   └── ar.json            # Arabic translations
└── types/                 # TypeScript type definitions
    └── index.ts           # Global type exports
```

## Key Conventions

### File Naming

- **kebab-case** for all files (enforced by ESLint)
- Component files: `component-name.tsx`
- Hook files: `use-hook-name.ts`
- Utility files: `utility-name.ts`
- Test files: `component-name.test.tsx`

### Import Aliases

- `@/*` → `./src/*` (all source code)
- `@env` → `./src/lib/env.js` (environment variables)

### Component Structure

- UI components in `src/components/ui/`
- Feature-specific components in `src/components/`
- Page components in `src/app/` (Expo Router)

### API Organization

- Feature-based API modules in `src/api/`
- Shared utilities in `src/api/common/`
- Type definitions in `src/api/types.ts`

### Styling Approach

- **NativeWind** (Tailwind CSS) for styling
- Color system defined in `src/components/ui/colors.js`
- Global styles in `global.css`
- Component-specific styles using Tailwind classes

### State Management

- **Zustand** for global state
- **React Query** for server state
- **WatermelonDB** for local/offline data
- Local component state with `useState`

### Testing Structure

- Test files alongside source files
- Mocks in `__mocks__/` directory
- Test utilities in `src/lib/test-utils.tsx`
- Jest configuration in `jest.config.js`

## Configuration Files

### Environment & Build

- `env.js` - Environment variable validation and configuration
- `app.config.ts` - Expo configuration
- `eas.json` - EAS Build configuration
- `.env.*` files - Environment-specific variables

### Code Quality

- `eslint.config.mjs` - ESLint configuration (flat config)
- `.prettierrc.js` - Prettier formatting rules
- `tsconfig.json` - TypeScript configuration
- `commitlint.config.js` - Commit message linting

### Build Tools

- `babel.config.js` - Babel transpilation
- `metro.config.js` - Metro bundler configuration
- `tailwind.config.js` - Tailwind CSS configuration

## Development Workflow

1. **Feature Development**: Create components in appropriate directories
2. **Routing**: Add pages to `src/app/` for automatic routing
3. **API Integration**: Add API calls to `src/api/` modules
4. **Styling**: Use NativeWind classes, extend colors in theme
5. **Testing**: Write tests alongside components
6. **Internationalization**: Add strings to translation files

## Offline-First Architecture

- **WatermelonDB** for local SQLite storage
- **Sync engine** with pull/push changes
- **Image storage** in app cache directories
- **Queue system** for offline operations
- **Conflict resolution** using last-write-wins
