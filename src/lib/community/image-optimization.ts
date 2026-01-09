/**
 * Image optimization utilities for community feature
 * Handles progressive loading with multiple URI sources and shared transitions
 */

import type { ImageProps } from 'expo-image';

const FALLBACK_BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

type PlaceholderConfig =
  | { blurhash: string }
  | { thumbhash: string }
  | { uri: string };

export interface CommunityImageProps {
  source?: { uri: string } | undefined;
  placeholder?: PlaceholderConfig | string;
  cachePolicy?: ImageProps['cachePolicy'];
  recyclingKey?: string | undefined;
  transition?: number | ImageProps['transition'];
  priority?: ImageProps['priority'];
}

/**
 * Get optimized image props for community posts
 * Handles multiple URI sources (resized > original > thumbnail)
 */
export function getCommunityImageProps(props: {
  uri?: string | null;
  thumbnailUri?: string | null;
  resizedUri?: string | null;
  blurhash?: string | null;
  thumbhash?: string | null;
  recyclingKey?: string | null;
}): CommunityImageProps {
  const { uri, thumbnailUri, resizedUri, blurhash, thumbhash, recyclingKey } =
    props;

  // Generate placeholder
  const placeholder: PlaceholderConfig | string = (() => {
    if (thumbhash) {
      return { thumbhash };
    }
    if (blurhash) {
      return { blurhash };
    }
    if (thumbnailUri) {
      return { uri: thumbnailUri };
    }
    return FALLBACK_BLURHASH;
  })();

  // Prefer resized for quality, fallback to original, then thumbnail
  const sourceUri = resizedUri || uri || thumbnailUri;
  const source = sourceUri ? { uri: sourceUri } : undefined;

  // Generate recycling key
  const effectiveRecyclingKey =
    recyclingKey ?? resizedUri ?? uri ?? thumbnailUri ?? undefined;

  return {
    source,
    placeholder,
    cachePolicy: 'memory-disk',
    recyclingKey: effectiveRecyclingKey,
    transition: 200,
    priority: 'normal',
  };
}
