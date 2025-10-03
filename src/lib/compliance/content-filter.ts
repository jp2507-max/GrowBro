import type { Strain } from '@/api';

import { isConservativeMode } from './regional-compliance';

// Keywords that suggest commerce or glamorization
const COMMERCE_KEYWORDS = [
  'buy',
  'purchase',
  'shop',
  'order',
  'delivery',
  'dispensary',
  'store',
  'price',
  'sale',
  'deal',
  'discount',
];

const GLAMORIZATION_KEYWORDS = [
  'best high',
  'get high',
  'party',
  'recreational use',
  'euphoria',
];

/**
 * Filters strain description to remove commerce and glamorization content
 * in conservative mode
 */
export function filterStrainDescription(description: string): string {
  if (!isConservativeMode()) {
    return description;
  }

  let filtered = description;

  // Remove sentences containing commerce keywords
  const sentences = filtered.split(/[.!?]+/);
  const cleanSentences = sentences.filter((sentence) => {
    const lowerSentence = sentence.toLowerCase();
    return !COMMERCE_KEYWORDS.some((keyword) =>
      lowerSentence.includes(keyword)
    );
  });

  filtered = cleanSentences.join('. ').trim();

  // Remove glamorization phrases
  GLAMORIZATION_KEYWORDS.forEach((phrase) => {
    const regex = new RegExp(phrase, 'gi');
    filtered = filtered.replace(regex, '');
  });

  // Clean up extra whitespace
  filtered = filtered.replace(/\s+/g, ' ').trim();

  return filtered || 'Educational information only.';
}

/**
 * Filters strain data to ensure compliance in conservative mode
 */
export function filterStrainData(strain: Strain): Strain {
  if (!isConservativeMode()) {
    return strain;
  }

  return {
    ...strain,
    description: strain.description
      ? strain.description.map((paragraph) =>
          filterStrainDescription(paragraph)
        )
      : strain.description,
  };
}

/**
 * Checks if a URL is a commerce link
 */
export function isCommerceLink(url: string): boolean {
  const commerceDomains = [
    'shop',
    'store',
    'buy',
    'order',
    'dispensary',
    'delivery',
    'cart',
    'checkout',
  ];

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Check hostname labels for exact matches
    const hostnameLabels = hostname.split('.');
    if (hostnameLabels.some((label) => commerceDomains.includes(label))) {
      return true;
    }

    // Check first path segment
    const pathname = urlObj.pathname.toLowerCase();
    const pathSegments = pathname.split('/').filter(Boolean);
    if (pathSegments.length > 0 && commerceDomains.includes(pathSegments[0])) {
      return true;
    }

    return false;
  } catch {
    // Invalid URL, return false
    return false;
  }
}

/**
 * Filters external links to remove commerce links in conservative mode
 */
export function shouldShowLink(url: string): boolean {
  if (!isConservativeMode()) {
    return true;
  }

  return !isCommerceLink(url);
}

/**
 * Gets educational disclaimer text based on compliance mode
 */
export function getEducationalDisclaimer(): string {
  if (isConservativeMode()) {
    return 'Educational content only. No commerce, sales, or delivery features. Consult local laws regarding cannabis cultivation.';
  }

  return 'Educational content only. No commerce or sales features.';
}
