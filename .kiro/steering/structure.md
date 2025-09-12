# Project Structure & Organization

## Root Directory Structure

```
├── src/                    # Main source code
├── assets/                 # Static assets (images, fonts, icons)
├── supabase/              # Supabase functions and migrations
├── .expo/                 # Expo configuration and cache
├── .kiro/                 # Kiro AI assistant configuration
├── .maestro/              # E2E test configurations
├── __mocks__/             # Jest mocks for testing
├── scripts/               # Build and utility scripts
├── docs/                  # Project documentation
└── prompts/               # AI assistant prompts
```

## Source Code Organization (`src/`)

### Core Directories

- **`src/app/`** - Expo Router pages and layouts (file-based routing)
- **`src/components/`** - Reusable UI components
- **`src/lib/`** - Business logic, utilities, and services
- **`src/api/`** - API layer and data fetching logic
- **`src/types/`** - TypeScript type definitions
- **`src/translations/`** - Internationalization files

### Component Structure (`src/components/`)

- **`ui/`** - Base UI components (buttons, inputs, typography)
- **Feature-specific folders** - Components grouped by feature (calendar, settings, sync)
- **Root level** - Shared components used across features

### Library Structure (`src/lib/`)

- **`auth/`** - Authentication logic and utilities
- **`hooks/`** - Custom React hooks
- **`i18n/`** - Internationalization configuration
- **`utils/`** - General utility functions
- **`watermelon-models/`** - Database models and schema
- **Feature-specific folders** - Business logic grouped by feature

## File Naming Conventions

- **kebab-case** for all files and directories (enforced by ESLint)
- **PascalCase** for React components
- **camelCase** for functions and variables
- **SCREAMING_SNAKE_CASE** for constants

## Import Path Aliases

- `@/*` maps to `./src/*` for clean imports
- `@env` maps to environment variables via `./src/lib/env.js`

## Architecture Patterns

### Component Organization

- Components are organized by feature and reusability
- UI components use Tailwind variants for consistent styling
- Each component should have a single responsibility

### Data Layer

- **WatermelonDB** for offline-first local storage
- **Supabase** for backend services and real-time sync
- **React Query** for server state management and caching
- **Zustand** for client-side state management

### Navigation Structure

- File-based routing with Expo Router
- Typed routes enabled for type safety
- Layout components for shared UI structure

### Environment Configuration

- Environment variables managed through `env.js` with Zod validation
- Separate client and build-time variable schemas
- Environment-specific `.env` files for different deployment targets

## Code Quality Standards

- **TypeScript strict mode** enabled
- **ESLint** with comprehensive rule set including:
  - Import sorting and unused import removal
  - Tailwind class ordering
  - Maximum function length (70 lines) and parameters (3)
  - Filename case enforcement
- **Prettier** for code formatting
- **Husky** git hooks for pre-commit quality checks

## Testing Structure

- **Unit tests** co-located with source files (`*.test.ts`)
- **Mocks** in `__mocks__/` directory for external dependencies
- **E2E tests** in `.maestro/` directory
- **Test utilities** in `src/lib/test-utils.tsx`

## Asset Organization

- **Icons and images** in `assets/` directory
- **Fonts** in `assets/fonts/`
- **App icons** with environment-specific badges for non-production builds
