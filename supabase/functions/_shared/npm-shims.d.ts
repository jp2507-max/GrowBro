declare module 'npm:@imagemagick/magick-wasm@0.0.30' {
  export interface MagickImage {
    width: number;
    height: number;
    quality: number;
    autoOrient(): void;
    strip(): void;
    clone(): MagickImage;
    resize(geometry: MagickGeometry): void;
    write(
      factory: (data: Uint8Array) => Uint8Array,
      format: MagickFormat
    ): Uint8Array;
    dispose(): void;
  }

  export class MagickGeometry {
    constructor(width: number, height: number);
    readonly width: number;
    readonly height: number;
  }

  export type MagickFormat = 'jpeg' | 'png' | 'rgba';
  export const MagickFormat: {
    readonly Jpeg: MagickFormat;
    readonly Png: MagickFormat;
    readonly Rgba: MagickFormat;
  };

  export const ImageMagick: {
    read(data: Uint8Array, predicate: (image: MagickImage) => void): void;
  };

  export function initializeImageMagick(wa: Uint8Array): Promise<void>;
}

declare module 'npm:blurhash@2.0.5' {
  export function encode(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
    componentX: number,
    componentY: number
  ): string;
}

declare module 'npm:thumbhash@0.1.1' {
  export function rgbaToThumbHash(
    width: number,
    height: number,
    rgba: Uint8Array
  ): Uint8Array;
}
