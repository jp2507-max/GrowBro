/* eslint-disable max-lines-per-function */
import {
  formatPercentageDisplay,
  normalizeEffects,
  normalizeFlavors,
  normalizeGrowCharacteristics,
  normalizeGrowDifficulty,
  normalizeRace,
  normalizeStrain,
  normalizeTerpenes,
  parsePercentageRange,
} from './utils';

describe('Strains Utilities', () => {
  describe('normalizeRace', () => {
    test('normalizes indica variants', () => {
      expect(normalizeRace('indica')).toBe('indica');
      expect(normalizeRace('Indica')).toBe('indica');
      expect(normalizeRace('INDICA')).toBe('indica');
      expect(normalizeRace('indica dominant')).toBe('indica');
    });

    test('normalizes sativa variants', () => {
      expect(normalizeRace('sativa')).toBe('sativa');
      expect(normalizeRace('Sativa')).toBe('sativa');
      expect(normalizeRace('SATIVA')).toBe('sativa');
      expect(normalizeRace('sativa dominant')).toBe('sativa');
    });

    test('defaults to hybrid', () => {
      expect(normalizeRace('hybrid')).toBe('hybrid');
      expect(normalizeRace('unknown')).toBe('hybrid');
      expect(normalizeRace('')).toBe('hybrid');
      expect(normalizeRace(null)).toBe('hybrid');
      expect(normalizeRace(undefined)).toBe('hybrid');
      expect(normalizeRace(123)).toBe('hybrid');
    });
  });

  describe('parsePercentageRange', () => {
    test('parses numeric strings', () => {
      expect(parsePercentageRange('17%')).toEqual({ min: 17, max: 17 });
      expect(parsePercentageRange('17')).toEqual({ min: 17, max: 17 });
      expect(parsePercentageRange('18.5%')).toEqual({ min: 18.5, max: 18.5 });
    });

    test('parses numeric ranges', () => {
      expect(parsePercentageRange('15-20%')).toEqual({ min: 15, max: 20 });
      expect(parsePercentageRange('15-20')).toEqual({ min: 15, max: 20 });
      expect(parsePercentageRange('12.5 - 18.5%')).toEqual({
        min: 12.5,
        max: 18.5,
      });
    });

    test('handles qualitative values', () => {
      expect(parsePercentageRange('High')).toEqual({ label: 'High' });
      expect(parsePercentageRange('Low')).toEqual({ label: 'Low' });
      expect(parsePercentageRange('Medium')).toEqual({ label: 'Medium' });
      expect(parsePercentageRange('Unknown')).toEqual({ label: 'Unknown' });
    });

    test('handles numeric values', () => {
      expect(parsePercentageRange(17)).toEqual({ min: 17, max: 17 });
      expect(parsePercentageRange(18.5)).toEqual({ min: 18.5, max: 18.5 });
    });

    test('handles objects with min/max', () => {
      expect(parsePercentageRange({ min: 15, max: 20 })).toEqual({
        min: 15,
        max: 20,
      });
      expect(parsePercentageRange({ min: 17 })).toEqual({
        min: 17,
        max: undefined,
        label: undefined,
      });
      expect(parsePercentageRange({ label: 'High' })).toEqual({
        min: undefined,
        max: undefined,
        label: 'High',
      });
    });

    test('handles null and undefined', () => {
      expect(parsePercentageRange(null)).toEqual({});
      expect(parsePercentageRange(undefined)).toEqual({});
      expect(parsePercentageRange('')).toEqual({});
    });

    test('handles edge cases', () => {
      expect(parsePercentageRange('   17%   ')).toEqual({ min: 17, max: 17 });
      expect(parsePercentageRange('0%')).toEqual({ min: 0, max: 0 });
      expect(parsePercentageRange('100%')).toEqual({ min: 100, max: 100 });
    });
  });

  describe('formatPercentageDisplay', () => {
    test('formats single values', () => {
      expect(formatPercentageDisplay({ min: 17, max: 17 })).toBe('17%');
      expect(formatPercentageDisplay({ min: 18.5, max: 18.5 })).toBe('18.5%');
    });

    test('formats ranges', () => {
      expect(formatPercentageDisplay({ min: 15, max: 20 })).toBe('15-20%');
      expect(formatPercentageDisplay({ min: 12.5, max: 18.5 })).toBe(
        '12.5-18.5%'
      );
    });

    test('formats min-only values', () => {
      expect(formatPercentageDisplay({ min: 15 })).toBe('15%+');
      expect(formatPercentageDisplay({ min: 18.5 })).toBe('18.5%+');
    });

    test('uses label when available', () => {
      expect(formatPercentageDisplay({ label: 'High' })).toBe('High');
      expect(formatPercentageDisplay({ min: 17, label: 'High' })).toBe('High');
    });

    test('returns "Not reported" for empty values', () => {
      expect(formatPercentageDisplay({})).toBe('Not reported');
    });

    test('formats max-only values', () => {
      expect(formatPercentageDisplay({ max: 20 })).toBe('Up to 20%');
    });

    test('supports locale formatting', () => {
      // German locale uses comma as decimal separator
      expect(formatPercentageDisplay({ min: 18.5, max: 18.5 }, 'de-DE')).toBe(
        '18,5%'
      );
      expect(formatPercentageDisplay({ min: 15.5, max: 20.5 }, 'de-DE')).toBe(
        '15,5-20,5%'
      );
    });
  });

  describe('normalizeEffects', () => {
    test('normalizes string array', () => {
      const input = ['Relaxed', 'Happy', 'Euphoric'];
      const result = normalizeEffects(input);
      expect(result).toEqual([
        { name: 'Relaxed' },
        { name: 'Happy' },
        { name: 'Euphoric' },
      ]);
    });

    test('normalizes object array with intensity', () => {
      const input = [
        { name: 'Relaxed', intensity: 'high' },
        { name: 'Happy', intensity: 'medium' },
      ];
      const result = normalizeEffects(input);
      expect(result).toEqual([
        { name: 'Relaxed', intensity: 'high' },
        { name: 'Happy', intensity: 'medium' },
      ]);
    });

    test('filters out invalid values', () => {
      const input = [
        'Valid',
        null,
        undefined,
        { name: 'Also Valid' },
        { invalid: 'no name' },
        123,
      ];
      const result = normalizeEffects(input);
      expect(result).toEqual([{ name: 'Valid' }, { name: 'Also Valid' }]);
    });

    test('ignores invalid intensity values', () => {
      const input = [{ name: 'Relaxed', intensity: 'invalid' }];
      const result = normalizeEffects(input);
      expect(result).toEqual([{ name: 'Relaxed', intensity: undefined }]);
    });

    test('returns empty array for non-array input', () => {
      expect(normalizeEffects(null)).toEqual([]);
      expect(normalizeEffects(undefined)).toEqual([]);
      expect(normalizeEffects('not an array')).toEqual([]);
      expect(normalizeEffects({})).toEqual([]);
    });
  });

  describe('normalizeFlavors', () => {
    test('normalizes string array', () => {
      const input = ['Earthy', 'Pine', 'Citrus'];
      const result = normalizeFlavors(input);
      expect(result).toEqual([
        { name: 'Earthy' },
        { name: 'Pine' },
        { name: 'Citrus' },
      ]);
    });

    test('normalizes object array with category', () => {
      const input = [
        { name: 'Lemon', category: 'Citrus' },
        { name: 'Pine', category: 'Tree' },
      ];
      const result = normalizeFlavors(input);
      expect(result).toEqual([
        { name: 'Lemon', category: 'Citrus' },
        { name: 'Pine', category: 'Tree' },
      ]);
    });

    test('filters out invalid values', () => {
      const input = [
        'Valid',
        null,
        { name: 'Also Valid' },
        { invalid: 'no name' },
      ];
      const result = normalizeFlavors(input);
      expect(result).toEqual([{ name: 'Valid' }, { name: 'Also Valid' }]);
    });

    test('returns empty array for non-array input', () => {
      expect(normalizeFlavors(null)).toEqual([]);
      expect(normalizeFlavors(undefined)).toEqual([]);
      expect(normalizeFlavors('not an array')).toEqual([]);
    });
  });

  describe('normalizeTerpenes', () => {
    test('normalizes string array', () => {
      const input = ['Myrcene', 'Limonene', 'Caryophyllene'];
      const result = normalizeTerpenes(input);
      expect(result).toEqual([
        { name: 'Myrcene' },
        { name: 'Limonene' },
        { name: 'Caryophyllene' },
      ]);
    });

    test('normalizes object array with percentage and description', () => {
      const input = [
        { name: 'Myrcene', percentage: 0.5, aroma_description: 'Earthy' },
        { name: 'Limonene', percentage: 0.3, aroma_description: 'Citrus' },
      ];
      const result = normalizeTerpenes(input);
      expect(result).toEqual([
        { name: 'Myrcene', percentage: 0.5, aroma_description: 'Earthy' },
        { name: 'Limonene', percentage: 0.3, aroma_description: 'Citrus' },
      ]);
    });

    test('returns undefined for empty array', () => {
      expect(normalizeTerpenes([])).toBeUndefined();
    });

    test('returns undefined for non-array input', () => {
      expect(normalizeTerpenes(null)).toBeUndefined();
      expect(normalizeTerpenes(undefined)).toBeUndefined();
      expect(normalizeTerpenes('not an array')).toBeUndefined();
    });

    test('filters out invalid values', () => {
      const input = [
        'Valid',
        null,
        { name: 'Also Valid' },
        { invalid: 'no name' },
      ];
      const result = normalizeTerpenes(input);
      expect(result).toEqual([{ name: 'Valid' }, { name: 'Also Valid' }]);
    });
  });

  describe('normalizeGrowDifficulty', () => {
    test('normalizes beginner variants', () => {
      expect(normalizeGrowDifficulty('beginner')).toBe('beginner');
      expect(normalizeGrowDifficulty('Beginner')).toBe('beginner');
      expect(normalizeGrowDifficulty('easy')).toBe('beginner');
      expect(normalizeGrowDifficulty('Easy')).toBe('beginner');
    });

    test('normalizes advanced variants', () => {
      expect(normalizeGrowDifficulty('advanced')).toBe('advanced');
      expect(normalizeGrowDifficulty('Advanced')).toBe('advanced');
      expect(normalizeGrowDifficulty('expert')).toBe('advanced');
      expect(normalizeGrowDifficulty('Expert')).toBe('advanced');
    });

    test('defaults to intermediate', () => {
      expect(normalizeGrowDifficulty('intermediate')).toBe('intermediate');
      expect(normalizeGrowDifficulty('medium')).toBe('intermediate');
      expect(normalizeGrowDifficulty('')).toBe('intermediate');
      expect(normalizeGrowDifficulty(null)).toBe('intermediate');
      expect(normalizeGrowDifficulty(undefined)).toBe('intermediate');
    });
  });

  describe('normalizeGrowCharacteristics', () => {
    test('normalizes complete grow data', () => {
      const input = {
        difficulty: 'beginner',
        indoor_suitable: true,
        outdoor_suitable: false,
        flowering_time: { min_weeks: 8, max_weeks: 10 },
        yield: {
          indoor: { min_grams: 400, max_grams: 500 },
          outdoor: { min_grams: 600, max_grams: 800 },
        },
        height: { indoor_cm: 100, outdoor_cm: 200 },
      };
      const result = normalizeGrowCharacteristics(input);
      expect(result).toEqual({
        difficulty: 'beginner',
        indoor_suitable: true,
        outdoor_suitable: false,
        flowering_time: { min_weeks: 8, max_weeks: 10, label: undefined },
        yield: {
          indoor: { min_grams: 400, max_grams: 500, label: undefined },
          outdoor: { min_grams: 600, max_grams: 800, label: undefined },
        },
        height: { indoor_cm: 100, outdoor_cm: 200, label: undefined },
      });
    });

    test('provides defaults for missing data', () => {
      const result = normalizeGrowCharacteristics(null);
      expect(result).toEqual({
        difficulty: 'intermediate',
        indoor_suitable: true,
        outdoor_suitable: true,
        flowering_time: {},
        yield: {},
        height: {},
      });
    });

    test('handles partial data', () => {
      const input = {
        difficulty: 'advanced',
        flowering_time: { label: '8-10 weeks' },
      };
      const result = normalizeGrowCharacteristics(input);
      expect(result.difficulty).toBe('advanced');
      expect(result.flowering_time).toEqual({
        min_weeks: undefined,
        max_weeks: undefined,
        label: '8-10 weeks',
      });
      expect(result.indoor_suitable).toBe(true);
      expect(result.outdoor_suitable).toBe(true);
    });
  });

  // TODO: Implement generateId function
  describe.skip('generateId', () => {
    test('generates unique IDs', () => {
      // const id1 = generateId();
      // const id2 = generateId();
      // expect(id1).not.toBe(id2);
    });

    test('generates valid ID format', () => {
      // const id = generateId();
      // expect(id).toMatch(/^strain_\d+_[a-z0-9]+$/);
    });
  });

  describe('normalizeStrain', () => {
    test('normalizes complete strain data', () => {
      const apiStrain = {
        id: '123',
        name: 'OG Kush',
        slug: 'og-kush',
        synonyms: ['OGK', 'Original Gangster'],
        link: 'https://example.com/og-kush',
        image: 'https://example.com/image.jpg',
        description: ['Popular indica-dominant hybrid'],
        parents: ['Chemdawg', 'Hindu Kush'],
        lineage: 'Chemdawg x Hindu Kush',
        race: 'indica',
        thc: '18-24%',
        cbd: '0.1-0.3%',
        effects: ['Relaxed', 'Happy'],
        flavors: ['Earthy', 'Pine'],
        terpenes: [{ name: 'Myrcene', percentage: 0.5 }],
        grow: {
          difficulty: 'intermediate',
          indoor_suitable: true,
          outdoor_suitable: true,
          flowering_time: { min_weeks: 8, max_weeks: 9 },
          yield: { indoor: { min_grams: 400, max_grams: 500 } },
          height: { indoor_cm: 100 },
        },
      };

      const result = normalizeStrain(apiStrain);

      expect(result.id).toBe('123');
      expect(result.name).toBe('OG Kush');
      expect(result.race).toBe('indica');
      expect(result.thc).toEqual({ min: 18, max: 24 });
      expect(result.cbd).toEqual({ min: 0.1, max: 0.3 });
      expect(result.thc_display).toBe('18-24%');
      expect(result.cbd_display).toBe('0.1-0.3%');
      expect(result.effects).toEqual([{ name: 'Relaxed' }, { name: 'Happy' }]);
      expect(result.source.provider).toBe('The Weed DB');
      expect(result.source.updated_at).toBeDefined();
    });

    test('provides defaults for missing fields', () => {
      const result = normalizeStrain({});

      expect(result.id).toBeDefined();
      expect(result.name).toBe('Unknown Strain');
      expect(result.slug).toBe('unknown');
      expect(result.synonyms).toEqual([]);
      expect(result.description).toEqual(['No description available']);
      expect(result.race).toBe('hybrid');
      expect(result.effects).toEqual([]);
      expect(result.flavors).toEqual([]);
      expect(result.thc_display).toBe('Not reported');
      expect(result.cbd_display).toBe('Not reported');
    });

    test('handles array vs string descriptions', () => {
      const withArray = normalizeStrain({
        description: ['Line 1', 'Line 2'],
      });
      expect(withArray.description).toEqual(['Line 1', 'Line 2']);

      const withString = normalizeStrain({
        description: 'Single line',
      });
      expect(withString.description).toEqual(['Single line']);
    });

    test('handles genetics variations', () => {
      const withParentsArray = normalizeStrain({
        parents: ['Parent1', 'Parent2'],
      });
      expect(withParentsArray.genetics.parents).toEqual(['Parent1', 'Parent2']);

      const withGeneticsObject = normalizeStrain({
        genetics: { parents: ['P1'], lineage: 'P1 x P2' },
      });
      expect(withGeneticsObject.genetics).toEqual({
        parents: ['P1'],
        lineage: 'P1 x P2',
      });
    });

    test('supports locale formatting', () => {
      const apiStrain = {
        thc: '18.5-24.5%',
        cbd: '0.1%',
      };

      const resultEn = normalizeStrain(apiStrain, 'en-US');
      expect(resultEn.thc_display).toBe('18.5-24.5%');

      const resultDe = normalizeStrain(apiStrain, 'de-DE');
      expect(resultDe.thc_display).toBe('18,5-24,5%');
    });
  });
});
