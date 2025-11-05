---
name: calendar-sortables-integration
description: 'Analysis and integration plan for adopting react-native-sortables into GrowBro calendar. Recommends a complementary adoption for intra-day reordering while retaining current provider for date-based moves; includes steps, files to change, install commands (PowerShell), risks, and next steps.'
---

## Summary

React Native Sortables (https://react-native-sortables-docs.vercel.app/) is a mature, Reanimated + RNGH based library that provides high-quality drag-and-drop reordering (Grid/Flex). It solves auto-scroll, haptics, and layout animations out of the box and is well suited for intra-container reordering (reordering tasks within a day or a list).

Our current `src/components/calendar/drag-drop-provider.tsx` implements date-driven drag behavior (vertical translation → target date), undo, recurrence/occurrence handling, and integrates with the agenda FlashList. Replacing it entirely is a large refactor (and would require rethinking virtualization / separators). A lower-risk, higher-value approach is to adopt Sortables complementarily for intra-day reordering while keeping our provider for date moves.

Recommendation: adopt Sortables for "reorder within day" (pilot) and keep current provider for cross-day/date moves. Defer a full replacement until we validate UX and accept replacing FlashList with a Sortables-based single-container model.

## Key benefits of complementary adoption

- Removes a lot of low-level gesture/auto-scroll code for reordering. Sortables provides robust auto-scroll, worklet callbacks and built-in haptics support.
- Reduces surface area for subtle bugs and performance issues when simply reordering items inside a day.
- Minimal risk: calendar-wide date moves remain handled by existing provider.

## Plan (short)

1. Add the package and optional haptics dependency.
2. Implement a `DaySortableList` wrapper for a day's task rows using `Sortable.Grid` or `Sortable.Flex`.
3. Add a small `DragHandle` inside each `AgendaItemRow` and enable `customHandle` on Sortables so Sortables only captures drag gestures from the handle.
4. Wire `onDragEnd` to update local ordering (and persist if needed); reuse our undo toast pattern for 5s undo.
5. Leave the existing pan gesture on the rest of the item to support date moves via the current provider.
6. Gate the feature behind a flag for easy rollback and testing.

## Files to add / update (proposal)

- NEW: `src/components/calendar/day-sortable-list.tsx`
  - Purpose: render tasks for a single day using `Sortable.Grid` (1 column) or `Sortable.Flex` and accept `scrollableRef` from parent.
  - Props: data, keyExtractor, renderItem, onDragEnd, enableSort (bool).

- UPDATE: `src/components/calendar/agenda-list.tsx`
  - Purpose: render `DaySortableList` for day blocks (or fallback to current List) when the feature flag is enabled.

- UPDATE: `src/components/calendar/agenda-item-row.tsx` (or equivalent)
  - Purpose: add a `DragHandle` component rendered inside row; only present when reorder-enabled.

- KEEP: `src/components/calendar/drag-drop-provider.tsx`
  - Purpose: keep existing drop-to-date, undo, recurrence logic; Sortables will not replace cross-day move logic in the pilot.

- Optional NEW: `src/lib/feature-flags.ts` or use env.js to gate `ENABLE_SORTABLES_CALENDAR`.

## Integration notes & code hints

- Use `customHandle` on Sortable components and include `Sortable.Handle` or equivalent handle component inside your item. This prevents gesture conflicts with the pan gesture used for date moves.

- Provide the parent Animated.ScrollView (or an Animated ref) to Sortables via `scrollableRef` to enable auto-scroll during dragging.

- Prefer `Sortable.Grid` with `columns={1}` for a vertical list of items with consistent behaviour; `Sortable.Flex` is more flexible but more complex.

- Callbacks: prefer worklet callbacks for performance. `onDragStart`, `onOrderChange`, and `onDragEnd` can be worklets. On `onDragEnd`, call a JS handler (or `runOnJS`) to persist reorder and show undo toast.

- Undo strategy: capture a small snapshot of the day's item IDs in previous order, persist the new order optimistically, then on undo restore the snapshot and persist restoration.

- Haptics: you can add `react-native-haptic-feedback`, or use existing `Vibration`. To leverage built-in haptics flag `hapticsEnabled` on Sortables.

## Install (PowerShell / Expo) — recommended commands

Run these from project root (PowerShell):

```powershell
# Install Sortables and optional haptics (using pnpm as repo already has pnpm)
pnpm add react-native-sortables react-native-haptic-feedback

# Ensure reanimated and gesture handler are installed/configured
npx expo install react-native-reanimated react-native-gesture-handler

# After install, rebuild the native app (required for Reanimated changes)
# For managed Expo you may need: expo prebuild and rebuild, or restart dev client
# Example (native rebuild):
# pnpm expo prebuild; pnpm eas build --platform android
```

Note: follow the Reanimated install docs if the project requires special Babel plugin setup (we already have `babel.config.js` in this repo — verify it contains the Reanimated plugin).

## UX / Accessibility

- Keep existing accessibility actions (activate/increment/decrement) on the item body so keyboard/assistive flows for moving items between dates remain available.
- Provide a `accessibilityLabel` for the drag handle, and localize the label via i18n.
- Respect reduced motion — Sortables uses Reanimated; use shorter durations or skip layout animations when the user has reduced motion enabled.

## Risks & Mitigations

- Gesture conflicts: use `customHandle` to avoid collisions with our pan-to-move gestures.
- FlashList virtualization vs Sortables: Sortables assumes a ScrollView-like container. Avoid rendering Sortables inside FlashList cells unless you confirm layout stability. Safer: render each day block as a separate Sortable container outside of FlashList virtualization for that block.
- Backend ordering: if server lacks an order field, the reorder can be local-only. Mitigation: add a `position` or `order` attribute for tasks in the day when ready.

## Next steps (for devs)

1. Add feature flag `ENABLE_SORTABLES_CALENDAR=false` by default.
2. Implement `DaySortableList` and add `DragHandle` inside `AgendaItemRow` (conditionally rendered).
3. Wire `scrollableRef` from `AgendaList`/parent ScrollView to `DaySortableList`.
4. Implement `onDragEnd` handler: update local order, show undo message (5s) with callback to revert.
5. Test on-device (Android + iOS) and under Hermes / JSC and both new/old RN arch if supported.

## Verification checklist

- [ ] Sortable day reorder works on long-press handle and updates UI order.
- [ ] Auto-scroll works when dragging near edges of the screen.
- [ ] Date-move pan gesture (dragging the item body) still triggers existing date move behavior.
- [ ] Undo restores previous order (and persists if we wrote to backend).
- [ ] Accessibility: handle has label; a11y actions still work.
- [ ] No regressions in FlashList scrolling performance.

---

If you want, I can now create the `day-sortable-list` scaffold and a `DragHandle` component, wire it into one day in `AgendaList`, and run the local tests. Tell me whether to proceed with the pilot implementation (complementary approach) or to attempt a full Sortables-based replacement of the calendar agenda.
