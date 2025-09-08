import { database } from '@/lib/watermelon';
import { schema } from '@/lib/watermelon-schema';

describe('WatermelonDB migrations', () => {
  it('initializes database and has occurrence_overrides.deleted_at column', async () => {
    const overrides = database.get('occurrence_overrides');
    expect(overrides).toBeTruthy();

    // Check that the deleted_at column exists in the schema
    const tables = (schema as any).tables;
    const tableSchema = tables.find(
      (table: any) => table.name === 'occurrence_overrides'
    );
    expect(tableSchema).toBeTruthy();
    expect(
      tableSchema?.columns.find((col: any) => col.name === 'deleted_at')
    ).toBeTruthy();
  });
});
