## Plan: Replace Zustand property selectors

We’ll keep Zustand and migrate away from property selectors (`store.use.foo()` / `useAgeGate.status()`) to direct selector hooks (`useStore((s) => s.foo)`), starting with the compiler-excluded and layout files that are most likely to crash. We’ll keep `createSelectors` initially to reduce churn, update tests that mock the old selector API, and only shrink the React Compiler exclusion list once each area is stable.

**Steps**

1. Add base-hook exports for compliance stores that currently only export `.use` object to enable direct selectors without breaking existing imports: update `src/lib/compliance/age-gate.ts`, `src/lib/compliance/onboarding-state.ts`, `src/lib/compliance/legal-acceptances.ts` (activation already has `useActivationStore`).
2. Refactor property selector usage in the highest-risk files to direct selector hooks:
   - `src/app/_layout.tsx`, `src/app/(app)/_layout.tsx`, `src/app/age-gate.tsx`
   - `src/components/community/use-post-card.ts`
   - `src/components/strains/favorite-button-connected.tsx`
   - `src/lib/strains/use-favorites-auto-sync.ts`
3. Refactor remaining `.use.*` callsites across app and components (prioritize notification/settings/auth screens, sync components) using patterns already present in `src/lib/auth/use-session-management.ts` and `useShallow` usage in `src/lib/strains/use-list-favorites.ts` for multi-field selectors.
4. Handle special cases like `useFavorites.use.getFavorites()()` by selecting the function via the store hook and calling it outside the selector.
5. Update tests mocking selector APIs to target the new base hooks (`src/__tests__/app/layouts/onboarding-flow.test.tsx`, `src/__tests__/app/settings/privacy-and-data.test.tsx`, `src/lib/compliance/activation-state.test.ts`).
6. Clean up React Compiler exclusions in `babel.config.js` only after the migrated files are stable; remove stale paths and the now-unneeded `eslint-disable react-compiler` comments in layouts.

**Verification**

- Run tests tied to affected areas: onboarding/layout tests, privacy settings test, activation state test, and favorites tests.
- Lint for React Compiler rule regressions.
- Manual checks: app boot gating (age gate → onboarding), favorites toggles + sync, community post card, notifications screen.

**Decisions**

- Approach A (direct selectors) is the default; keep `createSelectors` temporarily and migrate callsites incrementally.
