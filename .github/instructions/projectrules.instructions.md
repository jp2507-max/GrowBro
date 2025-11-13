---
applyTo: '**'
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
- Structure repository files as follows:

```
src
  ├── api   ## API related code, mainly using axios and react query
  ├── app   ## the main entry point for expo router(file-based routing), when you can find screens and navigation setup
  ├── components  ## shared components
  │   ├── card.tsx
  │   └── ui  ## core ui components. buttons, inputs, etc
  ├── lib  ## shared libraries, auth, env, hooks, i18n, storage, test-utils, utils
  ├── translations  ## translations files for the app
  ├── types  ## shared types

```

## Tech Stack

- Expo 54 (expo@~54.0.13)
- React Native (react-native@0.81.4)
- TypeScript (typescript@^5.9.2)
- Nativewind (Tailwind CSS for React Native) (nativewind@^4.2.1, tailwindcss@3.4.4)
- Expo Router v6 (expo-router@~6.0.12)
- React Query with React Query Kit (@tanstack/react-query@^5.90.1, react-query-kit@^3.3.2)
- Zustand (zustand@^5.0.8)
- React Native Keyboard Controller (react-native-keyboard-controller@^1.18.5)
- React Native SVG (react-native-svg@~15.12.1)
- React Native MMKV (react-native-mmkv@~3.1.0)
- Supabase (Backend & Database) (@supabase/supabase-js@^2.57.4)
- WatermelonDB (local database) (@nozbe/watermelondb@^0.28.0, @morrowdigital/watermelondb-expo-plugin@^2.3.3)
- Axios (HTTP client) (axios@^1.12.2)
- React Hook Form + Zod (forms and validation) (react-hook-form@^7.63.0, zod@^3.25.76, @hookform/resolvers@^3.10.0)
- i18next + react-i18next (internationalization) (i18next@^23.16.8, react-i18next@^15.7.3)
- @gorhom/bottom-sheet (bottom sheets) (@gorhom/bottom-sheet@^5.2.6)
- @shopify/flash-list (high-performance lists) (@shopify/flash-list@2.0.2)
- @shopify/react-native-skia ^2.3.10
- react-native-flash-message (toast notifications) (react-native-flash-message@^0.4.2)
- react-native-gesture-handler and react-native-reanimated (gestures and animations) (react-native-gesture-handler@~2.28.0, react-native-reanimated@~4.1.0)
- react-native-screens and react-native-safe-area-context (navigation primitives) (react-native-screens@~4.16.0, react-native-safe-area-context@5.6.1)
- react-native-edge-to-edge (layout) (react-native-edge-to-edge@^1.7.0)
- react-native-url-polyfill (URL APIs) (react-native-url-polyfill@^2.0.0)
- Luxon (date/time utilities) (luxon@^3.7.2)
- tailwind-variants (variant utilities for Nativewind) (tailwind-variants@^0.2.1)
- Charts: react-native-gifted-charts (react-native-gifted-charts@^1.4.64)
- Drag-and-drop: react-native sortables
- Expo modules: Image, Font, Constants, System UI, Updates, Linking, Localization, Notifications, Blur, Document Picker, Sharing, Image Manipulator, Background Task, Task Manager, Dev Client (expo-image@~3.0.9, expo-font@~14.0.9, expo-constants@~18.0.9, expo-system-ui@~6.0.7, expo-updates@~29.0.12, expo-linking@~8.0.8, expo-localization@~17.0.7, expo-notifications@~0.32.12, expo-blur@~15.0.7, expo-document-picker@~14.0.7, expo-sharing@~14.0.7, expo-image-manipulator@~14.0.7, expo-background-task@~1.0.8, expo-task-manager@~14.0.7, expo-dev-client@~6.0.15)
- Sentry (@sentry/react-native) for error and performance monitoring (@sentry/react-native@^7.2.0)

Additional utilities in use

- Network: @react-native-community/netinfo@11.4.1
- Storage: @react-native-async-storage/async-storage@^2.2.0
- Animations: moti@^0.29.0, react-native-worklets@0.5.1
- Misc RN: react-native-restart@0.0.27, react-native-quick-base64@^2.2.2
- Web: react-native-web@~0.21.1, react-dom@19.1.0
- Data/utils: papaparse@^5.5.3, lodash.memoize@^4.1.2, rrule@^2.8.1, react-error-boundary@^4.1.2
- Badging: app-icon-badge@^0.1.2

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

Here is a simple example of how a component should be written using :

```tsx
import * as React from 'react';

import { Text, View, Image, SafeAreaView } from '@/components/ui';

// Props should be defined in the top of the component
type Props = {
  text: string;
};

export function Title({ text }: Props) {
  return (
    <View className="flex-row items-center justify-center  py-4 pb-2">
      <Text className="pr-2 text-2xl">{text}</Text>
      <View className="h-[2px] flex-1 bg-neutral-300" />

      <Image
        // Use a documented import alias or a relative path to assets. In this repo
        // the alias `@/assets` isn't guaranteed in all setups, so prefer a
        // relative path from the file where the component lives, for example:
        source={require('../../assets/images/demo.png')}
        style={{ width: 24, height: 24 }}
        // `contentFit` is supported by `expo-image`. If `Image` here is a
        // re-export of `expo-image` then `contentFit` can be used. Otherwise
        // remove it or use `resizeMode` for the native Image component.
      />
    </View>
  );
}
```

## Error Handling

- Log errors appropriately for debugging
- Provide user-friendly error messages

## Testing

- Write unit tests using Jest and React Native Testing Library.
- Write unit tests for utilities and complex components
- The test file should be named like the component file but with the .test.tsx extension (e.g., component-name.test.tsx)
- Do not write unit tests for simple components that only show data

## Git Usage

Commit Message Prefixes:

- "fix:" for bug fixes
- "feat:" for new features
- "perf:" for performance improvements
- "docs:" for documentation changes
- "style:" for formatting changes
- "refactor:" for code refactoring
- "test:" for adding missing tests
- "chore:" for maintenance tasks

Rules:

- Use lowercase for commit messages
- Keep the summary line concise with a maximum of 100 characters
- Reference issue numbers when applicable

## Documentation

- Maintain clear README with the following sections:
  - Setup ( how to install and run the project )
  - Usage ( listing all the commands and how to use them )
  - Stack ( the tech stack used in the project )
  - Folder Structure ( the folder structure of the project only the important ones inside src )
