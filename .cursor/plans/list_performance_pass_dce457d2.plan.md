---
name: list_performance_pass
overview: Investigate and reduce scroll jank (JS FPS drops) on Home and Strains screens in dev/prod by eliminating unnecessary re-renders, avoiding non-virtualized lists, and reducing per-row subscriptions/work during scroll.
todos:
  - id: measure-release
    content: Run the same scroll test in release/profile build and capture UI/JS FPS + key traces.
    status: pending
  - id: home-virtualize
    content: Refactor Home screen from ScrollView+map to FlashList with header sections and plant items.
    status: pending
  - id: home-dedupe-attention
    content: Remove duplicate usePlantsAttention call; compute attention map once and pass down.
    status: pending
  - id: strains-favorites-subscription
    content: Reduce per-row favorites store subscriptions by lifting favorites state to list-level (or another existing shared context) and rendering a lighter favorite button per row.
    status: pending
  - id: verify
    content: Re-check FPS and confirm no regression in UX (search, filters, navigation, favorites).
    status: pending
---

## Goal

Improve perceived scroll smoothness on **Home** and **Strains** by reducing JS-thread work during fast scroll, while keeping the existing UX/visual design.

## What I found (codebase)

- Home (`[src/app/(app)/index.tsx](src/app/\\\(app)/index.tsx)`) uses a **non-virtualized** `ScrollView` and renders plant cards via `plants.map(...)`.
- Home computes plant attention via `usePlantsAttention()` **twice**:
- In `[src/app/(app)/index.tsx](src/app/\\\(app)/index.tsx) `to compute `taskCount`.
- In [`src/components/home/plants-section.tsx`](src/components/home/plants-section.tsx) again for per-plant `needsAttention`.
  `usePlantsAttention` is a React Query hook that runs potentially expensive task scanning/date parsing ([`src/lib/hooks/use-plants-attention.ts`](src/lib/hooks/use-plants-attention.ts)).
- Strains list is already `FlashList`-based ([`src/components/strains/strains-list-with-cache.tsx`](src/components/strains/strains-list-with-cache.tsx)), and `StrainCard` is `React.memo`, but each card mounts a `FavoriteButtonConnected` which subscribes to the favorites Zustand store ([`src/components/strains/favorite-button-connected.tsx`](src/components/strains/favorite-button-connected.tsx)). With large lists, many per-row subscriptions can add overhead when the store updates.

## Approach

### Measure first (avoid optimizing dev-only artifacts)

- Re-check the same scroll scenario in a **release/profile build** to separate “dev overhead” from real issues.

### Home screen fixes (highest ROI)

- Replace the Home `ScrollView` with a **virtualized list** (FlashList) so only visible rows mount.
- Put non-list sections (activation checklist, error card, etc.) into `ListHeaderComponent`.
- Render plant cards as list items.
- **Deduplicate** `usePlantsAttention`:
- Fetch attention map once in the Home screen and pass it into `PlantsSection`, or render plant list directly in the Home screen.
- Remove per-item inline closures when avoidable (pass `onPlantPress` through and let `PlantCard` call it with `plant.id`).

### Strains list targeted optimizations

- Reduce per-row subscriptions by moving favorites lookup to list level:
- Subscribe to favorites once in the list container, compute `isFavorite` for each row, and render a “dumb” favorite button.
- Keep toggle behavior via store actions, but avoid N subscriptions for N rows.
- Confirm no JS work is happening per-frame during scroll (keep scroll handlers on the UI runtime).

## Verification

- Compare dev vs release/profile FPS on the same device.
- Confirm Home and Strains keep **UI ~60** and **JS significantly higher** during aggressive scroll.

## Rules applied

- `projectrules.mdc`: TypeScript, reuse existing patterns/utils, avoid unnecessary new abstractions.
- `styling-guidelines.mdc`: keep `className` stable; keep scroll/animation logic on Reanimated worklets; avoid per-frame JS work.
