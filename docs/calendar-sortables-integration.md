# React Native Sortables Integration - GrowBro Calendar

## Overview

This integration provides intra-day task reordering using `react-native-sortables` while maintaining the existing cross-day drag-and-drop functionality. This is a **complementary adoption** that adds new capabilities without replacing existing features.

## Architecture

### Components

1. **DragHandle** (`src/components/calendar/drag-handle.tsx`)
   - Visual drag handle with three horizontal lines
   - Wraps `Sortable.Handle` for proper gesture handling
   - Includes accessibility labels (i18n)
   - Only captures drag gestures when touched directly

2. **DaySortableList** (`src/components/calendar/day-sortable-list.tsx`)
   - Sortable container for tasks within a single day
   - Uses `Sortable.Grid` with 1 column (vertical list)
   - Supports auto-scroll when dragging near edges
   - Worklet callbacks for UI-thread performance
   - Falls back to simple list when sorting is disabled

3. **AgendaItemRow** (updated)
   - Added optional `showDragHandle` prop
   - Conditionally renders drag handle when in sortable mode

### Hooks

**useTaskReorder** (`src/lib/hooks/use-task-reorder.ts`)

- Handles task position updates on drag end
- Implements 5-second undo window with toast
- Manages undo state and cleanup

## Feature Flag

`ENABLE_SORTABLES_CALENDAR` - Set in `env.js`, defaults to `false`

```typescript
// In your .env file
EXPO_PUBLIC_ENABLE_SORTABLES_CALENDAR = true;
```

## Usage Example

### Basic Integration

```tsx
import React from 'react';
import { Env } from '@env';
import { DaySortableList } from '@/components/calendar/day-sortable-list';
import { AgendaItemRow } from '@/components/calendar/agenda-item';
import { useTaskReorder } from '@/lib/hooks/use-task-reorder';

function DayView({ date, tasks }: { date: Date; tasks: Task[] }) {
  const { handleTaskReorder } = useTaskReorder();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  const renderItem = useCallback<SortableGridRenderItem<Task>>(
    ({ item }) => <AgendaItemRow task={item} showDragHandle={true} />,
    []
  );

  const onDragEnd = useCallback(
    (params: { data: Task[]; fromIndex: number; toIndex: number }) => {
      void handleTaskReorder(params);
    },
    [handleTaskReorder]
  );

  if (!Env.ENABLE_SORTABLES_CALENDAR) {
    // Fallback to current implementation
    return <RegularTaskList tasks={tasks} />;
  }

  return (
    <Animated.ScrollView ref={scrollRef}>
      <DaySortableList
        data={tasks}
        keyExtractor={(task) => task.id}
        renderItem={renderItem}
        onDragEnd={onDragEnd}
        scrollableRef={scrollRef}
        enableSort={true}
      />
    </Animated.ScrollView>
  );
}
```

### Integration with Existing Calendar

The current calendar uses FlashList with mixed item types (date-header, task, empty-state). To integrate Sortables:

**Option 1: Separate Day View (Recommended for pilot)**

- Create a new screen/modal for single-day task management
- Use DaySortableList in this dedicated view
- Keep main calendar unchanged

**Option 2: Hybrid Approach**

- Render DaySortableList for each day section
- Keep FlashList for overall scrolling and date headers
- This requires careful layout management

## Gesture Handling

### Drag Handle (Sortable reordering)

- Gesture: Long-press on the drag handle
- Action: Reorders task within the same day
- Visual feedback: Slight scale (1.02x)
- Auto-scroll: Enabled when dragging near screen edges

### Task Body (Date moves - existing)

- Gesture: Long-press on task body (excluding drag handle)
- Action: Moves task to different date (existing behavior)
- Managed by: `drag-drop-provider.tsx`

No gesture conflicts due to `customHandle` prop on Sortable.Grid.

## Accessibility

### Drag Handle

- **Role**: button
- **Label**: "Drag handle for reordering"
- **Hint**: "Long-press and drag to reorder tasks within this day."

### AgendaItemRow (existing a11y preserved)

- Accessibility actions (activate, increment, decrement) still work
- Screen reader support for task details

## Performance Considerations

1. **Worklet Callbacks**: `onDragEnd` uses worklet directive for UI-thread execution
2. **Auto-scroll**: Native implementation in Sortables (no JS thread overhead)
3. **FlashList Compatibility**: DaySortableList should be used outside FlashList cells for stable layout
4. **Reduced Motion**: Sortables respects system reduced motion settings

## Database Schema

Tasks need a `position` field for persistent ordering:

```sql
-- Migration example
ALTER TABLE tasks ADD COLUMN position INTEGER;
CREATE INDEX idx_tasks_position ON tasks(position);
```

If `position` is not available, the hook falls back to index-based positioning (local-only).

## Testing Checklist

- [ ] Sortable day reorder works on long-press handle
- [ ] Auto-scroll works when dragging near screen edges
- [ ] Date-move pan gesture still triggers existing date move behavior
- [ ] Undo restores previous order (and persists if backend supports it)
- [ ] Accessibility: handle has proper label; a11y actions still work
- [ ] No regressions in FlashList scrolling performance
- [ ] Feature flag correctly enables/disables Sortables mode
- [ ] Reduced motion is respected (shorter durations)

## Known Limitations

1. **Position Field**: Requires backend support for a `position` or `order` field
2. **FlashList Integration**: Not directly compatible with FlashList virtualization
3. **Multi-day Selection**: Sortables is designed for single-container reordering

## Rollback Plan

1. Set `ENABLE_SORTABLES_CALENDAR=false` in environment
2. Remove imports of DaySortableList if needed
3. Existing drag-drop-provider.tsx handles all functionality

## Future Enhancements

1. **Haptic Feedback**: Integrate `react-native-haptic-feedback` for drag start/end
2. **Visual Feedback**: Add custom overlay during drag
3. **Batch Operations**: Support reordering multiple selected tasks
4. **Cross-day Reorder**: Extend to support dragging between days (requires architecture changes)

## References

- [React Native Sortables Docs](https://react-native-sortables-docs.vercel.app/)
- [Reanimated 4.x Guide](https://docs.swmansion.com/react-native-reanimated/)
- [RNGH v2 Gestures](https://docs.swmansion.com/react-native-gesture-handler/)
