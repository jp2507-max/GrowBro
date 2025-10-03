import { FavoriteModel } from '../favorite';

function createMockFavoriteModel(data: {
  id: string;
  strain_id: string;
  snapshot: string;
  added_at: number;
  synced_at?: number;
  created_at: number;
  updated_at: number;
}): FavoriteModel {
  return new FavoriteModel(
    { schema: { name: 'favorites', columns: [] as any } } as any,

    data as any
  );
}

describe('FavoriteModel - parsedSnapshot', () => {
  test('parses valid JSON snapshot correctly', () => {
    const model = createMockFavoriteModel({
      id: 'test-id',
      strain_id: 'strain-123',
      snapshot: JSON.stringify({
        id: 'strain-123',
        name: 'OG Kush',
        race: 'hybrid',
        thc_display: '18-24%',
        imageUrl: 'https://example.com/image.jpg',
      }),
      added_at: Date.now(),
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    const snapshot = model.parsedSnapshot;

    expect(snapshot).toEqual({
      id: 'strain-123',
      name: 'OG Kush',
      race: 'hybrid',
      thc_display: '18-24%',
      imageUrl: 'https://example.com/image.jpg',
    });
  });

  test('returns safe default on invalid JSON', () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const model = createMockFavoriteModel({
      id: 'test-id',
      strain_id: 'strain-123',
      snapshot: 'invalid-json{',
      added_at: Date.now(),
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    const snapshot = model.parsedSnapshot;

    expect(snapshot).toEqual({
      id: 'strain-123',
      name: 'Unknown Strain',
      race: 'hybrid',
      thc_display: 'Not reported',
      imageUrl: '',
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[FavoriteModel] Failed to parse snapshot',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });
});

describe('FavoriteModel - needsSync', () => {
  test('returns true when syncedAt is undefined', () => {
    const now = Date.now();
    const model = createMockFavoriteModel({
      id: 'test-id',
      strain_id: 'strain-123',
      snapshot: '{}',
      added_at: now,
      synced_at: undefined,
      created_at: now,
      updated_at: now,
    });

    expect(model.needsSync).toBe(true);
  });

  test('returns true when updatedAt is after syncedAt', () => {
    const now = Date.now();
    const model = createMockFavoriteModel({
      id: 'test-id',
      strain_id: 'strain-123',
      snapshot: '{}',
      added_at: now,
      synced_at: now - 1000,
      created_at: now - 2000,
      updated_at: now,
    });

    expect(model.needsSync).toBe(true);
  });

  test('returns false when syncedAt is after updatedAt', () => {
    const now = Date.now();
    const model = createMockFavoriteModel({
      id: 'test-id',
      strain_id: 'strain-123',
      snapshot: '{}',
      added_at: now - 2000,
      synced_at: now,
      created_at: now - 2000,
      updated_at: now - 1000,
    });

    expect(model.needsSync).toBe(false);
  });
});
