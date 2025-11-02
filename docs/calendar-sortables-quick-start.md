# Quick Start: Using Sortables in GrowBro Calendar

## Enable the Feature

Add to your `.env.development`:

```bash
EXPO_PUBLIC_ENABLE_SORTABLES_CALENDAR=true
```

## Basic Usage

```tsx
import React from 'react';
import { Env } from '@env';
import { DaySortableList } from '@/components/calendar/day-sortable-list';
import { AgendaItemRow } from '@/components/calendar/agenda-item';
import { useTaskReorder } from '@/lib/hooks/use-task-reorder';
import type { Task } from '@/types/calendar';

function MyDayView({ tasks }: { tasks: Task[] }) {
  const scrollRef = React.useRef<any>(null);
  const { handleTaskReorder } = useTaskReorder();

  const renderItem = React.useCallback(
    ({ item }: { item: Task }) => (
      <AgendaItemRow task={item} showDragHandle={true} />
    ),
    []
  );

  const onDragEnd = React.useCallback(
    (params: { data: Task[] }) => {
      void handleTaskReorder(params);
    },
    [handleTaskReorder]
  );

  if (!Env.ENABLE_SORTABLES_CALENDAR) {
    return <FallbackList tasks={tasks} />;
  }

  return (
    <DaySortableList
      data={tasks}
      keyExtractor={(task) => task.id}
      renderItem={renderItem}
      onDragEnd={onDragEnd}
      scrollableRef={scrollRef}
      enableSort={true}
    />
  );
}
```

## Testing Locally

1. **Start dev server**:

   ```powershell
   pnpm start
   ```

2. **Run on device**:

   ```powershell
   # Android
   pnpm android

   # iOS
   pnpm ios
   ```

3. **Test reordering**:
   - Long-press the drag handle (3 horizontal lines)
   - Drag task to new position
   - Release to drop
   - Tap undo toast within 5 seconds to revert

## Full Example

See `src/components/calendar/sortable-day-view.example.tsx` for a complete, production-ready implementation with:

- Date header
- Empty state handling
- Feature flag check
- Proper TypeScript typing
- Accessibility support

## Troubleshooting

### "Drag handle not responding"

- Ensure `customHandle` prop is set on Sortable.Grid
- Verify `showDragHandle={true}` on AgendaItemRow
- Check that Sortable.Handle is rendered

### "Undo doesn't work"

- Currently logs only (backend schema not ready)
- Add `position` field to tasks table first

### "Gestures conflict with date moves"

- Drag handle isolates gestures via `customHandle`
- Task body still supports existing long-press for date moves

### "Auto-scroll not working"

- Pass `scrollableRef` to DaySortableList
- Ensure parent is an Animated.ScrollView

## Next Steps

1. Review full docs: `docs/calendar-sortables-integration.md`
2. Check example: `src/components/calendar/sortable-day-view.example.tsx`
3. Test on real device (gestures don't work well in simulator)
4. Add `position` field to backend schema for persistence
