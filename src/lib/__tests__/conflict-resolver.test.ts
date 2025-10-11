// Legacy conflict resolver tests - functions removed
// import {
//   buildConflict,
//   createConflictResolver,
// } from '@/lib/sync/conflict-resolver';

describe('conflict-resolver', () => {
  test.skip('diff and build conflict fields - legacy test', () => {
    // Legacy test - buildConflict removed
    // const local = { id: 't1', title: 'A', updatedAt: new Date('2024-01-01') };
    // const remote = {
    //   id: 't1',
    //   title: 'B',
    //   updatedAt: '2024-01-02T00:00:00.000Z',
    // };
    // const c = buildConflict({
    //   tableName: 'tasks',
    //   recordId: 't1',
    //   localRecord: local,
    //   remoteRecord: remote,
    // });
    // expect(c.tableName).toBe('tasks');
    // expect(c.recordId).toBe('t1');
    // expect(c.conflictFields).toEqual(
    //   expect.arrayContaining(['title', 'updatedAt'])
    // );
  });

  test.skip('strategy is needs-review for tasks and server-lww for others', () => {
    // Legacy test - createConflictResolver removed
    // const r = createConflictResolver();
    // expect(r.getResolutionStrategy('tasks')).toBe('needs-review');
    // expect(r.getResolutionStrategy('series')).toBe('server-lww');
    // expect(r.getResolutionStrategy('occurrence_overrides')).toBe('server-lww');
  });
});
