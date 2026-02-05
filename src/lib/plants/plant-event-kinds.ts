export const PlantEventKind = {
  SPROUT_CONFIRMED: 'sprout_confirmed',
  NODE_COUNT_UPDATED: 'node_count_updated',
  LIGHT_CYCLE_SWITCHED: 'light_cycle_switched',
  POT_WEIGHT_CHECK: 'pot_weight_check',
  SYMPTOM_LOGGED: 'symptom_logged',
  HARVEST_STARTED: 'harvest_started',
  HARVEST_COMPLETED: 'harvest_completed',
  JAR_BURPED: 'jar_burped',
} as const;

export type PlantEventKindValue =
  (typeof PlantEventKind)[keyof typeof PlantEventKind];
