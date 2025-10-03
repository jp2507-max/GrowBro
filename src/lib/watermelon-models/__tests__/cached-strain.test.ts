import { CachedStrainModel } from '../cached-strain';

function createMockCachedStrainModel(data: {
  id: string;
  query_hash: string;
  page_number: number;
  strains_data: string;
  cached_at: number;
  expires_at: number;
  created_at: number;
  updated_at: number;
}): CachedStrainModel {
  return new CachedStrainModel(
    { schema: { name: 'cached_strains', columns: [] as any } } as any,

    data as any
  );
}

describe('CachedStrainModel - parsedStrains', () => {
  test('parses valid JSON strains data correctly', () => {
    const strains = [
      {
        id: 'strain-1',
        name: 'OG Kush',
        race: 'hybrid',
        thc_display: '18-24%',
      },
      {
        id: 'strain-2',
        name: 'Blue Dream',
        race: 'hybrid',
        thc_display: '17-24%',
      },
    ];

    const model = createMockCachedStrainModel({
      id: 'test-id',
      query_hash: 'abc123',
      page_number: 1,
      strains_data: JSON.stringify(strains),
      cached_at: Date.now(),
      expires_at: Date.now() + 5 * 60 * 1000,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    const parsed = model.parsedStrains;

    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe('OG Kush');
    expect(parsed[1].name).toBe('Blue Dream');
  });

  test('returns empty array on invalid JSON', () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const model = createMockCachedStrainModel({
      id: 'test-id',
      query_hash: 'abc123',
      page_number: 1,
      strains_data: 'invalid-json[',
      cached_at: Date.now(),
      expires_at: Date.now() + 5 * 60 * 1000,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    const parsed = model.parsedStrains;

    expect(parsed).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[CachedStrainModel] Failed to parse strains data',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });
});

describe('CachedStrainModel - isExpired', () => {
  test('returns true when current time is after expiresAt', () => {
    const model = createMockCachedStrainModel({
      id: 'test-id',
      query_hash: 'abc123',
      page_number: 1,
      strains_data: '[]',
      cached_at: Date.now() - 10 * 60 * 1000,
      expires_at: Date.now() - 1000,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    expect(model.isExpired).toBe(true);
  });

  test('returns false when current time is before expiresAt', () => {
    const model = createMockCachedStrainModel({
      id: 'test-id',
      query_hash: 'abc123',
      page_number: 1,
      strains_data: '[]',
      cached_at: Date.now(),
      expires_at: Date.now() + 5 * 60 * 1000,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    expect(model.isExpired).toBe(false);
  });
});

describe('CachedStrainModel - ageInSeconds', () => {
  test('calculates age correctly', () => {
    const cachedAt = Date.now() - 120 * 1000; // 2 minutes ago

    const model = createMockCachedStrainModel({
      id: 'test-id',
      query_hash: 'abc123',
      page_number: 1,
      strains_data: '[]',
      cached_at: cachedAt,
      expires_at: Date.now() + 5 * 60 * 1000,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    const age = model.ageInSeconds;

    // Allow 1 second tolerance for test execution time
    expect(age).toBeGreaterThanOrEqual(119);
    expect(age).toBeLessThanOrEqual(121);
  });
});
