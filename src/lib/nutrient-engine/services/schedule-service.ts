import type { Database } from '@nozbe/watermelondb';
import { DateTime } from 'luxon';

import type { FeedingPhase, NutrientRatio } from '@/lib/nutrient-engine/types';
import type { FeedingTemplateModel } from '@/lib/watermelon-models/feeding-template';

/**
 * Service for generating and managing feeding schedules
 *
 * Handles schedule generation from templates, bulk shifting,
 * and dose guidance calculations.
 *
 * Requirements: 1.4, 1.7, 1.8, 5.1
 */

/**
 * Feeding event generated from template
 */
export type FeedingEvent = {
  id: string;
  plantId: string;
  templateId: string;
  phase: FeedingPhase;
  scheduledDate: number; // epoch ms
  nutrients: NutrientRatio[];
  targetPhMin: number;
  targetPhMax: number;
  targetEcMin25c: number;
  targetEcMax25c: number;
  doseGuidance?: DoseGuidance;
  measurementCheckpoint: boolean; // if true, create pH/EC measurement reminder
};

/**
 * Dose guidance for reservoir additions
 */
export type DoseGuidance = {
  reservoirVolumeL: number;
  nutrientAdditions: {
    nutrient: string;
    amountMl: number;
    stockConcentration: string;
  }[];
  safetyNote: string;
};

/**
 * Schedule with metadata
 */
export type FeedingSchedule = {
  id: string;
  plantId: string;
  templateId: string;
  startDate: number; // epoch ms
  events: FeedingEvent[];
  reservoirVolumeL?: number;
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
};

/**
 * Undo state for schedule operations
 */
export type ScheduleUndoState = {
  scheduleId: string;
  operation: 'shift' | 'delete' | 'update';
  previousEvents: FeedingEvent[];
  timestamp: number; // epoch ms
};

/**
 * Generate feeding schedule from template
 *
 * Creates feeding events for each phase, distributes them across dates,
 * and includes dose guidance if reservoir volume provided.
 *
 * @param database - WatermelonDB instance
 * @param options - Schedule generation options
 * @returns Generated feeding schedule
 */
export async function generateSchedule(
  database: Database,
  options: {
    templateId: string;
    plantId: string;
    startDate: number;
    reservoirVolumeL?: number;
  }
): Promise<FeedingSchedule> {
  const { templateId, plantId, startDate, reservoirVolumeL } = options;
  const templatesCollection =
    database.get<FeedingTemplateModel>('feeding_templates');

  const template = await templatesCollection.find(templateId);

  if (!template) {
    throw new Error(`Template ${templateId} not found`);
  }

  const events: FeedingEvent[] = [];
  let currentDate = DateTime.fromMillis(startDate);

  // Generate events for each phase
  template.phases.forEach((phase, _phaseIndex) => {
    // Create feeding events distributed across phase duration
    // For simplicity: 1 event every 3 days during the phase
    const feedingFrequencyDays = 3;
    const numEvents = Math.ceil(phase.durationDays / feedingFrequencyDays);

    for (let i = 0; i < numEvents; i++) {
      const eventDate = currentDate.plus({ days: i * feedingFrequencyDays });

      const event: FeedingEvent = {
        id: `${plantId}-${templateId}-${phaseIndex}-${i}`,
        plantId,
        templateId,
        phase,
        scheduledDate: eventDate.toMillis(),
        nutrients: phase.nutrients,
        targetPhMin: phase.phRange[0],
        targetPhMax: phase.phRange[1],
        targetEcMin25c: phase.ecRange25c[0],
        targetEcMax25c: phase.ecRange25c[1],
        measurementCheckpoint: true, // Always include measurement reminder
        doseGuidance: reservoirVolumeL
          ? calculateDoseGuidance(phase.nutrients, reservoirVolumeL)
          : undefined,
      };

      events.push(event);
    }

    // Move to next phase
    currentDate = currentDate.plus({ days: phase.durationDays });
  });

  return {
    id: `schedule-${plantId}-${templateId}-${Date.now()}`,
    plantId,
    templateId,
    startDate,
    events,
    reservoirVolumeL,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Calculate dose guidance for nutrients
 *
 * Computes ml additions based on reservoir volume.
 * Includes safety disclaimers.
 *
 * @param nutrients - Nutrient ratios from phase
 * @param reservoirVolumeL - Reservoir volume in liters
 * @returns Dose guidance with safety notes
 */
export function calculateDoseGuidance(
  nutrients: NutrientRatio[],
  reservoirVolumeL: number
): DoseGuidance {
  const nutrientAdditions = nutrients.map((nutrient) => {
    // Calculate total amount needed
    const amountMl =
      nutrient.unit === 'ml/L'
        ? nutrient.value * reservoirVolumeL
        : nutrient.value; // Already in absolute units

    return {
      nutrient: nutrient.nutrient,
      amountMl: Math.round(amountMl * 10) / 10, // Round to 1 decimal
      stockConcentration: `${nutrient.value} ${nutrient.unit}`,
    };
  });

  return {
    reservoirVolumeL,
    nutrientAdditions,
    safetyNote:
      'Educational guidance only. Always start with lower doses and increase gradually. Measure pH/EC after each addition.',
  };
}

/**
 * Shift schedule by delta days
 *
 * Moves all events forward or backward by specified days.
 * Returns undo state for reverting changes.
 *
 * @param schedule - Schedule to shift
 * @param deltaDays - Days to shift (positive = future, negative = past)
 * @returns Updated schedule and undo state
 */
export function shiftSchedule(
  schedule: FeedingSchedule,
  deltaDays: number
): { schedule: FeedingSchedule; undo: ScheduleUndoState } {
  // Store undo state
  const undo: ScheduleUndoState = {
    scheduleId: schedule.id,
    operation: 'shift',
    previousEvents: [...schedule.events],
    timestamp: Date.now(),
  };

  // Shift all events
  const shiftedEvents = schedule.events.map((event) => ({
    ...event,
    scheduledDate: DateTime.fromMillis(event.scheduledDate)
      .plus({ days: deltaDays })
      .toMillis(),
  }));

  const shiftedSchedule: FeedingSchedule = {
    ...schedule,
    startDate: DateTime.fromMillis(schedule.startDate)
      .plus({ days: deltaDays })
      .toMillis(),
    events: shiftedEvents,
    updatedAt: Date.now(),
  };

  return { schedule: shiftedSchedule, undo };
}

/**
 * Apply undo operation to schedule
 *
 * Reverts schedule to previous state from undo object.
 *
 * @param schedule - Current schedule
 * @param undo - Undo state to apply
 * @returns Restored schedule
 */
export function applyUndo(
  schedule: FeedingSchedule,
  undo: ScheduleUndoState
): FeedingSchedule {
  if (schedule.id !== undo.scheduleId) {
    throw new Error(
      `Undo state for schedule ${undo.scheduleId} cannot be applied to schedule ${schedule.id}`
    );
  }

  return {
    ...schedule,
    events: undo.previousEvents,
    updatedAt: Date.now(),
  };
}

/**
 * Create calendar task from feeding event
 *
 * Formats event data for calendar task creation.
 * Includes unit-resolved nutrient instructions and measurement reminders.
 *
 * @param event - Feeding event
 * @param ppmScale - User's preferred PPM scale ('500' or '700')
 * @returns Calendar task data
 */
export function createCalendarTaskFromEvent(
  event: FeedingEvent,
  ppmScale: '500' | '700'
): {
  title: string;
  description: string;
  dueDate: number;
  plantId: string;
  type: string;
  metadata: Record<string, unknown>;
} {
  // Format nutrient instructions
  const nutrientInstructions = event.nutrients
    .map((n) => `${n.nutrient}: ${n.value} ${n.unit}`)
    .join('\n');

  // Format target ranges with PPM scale
  const ecMidpoint = (event.targetEcMin25c + event.targetEcMax25c) / 2;
  const ppmValue = Math.round(ecMidpoint * (ppmScale === '500' ? 500 : 700));

  const targetRanges = `
pH: ${event.targetPhMin.toFixed(1)} - ${event.targetPhMax.toFixed(1)}
EC: ${event.targetEcMin25c.toFixed(2)} - ${event.targetEcMax25c.toFixed(2)} mS/cm @25°C
PPM: ~${ppmValue} ppm [${ppmScale}]
`.trim();

  const description = `
${event.phase.phase.toUpperCase()} Phase Feeding

Nutrients:
${nutrientInstructions || 'No specific nutrients listed'}

Target Ranges:
${targetRanges}

${event.doseGuidance ? `Dose Guidance (${event.doseGuidance.reservoirVolumeL}L reservoir):\n${event.doseGuidance.nutrientAdditions.map((a) => `- ${a.nutrient}: ${a.amountMl} ml`).join('\n')}\n\n${event.doseGuidance.safetyNote}` : ''}

${event.measurementCheckpoint ? '⚠️ Remember to measure pH/EC after feeding' : ''}
`.trim();

  return {
    title: `Feed - ${event.phase.phase} phase`,
    description,
    dueDate: event.scheduledDate,
    plantId: event.plantId,
    type: 'feeding',
    metadata: {
      templateId: event.templateId,
      eventId: event.id,
      phaseType: event.phase.phase,
      measurementCheckpoint: event.measurementCheckpoint,
    },
  };
}
