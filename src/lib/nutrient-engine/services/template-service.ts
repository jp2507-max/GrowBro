import type { Database } from '@nozbe/watermelondb';

import type {
  FeedingPhase,
  FeedingTemplate,
  GrowingMedium,
  PlantPhase,
} from '@/lib/nutrient-engine/types';
import { type FeedingTemplateModel } from '@/lib/watermelon-models/feeding-template';

/**
 * Service for managing feeding templates
 *
 * Handles CRUD operations, validation, and strain-specific adjustments.
 * Enforces range-based targets (not single points) aligned with soilless norms.
 *
 * Requirements: 1.1, 1.2, 1.6, 4.1, 4.2, 4.6, 4.7
 */

/**
 * Template creation options
 */
export type CreateTemplateOptions = {
  name: string;
  medium: GrowingMedium;
  phases: FeedingPhase[];
  isCustom?: boolean;
  userId?: string;
};

/**
 * Template update options (partial)
 */
export type UpdateTemplateOptions = Partial<CreateTemplateOptions>;

/**
 * Strain adjustment configuration
 * Applied as offsets to base template ranges
 */
export type StrainAdjustment = {
  strainId: string;
  strainName: string;
  phaseAdjustments: {
    phase: PlantPhase;
    phOffset?: number; // e.g., +0.2 or -0.3
    ecOffset?: number; // e.g., +0.2 mS/cm for late flower
    durationDaysOverride?: number; // override phase duration
  }[];
  note?: string;
};

/**
 * Validation error for template data
 */
export class TemplateValidationError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = 'TemplateValidationError';
  }
}

/**
 * Default soilless pH range (5.4 - 6.4)
 * Can be overridden per medium or strain
 */
const DEFAULT_PH_RANGE: [number, number] = [5.4, 6.4];

/**
 * Default EC ranges by phase for soilless growing
 * Values in mS/cm @25°C
 */
const DEFAULT_EC_RANGES: Record<PlantPhase, [number, number]> = {
  seedling: [0.4, 0.8],
  veg: [1.0, 1.6],
  flower: [1.4, 2.2],
  flush: [0.0, 0.2],
};

/**
 * Validate feeding phase data
 *
 * Ensures pH and EC are ranges (not single points) and within valid bounds.
 * Enforces soilless norms for default ranges.
 *
 * @param phase - Phase to validate
 * @throws {TemplateValidationError} If validation fails
 */
function validatePhaseType(phase: FeedingPhase): void {
  const validPhases: PlantPhase[] = ['seedling', 'veg', 'flower', 'flush'];
  if (!validPhases.includes(phase.phase)) {
    throw new TemplateValidationError(
      `Invalid phase: ${phase.phase}`,
      'phase.phase'
    );
  }
}

function validatePhaseDuration(phase: FeedingPhase): void {
  if (phase.durationDays < 1 || phase.durationDays > 365) {
    throw new TemplateValidationError(
      `Duration must be between 1 and 365 days, got ${phase.durationDays}`,
      'phase.durationDays'
    );
  }
}

function validatePHRange(phase: FeedingPhase): void {
  if (phase.phRange.length !== 2) {
    throw new TemplateValidationError(
      'pH range must have exactly 2 values [min, max]',
      'phase.phRange'
    );
  }

  const [phMin, phMax] = phase.phRange;
  if (phMin >= phMax) {
    throw new TemplateValidationError(
      `pH range min (${phMin}) must be less than max (${phMax})`,
      'phase.phRange'
    );
  }

  if (phMin < 4.0 || phMax > 8.5) {
    throw new TemplateValidationError(
      `pH range must be within 4.0-8.5, got ${phMin}-${phMax}`,
      'phase.phRange'
    );
  }
}

function validateECRange(phase: FeedingPhase): void {
  if (phase.ecRange25c.length !== 2) {
    throw new TemplateValidationError(
      'EC range must have exactly 2 values [min, max]',
      'phase.ecRange25c'
    );
  }

  const [ecMin, ecMax] = phase.ecRange25c;
  if (ecMin >= ecMax) {
    throw new TemplateValidationError(
      `EC range min (${ecMin}) must be less than max (${ecMax})`,
      'phase.ecRange25c'
    );
  }

  if (ecMin < 0.0 || ecMax > 4.0) {
    throw new TemplateValidationError(
      `EC range must be within 0.0-4.0 mS/cm, got ${ecMin}-${ecMax}`,
      'phase.ecRange25c'
    );
  }
}

function validateNutrients(phase: FeedingPhase): void {
  if (!Array.isArray(phase.nutrients)) {
    throw new TemplateValidationError(
      'Nutrients must be an array',
      'phase.nutrients'
    );
  }

  phase.nutrients.forEach((nutrient, index) => {
    if (!nutrient.nutrient || typeof nutrient.nutrient !== 'string') {
      throw new TemplateValidationError(
        `Nutrient at index ${index} must have a valid name`,
        `phase.nutrients[${index}].nutrient`
      );
    }

    if (typeof nutrient.value !== 'number' || nutrient.value < 0) {
      throw new TemplateValidationError(
        `Nutrient ${nutrient.nutrient} value must be a non-negative number`,
        `phase.nutrients[${index}].value`
      );
    }

    if (!nutrient.unit || typeof nutrient.unit !== 'string') {
      throw new TemplateValidationError(
        `Nutrient ${nutrient.nutrient} must have a valid unit`,
        `phase.nutrients[${index}].unit`
      );
    }
  });
}

export function validatePhase(phase: FeedingPhase): void {
  validatePhaseType(phase);
  validatePhaseDuration(phase);
  validatePHRange(phase);
  validateECRange(phase);
  validateNutrients(phase);
}

/**
 * Validate complete template data
 *
 * @param options - Template creation options
 * @throws {TemplateValidationError} If validation fails
 */
export function validateTemplate(options: CreateTemplateOptions): void {
  // Validate name
  if (!options.name || options.name.trim().length === 0) {
    throw new TemplateValidationError('Template name is required', 'name');
  }

  if (options.name.length > 100) {
    throw new TemplateValidationError(
      'Template name must be 100 characters or less',
      'name'
    );
  }

  // Validate medium
  const validMedia: GrowingMedium[] = ['soil', 'coco', 'hydro'];
  if (!validMedia.includes(options.medium)) {
    throw new TemplateValidationError(
      `Invalid medium: ${options.medium}`,
      'medium'
    );
  }

  // Validate phases
  if (!Array.isArray(options.phases) || options.phases.length === 0) {
    throw new TemplateValidationError(
      'Template must have at least one phase',
      'phases'
    );
  }

  options.phases.forEach((phase, index) => {
    try {
      validatePhase(phase);
    } catch (error) {
      if (error instanceof TemplateValidationError) {
        throw new TemplateValidationError(
          `Phase ${index + 1} (${phase.phase}): ${error.message}`,
          `phases[${index}].${error.field}`
        );
      }
      throw error;
    }
  });
}

/**
 * Create a new feeding template
 *
 * Validates template data and creates database record.
 * Enforces range-based targets aligned with soilless norms.
 *
 * @param database - WatermelonDB instance
 * @param options - Template creation options
 * @returns Created template
 * @throws {TemplateValidationError} If validation fails
 *
 * Requirements: 1.1, 1.2, 1.6
 */
export async function createTemplate(
  database: Database,
  options: CreateTemplateOptions
): Promise<FeedingTemplate> {
  // Validate input
  validateTemplate(options);

  const templatesCollection =
    database.get<FeedingTemplateModel>('feeding_templates');

  // Create template
  const template = await database.write(async () => {
    return await templatesCollection.create((record) => {
      record.name = options.name;
      record.medium = options.medium;
      record.phases = options.phases;
      record.targetRanges = {}; // Reserved for future use
      record.isCustom = options.isCustom ?? false;
      record.userId = options.userId;
    });
  });

  return {
    id: template.id,
    name: template.name,
    medium: template.medium as GrowingMedium,
    phases: template.phases,
    isCustom: template.isCustom,
    createdAt: template.createdAt.getTime(),
    updatedAt: template.updatedAt.getTime(),
  };
}

/**
 * Get template by ID
 *
 * @param database - WatermelonDB instance
 * @param templateId - Template ID
 * @returns Template or null if not found
 *
 * Requirements: 1.1, 1.2
 */
export async function getTemplate(
  database: Database,
  templateId: string
): Promise<FeedingTemplate | null> {
  const templatesCollection =
    database.get<FeedingTemplateModel>('feeding_templates');

  try {
    const template = await templatesCollection.find(templateId);

    return {
      id: template.id,
      name: template.name,
      medium: template.medium as GrowingMedium,
      phases: template.phases,
      isCustom: template.isCustom,
      createdAt: template.createdAt.getTime(),
      updatedAt: template.updatedAt.getTime(),
    };
  } catch {
    return null;
  }
}

/**
 * List templates filtered by medium
 *
 * @param database - WatermelonDB instance
 * @param medium - Growing medium filter (optional)
 * @returns Array of templates
 *
 * Requirements: 1.1, 1.2
 */
export async function listTemplates(
  database: Database,
  medium?: GrowingMedium
): Promise<FeedingTemplate[]> {
  const templatesCollection =
    database.get<FeedingTemplateModel>('feeding_templates');

  const templates = await templatesCollection.query().fetch();

  if (medium) {
    return templates
      .filter((t) => t.medium === medium)
      .map((template) => ({
        id: template.id,
        name: template.name,
        medium: template.medium as GrowingMedium,
        phases: template.phases,
        isCustom: template.isCustom,
        createdAt: template.createdAt.getTime(),
        updatedAt: template.updatedAt.getTime(),
      }));
  }

  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    medium: template.medium as GrowingMedium,
    phases: template.phases,
    isCustom: template.isCustom,
    createdAt: template.createdAt.getTime(),
    updatedAt: template.updatedAt.getTime(),
  }));
}

/**
 * Update existing template
 *
 * Validates updated data and updates database record.
 *
 * @param database - WatermelonDB instance
 * @param templateId - Template ID to update
 * @param options - Update options (partial)
 * @returns Updated template
 * @throws {TemplateValidationError} If validation fails
 * @throws {Error} If template not found
 *
 * Requirements: 1.1, 1.2, 1.6
 */
export async function updateTemplate(
  database: Database,
  templateId: string,
  options: UpdateTemplateOptions
): Promise<FeedingTemplate> {
  const templatesCollection =
    database.get<FeedingTemplateModel>('feeding_templates');

  const template = await templatesCollection.find(templateId);

  if (!template) {
    throw new Error(`Template ${templateId} not found`);
  }

  // Build updated data
  const updatedData: CreateTemplateOptions = {
    name: options.name ?? template.name,
    medium: (options.medium ?? template.medium) as GrowingMedium,
    phases: options.phases ?? template.phases,
    isCustom: options.isCustom ?? template.isCustom,
    userId: options.userId ?? template.userId,
  };

  // Validate complete updated data
  validateTemplate(updatedData);

  // Update record
  const updatedTemplate = await database.write(async () => {
    return await template.update((record) => {
      if (options.name !== undefined) record.name = options.name;
      if (options.medium !== undefined) record.medium = options.medium;
      if (options.phases !== undefined) record.phases = options.phases;
      if (options.isCustom !== undefined) record.isCustom = options.isCustom;
      if (options.userId !== undefined) record.userId = options.userId;
    });
  });

  return {
    id: updatedTemplate.id,
    name: updatedTemplate.name,
    medium: updatedTemplate.medium as GrowingMedium,
    phases: updatedTemplate.phases,
    isCustom: updatedTemplate.isCustom,
    createdAt: updatedTemplate.createdAt.getTime(),
    updatedAt: updatedTemplate.updatedAt.getTime(),
  };
}

/**
 * Delete template
 *
 * @param database - WatermelonDB instance
 * @param templateId - Template ID to delete
 * @throws {Error} If template not found
 *
 * Requirements: 1.1
 */
export async function deleteTemplate(
  database: Database,
  templateId: string
): Promise<void> {
  const templatesCollection =
    database.get<FeedingTemplateModel>('feeding_templates');

  const template = await templatesCollection.find(templateId);

  if (!template) {
    throw new Error(`Template ${templateId} not found`);
  }

  await database.write(async () => {
    await template.markAsDeleted();
  });
}

/**
 * Apply strain-specific adjustments to template
 *
 * Creates a modified copy of the base template with adjusted ranges.
 * Preserves the base template and returns a new custom template.
 *
 * @param database - WatermelonDB instance
 * @param baseTemplateId - Base template ID
 * @param adjustment - Strain adjustment configuration
 * @returns New custom template with adjustments applied
 * @throws {Error} If base template not found
 *
 * Requirements: 4.1, 4.2, 4.6, 4.7
 */
export async function applyStrainAdjustments(
  database: Database,
  baseTemplateId: string,
  adjustment: StrainAdjustment
): Promise<FeedingTemplate> {
  const baseTemplate = await getTemplate(database, baseTemplateId);

  if (!baseTemplate) {
    throw new Error(`Base template ${baseTemplateId} not found`);
  }

  // Create adjusted phases
  const adjustedPhases = baseTemplate.phases.map((phase) => {
    const phaseAdjustment = adjustment.phaseAdjustments.find(
      (adj) => adj.phase === phase.phase
    );

    if (!phaseAdjustment) {
      // No adjustment for this phase, return as-is
      return phase;
    }

    // Apply offsets to ranges
    const phOffset = phaseAdjustment.phOffset ?? 0;
    const ecOffset = phaseAdjustment.ecOffset ?? 0;

    return {
      ...phase,
      durationDays: phaseAdjustment.durationDaysOverride ?? phase.durationDays,
      phRange: [phase.phRange[0] + phOffset, phase.phRange[1] + phOffset] as [
        number,
        number,
      ],
      ecRange25c: [
        phase.ecRange25c[0] + ecOffset,
        phase.ecRange25c[1] + ecOffset,
      ] as [number, number],
    };
  });

  // Create new custom template
  const customTemplateName = `${baseTemplate.name} - ${adjustment.strainName}`;

  return await createTemplate(database, {
    name: customTemplateName,
    medium: baseTemplate.medium,
    phases: adjustedPhases,
    isCustom: true,
  });
}

/**
 * Get default phase configuration for medium
 *
 * Returns sensible defaults for creating new templates.
 * Uses soilless norms as baseline.
 *
 * @param medium - Growing medium
 * @param phase - Plant phase
 * @returns Default phase configuration
 *
 * Requirements: 1.6
 */
export function getDefaultPhaseConfig(
  medium: GrowingMedium,
  phase: PlantPhase
): FeedingPhase {
  // Adjust pH range based on medium
  let phRange = DEFAULT_PH_RANGE;
  if (medium === 'soil') {
    phRange = [6.0, 7.0]; // Soil prefers slightly higher pH
  }

  return {
    phase,
    durationDays: phase === 'seedling' ? 14 : phase === 'flush' ? 7 : 28,
    nutrients: [], // To be filled by user
    phRange,
    ecRange25c: DEFAULT_EC_RANGES[phase],
  };
}

/**
 * Create starter template for medium
 *
 * Generates a basic template with default phases for getting started.
 *
 * @param database - WatermelonDB instance
 * @param medium - Growing medium
 * @param name - Template name
 * @returns Created template
 *
 * Requirements: 1.1, 1.6
 */
export async function createStarterTemplate(
  database: Database,
  medium: GrowingMedium,
  name?: string
): Promise<FeedingTemplate> {
  const phases: FeedingPhase[] = [
    getDefaultPhaseConfig(medium, 'seedling'),
    getDefaultPhaseConfig(medium, 'veg'),
    getDefaultPhaseConfig(medium, 'flower'),
    getDefaultPhaseConfig(medium, 'flush'),
  ];

  return await createTemplate(database, {
    name: name ?? `Starter - ${medium}`,
    medium,
    phases,
    isCustom: false,
  });
}
