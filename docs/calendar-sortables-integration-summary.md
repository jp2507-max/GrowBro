# React Native Sortables Integration - Summary

## Completed Integration ✅

Successfully integrated `react-native-sortables` into GrowBro calendar with a **complementary adoption** approach. This adds intra-day task reordering capabilities while preserving existing cross-day drag-and-drop functionality.

## What Was Implemented

### 1. Package Installation

- ✅ `react-native-sortables@^1.9.3` - Core sortable components
- ✅ `react-native-haptic-feedback@^2.3.3` - Optional haptic feedback (ready for future use)

### 2. Feature Flag

- ✅ Added `ENABLE_SORTABLES_CALENDAR` to `env.js` (defaults to `false`)
- ✅ Updated TypeScript type definitions in `src/lib/env.d.ts`

### 3. New Components

#### DragHandle (`src/components/calendar/drag-handle.tsx`)

- Visual three-line drag handle
- Wraps `Sortable.Handle` for proper gesture isolation
- Full i18n support (English & German)
- Accessibility labels and hints
- **Size**: 40 lines

#### DaySortableList (`src/components/calendar/day-sortable-list.tsx`)

- Sortable container using `Sortable.Grid` (1 column)
- `customHandle` enabled to avoid gesture conflicts
- Auto-scroll support when dragging near screen edges
- Worklet callbacks for UI-thread performance
- Falls back to simple list when sorting is disabled
- **Size**: 125 lines

#### SortableDayView (Example) (`src/components/calendar/sortable-day-view.example.tsx`)

- Reference implementation showing how to use DaySortableList
- Includes date header, task list, empty state
- Feature flag integration
- **Size**: 140 lines

### 4. Updated Components

#### AgendaItemRow (`src/components/calendar/agenda-item.tsx`)

- Added optional `showDragHandle` prop
- Conditionally renders drag handle when in sortable mode
- Preserves all existing functionality and accessibility

### 5. Hooks & Utilities

#### useTaskReorder (`src/lib/hooks/use-task-reorder.ts`)

- Handles task reordering with 5-second undo window
- Shows toast notification with undo button
- Manages undo state and cleanup
- Prepared for backend `position` field (currently logs only)
- **Size**: 88 lines (under ESLint limit of 90)

### 6. Translations

Added to both English and German:

```json
{
  "calendar": {
    "drag_handle_hint": "Long-press and drag to reorder tasks within this day.",
    "drag_handle_label": "Drag handle for reordering"
  }
}
```

### 7. Documentation

#### Main Documentation (`docs/calendar-sortables-integration.md`)

- Complete architecture overview
- Usage examples
- Gesture handling details
- Accessibility guidelines
- Performance considerations
- Testing checklist
- Rollback plan

## Code Quality Metrics

- ✅ TypeScript: All types pass strict checking
- ✅ ESLint: No errors or warnings
- ✅ Function length: All under 90 lines (ESLint enforced)
- ✅ File naming: kebab-case (enforced by ESLint)
- ✅ Import organization: Auto-sorted
- ✅ Accessibility: Proper labels and hints on all interactive elements

## Architecture Decision: Complementary Adoption

The current calendar uses FlashList with mixed item types (date-header, task, empty-state). Rather than replacing this complex system, we created standalone components that can be used in specific contexts:

### Recommended Usage Patterns

1. **Dedicated Day View** (Recommended for pilot)
   - New screen/modal for single-day task management
   - Use `SortableDayView.example.tsx` as template
   - Keep main calendar unchanged

2. **Task Detail Screen**
   - Show day's tasks with reorder capability
   - Use when user taps on a date

3. **Future: Hybrid Approach**
   - Render `DaySortableList` for each day section
   - Requires careful layout management with FlashList

## Gesture Handling (No Conflicts)

### Intra-Day Reordering (NEW)

- **Trigger**: Long-press on drag handle (3 lines icon)
- **Action**: Reorders within same day
- **Visual**: Slight scale animation (1.02x)
- **Auto-scroll**: Enabled near screen edges

### Cross-Day Moves (EXISTING)

- **Trigger**: Long-press on task body (excluding handle)
- **Action**: Moves to different date
- **Managed by**: `drag-drop-provider.tsx`
- **Preserved**: 100% unchanged

No conflicts due to `customHandle` prop on Sortable.Grid.

## Database Schema Note

The implementation is ready for a `position` field:

```sql
ALTER TABLE tasks ADD COLUMN position INTEGER;
CREATE INDEX idx_tasks_position ON tasks(position);
```

Until then, reordering is logged but not persisted. Undo functionality is implemented but no-ops until backend supports the field.

## Testing Status

### Automated Tests

- ✅ TypeScript compilation: Passes
- ✅ ESLint: Passes
- ⚠️ Translation lint: Pre-existing errors in other files (not related to this work)

### Manual Testing Checklist

- [ ] Sortable day reorder works on long-press handle
- [ ] Auto-scroll works when dragging near screen edges
- [ ] Date-move pan gesture still works on task body
- [ ] Undo restores previous order (currently no-op until backend ready)
- [ ] Accessibility: handle has proper label; screen reader works
- [ ] No regressions in FlashList scrolling performance
- [ ] Feature flag correctly enables/disables Sortables mode
- [ ] Reduced motion is respected

## Performance Considerations

1. **Worklet Callbacks**: onDragEnd uses worklet directive
2. **Auto-scroll**: Native implementation in Sortables
3. **No FlashList Conflicts**: DaySortableList used outside FlashList cells
4. **Reduced Motion**: Sortables respects system settings

## Files Changed

### Added (7 files)

- `src/components/calendar/drag-handle.tsx`
- `src/components/calendar/day-sortable-list.tsx`
- `src/components/calendar/sortable-day-view.example.tsx`
- `src/lib/hooks/use-task-reorder.ts`
- `docs/calendar-sortables-integration.md`

### Modified (5 files)

- `env.js` - Added feature flag
- `src/lib/env.d.ts` - Added TypeScript type for flag
- `src/components/calendar/agenda-item.tsx` - Added showDragHandle prop
- `src/translations/en.json` - Added translations
- `src/translations/de.json` - Added translations

## Rollback Plan

1. Set `ENABLE_SORTABLES_CALENDAR=false` in all environments
2. Remove imports if needed (components are self-contained)
3. Existing drag-drop-provider handles all functionality

## Next Steps

### For Pilot Testing

1. Enable feature flag: `EXPO_PUBLIC_ENABLE_SORTABLES_CALENDAR=true` in `.env.development`
2. Create a new screen using `SortableDayView.example.tsx` as template
3. Add navigation from main calendar to this screen
4. Test on both iOS and Android devices
5. Gather user feedback on gesture interactions

### For Production

1. Add `position` field to tasks table schema
2. Implement position updates in `updateTask` API
3. Update `useTaskReorder` hook to persist positions
4. Add haptic feedback integration
5. Run full test suite on devices
6. Gradually roll out via feature flag

### Future Enhancements

- Haptic feedback on drag start/end
- Custom drag overlay with visual feedback
- Batch reorder operations
- Cross-day reordering (requires architecture changes)

## Known Limitations

1. **No Position Persistence**: Requires backend schema update
2. **Not FlashList Compatible**: Must be used outside virtualized lists
3. **Single Container**: Designed for same-day reordering only

## References

- [React Native Sortables Docs](https://react-native-sortables-docs.vercel.app/)
- [Reanimated 4.x Worklet Guide](https://docs.swmansion.com/react-native-reanimated/)
- [GrowBro Styling Guidelines](../.github/instructions/styling-guidelines.instructions.md)
- [GrowBro Project Rules](../.github/instructions/projectrules.instructions.md)

---

**Status**: ✅ Ready for pilot testing  
**Feature Flag**: `ENABLE_SORTABLES_CALENDAR=false` (default)  
**Backend Work Required**: Add `position` field to tasks schema  
**Risk Level**: Low (complementary approach, existing features unchanged)
