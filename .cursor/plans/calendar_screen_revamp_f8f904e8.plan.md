---
name: Calendar screen revamp
overview: 'Refactor the Calendar tab to match the Home/Strains header approach (ScreenHeaderBase) and implement a production-ready Today/Agenda experience: week strip, Plan+History for selected day, recurring quick-add, completion, and schedule editing.'
todos:
  - id: calendar-header-weekstrip (we have react native date time picker installed, maybe helpful) We also have already a component like this
    content: Implement Calendar header using ScreenHeaderBase + add 7-day week strip selector; wire into Calendar screen via navigation.setOptions.
    status: pending
  - id: calendar-day-data
    content: Load pending+completed tasks for selected day (new completed query) and show Plan/History sections with empty states.
    status: pending
    dependencies:
      - calendar-header-weekstrip
  - id: calendar-complete-task
    content: Add completion handling for normal vs ephemeral series tasks (completeTask vs completeRecurringInstance).
    status: pending
    dependencies:
      - calendar-day-data
  - id: calendar-schedule-editor
    content: Add recurring quick-add + edit-schedule bottom sheet modal (RRULE generator, createSeries/updateSeries + createTask first occurrence).
    status: pending
    dependencies:
      - calendar-header-weekstrip
      - calendar-day-data
  - id: calendar-i18n
    content: Add/adjust EN+DE translation keys for new Calendar header/sections/modal UI.
    status: pending
    dependencies:
      - calendar-header-weekstrip
      - calendar-schedule-editor
---

# Calendar screen production-ready (Home/Strains approach)

## Rules applied

- **Patterns**: reuse existing Home/Strains header pattern via `ScreenHeaderBase`.
- **I18n**: all new user-visible strings added in EN+DE.
- **NativeWind tokens**: prefer semantic tokens (`bg-background`, `text-text-primary`, `border-border`, `bg-card`).
- **A11y**: add stable `testID`s + accessibility labels/hints for key actions.

## Target UX (v1)

- **Header**: match Home/Strains styling using `ScreenHeaderBase` with large title (`Today/Heute` if selected day is today; otherwise formatted date).
- **Week strip**: horizontal 7-day selector (today ±3) with selected-day highlight; tap switches day.
- **Plan**: list of **pending** tasks for selected day.
- **History**: list of **completed** tasks for selected day.
- **Actions**:
- **Complete**: checkbox/tap completes task.
- **Quick add (recurring)**: create a recurring schedule (RRULE) + optionally materialize first occurrence.
- **Edit schedule**: for series tasks, edit recurrence/title/plant/time.

## Data + behavior

- **Pending tasks**: fetch via `getTasksByDateRange(startOfDay, endOfDay)` (includes series occurrences).
- **History tasks**: add a new query in `src/lib/task-manager.ts` for completed tasks in the same date range.
- **Series occurrences**:
- If the task is an **ephemeral** series occurrence (`id` starts with `series:` or `metadata.ephemeral`), completion uses `completeRecurringInstance(seriesId, occurrenceDate)`.
- Otherwise completion uses `completeTask(taskId)`.
- **Plant labels**: read from Watermelon via `getAllPlantsForUser()` and map `plantId -> plant.name`.

## Implementation outline (files)

- **Calendar header + week strip**
- Add [`src/components/calendar/calendar-header.tsx`](src/components/calendar/calendar-header.tsx) using `ScreenHeaderBase` + `HeaderIconButton`.
- Add [`src/components/calendar/week-strip.tsx`](src/components/calendar/week-strip.tsx) for the 7-day selector.
- Update `[src/app/(app)/calendar.tsx](src/app/\\\(app)/calendar.tsx)` to:
- override the tab header like Home does (`navigation.setOptions({ header: ... })`)
- remove the current in-screen Prev/Next header
- render Plan + History sections.

- **Task rows**
- Add [`src/components/calendar/day-task-row.tsx`](src/components/calendar/day-task-row.tsx) to render a task card matching the reference layout (left icon, title/subtitle, right action).

- **Recurring quick-add + edit schedule modal**
- Add [`src/components/calendar/schedule-editor-modal.tsx`](src/components/calendar/schedule-editor-modal.tsx) using `Modal`, `Input`, `Select`, `DatePicker`.
- Use `rruleGenerator` (`src/lib/rrule/generator.ts`) to build RRULE strings.
- On save:
- create: `createSeries(...)` + create first task occurrence via `createTask({ seriesId, ... })`
- edit: `updateSeries(...)` and update existing pending tasks for that series to keep titles consistent.

- **Task-manager additions**
- Update [`src/lib/task-manager.ts`](src/lib/task-manager.ts) to export `getCompletedTasksByDateRange(start,end)` (status = `completed`, `deleted_at = null`) and any small helpers needed.

- **Translations**
- Update [`src/translations/en.json`](src/translations/en.json) and [`src/translations/de.json`](src/translations/de.json) for:
- header title strings
- Plan/History section titles
- empty states
- schedule editor labels/options/buttons.

## Notes / risks

- **Series edits**: changing RRULE won’t retroactively reconcile existing overrides/materialized tasks beyond our “update titles” step; acceptable for v1, but we’ll keep the changes scoped and predictable.
- **Notifications**: only materialized tasks can have reminders scheduled; v1 will materialize the first occurrence so reminders work at least for the nearest task.
