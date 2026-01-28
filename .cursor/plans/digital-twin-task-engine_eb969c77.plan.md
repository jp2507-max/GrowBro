---
name: digital-twin-task-engine
overview: Evolve the existing stage-based RRULE TaskEngine into a dynamic, offline-first “Digital Twin” state machine that derives daily tasks from plant biology + user signals (logs/events) and stays reliable under changing settings (medium, stage, timezones).
todos:
  - id: stage-enum-expand
    content: Expand `PlantStage` + update PlantForm stage options + add i18n strings (EN/DE).
    status: pending
  - id: persist-stage-anchor
    content: Add `stage_entered_at` + implement stage history (Watermelon + Supabase + sync types).
    status: pending
  - id: plant-events-stream
    content: Add `plant_events` table and minimal event recording APIs for sprout/nodes/light-cycle/pot-weight/burping.
    status: pending
  - id: twin-core
    content: Implement `src/lib/digital-twin/` core types + derive function + transition validation module.
    status: pending
  - id: engine-hydrology
    content: Implement HydrologyEngine producing dynamic check/action intents (soil vs coco/hydro).
    status: pending
  - id: engine-nutrition
    content: Implement NutritionEngine ramping + integrate deficiency signals via diagnostics into `adjustment_suggestions`.
    status: pending
  - id: engine-environment
    content: Implement EnvironmentEngine lighting-distance + IPM rules (hard stop sprays in flower).
    status: pending
  - id: engine-curing
    content: Implement CuringEngine matching 2×/day week1, 1×/day week2, weekly thereafter.
    status: pending
  - id: taskengine-diff-sync
    content: Replace TaskEngine “skip if exists” with diff-based schedule sync using metadata.engineKey/signature and stable idempotency.
    status: pending
  - id: integration-triggers
    content: Wire sync triggers on plant changes, relevant logs, and a daily tick (background/app start).
    status: pending
  - id: tests
    content: Add focused unit tests for state machine + engines + diff sync behavior.
    status: pending
isProject: false
---

# Digital Twin TaskEngine plan

## What exists today (we will reuse)

- **Recurring task infrastructure**: RRULE-based `series` + lazy materialization + overrides in `src/lib/task-manager.ts`.
- **Plant-driven task generation**: `TaskEngine` and `TaskFactory` generate stage-based schedules, but are currently **static** once created and **do not update when settings change** (`src/lib/growbro-task-engine/task-engine.ts` L111-L114).
- **Plant profile inputs already captured**: medium, pot size, photoperiod, environment, height via `PlantForm` (`src/components/plants/plant-form.tsx` L348-L442) and stored in `plants.metadata`.
- **Signals/logs already exist**: trichome assessments (`trichome_assessments` in `src/lib/watermelon-schema.ts`), diagnostics (`diagnostic_results_v2`), and telemetry updates on task completion in `src/lib/task-manager.ts` (e.g. `onTaskCompleted`).
- **Adjustment suggestion framework** already exists for “dynamic schedule” changes (`src/lib/playbooks/ai-adjustment-service.ts`) and can be extended beyond playbooks.

## Target architecture

### 1) Core data structures

- **Expand growth stage enum** (app-side canonical type)
- Update `PlantStage` in [`src/api/plants/types.ts`](src/api/plants/types.ts) from the current coarse union (L5-L11) to include:
- `germination`, `seedling`, `vegetative`, `flowering_stretch`, `flowering`, `ripening`, `harvesting`, `curing`, `ready`
- Update UI options in [`src/components/plants/plant-form.tsx`](src/components/plants/plant-form.tsx) `STAGE_OPTIONS` (L348-L355) + i18n keys in `src/translations/en.json` and `src/translations/de.json`.

- **Persist stage anchors for reliable scheduling**
- Add `stage_entered_at` to Plants (Watermelon + Supabase) so the engine can compute day-in-stage and time-based transitions deterministically.
- Introduce `plant_stage_history` (Watermelon + Supabase) with:
- `plant_id`, `from_stage`, `to_stage`, `trigger` (`user|auto|import`), `reason`, `occurred_at`, `metadata_json`
- Update [`src/lib/plants/plant-service.ts`](src/lib/plants/plant-service.ts) to set `stage_entered_at` and append history whenever stage changes (currently it only calls `TaskEngine.onStageChange()` when stage changes, L274-L288).

- **Add a minimal event stream to “cover cases” without exploding schema**
- Add `plant_events` (Watermelon + Supabase) for discrete user confirmations/signals:
- `kind`: `sprout_confirmed`, `node_count_updated`, `light_cycle_switched`, `pot_weight_check`, `symptom_logged`, `harvest_started`, `jar_burped`
- `occurred_at`, `payload_json`
- Reuse existing tables as events where possible:
- Trichomes → `trichome_assessments`
- Diagnostics → `diagnostic_results_v2`
- Water/feed completion → existing task telemetry

### 2) Digital Twin State Machine

- Add `src/lib/digital-twin/` module (new) with:
- `growth-state-machine.ts`: allowed transitions + transition validators (pattern borrowed from `src/lib/harvest/state-machine.ts`).
- `twin-types.ts`: `PlantProfile` (immutable), `TwinSignals` (latest readings/events), `TwinState` (derived).
- `derive-twin-state.ts`: pure function that derives `TwinState` from profile + signals.
- Transition rules:
- `germination -> seedling`: user event `sprout_confirmed`.
- `seedling -> vegetative`: when node-count event >= 3 (or user confirm).
- `vegetative -> flowering_stretch`:
- photoperiod: user event `light_cycle_switched` (to 12/12).
- autoflower: time-based at day N (configurable default, initially reuse `AUTOFLOWER_NUDGE_START_DAY` semantics from `TaskFactory`, `src/lib/growbro-task-engine/types.ts` L53-L54).
- `flowering_stretch -> flowering`: auto after 7 days (controls “veg nutrients for first 7 days then bloom”).
- `flowering -> ripening`: time-based near end of expected flowering days (reuse `floweringDays` logic currently computed in `TaskEngine.buildPlantSettings()` `src/lib/growbro-task-engine/task-engine.ts` L74-L90).
- `ripening -> harvesting`: triggered by trichome assessment window (milky/cloudy % threshold) OR user confirm.
- `harvesting -> curing`: user confirm harvest complete.
- `curing -> ready`: time-based (>= 21 days) OR user confirm.

### 3) Modular task generators (engines)

Implement each engine as a **pure proposer**: input `TwinState` + signals → output `TaskIntents[]`.

- **HydrologyEngine**
- Soil: daily “check pot weight/knuckle test” prompt; create actual “water now” task only when user logs `pot_weight_check=light/dry` OR when last watered exceeds max interval.
- Coco/Hydro: daily or 2× daily fertigation tasks (“water to 10–20% runoff”) with optional “EC/pH check” reuse from existing hydro tasks in `TaskFactory`.

- **NutritionEngine**
- Ramping: seedling 0–25%, veg ramp up to 100% N, flower switch to PK.
- Deficiency logic: map `diagnostic_results_v2` symptom/nutrient signals to `adjustment_suggestions` root cause `nutrient_deficiency` (extend existing `AIAdjustmentService` root causes instead of silently changing schedule).

- **EnvironmentEngine**
- Lighting distance: derive “raise light” task when height increases beyond threshold or user logs distance; keep rules in metadata keyed by light type (default LED).
- IPM: weekly preventative in veg; hard stop in flower+ (switch tasks to biological controls).

- **CuringEngine**
- Replace current 1× daily curing reminder with research spec:
- week 1: 2× daily 15 min
- week 2: 1× daily
- week 3+: weekly
- Implement as multiple RRULE series (e.g., BYHOUR for 2× daily) or as daily materialized tasks.

### 4) Persistence + idempotency (reliable, not strict)

- Keep using `series` + lazy materialization for repeating prompts, but make schedules **self-healing**:
- Extend `TaskEngine` to a new `DigitalTwinTaskEngine` (either in `src/lib/growbro-task-engine/` or `src/lib/digital-twin/`) that:
- Computes desired “engine series specs” and “one-off intents” for a plant.
- Diffs against existing GrowBro-origin series and updates/creates/deletes as needed.
- Uses a stable `metadata.engineKey` + `metadata.signature` to make updates idempotent.
- Replace “skip if any series exists” behavior in `ensureSchedulesForPlant()` (currently returns early when it finds any series, `src/lib/growbro-task-engine/task-engine.ts` L123-L138) with a **diff-based sync**.
- Hook sync triggers:
- On plant create/update (already happens in `PlantService`, `src/lib/plants/plant-service.ts` L197-L205 and L274-L288)
- On relevant signals arriving: new trichome assessment, new diagnostic result, completion of water/feed tasks.
- On app start / daily background tick (reuse existing background sync registration).

### 5) “Virtual plant” + retention layer (minimal core + hooks)

- **Stage-driven avatar**: UI consumes new `PlantStage` + `dayInStage` from `TwinState` to render the correct avatar.
- **Milestones**: create `plant_milestones` (or reuse `plant_events` with kind `milestone_unlocked`) and award:
- first pistils (from stage transition into `flowering_stretch`)
- milky-window reached (from trichome assessment)
- curing complete
- **Streaks**: compute from “any cultivation log” events (task completion / assessments / events) and store `user_streaks` locally + sync.

## Data layer changes

### WatermelonDB

- Bump schema version in `src/lib/watermelon-schema.ts` and add:
- `stage_entered_at` column to `plants`
- `plant_stage_history` table
- `plant_events` table
- Add corresponding migrations in `src/lib/watermelon-migrations.ts`.

### Supabase

- Add migration(s) to:
- `ALTER TABLE public.plants ADD COLUMN stage_entered_at timestamptz;`
- Create `plant_stage_history` + `plant_events` with RLS policies mirroring `plants` (`supabase/migrations/20251208_create_plants_table.sql` shows the existing plants RLS pattern).

## Test plan (unit-level)

- Add tests for:
- `growth-state-machine` transition validation
- each engine’s task proposals (soil vs coco vs hydro; IPM stop; curing schedule)
- idempotent diff application (same inputs → no DB churn)

## Local verification commands

- `pnpm test digital-twin -- --coverage --coverageReporters="text"`
- `pnpm lint`
- Supabase: `supabase db reset` (or your existing migration workflow)
