---
name: remove-growbooks-tab
overview: Hide the current “Growbooks” tab (implemented as the Playbooks feature) and remove its home/onboarding entry points, while keeping underlying Playbooks code/routes intact for future use or repurposing into automatic task schedules.
todos:
  - id: hide-growbooks-tab
    content: Remove `NativeTabs.Trigger name="playbooks"` and its icon mapping from [`src/app/(app)/_layout.tsx`](src/app/(app)/_layout.tsx).
    status: pending
  - id: remove-home-entrypoints
    content: Remove Growbooks entry points from [`src/components/home/home-dashboard.tsx`](src/components/home/home-dashboard.tsx) and [`src/components/home/activation-checklist.tsx`](src/components/home/activation-checklist.tsx).
    status: pending
  - id: update-activation-state-tests
    content: Update activation state definitions/tests that reference `open-playbook` (e.g. [`src/lib/compliance/activation-state.ts`](src/lib/compliance/activation-state.ts) and related tests).
    status: pending
  - id: update-onboarding-copy
    content: Adjust onboarding strings that mention Growbooks (translations in [`src/translations/en.json`](src/translations/en.json), [`src/translations/de.json`](src/translations/de.json), and any referenced slides like [`src/components/onboarding/slides/guidance-slide.tsx`](src/components/onboarding/slides/guidance-slide.tsx)).
    status: pending
  - id: verify
    content: Run targeted tests and typecheck/lint locally (e.g. `pnpm test activation-checklist`, `pnpm test home-dashboard`, plus your standard `pnpm lint`/`pnpm typecheck`).
    status: pending
---

## What I found in the codebase

- “Growbooks” is the **Playbooks** feature.
- It is currently exposed as a bottom tab via [`src/app/(app)/_layout.tsx`](<src/app/(app)/_layout.tsx>) (`NativeTabs.Trigger name="playbooks"`).
- Home also links to it via:
- [`src/components/home/home-dashboard.tsx`](src/components/home/home-dashboard.tsx) quick action `router.push('/playbooks')`
- [`src/components/home/activation-checklist.tsx`](src/components/home/activation-checklist.tsx) action `open-playbook` → `/playbooks`
- The Playbooks UI is under [`src/app/(app)/playbooks/`](<src/app/(app)/playbooks/>) and is a “select a playbook → preview → apply to a plant” flow.
- Plant creation (`/plants/create`) does **not** auto-generate a full schedule today; it only creates the plant and offers a manual “starter tasks” button.

## Proposed change (MVP)...

- Remove Playbooks/Growbooks from primary navigation to match your desired “simple, automatic tasks” loop.
- Keep Playbooks routes/code in place (no destructive deletion) so deep links/tests don’t explode and you can reuse it later as an internal engine.

## UI/UX adjustments

- Remove the Playbooks tab.
- Remove the home quick action and activation checklist item that send users to Growbooks.
- Update onboarding copy that currently markets Growbooks so the onboarding matches the simplified product.

## Follow-up

- Reuse Playbooks as _internal schedule templates_: auto-pick a template based on plant `photoperiodType` + `environment` (and later medium/pot size/strain).
- Apply it automatically on plant creation.
- Note: `PlaybookService.getPlantInfo()` is currently a stub (always `startDate: new Date()`, `timezone: 'UTC'`), so this would need proper plant data wiring before relying on it.
