import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

import { generatePhotoVariants } from '../photo-variants';

jest.mock('expo-file-system/legacy');
jest.mock('expo-image-manipulator');
jest.mock('../exif', () => ({
  stripExifAndGeolocation: jest.fn((uri) =>
    Promise.resolve({ uri, didStrip: true })
  ),
}));

describe('photo-variants', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (
      FileSystem.getInfoAsync as jest.MockedFunction<
        typeof FileSystem.getInfoAsync
      >
    ).mockResolvedValue({
      exists: true,
      isDirectory: false,
      size: 1234,
      uri: 'file:///test.jpg',
    });
  });

  describe('generatePhotoVariants', () => {
    it('should generate resized and thumbnail variants', async () => {
      // Mock image dimensions retrieval
      (ImageManipulator.manipulateAsync as jest.Mock)
        .mockResolvedValueOnce({
          uri: 'file:///test.jpg',
          width: 4032,
          height: 3024,
        })
        // Mock resized variant
        .mockResolvedValueOnce({
          uri: 'file:///resized.jpg',
          width: 1280,
          height: 960,
        })
        // Mock thumbnail variant
        .mockResolvedValueOnce({
          uri: 'file:///thumb.jpg',
          width: 200,
          height: 150,
        });

      const variants = await generatePhotoVariants('file:///original.jpg');

      expect(variants).toEqual({
        resized: 'file:///resized.jpg',
        thumbnail: 'file:///thumb.jpg',
        metadata: {
          width: 4032,
          height: 3024,
          fileSize: 1234,
          mimeType: 'image/jpeg',
          gpsStripped: true,
        },
      });
    });

    it('should skip resize for images already smaller than target', async () => {
      // Mock image dimensions retrieval for small image
      (ImageManipulator.manipulateAsync as jest.Mock)
        .mockResolvedValueOnce({
          uri: 'file:///small.jpg',
          width: 800,
          height: 600,
        })
        // Mock thumbnail only
        .mockResolvedValueOnce({
          uri: 'file:///thumb.jpg',
          width: 200,
          height: 150,
        });

      const variants = await generatePhotoVariants('file:///small.jpg');

      // Resized should be same as original (skipped)
      expect(variants.resized).toBe('file:///small.jpg');
      expect(variants.thumbnail).toBe('file:///thumb.jpg');
    });

    it('should handle landscape images correctly', async () => {
      (ImageManipulator.manipulateAsync as jest.Mock)
        .mockResolvedValueOnce({
          uri: 'file:///landscape.jpg',
          width: 4032,
          height: 3024,
        })
        .mockResolvedValueOnce({
          uri: 'file:///resized.jpg',
          width: 1280,
          height: 960,
        })
        .mockResolvedValueOnce({
          uri: 'file:///thumb.jpg',
          width: 200,
          height: 150,
        });

      await generatePhotoVariants('file:///landscape.jpg');

      // Check that resize was called with width constraint
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        expect.any(String),
        [{ resize: { width: 1280 } }],
        expect.objectContaining({
          compress: 0.85,
          format: ImageManipulator.SaveFormat.JPEG,
        })
      );
    });

    it('should handle portrait images correctly', async () => {
      (ImageManipulator.manipulateAsync as jest.Mock)
        .mockResolvedValueOnce({
          uri: 'file:///portrait.jpg',
          width: 3024,
          height: 4032,
        })
        .mockResolvedValueOnce({
          uri: 'file:///resized.jpg',
          width: 960,
          height: 1280,
        })
        .mockResolvedValueOnce({
          uri: 'file:///thumb.jpg',
          width: 150,
          height: 200,
        });

      await generatePhotoVariants('file:///portrait.jpg');

      // Check that resize was called with height constraint
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        expect.any(String),
        [{ resize: { height: 1280 } }],
        expect.objectContaining({
          compress: 0.85,
          format: ImageManipulator.SaveFormat.JPEG,
        })
      );
    });

    it('should fallback to original on resize error', async () => {
      (ImageManipulator.manipulateAsync as jest.Mock)
        .mockResolvedValueOnce({
          uri: 'file:///test.jpg',
          width: 4032,
          height: 3024,
        })
        .mockRejectedValueOnce(new Error('Resize failed'))
        .mockResolvedValueOnce({
          uri: 'file:///thumb.jpg',
          width: 200,
          height: 150,
        });

      const variants = await generatePhotoVariants('file:///test.jpg');

      // Resized should fallback to original
      expect(variants.resized).toBe('file:///test.jpg');
      expect(variants.thumbnail).toBe('file:///thumb.jpg');
    });

    it('should fallback to original on thumbnail error', async () => {
      (ImageManipulator.manipulateAsync as jest.Mock)
        .mockResolvedValueOnce({
          uri: 'file:///test.jpg',
          width: 4032,
          height: 3024,
        })
        .mockResolvedValueOnce({
          uri: 'file:///resized.jpg',
          width: 1280,
          height: 960,
        })
        .mockRejectedValueOnce(new Error('Thumbnail failed'));

      const variants = await generatePhotoVariants('file:///test.jpg');

      expect(variants.resized).toBe('file:///resized.jpg');
      // Thumbnail should fallback to original
      expect(variants.thumbnail).toBe('file:///test.jpg');
    });

    it('should handle metadata extraction failure gracefully', async () => {
      (ImageManipulator.manipulateAsync as jest.Mock)
        .mockRejectedValueOnce(new Error('Metadata failed'))
        .mockResolvedValueOnce({
          uri: 'file:///resized.jpg',
          width: 1280,
          height: 960,
        })
        .mockResolvedValueOnce({
          uri: 'file:///thumb.jpg',
          width: 200,
          height: 150,
        });

      const variants = await generatePhotoVariants('file:///test.jpg');

      expect(variants.metadata).toEqual({
        gpsStripped: true,
        mimeType: 'image/jpeg',
      });
    });
  });
});
