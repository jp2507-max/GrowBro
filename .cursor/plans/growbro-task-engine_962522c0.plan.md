---
name: growbro-task-engine
overview: Implement GrowBro’s biology-based task generation using existing Calendar 2.0 (WatermelonDB `series`/`tasks` + RRULE) with **manual** stage transitions for autoflowers, plus strict stage-change cleanup and lifecycle rules (seedling safety, flowering/flush, harvest/drying/curing).
todos:
  - id: schema-series-origin
    content: Add `origin` to series in Supabase + Watermelon schema/migrations/models/types.
    status: pending
  - id: rrule-monthly
    content: Extend internal RRULE parser/validator/iterator to support `FREQ=MONTHLY` (needed for Living Soil top dressing).
    status: pending
  - id: growbro-task-engine
    content: Implement `TaskFactory.create()` + `TaskEngine.ensureSchedulesForPlant()` + `onStageChange()` using biological rules and origin-tagged series.
    status: pending
  - id: integrate-stage-change
    content: Hook plant create/update to call ensureSchedules/onStageChange; wire Plant detail Action Hub with today’s tasks.
    status: pending
  - id: tests
    content: Add unit tests for RRULE MONTHLY + GrowBro TaskFactory/cleanup + autoflower nudge + flush logic.
    status: pending
---

#GrowBro logic engine (manual stage transitions)

## Architecture (reuse existing calendar system)

- **Recurring tasks**: use existing `series` + RRULE iteration via [`src/lib/task-manager.ts`](src/lib/task-manager.ts) (ephemeral occurrences show in Calendar; completion uses `completeRecurringInstance`).
- **System vs user schedules**: add `series.origin` and set to **`'growbro'`** for all engine-created series.
- **Manual stage transitions (Option B)**:
- Never auto-update `plants.stage`.
- Autoflowers in Veg get a **recurring “Smart Nudge”** series starting at day 28 to remind the user to manually switch to Flower.

## Required schema + model changes

### 1) Add `origin` column to `series`

- **Supabase**: new migration under [`supabase/migrations/`](supabase/migrations/) to:
- `ALTER TABLE public.series ADD COLUMN IF NOT EXISTS origin text;`
- optional: index `(plant_id, origin)` for fast cleanup queries.
- **Watermelon**:
- bump schema version in [`src/lib/watermelon-schema.ts`](src/lib/watermelon-schema.ts) (currently `version: 35`).
- add `origin` column to `series` table schema.
- add a Watermelon migration in [`src/lib/watermelon-migrations.ts`](src/lib/watermelon-migrations.ts) with `addColumns({ table: 'series', columns: [{ name: 'origin', type: 'string', isOptional: true }] })`.
- update model mapping in [`src/lib/watermelon-models/series.ts`](src/lib/watermelon-models/series.ts) to include `@text('origin') origin?: string;`.
- update app-level type in [`src/types/calendar.ts`](src/types/calendar.ts) `Series` to include `origin?: string`.

## RRULE support gap (needed for Living Soil monthly top dress)

Current iterator only supports `DAILY` and `WEEKLY` (see [`src/lib/rrule/types.ts`](src/lib/rrule/types.ts), [`src/lib/rrule/iterator.ts`](src/lib/rrule/iterator.ts)).Add **`MONTHLY`** support end-to-end:

- [`src/lib/rrule/types.ts`](src/lib/rrule/types.ts): extend `RRuleFrequency` to include `MONTHLY`.
- [`src/lib/rrule/parse.ts`](src/lib/rrule/parse.ts): accept `FREQ=MONTHLY` and parse it.
- [`src/lib/rrule/validate.ts`](src/lib/rrule/validate.ts): allow `MONTHLY`.
- [`src/lib/rrule/iterator.ts`](src/lib/rrule/iterator.ts): add a monthly generator (`plus({ months: interval })` in the plant’s timezone, preserving time-of-day). Add stop-condition handling consistent with DAILY/WEEKLY.

## GrowBro TaskFactory + TaskEngine

### New module (kebab-case)

Create `src/lib/growbro-task-engine/`:

- `task-factory.ts`: `TaskFactory.create(settings, stage)` returns a list of **series specs** (title, description, rrule, dtstart).
- `task-engine.ts`: orchestration:
- `ensureSchedulesForPlant(plantId)` (idempotent for the current stage entry)
- `onStageChange({ plantId, fromStage, toStage })` → cleanup + regenerate
- `types.ts` + `utils.ts`: date/pot parsing, flowering-days derivation.

### Inputs (from existing models)

- Plant fields are already available via [`src/lib/plants/plant-service.ts`](src/lib/plants/plant-service.ts):
- `stage` (`seedling|vegetative|flowering|harvesting|curing|ready`)
- `metadata.medium` (`soil|coco|hydro|living_soil|other`)
- `metadata.potSize` (string; parse liters)
- `environment`, `photoperiodType`, `geneticLean`, `plantedAt`, `metadata.strainId/strainSlug`.
- Flowering duration:
- Best-effort: load strain from local cache (`cached_strains`) by `strainId/slug` and compute days from `grow.flowering_time`.
- Fallback: conservative defaults (autoflower ~49d, photoperiod ~56d).

### Business rules implemented (strictly per your spec)

#### A) Seedling safety (`plants.stage === 'seedling'`)

- Always create series: **"Check Humidity Dome"** → `FREQ=DAILY;INTERVAL=1`.
- **Force-disable all feed/nutrient series** regardless of medium (hydro maintenance series are still allowed).

#### B) Vegetative (`'vegetative'`)

- Apply medium matrix:
- **Soil**: water `FREQ=DAILY;INTERVAL=3` (pot <10L → 2; >25L → 4); feed `FREQ=WEEKLY;BYDAY=FR`.
- **Coco**: water `FREQ=DAILY;INTERVAL=1`; feed `FREQ=DAILY;INTERVAL=1`.
- **Living soil**: water like soil; **no liquid feed**; add **"Top Dressing"** `FREQ=MONTHLY;INTERVAL=1`.
- **Hydro**: no watering; daily "Check pH & EC", daily "Check Water Temperature", weekly "Change Reservoir Water".
- **Autoflower smart nudge** (manual transition; no stage auto-switch):
- IF `photoperiodType==='autoflower'` AND `stage==='vegetative'` AND `days_since_start >= 28` → create a recurring series: **"Check for Pre-flowers (White Pistils)…"** (daily).
- If `days_since_start < 28`, create the same series with `dtstart` set to `start+28d` (so it only begins at week 4).

#### C) Flowering (`'flowering'`, manual switch)

- Continue medium watering rules.
- **Photoperiod + Indoor**: one-time series (COUNT=1) on day 1: **"Switch Lights to 12/12"**.
- **Sativa warning**: if `environment==='indoor'` and lean is sativa-dominant → one-time series (COUNT=1) in week 3 of flower: **"Check Light Distance (Stretch Warning)"**.
- **Flush**:
- compute `harvestDate = flowerStart + flowering_days` (flowerStart = stage-change date).
- stop feed tasks by generating flower feed series with `UNTIL = flushStart - 1s`.
- add **"Start Flushing (Water Only)"** series: `FREQ=DAILY;INTERVAL=2;UNTIL=<harvestDate>`.

#### D) Harvest/Drying/Curing (mapped to existing plant stages)

Because the UI currently uses plant `stage` values, map:

- `harvesting` → Drying rules
- `curing` → Curing rules

Rules:

- **Harvesting/Drying**: "Check Stem Snap" daily for 10 days (use `COUNT=10` on a DAILY rule).
- **Curing**:
- Weeks 1–2: "Burp Jars" daily (COUNT=14).
- Weeks 3–4: "Burp Jars" FREQ=DAILY;INTERVAL=3 (Effective: every 3 days. Corrects logic error to prevent mold).

## Stage-change cleanup + regeneration

Implement in TaskEngine:

- Query `series` where `plant_id=<plantId>` AND `origin='growbro'` AND `deleted_at IS NULL`.
- Soft-delete those series (`deleted_at=now`).
- Soft-delete **future** pending materialized tasks for those series (`tasks.series_id IN (…)` AND `status='pending'` AND `deleted_at IS NULL` AND `due_at >= startOfToday`).
- Call `ensureSchedulesForPlant(plantId)` immediately for the new stage.

## Integration points

- **Plant writes**: detect stage changes inside [`src/lib/plants/plant-service.ts`](src/lib/plants/plant-service.ts):
- on create: call `ensureSchedulesForPlant(newPlantId)`.
- on update: if `stage` changed, call `onStageChange(...)`.
- **Plant detail reminders**: wire [`src/components/plants/plant-action-hub.tsx`](src/components/plants/plant-action-hub.tsx) by supplying today’s tasks for that plant from [`getTasksByDateRange`](src/lib/task-manager.ts) filtered by `plantId`.

## Tests

- Add unit tests for:
- RRULE MONTHLY iteration correctness (`src/lib/rrule/*`).
- TaskFactory outputs per stage/medium/pot modifiers.
- Autoflower “smart nudge” dtstart behavior (before/after day 28).
- Flower flush cutoff logic (feed UNTIL; flush series).
- Stage-change cleanup (series soft-deleted; future tasks soft-deleted; completed preserved).

## Local verification commands

- **Unit tests (targeted + coverage)**:
- `pnpm test -- growbro-task-engine --coverage --coverageReporters="text"`
- `pnpm test -- src/lib/rrule --coverage --coverageReporters="text"`
- **Typecheck**: `pnpm type-check`
- **Lint**: `pnpm lint`

## Risks / notes

- Adding `series.origin` requires schema alignment across:
- Watermelon schema + migrations
- Supabase migration + regenerated `src/types/supabase.ts`
