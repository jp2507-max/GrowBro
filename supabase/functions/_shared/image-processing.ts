/// <reference path="./npm-shims.d.ts" />

import {
  ImageMagick,
  initializeImageMagick,
  MagickFormat,
  MagickGeometry,
  type MagickImage,
} from 'npm:@imagemagick/magick-wasm@0.0.30';
import { encode as encodeBlurhash } from 'npm:blurhash@2.0.5';
import { rgbaToThumbHash } from 'npm:thumbhash@0.1.1';

const RESIZED_LONG_EDGE = 1280;
const RESIZED_QUALITY = 85;
const THUMBNAIL_LONG_EDGE = 200;
const THUMBNAIL_QUALITY = 70;
const HASH_SAMPLE_LONG_EDGE = 64;
const BLURHASH_COMPONENT_X = 4;
const BLURHASH_COMPONENT_Y = 3;
const DEFAULT_BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

let magickReadyPromise: Promise<void> | undefined;

export type ImageVariant = {
  data: Uint8Array;
  width: number;
  height: number;
  bytes: number;
  contentType: 'image/jpeg';
};

export type ProcessedImageMetadata = {
  width: number;
  height: number;
  aspectRatio: number;
  bytes: number;
  gpsStripped: boolean;
};

export type ProcessedImage = {
  original: ImageVariant;
  resized: ImageVariant;
  thumbnail: ImageVariant;
  blurhash: string;
  thumbhash: string | null;
  metadata: ProcessedImageMetadata;
};

export async function ensureMagickInitialized(): Promise<void> {
  if (!magickReadyPromise) {
    magickReadyPromise = (async () => {
      const wasmUrl = new URL(
        'magick.wasm',
        import.meta.resolve('npm:@imagemagick/magick-wasm@0.0.30')
      );
      const wasmBytes = await Deno.readFile(wasmUrl);
      await initializeImageMagick(wasmBytes);
    })();
  }

  await magickReadyPromise;
}

export async function loadImageBytes(
  url: string,
  init?: RequestInit
): Promise<Uint8Array> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Failed to fetch image. Status: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

export async function processImageVariants(
  input: Uint8Array
): Promise<ProcessedImage> {
  await ensureMagickInitialized();

  let result: ProcessedImage | undefined;

  ImageMagick.read(input, (image: MagickImage) => {
    image.autoOrient();
    image.strip();
    image.quality = RESIZED_QUALITY;

    const sanitizedBytes = image.write(
      (data: Uint8Array) => data,
      MagickFormat.Jpeg
    );

    const originalVariant = createVariant(
      sanitizedBytes,
      image.width,
      image.height
    );

    const resizedVariant = createResizedVariant(image, originalVariant);
    const thumbnailVariant = createThumbnailVariant(image);

    const { blurhash, thumbhash } = generatePlaceholders(image);

    result = {
      original: originalVariant,
      resized: resizedVariant,
      thumbnail: thumbnailVariant,
      blurhash,
      thumbhash,
      metadata: buildMetadata(originalVariant),
    };
  });

  if (!result) {
    throw new Error('Failed to process image. No result produced.');
  }

  return result;
}

function createVariant(
  data: Uint8Array,
  width: number,
  height: number
): ImageVariant {
  return {
    data: new Uint8Array(data),
    width,
    height,
    bytes: data.byteLength,
    contentType: 'image/jpeg',
  };
}

function createResizedVariant(
  baseImage: MagickImage,
  fallback: ImageVariant
): ImageVariant {
  const { width, height } = fallback;
  const { width: targetWidth, height: targetHeight } =
    calculateResizeDimensions(width, height, RESIZED_LONG_EDGE);

  if (targetWidth === width && targetHeight === height) {
    return fallback;
  }

  const resizedImage = baseImage.clone();
  resizedImage.resize(new MagickGeometry(targetWidth, targetHeight));
  resizedImage.quality = RESIZED_QUALITY;
  const resizedBytes = resizedImage.write(
    (data: Uint8Array) => data,
    MagickFormat.Jpeg
  );

  const variant = createVariant(
    resizedBytes,
    resizedImage.width,
    resizedImage.height
  );

  resizedImage.dispose();
  return variant;
}

function createThumbnailVariant(baseImage: MagickImage): ImageVariant {
  const { width, height } = calculateResizeDimensions(
    baseImage.width,
    baseImage.height,
    THUMBNAIL_LONG_EDGE
  );

  const thumbnailImage = baseImage.clone();
  thumbnailImage.resize(new MagickGeometry(width, height));
  thumbnailImage.quality = THUMBNAIL_QUALITY;
  const thumbnailBytes = thumbnailImage.write(
    (data: Uint8Array) => data,
    MagickFormat.Jpeg
  );

  const variant = createVariant(
    thumbnailBytes,
    thumbnailImage.width,
    thumbnailImage.height
  );

  thumbnailImage.dispose();
  return variant;
}

function calculateResizeDimensions(
  width: number,
  height: number,
  maxLongEdge: number
): { width: number; height: number } {
  const longEdge = Math.max(width, height);

  if (longEdge <= maxLongEdge) {
    return { width, height };
  }

  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function generatePlaceholders(image: MagickImage): {
  blurhash: string;
  thumbhash: string | null;
} {
  let blurhash = DEFAULT_BLURHASH;
  let thumbhash: string | null = null;

  const hashImage = image.clone();
  const { width, height } = calculateResizeDimensions(
    hashImage.width,
    hashImage.height,
    HASH_SAMPLE_LONG_EDGE
  );
  hashImage.resize(new MagickGeometry(width, height));

  const rgbaBytes = hashImage.write(
    (data: Uint8Array) => data,
    MagickFormat.Rgba
  );
  const pixels = new Uint8ClampedArray(
    rgbaBytes.buffer,
    rgbaBytes.byteOffset,
    rgbaBytes.byteLength
  );

  try {
    blurhash = encodeBlurhash(
      pixels,
      hashImage.width,
      hashImage.height,
      BLURHASH_COMPONENT_X,
      BLURHASH_COMPONENT_Y
    );
  } catch (error) {
    console.warn('[image-processing] Failed to generate BlurHash:', error);
  }

  try {
    const thumbhashBytes = rgbaToThumbHash(
      hashImage.width,
      hashImage.height,
      new Uint8Array(rgbaBytes)
    );
    thumbhash = toBase64(thumbhashBytes);
  } catch (error) {
    console.warn('[image-processing] Failed to generate ThumbHash:', error);
  }

  hashImage.dispose();

  return { blurhash, thumbhash };
}

function toBase64(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i += 1) {
    binary += String.fromCharCode(data[i] ?? 0);
  }
  return btoa(binary);
}

function buildMetadata(variant: ImageVariant): ProcessedImageMetadata {
  const aspectRatio = variant.height > 0 ? variant.width / variant.height : 1;
  return {
    width: variant.width,
    height: variant.height,
    aspectRatio,
    bytes: variant.bytes,
    gpsStripped: true,
  };
}
