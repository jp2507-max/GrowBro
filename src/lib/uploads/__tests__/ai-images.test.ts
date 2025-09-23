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

describe('AI image uploads with consent gating', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      blob: async () => new Blob([new Uint8Array([1, 2, 3])]),
    } as any);
    // Reset consents to false
    await ConsentService.setConsent('cloudProcessing', false);
    await ConsentService.setConsent('aiTraining', false);
  });

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
});
