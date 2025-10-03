export const addColumns = (cfg: any) => ({ type: 'addColumns', ...cfg });
export const schemaMigrations = (cfg: any) => ({
  migrations: cfg?.migrations ?? [],
});
export const unsafeExecuteSql = (_sql: string): Promise<void> =>
  Promise.resolve();
export default { addColumns, schemaMigrations, unsafeExecuteSql };
