import type { PlantSettings, SeriesSpec } from './types';
import { AUTOFLOWER_NUDGE_START_DAY, FLUSH_DAYS } from './types';
import {
  addDays,
  buildDtstartTimestamps,
  buildUntilUtc,
  daysSince,
  getWateringInterval,
} from './utils';

/**
 * TaskFactory creates series specifications based on plant settings and stage.
 * These specs are used by the TaskEngine to create actual series in the database.
 */
export class TaskFactory {
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
        title: 'Check Humidity Dome',
        description:
          'Ensure humidity dome is in place and moisture levels are adequate for seedling.',
        rrule: 'FREQ=DAILY;INTERVAL=1',
        dtstartLocal,
        dtstartUtc,
        timezone,
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

    // Living soil top dressing (monthly)
    if (medium === 'living_soil') {
      const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(
        now,
        timezone
      );
      specs.push({
        title: 'Top Dressing',
        description:
          'Add organic amendments to the soil surface for slow-release nutrients.',
        rrule: 'FREQ=MONTHLY;INTERVAL=1',
        dtstartLocal,
        dtstartUtc,
        timezone,
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
        title: 'Check for Pre-flowers (White Pistils)',
        description:
          'Look for white pistils emerging at nodes - a sign your autoflower is transitioning to flower. Consider switching to flowering stage when confirmed.',
        rrule: 'FREQ=DAILY;INTERVAL=1',
        dtstartLocal,
        dtstartUtc,
        timezone,
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

    // Photoperiod + Indoor: Switch to 12/12 reminder (one-time)
    if (photoperiodType === 'photoperiod' && environment === 'indoor') {
      const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(
        now,
        timezone
      );
      specs.push({
        title: 'Switch Lights to 12/12',
        description:
          'Set light schedule to 12 hours on, 12 hours off to trigger and maintain flowering.',
        rrule: 'FREQ=DAILY;INTERVAL=1',
        dtstartLocal,
        dtstartUtc,
        timezone,
        count: 1,
      });
    }

    // Sativa stretch warning (week 3 of flower, indoor only)
    specs.push(...this.createStretchWarningTask(settings, flowerStart, now));

    // Flush period tasks
    specs.push(
      ...this.createFlushTasks({ flushStartDate, harvestDate, now, timezone })
    );

    return specs;
  }

  /**
   * Create stretch warning task for sativa-dominant plants (indoor only)
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

    const stretchWarningDate = addDays(flowerStart, 21); // Week 3
    if (stretchWarningDate <= now) {
      return [];
    }

    const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(
      stretchWarningDate,
      timezone
    );
    return [
      {
        title: 'Check Light Distance (Stretch Warning)',
        description:
          'Sativa-dominant plants may stretch significantly. Ensure adequate distance between lights and canopy to prevent light burn.',
        rrule: 'FREQ=DAILY;INTERVAL=1',
        dtstartLocal,
        dtstartUtc,
        timezone,
        count: 1,
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
        title: 'Start Flushing (Water Only)',
        description:
          'Begin the flush period - use plain pH-balanced water only. This helps remove excess nutrients and improves final taste.',
        rrule: 'FREQ=DAILY;INTERVAL=2',
        dtstartLocal,
        dtstartUtc,
        timezone,
        untilUtc: buildUntilUtc(harvestDate),
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
        title: 'Check Stem Snap',
        description:
          'Bend a small stem - if it snaps cleanly (not bends), buds are ready for curing. Check daily until dry.',
        rrule: 'FREQ=DAILY;INTERVAL=1',
        dtstartLocal,
        dtstartUtc,
        timezone,
        count: 10,
      },
    ];
  }

  /**
   * Curing stage: Burp jars - daily for weeks 1-2, every 3 days for weeks 3-4
   */
  private static createCuringTasks(settings: PlantSettings): SeriesSpec[] {
    const { timezone, stageEnteredAt } = settings;
    const now = new Date();
    const cureStart = stageEnteredAt ?? now;

    const specs: SeriesSpec[] = [];

    // Weeks 1-2: Daily burping (14 days)
    const { dtstartLocal: dtstartLocal1, dtstartUtc: dtstartUtc1 } =
      buildDtstartTimestamps(cureStart, timezone);
    specs.push({
      title: 'Burp Jars',
      description:
        'Open jars for 15-30 minutes to release moisture and refresh air. Check for mold or ammonia smell.',
      rrule: 'FREQ=DAILY;INTERVAL=1',
      dtstartLocal: dtstartLocal1,
      dtstartUtc: dtstartUtc1,
      timezone,
      count: 14,
    });

    // Weeks 3-4: Every 3 days
    const week3Start = addDays(cureStart, 14);
    if (week3Start > now) {
      const { dtstartLocal: dtstartLocal2, dtstartUtc: dtstartUtc2 } =
        buildDtstartTimestamps(week3Start, timezone);
      const week4End = addDays(cureStart, 28);
      specs.push({
        title: 'Burp Jars',
        description:
          'Open jars briefly to maintain proper humidity levels. Less frequent burping is needed as cure progresses.',
        rrule: 'FREQ=DAILY;INTERVAL=3',
        dtstartLocal: dtstartLocal2,
        dtstartUtc: dtstartUtc2,
        timezone,
        untilUtc: buildUntilUtc(week4End),
      });
    }

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

    return [
      {
        title: 'Water Plant',
        description: `Water until ~10-20% runoff. ${medium === 'coco' ? 'Coco dries quickly - check daily.' : 'Check soil moisture before watering.'}`,
        rrule: `FREQ=DAILY;INTERVAL=${interval}`,
        dtstartLocal,
        dtstartUtc,
        timezone,
      },
    ];
  }

  /**
   * Create feeding tasks based on medium
   */
  private static createFeedingTasks(
    settings: PlantSettings,
    startDate: Date,
    untilDate?: Date
  ): SeriesSpec[] {
    const { medium, timezone } = settings;

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
    let description: string;

    switch (medium) {
      case 'coco':
        rrule = 'FREQ=DAILY;INTERVAL=1';
        description =
          'Feed with every watering in coco. Monitor EC/pH of runoff.';
        break;
      case 'soil':
      case 'other':
      default:
        rrule = 'FREQ=WEEKLY;BYDAY=FR';
        description =
          'Apply nutrients according to your feeding schedule. Adjust based on plant response.';
        break;
    }

    return [
      {
        title: 'Feed Plant',
        description,
        rrule,
        dtstartLocal,
        dtstartUtc,
        timezone,
        ...(untilDate && { untilUtc: buildUntilUtc(untilDate) }),
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
        title: 'Check pH & EC',
        description:
          'Monitor reservoir pH (5.5-6.5) and EC levels. Adjust as needed for optimal nutrient uptake.',
        rrule: 'FREQ=DAILY;INTERVAL=1',
        dtstartLocal,
        dtstartUtc,
        timezone,
      },
      {
        title: 'Check Water Temperature',
        description:
          'Maintain reservoir temperature between 18-22°C (65-72°F) to prevent root issues.',
        rrule: 'FREQ=DAILY;INTERVAL=1',
        dtstartLocal,
        dtstartUtc,
        timezone,
      },
      {
        title: 'Change Reservoir Water',
        description:
          'Complete water change to prevent nutrient buildup and maintain freshness.',
        rrule: 'FREQ=WEEKLY;INTERVAL=1',
        dtstartLocal,
        dtstartUtc,
        timezone,
      },
    ];
  }
}
