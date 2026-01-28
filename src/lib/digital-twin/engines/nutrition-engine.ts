import { Q } from '@nozbe/watermelondb';

import {
  addDays,
  buildDtstartTimestamps,
  buildUntilUtc,
} from '@/lib/growbro-task-engine/utils';
import i18n from '@/lib/i18n';
import { IssueType } from '@/lib/nutrient-engine/types';
import { database } from '@/lib/watermelon';
import type { AdjustmentSuggestion } from '@/types/ai-adjustments';

import type { TaskIntent, TwinState } from '../twin-types';

function getFeedingDescription(
  stage: TwinState['stage'],
  medium: string
): string {
  if (medium === 'coco') {
    return stage === 'flowering' || stage === 'ripening'
      ? i18n.t('tasks.feed_plant.description_coco_flower_safe')
      : i18n.t('tasks.feed_plant.description_coco_veg_safe');
  }

  return stage === 'flowering' || stage === 'ripening'
    ? i18n.t('tasks.feed_plant.description_soil_flower_safe')
    : i18n.t('tasks.feed_plant.description_soil_veg_safe');
}

function getRampPercent(state: TwinState): number | null {
  switch (state.stage) {
    case 'germination':
      return 0;
    case 'seedling':
      return 25;
    case 'vegetative': {
      const day = Math.max(0, state.dayInStage);
      const percent = Math.min(100, 50 + (day / 14) * 50);
      return Math.round(percent / 5) * 5;
    }
    case 'flowering_stretch':
      return 90;
    case 'flowering':
      return 100;
    case 'ripening':
      return 80;
    default:
      return null;
  }
}

function buildRampedDescription(state: TwinState): string {
  const base = getFeedingDescription(state.stage, state.profile.medium);
  const percent = getRampPercent(state);
  if (percent == null) return base;
  return i18n.t('tasks.feed_plant.description_ramp', {
    percent,
    base,
  });
}

function createAdjustmentSuggestion(params: {
  plantId: string;
  rootCause: AdjustmentSuggestion['rootCause'];
  suggestionType: AdjustmentSuggestion['suggestionType'];
  reasoning: string;
  confidence: number;
}): Promise<void> {
  const now = Date.now();
  const expiresAt = now + 3 * 24 * 60 * 60 * 1000;

  return database.write(async () => {
    const existing = await database
      .get('adjustment_suggestions')
      .query(
        Q.where('plant_id', params.plantId),
        Q.where('root_cause', params.rootCause),
        Q.where('status', 'pending')
      )
      .fetch();

    if (existing.length > 0) {
      return;
    }

    await database.get('adjustment_suggestions').create((record) => {
      // @ts-expect-error - WatermelonDB model fields
      record.plant_id = params.plantId;
      // @ts-expect-error - WatermelonDB model fields
      record.suggestion_type = params.suggestionType;
      // @ts-expect-error - WatermelonDB model fields
      record.root_cause = params.rootCause;
      // @ts-expect-error - WatermelonDB model fields
      record.reasoning = params.reasoning;
      // @ts-expect-error - WatermelonDB model fields
      record.affected_tasks = JSON.stringify([]);
      // @ts-expect-error - WatermelonDB model fields
      record.confidence = params.confidence;
      // @ts-expect-error - WatermelonDB model fields
      record.status = 'pending';
      // @ts-expect-error - WatermelonDB model fields
      record.expires_at = expiresAt;
      // @ts-expect-error - WatermelonDB model fields
      record.created_at = now;
      // @ts-expect-error - WatermelonDB model fields
      record.updated_at = now;
    });
  });
}

async function maybeSuggestDeficiency(state: TwinState): Promise<void> {
  const diagnostic = state.signals.latestDiagnostic;
  if (!diagnostic) return;

  if (diagnostic.classification.type !== IssueType.DEFICIENCY) return;

  const nutrient =
    diagnostic.nutrientCode ?? diagnostic.classification.nutrient;
  const reasoning = nutrient
    ? i18n.t('nutrition.adjustments.deficiency_with_nutrient', { nutrient })
    : i18n.t('nutrition.adjustments.deficiency_generic');

  await createAdjustmentSuggestion({
    plantId: state.profile.plantId,
    rootCause: 'nutrient_deficiency',
    suggestionType: 'feeding',
    reasoning,
    confidence: Math.min(0.95, Math.max(0.5, diagnostic.confidence)),
  });
}

export async function getNutritionIntents(
  state: TwinState
): Promise<TaskIntent[]> {
  const intents: TaskIntent[] = [];
  const { profile } = state;
  const start = profile.stageEnteredAt ?? new Date();

  if (profile.medium === 'living_soil') {
    const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(
      start,
      profile.timezone
    );
    intents.push({
      engineKey: 'nutrition.top_dressing',
      title: i18n.t('tasks.top_dressing.title'),
      description: i18n.t('tasks.top_dressing.description'),
      rrule: 'FREQ=MONTHLY;INTERVAL=1',
      dtstartLocal,
      dtstartUtc,
      timezone: profile.timezone,
      metadata: { category: 'nutrition' },
    });
  }

  if (profile.medium !== 'living_soil' && profile.medium !== 'hydro') {
    const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(
      start,
      profile.timezone
    );
    const rrule =
      profile.medium === 'coco'
        ? 'FREQ=DAILY;INTERVAL=1'
        : 'FREQ=WEEKLY;BYDAY=FR';

    intents.push({
      engineKey: 'nutrition.feed_plant',
      title: i18n.t('tasks.feed_plant.title'),
      description: buildRampedDescription(state),
      rrule,
      dtstartLocal,
      dtstartUtc,
      timezone: profile.timezone,
      metadata: { category: 'nutrition' },
    });
  }

  if (state.stage === 'flowering' || state.stage === 'ripening') {
    const stageStart =
      state.stageEnteredAt ?? profile.stageEnteredAt ?? new Date();
    const flushStart = addDays(
      stageStart,
      Math.max(0, profile.floweringDays - 14)
    );
    if (flushStart > new Date()) {
      const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(
        flushStart,
        profile.timezone
      );
      intents.push({
        engineKey: 'nutrition.flush_start',
        title: i18n.t('tasks.start_flushing.title'),
        description: i18n.t('tasks.start_flushing.description_rich'),
        rrule: 'FREQ=DAILY;INTERVAL=2',
        dtstartLocal,
        dtstartUtc,
        timezone: profile.timezone,
        untilUtc: buildUntilUtc(addDays(flushStart, 14)),
        metadata: { category: 'nutrition' },
      });
    }
  }

  await maybeSuggestDeficiency(state);

  return intents;
}
