/**
 * Image optimization utilities for community feature
 * Handles progressive loading with multiple URI sources and shared transitions
 */

import type { ImageProps } from 'expo-image';
import { Image } from 'expo-image';
import { InteractionManager } from 'react-native';

import { DEFAULT_IMAGE_BLURHASH } from '@/lib/media/image-placeholders';

type PlaceholderConfig =
  | { blurhash: string }
  | { thumbhash: string }
  | { uri: string };

type PrefetchQueueState = {
  scheduled: ReturnType<typeof InteractionManager.runAfterInteractions> | null;
  queued: Set<string>;
};

const PREFETCH_QUEUE: PrefetchQueueState = {
  scheduled: null,
  queued: new Set<string>(),
};

const MAX_QUEUE_SIZE = 24;
const FLUSH_COUNT_PER_TICK = 4;
let isFlushing = false;

function trimQueueToMaxSize(): void {
  while (PREFETCH_QUEUE.queued.size > MAX_QUEUE_SIZE) {
    const first = PREFETCH_QUEUE.queued.values().next().value as
      | string
      | undefined;
    if (!first) break;
    PREFETCH_QUEUE.queued.delete(first);
  }
}

function scheduleFlush(): void {
  if (PREFETCH_QUEUE.scheduled || isFlushing) return;

  PREFETCH_QUEUE.scheduled = InteractionManager.runAfterInteractions(() => {
    isFlushing = true;
    PREFETCH_QUEUE.scheduled = null;

    const batch: string[] = [];
    const iter = PREFETCH_QUEUE.queued.values();
    for (let i = 0; i < FLUSH_COUNT_PER_TICK; i++) {
      const { value, done } = iter.next();
      if (done) break;
      batch.push(value);
    }

    for (const uri of batch) {
      PREFETCH_QUEUE.queued.delete(uri);
    }

    for (const uri of batch) {
      Image.prefetch(uri).catch((error) => {
        console.debug('[prefetchCommunityImages] Prefetch failed:', uri, error);
      });
    }

    isFlushing = false;
    if (PREFETCH_QUEUE.queued.size > 0) scheduleFlush();
  });
}

export interface CommunityImageProps {
  source?: { uri: string } | undefined;
  placeholder?: PlaceholderConfig | string;
  cachePolicy?: ImageProps['cachePolicy'];
  recyclingKey?: string | undefined;
  transition?: number | ImageProps['transition'];
  priority?: ImageProps['priority'];
}

export type CommunityImageSource = {
  media_uri?: string | null;
  media_resized_uri?: string | null;
  media_thumbnail_uri?: string | null;
};

export function getCommunityPrefetchUris(
  items: CommunityImageSource[]
): string[] {
  return items
    .map(
      (item) =>
        item.media_resized_uri || item.media_uri || item.media_thumbnail_uri
    )
    .filter((uri): uri is string => typeof uri === 'string' && uri.length > 0);
}

export function prefetchCommunityImages(imageUris: string[]): void {
  for (const uri of imageUris) {
    if (!uri || uri.length === 0) continue;
    PREFETCH_QUEUE.queued.add(uri);
  }
  trimQueueToMaxSize();
  scheduleFlush();
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
  transitionMs?: number | null;
}): CommunityImageProps {
  const { uri, thumbnailUri, resizedUri, blurhash, thumbhash, recyclingKey } =
    props;
  const transitionMs = props.transitionMs ?? 200;

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
    return DEFAULT_IMAGE_BLURHASH;
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
    transition: transitionMs,
    priority: 'normal',
  };
}
