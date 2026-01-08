---
trigger: always_on
---

# React Native/Expo Project

You are an expert in TypeScript, React Native, Expo, and Mobile UI development with Nativewind.

Every time you choose to apply a rule(s), explicitly state the rule(s) in the output. You can abbreviate the rule description to a single word or phrase.

## Project Context

## Code Style and Structure

- Write concise, technical TypeScript code with accurate examples
- Use functional and declarative programming patterns; avoid classes
- Prefer iteration and modularization over code duplication
- Use descriptive variable names with auxiliary verbs (e.g., isLoading, hasError)
- Ensure components are modular, reusable, and maintainable.
- Component Modularity: Break down components into smaller, reusable pieces. Keep components focused on a single responsibility.
- Function Length Guidelines (enforced by ESLint):
  - **Global default**: ~110 lines (warning) - suitable for most React Native/Expo code
  - **JSX-heavy components** (screens, modals, sheets): up to 150 lines (warning) - allows for complex layouts
  - **Services, hooks, utilities**: 90 lines (error) - stricter for business logic
  - **Tests, stories, generated files**: no limit - complexity varies
- To install new packages use `npx expo install <package-name>`

## Tech Stack

Core: Expo 54, React Native, TypeScript, Nativewind (Tailwind), Expo Router v6.
State: React Query + react-query-kit, Zustand.
Database: WatermelonDB (offline-first local), Supabase (backend).
Forms: React Hook Form + Zod.
UI: @gorhom/bottom-sheet, @shopify/flash-list, react-native-reanimated, react-native-gesture-handler.
i18n: i18next + react-i18next.
Monitoring: @sentry/react-native.

For exact versions, check `package.json`.

## Supabase Integration

- Use MCP tools for database migrations, schema changes, and backend management
- Supabase client is configured in `src/lib/supabase.ts` for authentication, queries, and real-time features
- Environment variables are managed through the env.js system (SUPABASE_URL, SUPABASE_ANON_KEY)
- AsyncStorage is used for session persistence in React Native

## Sentry

- We use `@sentry/react-native` for crash reporting and performance monitoring.
- We leverage the Sentry MCP server for issue insights, traces, and docs lookups during development. Ensure it is configured in `.cursor/mcp.json`.

## Naming Conventions

- Favor named exports for components and utilities
- Use kebabCase for all files names and directories (e.g., visa-form.tsx)

## TypeScript Usage

- Use TypeScript for all code; prefer types over interfaces
- Avoid enums; use const objects with 'as const' assertion
- Use functional components with TypeScript interfaces
- Define strict types for message passing between different parts of the extension
- Use absolute imports for all files @/...
- Avoid try/catch blocks unless there's good reason to translate or handle error in that abstraction
- Use explicit return types for all functions

## State Management

- Use React Zustand for global state management
- Implement proper cleanup in useEffect hooks

## Syntax and Formatting

- Use "function" keyword for pure functions
- Avoid unnecessary curly braces in conditionals
- Use declarative JSX
- Implement proper TypeScript discriminated unions for message types

## Internationalization (I18n)

- make sure all user-visible strings (UI labels, buttons, error messages, placeholders, notifications, email templates, tooltips, and any text rendered to users) are internationalized in German and English

## UI and Styling

- Use Nativewind for styling and components
- Use built-in ui components such as Button, Input from `@components/ui`
- Ensure high accessibility (a11y) standards using ARIA roles and native accessibility props.
- Leverage react-native-reanimated and react-native-gesture-handler for performant animations and gestures.
- Avoid unnecessary re-renders by memoizing components and using useMemo and useCallback hooks appropriately.
- Make sure to use defined colors and fonts in the tailwind config file.

## Error Handling

- Log errors appropriately for debugging
- Provide user-friendly error messages

## Testing

- Write unit tests using Jest and React Native Testing Library.
- Write unit tests for utilities and complex components
- The test file should be named like the component file but with the .test.tsx extension (e.g., component-name.test.tsx)
- Do not write unit tests for simple components that only show data

## Git

Use conventional commits (fix:, feat:, perf:, docs:, style:, refactor:, test:, chore:). Lowercase, max 100 chars.
