import type {
  GeneticLean,
  PhotoperiodType,
  PlantEnvironment,
  Race,
} from '@/api/plants/types';
import type { Strain } from '@/api/strains/types';

type DerivedDefaults = {
  photoperiodType?: PhotoperiodType;
  environment?: PlantEnvironment;
  geneticLean?: GeneticLean;
  meta: {
    strainId: string;
    strainSlug: string;
    strainSource: 'api' | 'custom';
    strainRace: Race;
  };
};

function deriveGeneticLean(race: Race): GeneticLean {
  if (race === 'indica') return 'indica_dominant';
  if (race === 'sativa') return 'sativa_dominant';
  return 'balanced';
}

/**
 * Best-effort photoperiod detection.
 * The API does not expose a normalized flowering type, so we fall back to
 * lightweight heuristics to avoid wrong assumptions. We keep this conservative.
 */
function derivePhotoperiodType(strain: Strain): PhotoperiodType | undefined {
  const name = strain.name.toLowerCase();
  const lineage = strain.genetics.lineage.toLowerCase();

  const haystack = `${name} ${lineage}`;

  if (haystack.includes('auto') || haystack.includes('autoflower')) {
    return 'autoflower';
  }

  // Default to undefined when we cannot be confident. The form will keep the
  // user's current value or initial default.
  return undefined;
}

function deriveEnvironment(strain: Strain): PlantEnvironment | undefined {
  const { indoor_suitable, outdoor_suitable } = strain.grow;

  if (indoor_suitable && !outdoor_suitable) return 'indoor';
  if (outdoor_suitable && !indoor_suitable) return 'outdoor';
  return undefined;
}

/**
 * Map Strain data into sensible plant defaults and metadata.
 */
export function derivePlantDefaultsFromStrain(
  strain: Strain,
  options: { source?: 'api' | 'custom' } = {}
): DerivedDefaults {
  const strainSource = options.source ?? 'api';

  return {
    photoperiodType: derivePhotoperiodType(strain),
    environment: deriveEnvironment(strain),
    geneticLean: deriveGeneticLean(strain.race),
    meta: {
      strainId: strain.id,
      strainSlug: strain.slug,
      strainSource,
      strainRace: strain.race,
    },
  };
}
