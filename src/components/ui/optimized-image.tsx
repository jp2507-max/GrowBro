/**
 * Optimized Image Component
 *
 * Use this component for ALL remote images, especially in lists/feeds.
 *
 * Features:
 * - Handles multiple URI sources (resized > original > thumbnail)
 * - Intelligent placeholder support (thumbhash > blurhash > fallback)
 * - Automatic recycling keys for FlashList performance
 * - Default caching and transition policies
 */
import * as React from 'react';

import type { ImgProps } from './image';
import { Image } from './image';

const FALLBACK_BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

type PlaceholderConfig =
  | { blurhash: string }
  | { thumbhash: string }
  | { uri: string };

type BaseProps = Omit<ImgProps, 'source' | 'placeholder'>;

export type OptimizedImageProps = BaseProps & {
  /** Main image URI (original or full-size) */
  uri?: string | null;
  /** Thumbnail URI (200px) - preferred for list scrolling */
  thumbnailUri?: string | null;
  /** Resized URI (~1280px) - fallback between thumbnail and original */
  resizedUri?: string | null;
  /** BlurHash placeholder */
  blurhash?: string | null;
  /** ThumbHash placeholder (preferred over BlurHash) */
  thumbhash?: string | null;
  /** Recycling key for FlashList optimization */
  recyclingKey?: string | null;
};

export function OptimizedImage({
  uri,
  thumbnailUri,
  resizedUri,
  blurhash,
  thumbhash,
  recyclingKey,
  cachePolicy = 'memory-disk',
  contentFit = 'cover',
  transition = 200,
  priority = 'normal',
  ...rest
}: OptimizedImageProps): React.ReactElement {
  const placeholder = React.useMemo<PlaceholderConfig | string>(() => {
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
  }, [blurhash, thumbhash, thumbnailUri]);

  // Prefer resized for quality, fallback to original, then thumbnail
  const source = React.useMemo(() => {
    const sourceUri = resizedUri || uri || thumbnailUri;
    if (!sourceUri) {
      return undefined;
    }
    return { uri: sourceUri };
  }, [thumbnailUri, resizedUri, uri]);

  const effectiveRecyclingKey = React.useMemo(() => {
    if (recyclingKey) {
      return recyclingKey;
    }
    const keyUri = thumbnailUri || resizedUri || uri;
    if (keyUri) {
      return keyUri;
    }
    return undefined;
  }, [recyclingKey, thumbnailUri, resizedUri, uri]);

  return (
    <Image
      cachePolicy={cachePolicy}
      contentFit={contentFit}
      placeholder={placeholder}
      priority={priority}
      recyclingKey={effectiveRecyclingKey}
      source={source}
      transition={transition}
      {...rest}
    />
  );
}
