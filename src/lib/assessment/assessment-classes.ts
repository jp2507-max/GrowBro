/**
 * Assessment Classes Module
 *
 * Provides utilities for working with assessment classes including
 * class lookup, validation, and OOD detection.
 *
 * Requirements:
 * - 2.2: Support Healthy and Unknown/OOD classes
 * - 6.1: Classify nutrient deficiencies with descriptions and visual cues
 * - 6.2: Detect stress conditions
 * - 6.3: Identify pathogens/pests
 * - Design: Canonical list of 12 assessment classes with isOod flag
 */

import type { AssessmentClassRecord } from '@/types/assessment';

import { MODEL_CONFIG } from './model-config';

/**
 * Get assessment class by ID
 *
 * @param classId - Class identifier
 * @returns Assessment class record
 * @throws Error if class not found
 */
export function getAssessmentClass(classId: string): AssessmentClassRecord {
  const classInfo = MODEL_CONFIG.CLASSES.find((c) => c.id === classId);

  if (!classInfo) {
    throw new Error(`Assessment class not found: ${classId}`);
  }

  return createClassRecord(classInfo);
}

/**
 * Get the Unknown/OOD class
 *
 * @returns Unknown class record
 * @throws Error if Unknown class not found in config
 */
export function getUnknownClass(): AssessmentClassRecord {
  const unknownClass = MODEL_CONFIG.CLASSES.find((c) => c.isOod);

  if (!unknownClass) {
    throw new Error('Unknown/OOD class not found in MODEL_CONFIG');
  }

  return createClassRecord(unknownClass);
}

/**
 * Get all assessment classes
 *
 * @returns Array of all assessment class records
 */
export function getAllAssessmentClasses(): AssessmentClassRecord[] {
  return MODEL_CONFIG.CLASSES.map((c) => createClassRecord(c));
}

/**
 * Get assessment classes by category
 *
 * @param category - Category filter
 * @returns Array of matching class records
 */
export function getClassesByCategory(
  category: string
): AssessmentClassRecord[] {
  return MODEL_CONFIG.CLASSES.filter((c) => c.category === category).map((c) =>
    createClassRecord(c)
  );
}

/**
 * Check if a class ID is valid
 *
 * @param classId - Class identifier to validate
 * @returns True if class exists
 */
export function isValidClassId(classId: string): boolean {
  return MODEL_CONFIG.CLASSES.some((c) => c.id === classId);
}

/**
 * Check if a class is marked as OOD
 *
 * @param classId - Class identifier
 * @returns True if class is OOD
 */
export function isOodClass(classId: string): boolean {
  const classInfo = MODEL_CONFIG.CLASSES.find((c) => c.id === classId);
  return classInfo?.isOod ?? false;
}

/**
 * Get class display name
 *
 * @param classId - Class identifier
 * @returns Human-readable class name
 */
export function getClassDisplayName(classId: string): string {
  const classInfo = MODEL_CONFIG.CLASSES.find((c) => c.id === classId);
  return classInfo?.name ?? 'Unknown';
}

/**
 * Get class category
 *
 * @param classId - Class identifier
 * @returns Class category
 */
export function getClassCategory(classId: string): string {
  const classInfo = MODEL_CONFIG.CLASSES.find((c) => c.id === classId);
  return classInfo?.category ?? 'unknown';
}

/**
 * Create a full AssessmentClassRecord from config data
 *
 * @param classInfo - Class info from MODEL_CONFIG
 * @returns Complete assessment class record
 */
function createClassRecord(
  classInfo: (typeof MODEL_CONFIG.CLASSES)[number]
): AssessmentClassRecord {
  return {
    id: classInfo.id,
    name: classInfo.name,
    category: classInfo.category,
    description: getClassDescription(classInfo.id),
    visualCues: getClassVisualCues(classInfo.id),
    isOod: classInfo.isOod,
    actionTemplate: {
      immediateSteps: [],
      shortTermActions: [],
      diagnosticChecks: [],
      warnings: [],
      disclaimers: [],
    },
    createdAt: Date.now(),
  };
}

/**
 * Get class description (placeholder for future database integration)
 *
 * @param classId - Class identifier
 * @returns Class description
 */
function getClassDescription(classId: string): string {
  // Placeholder descriptions - will be populated from database in production
  const descriptions: Record<string, string> = {
    healthy: 'Plant appears healthy with no visible issues',
    unknown:
      'Unable to confidently identify the issue. Consider consulting the community or retaking photos with better lighting.',
    nitrogen_deficiency:
      'Nitrogen deficiency typically shows as yellowing of older leaves starting from the tips',
    phosphorus_deficiency:
      'Phosphorus deficiency appears as dark green or purple discoloration, often with brown spots',
    potassium_deficiency:
      'Potassium deficiency shows as yellowing or browning at leaf edges and tips',
    magnesium_deficiency:
      'Magnesium deficiency causes yellowing between leaf veins while veins remain green',
    calcium_deficiency:
      'Calcium deficiency appears as brown spots on new growth and leaf tip burn',
    overwatering:
      'Overwatering symptoms include drooping leaves, yellowing, and root issues',
    underwatering:
      'Underwatering shows as wilting, dry soil, and curling leaf edges',
    light_burn:
      'Light burn appears as bleaching or yellowing of leaves closest to the light source',
    spider_mites:
      'Spider mites cause tiny yellow or white spots on leaves with possible webbing',
    powdery_mildew:
      'Powdery mildew appears as white powdery spots on leaves and stems',
  };

  return descriptions[classId] ?? '';
}

/**
 * Get visual cues for a class (placeholder for future database integration)
 *
 * @param classId - Class identifier
 * @returns Array of visual cue descriptions
 */
function getClassVisualCues(classId: string): string[] {
  // Placeholder visual cues - will be populated from database in production
  const visualCues: Record<string, string[]> = {
    healthy: [
      'Vibrant green color',
      'No discoloration',
      'Healthy leaf structure',
    ],
    unknown: [],
    nitrogen_deficiency: [
      'Yellowing older leaves',
      'Pale green color',
      'Slow growth',
    ],
    phosphorus_deficiency: [
      'Dark green or purple leaves',
      'Brown spots',
      'Stunted growth',
    ],
    potassium_deficiency: ['Brown leaf edges', 'Yellowing tips', 'Weak stems'],
    magnesium_deficiency: [
      'Interveinal chlorosis',
      'Yellow between veins',
      'Green veins',
    ],
    calcium_deficiency: [
      'Brown spots on new growth',
      'Leaf tip burn',
      'Distorted leaves',
    ],
    overwatering: [
      'Drooping leaves',
      'Yellowing',
      'Soft stems',
      'Root rot smell',
    ],
    underwatering: ['Wilting', 'Dry soil', 'Curling leaves', 'Crispy edges'],
    light_burn: ['Bleached leaves', 'Yellowing near light', 'Upward curling'],
    spider_mites: [
      'Tiny spots on leaves',
      'Webbing',
      'Stippling pattern',
      'Leaf discoloration',
    ],
    powdery_mildew: [
      'White powdery coating',
      'Spots on leaves',
      'Spreads quickly',
    ],
  };

  return visualCues[classId] ?? [];
}

/**
 * Get all nutrient deficiency classes
 *
 * @returns Array of nutrient deficiency class records
 */
export function getNutrientDeficiencyClasses(): AssessmentClassRecord[] {
  return getClassesByCategory('nutrient');
}

/**
 * Get all stress condition classes
 *
 * @returns Array of stress condition class records
 */
export function getStressConditionClasses(): AssessmentClassRecord[] {
  return getClassesByCategory('stress');
}

/**
 * Get all pest and pathogen classes
 *
 * @returns Array of pest and pathogen class records
 */
export function getPestAndPathogenClasses(): AssessmentClassRecord[] {
  const pests = getClassesByCategory('pest');
  const pathogens = getClassesByCategory('pathogen');
  return [...pests, ...pathogens];
}
