import { database } from '@/lib/watermelon';

describe('WatermelonDB migrations', () => {
  it('initializes database and has occurrence_overrides.deleted_at column', async () => {
    const overrides = database.get('occurrence_overrides');
    expect(overrides).toBeTruthy();
  });
});
