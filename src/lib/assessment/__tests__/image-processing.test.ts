import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

import {
  generateThumbnail,
  getImageSize,
  stripExifData,
} from '../image-processing';

// Mock expo modules
jest.mock('expo-file-system');
jest.mock('expo-image-manipulator');

describe('Image Processing', () => {
  const mockImageUri = 'file:///test/image.jpg';
  const mockProcessedUri = 'file:///test/processed.jpg';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('stripExifData', () => {
    it('should strip EXIF data from image', async () => {
      const mockResult = {
        uri: mockProcessedUri,
        width: 1920,
        height: 1080,
      };

      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue(
        mockResult
      );

      const result = await stripExifData(mockImageUri);

      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        mockImageUri,
        [],
        {
          compress: 0.9,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      expect(result).toEqual({
        uri: mockProcessedUri,
        width: 1920,
        height: 1080,
        metadata: {
          width: 1920,
          height: 1080,
          gps: null,
        },
      });
    });

    it('should ensure GPS is always null after stripping', async () => {
      const mockResult = {
        uri: mockProcessedUri,
        width: 800,
        height: 600,
      };

      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue(
        mockResult
      );

      const result = await stripExifData(mockImageUri);

      expect(result.metadata.gps).toBeNull();
    });

    it('should throw error when manipulation fails', async () => {
      (ImageManipulator.manipulateAsync as jest.Mock).mockRejectedValue(
        new Error('Manipulation failed')
      );

      await expect(stripExifData(mockImageUri)).rejects.toThrow(
        'Failed to process image'
      );
    });
  });

  describe('generateThumbnail', () => {
    it('should generate thumbnail with default size', async () => {
      const mockResult = {
        uri: mockProcessedUri,
        width: 200,
        height: 150,
      };

      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue(
        mockResult
      );

      const result = await generateThumbnail(mockImageUri);

      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        mockImageUri,
        [{ resize: { width: 200 } }],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      expect(result).toBe(mockProcessedUri);
    });

    it('should generate thumbnail with custom size', async () => {
      const customSize = 300;
      const mockResult = {
        uri: mockProcessedUri,
        width: customSize,
        height: 225,
      };

      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue(
        mockResult
      );

      const result = await generateThumbnail(mockImageUri, customSize);

      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        mockImageUri,
        [{ resize: { width: customSize } }],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      expect(result).toBe(mockProcessedUri);
    });

    it('should throw error when thumbnail generation fails', async () => {
      (ImageManipulator.manipulateAsync as jest.Mock).mockRejectedValue(
        new Error('Generation failed')
      );

      await expect(generateThumbnail(mockImageUri)).rejects.toThrow(
        'Failed to generate thumbnail'
      );
    });
  });

  describe('getImageSize', () => {
    it('should return file size when file exists', async () => {
      const mockSize = 1024000;
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: mockSize,
      });

      const result = await getImageSize(mockImageUri);

      expect(FileSystem.getInfoAsync).toHaveBeenCalledWith(mockImageUri);
      expect(result).toBe(mockSize);
    });

    it('should return 0 when file does not exist', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: false,
      });

      const result = await getImageSize(mockImageUri);

      expect(result).toBe(0);
    });

    it('should return 0 when size property is missing', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
      });

      const result = await getImageSize(mockImageUri);

      expect(result).toBe(0);
    });

    it('should return 0 on error', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockRejectedValue(
        new Error('File access error')
      );

      const result = await getImageSize(mockImageUri);

      expect(result).toBe(0);
    });
  });
});
