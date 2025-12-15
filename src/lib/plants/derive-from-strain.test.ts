import type { Strain } from '@/api/strains/types';

import { derivePlantDefaultsFromStrain } from './derive-from-strain';

const baseStrain: Strain = {
  id: 'strain-1',
  name: 'Test Strain',
  slug: 'test-strain',
  synonyms: [],
  link: '',
  imageUrl: '',
  description: [''],
  genetics: { parents: [], lineage: '' },
  race: 'hybrid',
  thc: {},
  cbd: {},
  effects: [],
  flavors: [],
  terpenes: undefined,
  grow: {
    difficulty: 'intermediate',
    indoor_suitable: true,
    outdoor_suitable: true,
    flowering_time: {},
    yield: {},
    height: {},
  },
  source: { provider: 'test', updated_at: '', attribution_url: '' },
  thc_display: '',
  cbd_display: '',
};

describe('derivePlantDefaultsFromStrain', () => {
  test('maps race to genetic lean', () => {
    const result = derivePlantDefaultsFromStrain({
      ...baseStrain,
      race: 'sativa',
    });

    expect(result.geneticLean).toBe('sativa_dominant');
  });

  test('detects autoflower from name or lineage', () => {
    const result = derivePlantDefaultsFromStrain({
      ...baseStrain,
      name: 'Super Auto Haze',
    });

    expect(result.photoperiodType).toBe('autoflower');
  });

  test('infers environment preference from grow suitability', () => {
    const result = derivePlantDefaultsFromStrain({
      ...baseStrain,
      grow: {
        ...baseStrain.grow,
        indoor_suitable: true,
        outdoor_suitable: false,
      },
    });

    expect(result.environment).toBe('indoor');
  });

  test('returns strain metadata payload', () => {
    const strain = { ...baseStrain, id: 'abc', slug: 'abc-slug' };
    const result = derivePlantDefaultsFromStrain(strain, { source: 'custom' });

    expect(result.meta).toEqual({
      strainId: 'abc',
      strainSlug: 'abc-slug',
      strainSource: 'custom',
      strainRace: 'hybrid',
    });
  });
});
