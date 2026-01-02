---
name: obytes styling refactor
overview: Align GrowBro styling to the Obytes Starter Nativewind approach (SSOT colors.js + explicit Tailwind light/dark pairs + ThemeProvider wiring) by removing all legacy semantic/CSS-variable tokens and standardizing dark-mode typography.
todos:
  - id: audit-legacy-tokens
    content: Inventory all remaining legacy/semantic/CSS-var tokens (bg-card, border-border, text-text-*, bg-input-bg, border-input-border, *-divider, bg-action-*, --color-*) and group by feature folder for batch refactors.
    status: done
  - id: align-typography-defaults
    content: 'Update src/components/ui/text.tsx default to Body: text-neutral-900 dark:text-neutral-200; introduce/standardize Headline and Muted usage via class conventions (no semantic tokens).'
    status: done
  - id: fix-button-variants
    content: Update src/components/ui/button.tsx to remove invalid classes (e.g. text-secondary-600) and align interactive colors to primary/terracotta; update src/components/ui/button.test.tsx accordingly.
    status: done
  - id: refactor-input-select
    content: Refactor src/components/ui/input.tsx and src/components/ui/select.tsx to remove bg-input-bg/border-input-border and all --color-* usage; use explicit light/dark pairs and primary-based selected styling.
    status: done
  - id: replace-divider-tokens
    content: Replace bg-divider/border-divider usage in plants UI (e.g. src/components/plants/plant-stats-grid.tsx, src/app/plants/[id].tsx) with explicit border/bg utilities.
    status: done
  - id: replace-semantic-surface-border-tokens
    content: Sweep src/ and replace bg-card + border-border with explicit surface/border pairs; adjust any dark-border choice to dark:border-white/10 unless a stronger border is intentionally needed.
    status: done
  - id: replace-semantic-text-tokens
    content: Sweep src/ and replace text-text-secondary/tertiary with Muted mapping; remove or reclassify text-text-primary as Body or Headline depending on context (use primary only for headings/interactive).
    status: done
  - id: replace-action-tokens
    content: Replace bg-action-primary/bg-action-cta with palette-based utilities (primary/terracotta) and validate contrast on progress bars/CTAs.
    status: done
  - id: cleanup-global-css-comment
    content: Update global.css to remove stale reference to missing nativewind-theme-provider.tsx and document the actual theming approach used.
    status: done
  - id: verify-no-regressions
    content: Run lint/tests and ensure rg check for legacy tokens returns zero; do a quick visual pass on key screens in both light/dark and with system theme switching.
    status: in-progress
---

# Obytes-style theming & styling refactor plan

Applied rules: `projectrules.mdc` (nativewind/theming), `styling-guidelines.mdc` (no CSS vars, explicit light/dark pairs), `structure.mdc` (file locations).

## What already matches Obytes (verified in repo)

- **SSOT palette**: `src/components/ui/colors.js` is imported into `tailwind.config.js`.
- **Nativewind dark mode**: `tailwind.config.js` uses `darkMode: 'class'`.
- **Theme wiring**: `src/lib/use-theme-config.tsx` returns a React Navigation `Theme` derived from `colors.js`.
- **Persisted theme selection**: `src/lib/hooks/use-selected-theme.tsx` uses MMKV + `colorScheme.set()`.
- **Root setup**: `src/app/_layout.tsx` calls `loadSelectedTheme()` at startup and applies `className={theme.dark ? 'dark' : undefined}` on the root view.
- **Expo requirement**: NativeWind docs require `userInterfaceStyle: 'automatic'`; you already added this in `app.config.cjs` (diff shows it).

## Gaps (codebase still contains legacy tokens)

These are still present and must be removed for a strict Obytes approach:

- **Semantic Tailwind tokens** (no longer defined in `tailwind.config.js`): `bg-card`, `border-border`, `text-text-primary|secondary|tertiary`.
- **Legacy “design token” classes**: `bg-input-bg`, `border-input-border`, `bg-divider`, `border-divider`.
- **CSS-variable-based classes** (explicitly disallowed by our styling guidelines):
- `text-[--color-text-primary]`, `text-[--color-action-primary] `(e.g. `src/components/plants/plant-stats-grid.tsx`)
- `bg-[--color-selection-bg]`, `border-[--color-selection-border]`, etc (in `src/components/ui/select.tsx`)
- **Action tokens**: `bg-action-primary`, `bg-action-cta` (in `src/components/plants/plants-card.tsx`).
- **Stale documentation**: `global.css` references `src/lib/nativewind-theme-provider.tsx`, but that file does not exist.

## Dark-mode typography standard (your latest rules)

Use these consistently across the app:

- **Body**: `text-neutral-900 dark:text-neutral-200`
- **Muted/Subtext**: `text-neutral-500 dark:text-neutral-400`
- **Headline/Interactive accent**: `text-primary-900 dark:text-primary-100`

## Replacement map (strict, no compat aliases)

- **Surfaces**:
- App background: `bg-neutral-50 dark:bg-charcoal-950`
- Card/surface: replace `bg-card` → `bg-white dark:bg-charcoal-900` (use `dark:bg-charcoal-850` only where you intentionally want “elevated”)
- **Borders/dividers**:
- replace `border-border` / `border-divider` → `border-neutral-200 dark:border-white/10`
- replace `bg-divider` → `bg-neutral-200 dark:bg-white/10`
- **Text tokens**:
- replace `text-text-secondary` / `text-text-tertiary` → `text-neutral-500 dark:text-neutral-400`
- replace `text-text-primary` → usually delete and rely on `Text` default; use `text-primary-900 dark:text-primary-100` only for actual headings.
- **Inputs**:
- replace `bg-input-bg` → `bg-white dark:bg-white/10`
- replace `border-input-border` → `border-neutral-200 dark:border-white/10`
- **Action tokens**:
- replace `bg-action-primary` → `bg-primary-600` (interactive/brand)
- replace `bg-action-cta` → `bg-terracotta-500` (CTA)
- **CSS vars**:
- replace `text-[--color-…]` / `bg-[--color-…]` / `stroke-[--color-…]` with explicit palette utilities (see UI primitives section below).

## Core refactors (do these first to reduce churn)

- **Update `Text` default** (`src/components/ui/text.tsx`)
- Change base color from `text-black dark:text-white` to **Body** colors (`text-neutral-900 dark:text-neutral-200`).
- Keep `twMerge(base, className)` so callers can override (e.g. `text-white` on colored headers).
- **Fix `Button` variant colors** (`src/components/ui/button.tsx`)
- Replace invalid `text-secondary-600` with an actual palette class.
- Ensure interactive variants use “Headline/Interactive” accent where appropriate.
- Update `src/components/ui/button.test.tsx` expectations accordingly.
- **Remove tokenized input/select styling**
- `src/components/ui/input.tsx`: replace `bg-input-bg`, `border-input-border`, `text-text-tertiary` with explicit utilities aligned to the new Body/Muted rules.
- `src/components/ui/select.tsx`: replace `--color-selection-*` usage with explicit `primary`-based selected state (border/bg/text) and use the shared `Check` icon if available (`src/components/ui/icons/check.tsx`) to avoid per-component SVG token hacks.

## Bulk cleanup (feature files)

After primitives are updated, sweep `src/` and replace remaining:

- `bg-card`, `border-border`
- `text-text-primary|secondary|tertiary`
- `bg-action-primary|bg-action-cta`
- `bg-divider|border-divider`

Do this in feature-sized batches (plants, playbooks, moderation, settings, etc.) to keep diffs reviewable.

## Remove stale references

- Update `global.css` comment to reflect the current approach (ThemeProvider + root `dark` class) and remove mention of the missing provider file.

## Verification (local)

- `pnpm lint`
- `pnpm test`
- Ensure no legacy tokens remain:
- `rg "bg-card|border-border|text-text-(primary|secondary|tertiary)|bg-input-bg|border-input-border|bg-divider|border-divider|--color-" src`
- Manual spot-check (at minimum): Home, Plants list/detail, Playbooks, Settings, a BottomSheet (Select/Input), and one “colored header” screen.

## Risks / gotchas

10 To-dos · Completed In Order
New Todo
Inventory all remaining legacy/semantic/CSS-var tokens (bg-card, border-border, text-text-_, bg-input-bg, border-input-border, \_-divider, bg-action-_, --color-\_) and group by feature folder for batch refactors.
Update src/components/ui/text.tsx default to Body: text-neutral-900 dark:text-neutral-200; introduce/standardize Headline and Muted usage via class conventions (no semantic tokens).
Update src/components/ui/button.tsx to remove invalid classes (e.g. text-secondary-600) and align interactive colors to primary/terracotta; update src/components/ui/button.test.tsx accordingly.
Refactor src/components/ui/input.tsx and src/components/ui/select.tsx to remove bg-input-bg/border-input-border and all --color-\* usage; use explicit light/dark pairs and primary-based selected styling.
Replace bg-divider/border-divider usage in plants UI (e.g. src/components/plants/plant-stats-grid.tsx, src/app/plants/[id].tsx) with explicit border/bg utilities.
Sweep src/ and replace bg-card + border-border with explicit surface/border pairs; adjust any dark-border choice to dark:border-white/10 unless a stronger border is intentionally needed.
Sweep src/ and replace text-text-secondary/tertiary with Muted mapping; remove or reclassify text-text-primary as Body or Headline depending on context (use primary only for headings/interactive).
Replace bg-action-primary/bg-action-cta with palette-based utilities (primary/terracotta) and validate contrast on progress bars/CTAs.
Update global.css to remove stale reference to missing nativewind-theme-provider.tsx and document the actual theming approach used.
Run lint/tests and ensure rg check for legacy tokens returns zero; do a quick visual pass on key screens in both light/dark and with system theme switching.
Referenced by 1 Agent
New Agent
Obytes Starter template styling guidelines · Author
