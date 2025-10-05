/**
 * Trichome Helper Service
 *
 * Provides educational guidance for trichome assessment and harvest timing.
 * All content is educational and platform-safe without commercial product links.
 */

import type { Database } from '@nozbe/watermelondb';

import type { TrichomeAssessment } from '@/types/playbook';

import { type TrichomeAssessmentModel } from '../watermelon-models/trichome-assessment';

export type TrichomeStage = 'clear' | 'milky' | 'cloudy' | 'amber';

export type TrichomeGuide = {
  stages: {
    stage: TrichomeStage;
    title: string;
    description: string;
    maturityLevel: 'immature' | 'peak' | 'late';
    effectProfile: string;
  }[];
  photographyTips: string[];
  lightingCautions: string[];
  disclaimer: string;
};

export type HarvestWindow = {
  targetEffect: 'energetic' | 'balanced' | 'sedating';
  description: string;
  trichomeRatio: {
    clear: string;
    milky: string;
    amber: string;
  };
  disclaimer: string;
};

export type HarvestSuggestion = {
  minDays: number;
  maxDays: number;
  targetEffect: 'energetic' | 'balanced' | 'sedating';
  reasoning: string;
  requiresConfirmation: boolean;
};

export type PhotographyTips = {
  equipment: string[];
  lighting: string[];
  technique: string[];
  disclaimer: string;
};

/**
 * TrichomeHelper Service
 * Provides educational trichome assessment guidance
 */
export class TrichomeHelper {
  constructor(private database: Database) {}

  /**
   * Get educational trichome assessment guide
   * Returns neutral, educational content about trichome stages
   */
  getAssessmentGuide(): TrichomeGuide {
    return {
      stages: [
        {
          stage: 'clear',
          title: 'Clear (Immature)',
          description:
            'Transparent, glass-like trichomes indicate the plant is not yet ready for harvest. THC levels are still developing.',
          maturityLevel: 'immature',
          effectProfile:
            'Harvesting at this stage is not recommended as cannabinoid production is incomplete.',
        },
        {
          stage: 'milky',
          title: 'Milky/Cloudy (Peak Potency)',
          description:
            'White or opaque trichomes indicate peak THC production. This is typically considered the optimal harvest window for maximum potency.',
          maturityLevel: 'peak',
          effectProfile:
            'Generally associated with more cerebral, uplifting effects. Most growers target 70-90% milky trichomes.',
        },
        {
          stage: 'cloudy',
          title: 'Cloudy (Peak Potency)',
          description:
            'Cloudy trichomes are the same as milky - white or opaque appearance indicating peak THC levels.',
          maturityLevel: 'peak',
          effectProfile:
            'Generally associated with more cerebral, uplifting effects. Most growers target 70-90% cloudy trichomes.',
        },
        {
          stage: 'amber',
          title: 'Amber (More Sedating Trend)',
          description:
            'Amber-colored trichomes indicate THC is degrading into CBN. This is associated with more sedating effects.',
          maturityLevel: 'late',
          effectProfile:
            'Generally associated with more relaxing, body-focused effects. Some growers prefer 10-30% amber trichomes for this profile.',
        },
      ],
      photographyTips: [
        'Use a macro lens or phone macro mode (60x-100x magnification recommended)',
        'Check multiple bud sites - top, middle, and lower branches',
        'Examine trichomes on calyxes (flower bracts), not sugar leaves',
        'Take photos in natural daylight or with white LED lighting',
        'Steady your hand or use a tripod for clear images',
      ],
      lightingCautions: [
        'Avoid colored grow lights when assessing - they can distort trichome color',
        'Turn off purple/red LED lights and use white light or natural daylight',
        'Take photos during lights-off period if possible, or move sample to neutral lighting',
        'Be aware that some lighting can make clear trichomes appear milky',
      ],
      disclaimer:
        'This information is educational only and not professional cultivation advice. Harvest timing depends on many factors including strain genetics, growing conditions, and personal preference. Always research your specific strain and local regulations.',
    };
  }

  /**
   * Get harvest window recommendations based on desired effects
   * Returns educational guidance without product recommendations
   */
  getHarvestWindows(): HarvestWindow[] {
    return [
      {
        targetEffect: 'energetic',
        description:
          'For more uplifting, cerebral effects, harvest when trichomes are mostly milky/cloudy with minimal amber.',
        trichomeRatio: {
          clear: '0-5%',
          milky: '90-95%',
          amber: '5-10%',
        },
        disclaimer:
          'Individual experiences vary. This is general guidance based on common cultivation practices.',
      },
      {
        targetEffect: 'balanced',
        description:
          'For balanced effects, harvest when trichomes show a mix of milky and amber coloration.',
        trichomeRatio: {
          clear: '0%',
          milky: '70-80%',
          amber: '20-30%',
        },
        disclaimer:
          'Individual experiences vary. This is general guidance based on common cultivation practices.',
      },
      {
        targetEffect: 'sedating',
        description:
          'For more relaxing, body-focused effects, harvest when trichomes show significant amber coloration.',
        trichomeRatio: {
          clear: '0%',
          milky: '50-70%',
          amber: '30-50%',
        },
        disclaimer:
          'Individual experiences vary. This is general guidance based on common cultivation practices.',
      },
    ];
  }

  /**
   * Get macro photography tips and lighting cautions
   * Returns educational guidance for accurate trichome assessment
   */
  getMacroPhotographyTips(): PhotographyTips {
    return {
      equipment: [
        "Jeweler's loupe (60x-100x magnification)",
        'Digital microscope or macro lens attachment',
        'Phone with macro mode (if available)',
        'Steady surface or small tripod',
      ],
      lighting: [
        'Use natural daylight when possible',
        'White LED flashlight for supplemental lighting',
        'Avoid colored grow lights (purple, red, blue)',
        'Turn off grow lights or move sample to neutral lighting area',
      ],
      technique: [
        'Check multiple bud sites (top, middle, lower)',
        'Focus on calyxes (flower bracts), not sugar leaves',
        'Sugar leaves mature faster and can give false readings',
        'Take multiple photos from different angles',
        'Check daily during final weeks to track changes',
        'Keep a photo log to track trichome development over time',
      ],
      disclaimer:
        'These are general photography tips for educational purposes. Practice and patience improve assessment accuracy over time.',
    };
  }

  /**
   * Log a trichome assessment with optional photos
   * Stores assessment with timestamp for tracking harvest readiness
   */
  async logTrichomeCheck(
    assessment: Omit<TrichomeAssessment, 'id' | 'createdAt'>
  ): Promise<TrichomeAssessment> {
    const collection = this.database.get<TrichomeAssessmentModel>(
      'trichome_assessments'
    );

    const created = await this.database.write(async () => {
      return await collection.create((record: TrichomeAssessmentModel) => {
        record.plantId = assessment.plantId;
        record.assessmentDate = assessment.assessmentDate;
        record.clearPercent = assessment.clearPercent;
        record.milkyPercent = assessment.milkyPercent;
        record.amberPercent = assessment.amberPercent;
        record.photos = assessment.photos;
        record.notes = assessment.notes;
        record.harvestWindowSuggestion = assessment.harvestWindowSuggestion;
      });
    });

    return created.toTrichomeAssessment();
  }

  /**
   * Suggest harvest window adjustments based on trichome assessment
   * Returns suggestions that require explicit user confirmation
   * NEVER auto-reschedules without user consent
   */
  async suggestHarvestAdjustments(
    assessment: TrichomeAssessment
  ): Promise<HarvestSuggestion[]> {
    const suggestions: HarvestSuggestion[] = [];

    // Calculate dominant trichome stage
    const milkyPercent = assessment.milkyPercent || 0;
    const amberPercent = assessment.amberPercent || 0;
    const clearPercent = assessment.clearPercent || 0;

    // If mostly clear, suggest waiting
    if (clearPercent > 50) {
      suggestions.push({
        minDays: 7,
        maxDays: 14,
        targetEffect: 'balanced',
        reasoning:
          'Trichomes are mostly clear, indicating the plant needs more time to mature. Consider waiting 1-2 weeks and reassessing.',
        requiresConfirmation: true,
      });
    }

    // If mostly milky, plant is ready - suggest harvest window based on desired effect
    if (milkyPercent > 70 && amberPercent < 20) {
      suggestions.push({
        minDays: 0,
        maxDays: 3,
        targetEffect: 'energetic',
        reasoning:
          'Trichomes are mostly milky/cloudy, indicating peak potency. Harvest now for more uplifting effects.',
        requiresConfirmation: true,
      });

      suggestions.push({
        minDays: 3,
        maxDays: 7,
        targetEffect: 'balanced',
        reasoning:
          'Wait 3-7 days for some amber development for more balanced effects.',
        requiresConfirmation: true,
      });
    }

    // If significant amber, suggest harvest soon for sedating effects
    if (amberPercent > 30) {
      suggestions.push({
        minDays: 0,
        maxDays: 2,
        targetEffect: 'sedating',
        reasoning:
          'Trichomes show significant amber coloration. Harvest soon for more relaxing, body-focused effects.',
        requiresConfirmation: true,
      });
    }

    // If balanced mix, plant is in optimal window
    if (milkyPercent > 50 && amberPercent >= 20 && amberPercent <= 40) {
      suggestions.push({
        minDays: 0,
        maxDays: 3,
        targetEffect: 'balanced',
        reasoning:
          'Trichomes show a balanced mix of milky and amber. Plant is in optimal harvest window.',
        requiresConfirmation: true,
      });
    }

    return suggestions;
  }

  /**
   * Get all trichome assessments for a plant
   * Returns assessments ordered by date (newest first)
   */
  async getAssessmentsForPlant(plantId: string): Promise<TrichomeAssessment[]> {
    const collection = this.database.get<TrichomeAssessmentModel>(
      'trichome_assessments'
    );

    const records = await collection.query().fetch();

    // Filter by plantId and sort
    return records
      .filter((record) => record.plantId === plantId)
      .map((record) => record.toTrichomeAssessment())
      .sort(
        (a: TrichomeAssessment, b: TrichomeAssessment) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }

  /**
   * Get the most recent trichome assessment for a plant
   */
  async getLatestAssessment(
    plantId: string
  ): Promise<TrichomeAssessment | null> {
    const assessments = await this.getAssessmentsForPlant(plantId);
    return assessments[0] || null;
  }

  /**
   * Accept a harvest suggestion and update the latest assessment
   * Records the accepted harvest window suggestion for tracking
   */
  async acceptSuggestion(
    plantId: string,
    suggestion: HarvestSuggestion
  ): Promise<void> {
    const latestAssessment = await this.getLatestAssessment(plantId);
    if (!latestAssessment) {
      throw new Error('No assessment found for plant');
    }

    const collection = this.database.get<TrichomeAssessmentModel>(
      'trichome_assessments'
    );

    await this.database.write(async () => {
      const record = await collection.find(latestAssessment.id);
      await record.update((assessment: TrichomeAssessmentModel) => {
        assessment.harvestWindowSuggestion = {
          minDays: suggestion.minDays,
          maxDays: suggestion.maxDays,
          targetEffect: suggestion.targetEffect,
        };
      });
    });
  }
}
