export type CannabisContentCategory = 'educational-only';

export function getCannabisContentCategory(): CannabisContentCategory {
  return 'educational-only';
}

export function isEducationalCannabisContent(): boolean {
  return getCannabisContentCategory() === 'educational-only';
}
