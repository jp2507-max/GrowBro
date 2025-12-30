import { parsePercentageRange } from '@/lib/strains';

/**
 * Default BlurHash placeholder for image loading
 * Used when strain has no image URL
 */
export const DEFAULT_BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

export { formatPercentageDisplay } from '@/lib/strains/normalization';
export { normalizeEffects } from '@/lib/strains/normalization';
export { normalizeFlavors } from '@/lib/strains/normalization';
export { normalizeGrowCharacteristics } from '@/lib/strains/normalization';
export { normalizeGrowDifficulty } from '@/lib/strains/normalization';
export { normalizeRace } from '@/lib/strains/normalization';
export {
  normalizeStrain,
  type RawApiStrain,
} from '@/lib/strains/normalization';
export { normalizeTerpenes } from '@/lib/strains/normalization';

export { parsePercentageRange };

/**
 * Generate a slug from a string
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}
