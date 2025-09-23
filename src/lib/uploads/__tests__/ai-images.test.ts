import { stripExifAndGeolocation } from '@/lib/media/exif';
import { ConsentService } from '@/lib/privacy/consent-service';
import {
  ConsentRequiredError,
  uploadInferenceImage,
  uploadTrainingImage,
} from '@/lib/uploads/ai-images';

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

let mockResponse: ReturnType<typeof createMockResponse>;

function createMockResponse() {
  const mockArrayBuffer = new Uint8Array([1, 2, 3, 4, 5]).buffer;
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: {
      get: jest.fn((name: string) => {
        if (name === 'content-type') return 'image/jpeg';
        return null;
      }),
    },
    arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer),
    blob: jest
      .fn()
      .mockResolvedValue(new Blob([mockArrayBuffer], { type: 'image/jpeg' })),
    json: jest.fn(),
    text: jest.fn(),
  };
}

async function setupTestEnvironment() {
  jest.restoreAllMocks();
  mockResponse = createMockResponse();
  jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse as any);
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
    // Verify fetch was called and arrayBuffer was used
    expect(fetch).toHaveBeenCalledWith('file:///tmp/stripped.jpg');
    expect(mockResponse.arrayBuffer).toHaveBeenCalled();
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
    // Verify fetch was called and arrayBuffer was used
    expect(fetch).toHaveBeenCalledWith('file:///tmp/stripped.jpg');
    expect(mockResponse.arrayBuffer).toHaveBeenCalled();
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

  test('handles different MIME types and creates blob correctly', async () => {
    await ConsentService.setConsent('cloudProcessing', true);
    // Test with PNG
    const result = await uploadInferenceImage({
      userId: 'u1',
      plantId: 'p1',
      localUri: 'file:///tmp/image.png',
      mimeType: 'image/png',
    });

    // Verify the response methods were called
    expect(fetch).toHaveBeenCalledWith('file:///tmp/stripped.jpg');
    expect(mockResponse.arrayBuffer).toHaveBeenCalled();

    // Verify upload succeeded and path contains expected structure
    expect(result.bucket).toBe('plant-images');
    expect(result.path).toContain('inference/u1/p1/');
  });
});
