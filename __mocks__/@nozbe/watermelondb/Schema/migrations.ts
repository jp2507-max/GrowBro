export const addColumns = (cfg: any) => ({ type: 'addColumns', ...cfg });
export const schemaMigrations = (cfg: any) => ({
  migrations: cfg?.migrations ?? [],
});
export default { addColumns, schemaMigrations };
