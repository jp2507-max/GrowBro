/**
 * Test data generators for harvest workflow testing
 * Provides factories for creating mock Harvest, Inventory, and Photo data
 */

import type {
  Harvest,
  HarvestPhotoObject,
  HarvestStage,
} from '@/types/harvest';
import { HarvestStages } from '@/types/harvest';
import type { ExifMetadata, PhotoVariants } from '@/types/photo-storage';

// Inventory type definition (simplified for testing)
export interface Inventory {
  id: string;
  plant_id: string;
  harvest_id: string;
  user_id: string;
  final_weight_g: number;
  harvest_date: Date;
  total_duration_days: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface GenerateHarvestOptions {
  id?: string;
  plant_id?: string;
  user_id?: string;
  stage?: HarvestStage;
  wet_weight_g?: number | null;
  dry_weight_g?: number | null;
  trimmings_weight_g?: number | null;
  notes?: string;
  stage_started_at?: Date;
  stage_completed_at?: Date | null;
  photos?: HarvestPhotoObject[];
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
  conflict_seen?: boolean;
}

export interface GenerateInventoryOptions {
  id?: string;
  plant_id?: string;
  harvest_id?: string;
  user_id?: string;
  final_weight_g?: number;
  harvest_date?: Date;
  total_duration_days?: number;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}

export interface GeneratePhotoVariantsOptions {
  original?: string;
  resized?: string;
  thumbnail?: string;
  metadata?: Partial<ExifMetadata>;
}

let harvestIdCounter = 0;
let inventoryIdCounter = 0;
let plantIdCounter = 0;

/**
 * Generate a mock Harvest record with sensible defaults
 */
export function generateHarvest(options: GenerateHarvestOptions = {}): Harvest {
  const id = options.id || `harvest-${++harvestIdCounter}`;
  const plant_id = options.plant_id || `plant-${plantIdCounter}`;
  const user_id = options.user_id || 'test-user-123';
  const now = new Date();

  return {
    id,
    plant_id,
    user_id,
    stage:
      (options.stage as HarvestStage) ||
      (HarvestStages.HARVEST as HarvestStage),
    wet_weight_g: options.wet_weight_g ?? 1000,
    dry_weight_g: options.dry_weight_g ?? null,
    trimmings_weight_g: options.trimmings_weight_g ?? null,
    notes: options.notes || '',
    stage_started_at: options.stage_started_at || now,
    stage_completed_at: options.stage_completed_at || null,
    photos: options.photos || [],
    created_at: options.created_at || now,
    updated_at: options.updated_at || now,
    deleted_at: options.deleted_at || null,
    conflict_seen: options.conflict_seen || false,
  };
}

/**
 * Generate a mock Inventory record with sensible defaults
 */
export function generateInventory(
  options: GenerateInventoryOptions = {}
): Inventory {
  const id = options.id || `inventory-${++inventoryIdCounter}`;
  const plant_id = options.plant_id || `plant-${plantIdCounter}`;
  const harvest_id = options.harvest_id || `harvest-${harvestIdCounter}`;
  const user_id = options.user_id || 'test-user-123';
  const now = new Date();

  return {
    id,
    plant_id,
    harvest_id,
    user_id,
    final_weight_g: options.final_weight_g ?? 200,
    harvest_date: options.harvest_date || now,
    total_duration_days: options.total_duration_days ?? 30,
    created_at: options.created_at || now,
    updated_at: options.updated_at || now,
    deleted_at: options.deleted_at || null,
  };
}

/**
 * Generate mock PhotoVariants with test URIs
 */
export function generatePhotoVariants(
  options: GeneratePhotoVariantsOptions = {}
): PhotoVariants {
  const hash = Math.random().toString(36).substring(7);

  return {
    original: options.original || `file:///photos/${hash}-original.jpg`,
    resized: options.resized || `file:///photos/${hash}-resized.jpg`,
    thumbnail: options.thumbnail || `file:///photos/${hash}-thumb.jpg`,
    metadata: {
      width: 4032,
      height: 3024,
      capturedAt: new Date().toISOString(),
      gpsStripped: true,
      ...options.metadata,
    },
  };
}

/**
 * Generate an array of harvest records for list testing
 */
export function generateHarvestList(count: number): Harvest[] {
  return Array.from({ length: count }, (_, index) =>
    generateHarvest({
      id: `harvest-list-${index}`,
      created_at: new Date(Date.now() - index * 86400000), // Each day earlier
    })
  );
}

/**
 * Generate chart data points for performance testing
 */
export interface ChartDataPoint {
  timestamp: number;
  weight_g: number;
  stage: HarvestStage;
}

export function generateChartData(days: number): ChartDataPoint[] {
  const points: ChartDataPoint[] = [];
  const stages: HarvestStage[] = [
    HarvestStages.HARVEST,
    HarvestStages.DRYING,
    HarvestStages.CURING,
    HarvestStages.INVENTORY,
  ];
  const now = Date.now();

  for (let i = 0; i < days; i++) {
    const timestamp = now - (days - i) * 86400000;
    const stage = stages[Math.min(Math.floor(i / (days / 4)), 3)];
    const weight_g = 1000 - i * 2; // Gradual weight loss

    points.push({ timestamp, weight_g, stage });
  }

  return points;
}

/**
 * Reset counters for test isolation
 */
export function resetTestGenerators(): void {
  harvestIdCounter = 0;
  inventoryIdCounter = 0;
  plantIdCounter = 0;
}
