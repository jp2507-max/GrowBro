import { DateTime } from 'luxon';

import i18n from '@/lib/i18n';

import type { PlantSettings, SeriesSpec } from './types';
import {
  AUTOFLOWER_NUDGE_START_DAY,
  FLUSH_DAYS,
  STEM_SNAP_CHECK_DAYS,
  STRETCH_WARNING_DAY,
} from './types';
import {
  addDays,
  buildDtstartTimestamps,
  buildUntilUtc,
  calculateWaterVolume,
  daysSince,
  getWateringInterval,
} from './utils';

/**
 * TaskFactory creates series specifications based on plant settings and stage.
 * These specs are used by the TaskEngine to create actual series in the database.
 */
export class TaskFactory {
  private static buildMetadata(
    engineKey: string,
    extra: Record<string, unknown> = {}
  ): Record<string, unknown> {
    return { engineKey, ...extra };
  }

  /**
   * Generate all series specs for a plant based on its current stage and settings.
   */
  static create(settings: PlantSettings): SeriesSpec[] {
    const { stage } = settings;

    switch (stage) {
      case 'seedling':
        return this.createSeedlingTasks(settings);
      case 'vegetative':
        return this.createVegetativeTasks(settings);
      case 'flowering':
        return this.createFloweringTasks(settings);
      case 'harvesting':
        return this.createHarvestingTasks(settings);
      case 'curing':
        return this.createCuringTasks(settings);
      case 'ready':
        return []; // No tasks for ready stage
      default:
        return [];
    }
  }

  /**
   * Seedling stage: Humidity dome check only, NO feeding/nutrients
   */
  private static createSeedlingTasks(settings: PlantSettings): SeriesSpec[] {
    const { timezone } = settings;
    const now = new Date();
    const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(now, timezone);

    return [
      {
        title: i18n.t('tasks.check_humidity_dome.title'),
        description: i18n.t('tasks.check_humidity_dome.description'),
        rrule: 'FREQ=DAILY;INTERVAL=1',
        dtstartLocal,
        dtstartUtc,
        timezone,
        metadata: this.buildMetadata('legacy.seedling.check_humidity_dome', {
          category: 'legacy',
        }),
      },
    ];
  }

  /**
   * Vegetative stage: Watering, feeding based on medium, autoflower nudge
   */
  private static createVegetativeTasks(settings: PlantSettings): SeriesSpec[] {
    const specs: SeriesSpec[] = [];
    const { medium, photoperiodType, plantedAt, timezone } = settings;
    const now = new Date();

    // Watering tasks (medium-dependent)
    specs.push(...this.createWateringTasks(settings, now));

    // Feeding tasks (medium-dependent, NOT for seedling safety)
    specs.push(...this.createFeedingTasks(settings, now));

    // Hydro-specific maintenance tasks
    if (medium === 'hydro') {
      specs.push(...this.createHydroMaintenanceTasks(settings, now));
    }

    // Environment check task (weekly on Wednesdays)
    specs.push(...this.createEnvironmentCheckTasks(settings, now));

    // Living soil top dressing (monthly)
    if (medium === 'living_soil') {
      const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(
        now,
        timezone
      );
      specs.push({
        title: i18n.t('tasks.top_dressing.title'),
        description: i18n.t('tasks.top_dressing.description'),
        rrule: 'FREQ=MONTHLY;INTERVAL=1',
        dtstartLocal,
        dtstartUtc,
        timezone,
        metadata: this.buildMetadata('legacy.nutrition.top_dressing', {
          category: 'nutrition',
        }),
      });
    }

    // Autoflower smart nudge (starting day 28)
    if (photoperiodType === 'autoflower') {
      const daysSinceStart = daysSince(plantedAt, now);
      const nudgeStartDate =
        daysSinceStart >= AUTOFLOWER_NUDGE_START_DAY
          ? now
          : addDays(plantedAt, AUTOFLOWER_NUDGE_START_DAY);

      const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(
        nudgeStartDate,
        timezone
      );
      specs.push({
        title: i18n.t('tasks.check_preflowers.title'),
        description: i18n.t('tasks.check_preflowers.description'),
        rrule: 'FREQ=DAILY;INTERVAL=1',
        dtstartLocal,
        dtstartUtc,
        timezone,
        metadata: this.buildMetadata('legacy.autoflower.check_preflowers', {
          category: 'legacy',
        }),
      });
    }

    return specs;
  }

  /**
   * Flowering stage: Continue watering, adjust feeding with flush cutoff
   */
  private static createFloweringTasks(settings: PlantSettings): SeriesSpec[] {
    const specs: SeriesSpec[] = [];
    const {
      medium,
      environment,
      photoperiodType,
      floweringDays,
      stageEnteredAt,
      timezone,
    } = settings;
    const now = new Date();
    const flowerStart = stageEnteredAt ?? now;

    // Watering tasks (same as veg)
    specs.push(...this.createWateringTasks(settings, now));

    // Calculate harvest and flush dates
    const harvestDate = addDays(flowerStart, floweringDays);
    const flushStartDate = addDays(harvestDate, -FLUSH_DAYS);

    // Feeding tasks with UNTIL set to flush start - 1 day
    const feedUntilDate = addDays(flushStartDate, -1);
    if (feedUntilDate > now) {
      specs.push(...this.createFeedingTasks(settings, now, feedUntilDate));
    }

    // Hydro maintenance (continues through flower)
    if (medium === 'hydro') {
      specs.push(...this.createHydroMaintenanceTasks(settings, now));
    }

    // Environment check task (weekly on Wednesdays)
    specs.push(...this.createEnvironmentCheckTasks(settings, now));

    // Photoperiod + Indoor: Switch to 12/12 reminder (one-time)
    if (photoperiodType === 'photoperiod' && environment === 'indoor') {
      const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(
        now,
        timezone
      );
      specs.push({
        title: i18n.t('tasks.switch_lights.title'),
        description: i18n.t('tasks.switch_lights.description'),
        rrule: 'FREQ=DAILY;INTERVAL=1',
        dtstartLocal,
        dtstartUtc,
        timezone,
        count: 1,
        metadata: this.buildMetadata('legacy.flowering.switch_lights', {
          category: 'legacy',
        }),
      });
    }

    // Sativa/Balanced stretch warning (week 3 of flower, indoor only)
    specs.push(...this.createStretchWarningTask(settings, flowerStart, now));

    // Flush period tasks
    specs.push(
      ...this.createFlushTasks({ flushStartDate, harvestDate, now, timezone })
    );

    return specs;
  }

  /**
   * Create stretch warning task for sativa-dominant and balanced plants (indoor only)
   */
  private static createStretchWarningTask(
    settings: PlantSettings,
    flowerStart: Date,
    now: Date
  ): SeriesSpec[] {
    const { geneticLean, timezone, environment } = settings;
    if (
      environment !== 'indoor' ||
      (geneticLean !== 'sativa_dominant' && geneticLean !== 'balanced')
    ) {
      return [];
    }

    const stretchWarningDate = addDays(flowerStart, STRETCH_WARNING_DAY);
    if (stretchWarningDate <= now) {
      return [];
    }

    const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(
      stretchWarningDate,
      timezone
    );
    return [
      {
        title: i18n.t('tasks.check_light_distance.title'),
        description: i18n.t('tasks.check_light_distance.description'),
        rrule: 'FREQ=DAILY;INTERVAL=1',
        dtstartLocal,
        dtstartUtc,
        timezone,
        count: 1,
        metadata: this.buildMetadata(
          'legacy.environment.check_light_distance',
          {
            category: 'environment',
          }
        ),
      },
    ];
  }

  /**
   * Create flush period tasks
   */
  private static createFlushTasks(params: {
    flushStartDate: Date;
    harvestDate: Date;
    now: Date;
    timezone: string;
  }): SeriesSpec[] {
    const { flushStartDate, harvestDate, now, timezone } = params;
    if (flushStartDate <= now) {
      return [];
    }

    const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(
      flushStartDate,
      timezone
    );
    return [
      {
        title: i18n.t('tasks.start_flushing.title'),
        description: i18n.t('tasks.start_flushing.description_rich'),
        rrule: 'FREQ=DAILY;INTERVAL=2',
        dtstartLocal,
        dtstartUtc,
        timezone,
        untilUtc: buildUntilUtc(harvestDate),
        metadata: this.buildMetadata('legacy.nutrition.start_flushing', {
          category: 'nutrition',
        }),
      },
    ];
  }

  /**
   * Harvesting/Drying stage: Stem snap check for 10 days
   */
  private static createHarvestingTasks(settings: PlantSettings): SeriesSpec[] {
    const { timezone } = settings;
    const now = new Date();
    const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(now, timezone);

    return [
      {
        title: i18n.t('tasks.check_stem_snap.title'),
        description: i18n.t('tasks.check_stem_snap.description'),
        rrule: 'FREQ=DAILY;INTERVAL=1',
        dtstartLocal,
        dtstartUtc,
        timezone,
        count: STEM_SNAP_CHECK_DAYS,
        metadata: this.buildMetadata('legacy.harvest.check_stem_snap', {
          category: 'legacy',
        }),
      },
    ];
  }

  /**
   * Curing stage: Burp jars - 2x daily week 1, daily week 2, weekly thereafter
   */
  private static createCuringTasks(settings: PlantSettings): SeriesSpec[] {
    const { timezone, stageEnteredAt } = settings;
    const now = new Date();
    const cureStart = stageEnteredAt ?? now;

    const specs: SeriesSpec[] = [];

    const week1Start = DateTime.fromJSDate(cureStart, { zone: timezone }).set({
      hour: 9,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
    const week2Start = week1Start.plus({ days: 7 });
    const week3Start = week1Start.plus({ days: 14 });

    // Week 1: 2x daily (14 occurrences)
    const { dtstartLocal: dtstartLocal1, dtstartUtc: dtstartUtc1 } =
      buildDtstartTimestamps(week1Start.toJSDate(), timezone);
    specs.push({
      title: i18n.t('tasks.burp_jars_week1.title'),
      description: i18n.t('tasks.burp_jars_week1.description_rich'),
      rrule: 'FREQ=DAILY;INTERVAL=1;BYHOUR=9,21;BYMINUTE=0;BYSECOND=0',
      dtstartLocal: dtstartLocal1,
      dtstartUtc: dtstartUtc1,
      timezone,
      count: 14,
      metadata: this.buildMetadata('legacy.curing.burp_jars_week1', {
        category: 'curing',
      }),
    });

    // Week 2: Daily
    const { dtstartLocal: dtstartLocal2, dtstartUtc: dtstartUtc2 } =
      buildDtstartTimestamps(week2Start.toJSDate(), timezone);
    specs.push({
      title: i18n.t('tasks.burp_jars_week2.title'),
      description: i18n.t('tasks.burp_jars_week2.description_rich'),
      rrule: 'FREQ=DAILY;INTERVAL=1;BYHOUR=9;BYMINUTE=0;BYSECOND=0',
      dtstartLocal: dtstartLocal2,
      dtstartUtc: dtstartUtc2,
      timezone,
      count: 7,
      metadata: this.buildMetadata('legacy.curing.burp_jars_week2', {
        category: 'curing',
      }),
    });

    // Week 3+: Weekly thereafter
    const weeklyStart =
      week3Start > DateTime.fromJSDate(now, { zone: timezone })
        ? week3Start
        : DateTime.fromJSDate(now, { zone: timezone }).set({
            hour: 9,
            minute: 0,
            second: 0,
            millisecond: 0,
          });
    const { dtstartLocal: dtstartLocal3, dtstartUtc: dtstartUtc3 } =
      buildDtstartTimestamps(weeklyStart.toJSDate(), timezone);
    specs.push({
      title: i18n.t('tasks.burp_jars_week3.title'),
      description: i18n.t('tasks.burp_jars_week3.description_rich'),
      rrule: 'FREQ=WEEKLY;INTERVAL=1;BYHOUR=9;BYMINUTE=0;BYSECOND=0',
      dtstartLocal: dtstartLocal3,
      dtstartUtc: dtstartUtc3,
      timezone,
      metadata: this.buildMetadata('legacy.curing.burp_jars_week3', {
        category: 'curing',
      }),
    });

    return specs;
  }

  /**
   * Create watering tasks based on medium and pot size
   */
  private static createWateringTasks(
    settings: PlantSettings,
    startDate: Date
  ): SeriesSpec[] {
    const { medium, potSizeLiters, timezone } = settings;

    // No watering tasks for hydro
    if (medium === 'hydro') {
      return [];
    }

    const interval = getWateringInterval(medium, potSizeLiters);
    const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(
      startDate,
      timezone
    );

    // Calculate dynamic water volume
    const { min, max } = calculateWaterVolume(potSizeLiters);

    const descriptionKey =
      medium === 'coco'
        ? 'tasks.check_water_need.description_coco'
        : 'tasks.check_water_need.description_soil';

    return [
      {
        title: i18n.t('tasks.check_water_need.title'),
        description: i18n.t(descriptionKey, { min, max }),
        rrule: `FREQ=DAILY;INTERVAL=${interval}`,
        dtstartLocal,
        dtstartUtc,
        timezone,
        metadata: this.buildMetadata('legacy.hydrology.check_water_need', {
          category: 'hydrology',
          type: 'water',
        }),
      },
    ];
  }

  /**
   * Create feeding tasks based on medium and stage
   */
  private static createFeedingTasks(
    settings: PlantSettings,
    startDate: Date,
    untilDate?: Date
  ): SeriesSpec[] {
    const { medium, timezone, stage } = settings;

    // Living soil: No liquid feeding (uses top dressing instead)
    // Hydro: Nutrients handled in reservoir
    if (medium === 'living_soil' || medium === 'hydro') {
      return [];
    }

    const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(
      startDate,
      timezone
    );

    let rrule: string;
    let descriptionKey: string;

    // Stage-aware description keys
    const isFlowering = stage === 'flowering';

    switch (medium) {
      case 'coco':
        rrule = 'FREQ=DAILY;INTERVAL=1';
        descriptionKey = isFlowering
          ? 'tasks.feed_plant.description_coco_flower_safe'
          : 'tasks.feed_plant.description_coco_veg_safe';
        break;
      case 'soil':
      case 'other':
      default:
        rrule = 'FREQ=WEEKLY;BYDAY=FR';
        descriptionKey = isFlowering
          ? 'tasks.feed_plant.description_soil_flower_safe'
          : 'tasks.feed_plant.description_soil_veg_safe';
        break;
    }

    return [
      {
        title: i18n.t('tasks.feed_plant.title'),
        description: i18n.t(descriptionKey),
        rrule,
        dtstartLocal,
        dtstartUtc,
        timezone,
        ...(untilDate && { untilUtc: buildUntilUtc(untilDate) }),
        metadata: this.buildMetadata('legacy.nutrition.feed_plant', {
          category: 'nutrition',
          type: 'feed',
        }),
      },
    ];
  }

  /**
   * Create hydro-specific maintenance tasks
   */
  private static createHydroMaintenanceTasks(
    settings: PlantSettings,
    startDate: Date
  ): SeriesSpec[] {
    const { timezone } = settings;
    const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(
      startDate,
      timezone
    );

    return [
      {
        title: i18n.t('tasks.check_ph_ec.title'),
        description: i18n.t('tasks.check_ph_ec.description'),
        rrule: 'FREQ=DAILY;INTERVAL=1',
        dtstartLocal,
        dtstartUtc,
        timezone,
        metadata: this.buildMetadata('legacy.hydrology.check_ph_ec', {
          category: 'hydrology',
        }),
      },
      {
        title: i18n.t('tasks.check_water_temp.title'),
        description: i18n.t('tasks.check_water_temp.description'),
        rrule: 'FREQ=DAILY;INTERVAL=1',
        dtstartLocal,
        dtstartUtc,
        timezone,
        metadata: this.buildMetadata('legacy.hydrology.check_water_temp', {
          category: 'hydrology',
        }),
      },
      {
        title: i18n.t('tasks.change_reservoir.title'),
        description: i18n.t('tasks.change_reservoir.description'),
        rrule: 'FREQ=WEEKLY;INTERVAL=1',
        dtstartLocal,
        dtstartUtc,
        timezone,
        metadata: this.buildMetadata('legacy.hydrology.change_reservoir', {
          category: 'hydrology',
        }),
      },
    ];
  }

  /**
   * Create environment check tasks (weekly on Wednesdays)
   * Helps beginners monitor temperature and humidity conditions
   */
  private static createEnvironmentCheckTasks(
    settings: PlantSettings,
    startDate: Date
  ): SeriesSpec[] {
    const { timezone, stage } = settings;
    const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(
      startDate,
      timezone
    );

    // Use stage-specific description for humidity targets
    const descriptionKey =
      stage === 'flowering'
        ? 'tasks.climate_check.description_flower'
        : 'tasks.climate_check.description_veg';

    return [
      {
        title: i18n.t('tasks.climate_check.title'),
        description: i18n.t(descriptionKey),
        rrule: 'FREQ=WEEKLY;BYDAY=WE',
        dtstartLocal,
        dtstartUtc,
        timezone,
        metadata: this.buildMetadata('legacy.environment.climate_check', {
          category: 'environment',
        }),
      },
    ];
  }
}
