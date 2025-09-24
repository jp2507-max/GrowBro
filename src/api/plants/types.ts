export type Plant = {
  id: string;
  name: string;
  stage?:
    | 'seedling'
    | 'vegetative'
    | 'flowering'
    | 'harvesting'
    | 'curing'
    | 'ready';
  strain?: string;
  plantedAt?: string;
  expectedHarvestAt?: string;
  lastWateredAt?: string;
  lastFedAt?: string;
  health?: 'excellent' | 'good' | 'fair' | 'poor';
  notes?: string;
  imageUrl?: string;
};
