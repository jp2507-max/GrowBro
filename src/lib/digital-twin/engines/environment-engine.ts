import { buildDtstartTimestamps } from '@/lib/growbro-task-engine/utils';
import i18n from '@/lib/i18n';

import type { TaskIntent, TwinState } from '../twin-types';

function buildIntent(
  params: Omit<TaskIntent, 'engineKey'> & { engineKey: string }
): TaskIntent {
  return { ...params };
}

export function getEnvironmentIntents(state: TwinState): TaskIntent[] {
  const intents: TaskIntent[] = [];
  const { profile } = state;
  const start = profile.stageEnteredAt ?? new Date();

  const isVegOrEarlier =
    state.stage === 'germination' ||
    state.stage === 'seedling' ||
    state.stage === 'vegetative';

  const isFlowerOrLater =
    state.stage === 'flowering_stretch' ||
    state.stage === 'flowering' ||
    state.stage === 'ripening';

  if (isVegOrEarlier) {
    const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(
      start,
      profile.timezone
    );
    intents.push(
      buildIntent({
        engineKey: 'environment.ipm_preventative',
        title: i18n.t('tasks.ipm_preventative.title'),
        description: i18n.t('tasks.ipm_preventative.description'),
        rrule: 'FREQ=WEEKLY;BYDAY=SU',
        dtstartLocal,
        dtstartUtc,
        timezone: profile.timezone,
        metadata: { category: 'environment' },
      })
    );
  }

  if (isFlowerOrLater) {
    const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(
      start,
      profile.timezone
    );
    intents.push(
      buildIntent({
        engineKey: 'environment.ipm_biological',
        title: i18n.t('tasks.ipm_biological.title'),
        description: i18n.t('tasks.ipm_biological.description'),
        rrule: 'FREQ=WEEKLY;BYDAY=SU',
        dtstartLocal,
        dtstartUtc,
        timezone: profile.timezone,
        metadata: { category: 'environment' },
      })
    );
  }

  const shouldCheckLightDistance =
    (state.stage === 'flowering_stretch' || state.stage === 'flowering') &&
    profile.environment !== 'outdoor' &&
    typeof profile.heightCm === 'number';

  if (shouldCheckLightDistance) {
    const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(
      start,
      profile.timezone
    );
    intents.push(
      buildIntent({
        engineKey: 'environment.check_light_distance',
        title: i18n.t('tasks.check_light_distance.title'),
        description: i18n.t('tasks.check_light_distance.description'),
        rrule: 'FREQ=WEEKLY;BYDAY=WE',
        dtstartLocal,
        dtstartUtc,
        timezone: profile.timezone,
        metadata: { category: 'environment' },
      })
    );
  }

  return intents;
}
