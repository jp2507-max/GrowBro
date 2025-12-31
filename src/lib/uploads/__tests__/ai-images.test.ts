import { stripExifAndGeolocation } from '@/lib/media/exif';
import { ConsentService } from '@/lib/privacy/consent-service';
import { ConsentRequiredError } from '@/lib/privacy/errors';
import {
  uploadInferenceImage,
  uploadTrainingImage,
} from '@/lib/uploads/ai-images';

// Mock expo-file-system with EncodingType
const mockReadAsStringAsync = jest
  .fn()
  .mockResolvedValue('bW9ja2VkLWJhc2U2NA==');
jest.mock('expo-file-system', () => ({
  ...jest.requireActual('expo-file-system'),
  readAsStringAsync: mockReadAsStringAsync,
  EncodingType: {
    UTF8: 'utf8',
    Base64: 'base64',
  },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: async (path: string) => ({ data: { path }, error: null }),
        list: async () => ({ data: [], error: null }),
        remove: async () => ({ error: null }),
      }),
    },
  },
}));

jest.mock('@/lib/media/exif', () => ({
  stripExifAndGeolocation: jest
    .fn()
    .mockResolvedValue({ uri: 'file:///tmp/stripped.jpg', didStrip: true }),
}));

// Mock base64-arraybuffer
jest.mock('base64-arraybuffer', () => ({
  decode: jest.fn().mockReturnValue(new ArrayBuffer(8)),
}));

async function setupTestEnvironment() {
  jest.restoreAllMocks();
  // Mock FileSystem.readAsStringAsync to return base64 data
  mockReadAsStringAsync.mockResolvedValue('bW9ja2VkLWJhc2U2NC1kYXRh');
  // Reset consents to false
  await ConsentService.setConsent('cloudProcessing', false);
  await ConsentService.setConsent('aiTraining', false);
}

describe('AI image uploads with consent gating', () => {
  beforeEach(setupTestEnvironment);

  test('inference upload requires cloudProcessing consent', async () => {
    await expect(
      uploadInferenceImage({
        userId: 'u1',
        plantId: 'p1',
        localUri: 'file:///tmp/a.jpg',
        mimeType: 'image/jpeg',
      })
    ).rejects.toBeInstanceOf(ConsentRequiredError);
  });

  test('inference upload succeeds with cloudProcessing and without aiTraining consent', async () => {
    await ConsentService.setConsent('cloudProcessing', true);
    const res = await uploadInferenceImage({
      userId: 'u1',
      plantId: 'p1',
      localUri: 'file:///tmp/a.jpg',
      mimeType: 'image/jpeg',
    });
    expect(res.bucket).toBe('plant-images');
    expect(res.path).toContain('inference/u1/p1/');
    // Verify FileSystem.readAsStringAsync was called with stripped URI
    expect(mockReadAsStringAsync).toHaveBeenCalledWith(
      'file:///tmp/stripped.jpg',
      { encoding: 'base64' }
    );
  });

  test('training upload throws ConsentRequiredError without consent', async () => {
    await expect(
      uploadTrainingImage({
        userId: 'u1',
        plantId: 'p1',
        localUri: 'file:///tmp/a.jpg',
      })
    ).rejects.toBeInstanceOf(ConsentRequiredError);
  });
});

describe('AI image upload implementation details', () => {
  beforeEach(setupTestEnvironment);

  test('training upload succeeds with both consents and records retention', async () => {
    await ConsentService.setConsent('cloudProcessing', true);
    await ConsentService.setConsent('aiTraining', true);
    const res = await uploadTrainingImage({
      userId: 'u1',
      plantId: 'p1',
      localUri: 'file:///tmp/a.jpg',
    });
    expect(res.path).toContain('training/');
    expect(res.path).toContain('/u1/p1/');
    // Verify FileSystem.readAsStringAsync was called with stripped URI
    expect(mockReadAsStringAsync).toHaveBeenCalledWith(
      'file:///tmp/stripped.jpg',
      { encoding: 'base64' }
    );
  });

  test('calls stripExifAndGeolocation before upload', async () => {
    await ConsentService.setConsent('cloudProcessing', true);
    await uploadInferenceImage({
      userId: 'u1',
      plantId: 'p1',
      localUri: 'file:///tmp/original.jpg',
    });
    expect(stripExifAndGeolocation).toHaveBeenCalledWith(
      'file:///tmp/original.jpg'
    );
  });

  test('handles different MIME types and creates ArrayBuffer correctly', async () => {
    await ConsentService.setConsent('cloudProcessing', true);
    // Test with PNG
    const result = await uploadInferenceImage({
      userId: 'u1',
      plantId: 'p1',
      localUri: 'file:///tmp/image.png',
      mimeType: 'image/png',
    });

    // Verify FileSystem.readAsStringAsync was called
    expect(mockReadAsStringAsync).toHaveBeenCalledWith(
      'file:///tmp/stripped.jpg',
      { encoding: 'base64' }
    );

    // Verify upload succeeded and path contains expected structure
    expect(result.bucket).toBe('plant-images');
    expect(result.path).toContain('inference/u1/p1/');
  });
});
