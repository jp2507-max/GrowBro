import { DateTime } from 'luxon';

import { TaskFactory } from './task-factory';
import type { PlantSettings } from './types';
import {
  AUTOFLOWER_NUDGE_START_DAY,
  DEFAULT_FLOWERING_DAYS_AUTOFLOWER,
  DEFAULT_FLOWERING_DAYS_PHOTOPERIOD,
} from './types';

function createDefaultSettings(
  overrides: Partial<PlantSettings> = {}
): PlantSettings {
  return {
    plantId: 'test-plant-1',
    stage: 'vegetative',
    medium: 'soil',
    potSizeLiters: 10,
    environment: 'indoor',
    photoperiodType: 'photoperiod',
    geneticLean: 'balanced',
    plantedAt: new Date('2024-01-01T10:00:00Z'),
    floweringDays: DEFAULT_FLOWERING_DAYS_PHOTOPERIOD,
    timezone: 'Europe/Berlin',
    ...overrides,
  };
}

describe('TaskFactory', () => {
  describe('Seedling stage', () => {
    it('creates only humidity dome check task', () => {
      const settings = createDefaultSettings({ stage: 'seedling' });
      const specs = TaskFactory.create(settings);

      expect(specs).toHaveLength(1);
      expect(specs[0].title).toBe('Check Humidity Dome');
      expect(specs[0].rrule).toBe('FREQ=DAILY;INTERVAL=1');
    });

    it('does NOT create watering or feeding tasks for seedling (seedling safety)', () => {
      const settings = createDefaultSettings({
        stage: 'seedling',
        medium: 'coco',
      });
      const specs = TaskFactory.create(settings);

      const titles = specs.map((s) => s.title);
      expect(titles).not.toContain('Check Water Need');
      expect(titles).not.toContain('Feed Plant');
    });
  });

  describe('Vegetative stage - Soil medium', () => {
    it('creates watering task with default 3-day interval for 10L pot', () => {
      const settings = createDefaultSettings({
        stage: 'vegetative',
        medium: 'soil',
        potSizeLiters: 10,
      });
      const specs = TaskFactory.create(settings);

      const waterTask = specs.find((s) => s.title === 'Check Water Need');
      expect(waterTask).toBeDefined();
      expect(waterTask?.rrule).toBe('FREQ=DAILY;INTERVAL=3');
    });

    it('creates watering task with 2-day interval for small pot (<10L)', () => {
      const settings = createDefaultSettings({
        stage: 'vegetative',
        medium: 'soil',
        potSizeLiters: 5,
      });
      const specs = TaskFactory.create(settings);

      const waterTask = specs.find((s) => s.title === 'Check Water Need');
      expect(waterTask?.rrule).toBe('FREQ=DAILY;INTERVAL=2');
    });

    it('creates watering task with 4-day interval for large pot (>25L)', () => {
      const settings = createDefaultSettings({
        stage: 'vegetative',
        medium: 'soil',
        potSizeLiters: 30,
      });
      const specs = TaskFactory.create(settings);

      const waterTask = specs.find((s) => s.title === 'Check Water Need');
      expect(waterTask?.rrule).toBe('FREQ=DAILY;INTERVAL=4');
    });

    it('creates weekly feeding task on Friday', () => {
      const settings = createDefaultSettings({
        stage: 'vegetative',
        medium: 'soil',
      });
      const specs = TaskFactory.create(settings);

      const feedTask = specs.find((s) => s.title === 'Feed Plant');
      expect(feedTask).toBeDefined();
      expect(feedTask?.rrule).toBe('FREQ=WEEKLY;BYDAY=FR');
    });

    it('creates weekly climate check task on Wednesdays', () => {
      const settings = createDefaultSettings({
        stage: 'vegetative',
        medium: 'soil',
      });
      const specs = TaskFactory.create(settings);

      const climateTask = specs.find((s) => s.title === 'Climate Check');
      expect(climateTask).toBeDefined();
      expect(climateTask?.rrule).toBe('FREQ=WEEKLY;BYDAY=WE');
    });
  });

  describe('Vegetative stage - Coco medium', () => {
    it('creates daily watering task', () => {
      const settings = createDefaultSettings({
        stage: 'vegetative',
        medium: 'coco',
      });
      const specs = TaskFactory.create(settings);

      const waterTask = specs.find((s) => s.title === 'Check Water Need');
      expect(waterTask?.rrule).toBe('FREQ=DAILY;INTERVAL=1');
    });

    it('creates daily feeding task', () => {
      const settings = createDefaultSettings({
        stage: 'vegetative',
        medium: 'coco',
      });
      const specs = TaskFactory.create(settings);

      const feedTask = specs.find((s) => s.title === 'Feed Plant');
      expect(feedTask?.rrule).toBe('FREQ=DAILY;INTERVAL=1');
    });
  });

  describe('Vegetative stage - Living Soil medium', () => {
    it('creates watering task like soil', () => {
      const settings = createDefaultSettings({
        stage: 'vegetative',
        medium: 'living_soil',
        potSizeLiters: 15,
      });
      const specs = TaskFactory.create(settings);

      const waterTask = specs.find((s) => s.title === 'Check Water Need');
      expect(waterTask).toBeDefined();
      expect(waterTask?.rrule).toBe('FREQ=DAILY;INTERVAL=3');
    });

    it('does NOT create liquid feed task', () => {
      const settings = createDefaultSettings({
        stage: 'vegetative',
        medium: 'living_soil',
      });
      const specs = TaskFactory.create(settings);

      const feedTask = specs.find((s) => s.title === 'Feed Plant');
      expect(feedTask).toBeUndefined();
    });

    it('creates monthly top dressing task', () => {
      const settings = createDefaultSettings({
        stage: 'vegetative',
        medium: 'living_soil',
      });
      const specs = TaskFactory.create(settings);

      const topDressTask = specs.find((s) => s.title === 'Top Dressing');
      expect(topDressTask).toBeDefined();
      expect(topDressTask?.rrule).toBe('FREQ=MONTHLY;INTERVAL=1');
    });
  });

  describe('Vegetative stage - Hydro medium', () => {
    it('does NOT create watering tasks', () => {
      const settings = createDefaultSettings({
        stage: 'vegetative',
        medium: 'hydro',
      });
      const specs = TaskFactory.create(settings);

      const waterTask = specs.find((s) => s.title === 'Check Water Need');
      expect(waterTask).toBeUndefined();
    });

    it('creates daily pH & EC check', () => {
      const settings = createDefaultSettings({
        stage: 'vegetative',
        medium: 'hydro',
      });
      const specs = TaskFactory.create(settings);

      const phTask = specs.find((s) => s.title === 'Check pH & EC');
      expect(phTask).toBeDefined();
      expect(phTask?.rrule).toBe('FREQ=DAILY;INTERVAL=1');
    });

    it('creates daily water temperature check', () => {
      const settings = createDefaultSettings({
        stage: 'vegetative',
        medium: 'hydro',
      });
      const specs = TaskFactory.create(settings);

      const tempTask = specs.find((s) => s.title === 'Check Water Temperature');
      expect(tempTask).toBeDefined();
      expect(tempTask?.rrule).toBe('FREQ=DAILY;INTERVAL=1');
    });

    it('creates weekly reservoir water change', () => {
      const settings = createDefaultSettings({
        stage: 'vegetative',
        medium: 'hydro',
      });
      const specs = TaskFactory.create(settings);

      const changeTask = specs.find(
        (s) => s.title === 'Change Reservoir Water'
      );
      expect(changeTask).toBeDefined();
      expect(changeTask?.rrule).toBe('FREQ=WEEKLY;INTERVAL=1');
    });
  });

  describe('Autoflower Smart Nudge', () => {
    it('creates nudge task starting immediately if plant is past day 28', () => {
      const plantedAt = DateTime.now().minus({ days: 35 }).toJSDate();
      const settings = createDefaultSettings({
        stage: 'vegetative',
        photoperiodType: 'autoflower',
        plantedAt,
        floweringDays: DEFAULT_FLOWERING_DAYS_AUTOFLOWER,
      });
      const specs = TaskFactory.create(settings);

      const nudgeTask = specs.find((s) =>
        s.title.includes('Check for Pre-flowers')
      );
      expect(nudgeTask).toBeDefined();
      // Should start today since plant is already past day 28
      const dtstart = DateTime.fromISO(nudgeTask!.dtstartLocal);
      expect(dtstart.hasSame(DateTime.now(), 'day')).toBe(true);
    });

    it('creates nudge task with future dtstart if plant is before day 28', () => {
      const plantedAt = DateTime.now().minus({ days: 10 }).toJSDate();
      const settings = createDefaultSettings({
        stage: 'vegetative',
        photoperiodType: 'autoflower',
        plantedAt,
        floweringDays: DEFAULT_FLOWERING_DAYS_AUTOFLOWER,
      });
      const specs = TaskFactory.create(settings);

      const nudgeTask = specs.find((s) =>
        s.title.includes('Check for Pre-flowers')
      );
      expect(nudgeTask).toBeDefined();
      // Should start at day 28 (18 days from now)
      const dtstart = DateTime.fromISO(nudgeTask!.dtstartLocal);
      const expectedStart = DateTime.fromJSDate(plantedAt).plus({
        days: AUTOFLOWER_NUDGE_START_DAY,
      });
      expect(dtstart.hasSame(expectedStart, 'day')).toBe(true);
    });

    it('does NOT create nudge task for photoperiod plants', () => {
      const settings = createDefaultSettings({
        stage: 'vegetative',
        photoperiodType: 'photoperiod',
      });
      const specs = TaskFactory.create(settings);

      const nudgeTask = specs.find((s) =>
        s.title.includes('Check for Pre-flowers')
      );
      expect(nudgeTask).toBeUndefined();
    });
  });

  describe('Flowering stage', () => {
    it('creates 12/12 light switch task for indoor photoperiod', () => {
      const settings = createDefaultSettings({
        stage: 'flowering',
        environment: 'indoor',
        photoperiodType: 'photoperiod',
      });
      const specs = TaskFactory.create(settings);

      const lightTask = specs.find((s) => s.title === 'Switch Lights to 12/12');
      expect(lightTask).toBeDefined();
      expect(lightTask?.count).toBe(1); // One-time task
    });

    it('does NOT create 12/12 task for outdoor plants', () => {
      const settings = createDefaultSettings({
        stage: 'flowering',
        environment: 'outdoor',
        photoperiodType: 'photoperiod',
      });
      const specs = TaskFactory.create(settings);

      const lightTask = specs.find((s) => s.title === 'Switch Lights to 12/12');
      expect(lightTask).toBeUndefined();
    });

    it('creates sativa stretch warning for indoor sativa-dominant', () => {
      const stageEnteredAt = new Date();
      const settings = createDefaultSettings({
        stage: 'flowering',
        environment: 'indoor',
        geneticLean: 'sativa_dominant',
        stageEnteredAt,
      });
      const specs = TaskFactory.create(settings);

      const stretchTask = specs.find((s) => s.title.includes('Light Distance'));
      expect(stretchTask).toBeDefined();
      // Should be scheduled for week 3 of flower
      const dtstart = DateTime.fromISO(stretchTask!.dtstartLocal);
      const expectedDate = DateTime.fromJSDate(stageEnteredAt).plus({
        days: 21,
      });
      expect(dtstart.hasSame(expectedDate, 'day')).toBe(true);
    });

    it('creates flush task with correct schedule', () => {
      const stageEnteredAt = new Date();
      const settings = createDefaultSettings({
        stage: 'flowering',
        stageEnteredAt,
        floweringDays: 56,
      });
      const specs = TaskFactory.create(settings);

      const flushTask = specs.find((s) => s.title.includes('Flushing'));
      expect(flushTask).toBeDefined();
      expect(flushTask?.rrule).toBe('FREQ=DAILY;INTERVAL=2');
      expect(flushTask?.untilUtc).toBeDefined();
    });
  });

  describe('Harvesting/Drying stage', () => {
    it('creates stem snap check for 10 days', () => {
      const settings = createDefaultSettings({ stage: 'harvesting' });
      const specs = TaskFactory.create(settings);

      expect(specs).toHaveLength(1);
      expect(specs[0].title).toBe('Check Stem Snap');
      expect(specs[0].rrule).toBe('FREQ=DAILY;INTERVAL=1');
      expect(specs[0].count).toBe(10);
    });
  });

  describe('Curing stage', () => {
    it('creates daily burp task for first 2 weeks', () => {
      const settings = createDefaultSettings({ stage: 'curing' });
      const specs = TaskFactory.create(settings);

      const dailyBurp = specs.find(
        (s) => s.title === 'Burp Jars' && s.count === 14
      );
      expect(dailyBurp).toBeDefined();
      expect(dailyBurp?.rrule).toBe('FREQ=DAILY;INTERVAL=1');
    });

    it('creates every-3-days burp task for weeks 3-4', () => {
      const stageEnteredAt = new Date();
      const settings = createDefaultSettings({
        stage: 'curing',
        stageEnteredAt,
      });
      const specs = TaskFactory.create(settings);

      const laterBurp = specs.find(
        (s) => s.title === 'Burp Jars' && s.rrule === 'FREQ=DAILY;INTERVAL=3'
      );
      expect(laterBurp).toBeDefined();
      expect(laterBurp?.untilUtc).toBeDefined();
    });
  });

  describe('Ready stage', () => {
    it('creates no tasks', () => {
      const settings = createDefaultSettings({ stage: 'ready' });
      const specs = TaskFactory.create(settings);

      expect(specs).toHaveLength(0);
    });
  });
});
