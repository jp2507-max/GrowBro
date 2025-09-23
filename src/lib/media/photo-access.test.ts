import * as ImagePicker from 'expo-image-picker';

import { requestSelectedPhotos, showReselectionUI } from './photo-access';

jest.mock('expo-image-picker');

describe('photo-access (PHPicker path)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns granted=false on cancel', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: true,
      assets: [],
    });

    const res = await requestSelectedPhotos();
    expect(res.granted).toBe(false);
    expect(res.selection).toEqual([]);
    expect(res.reselectionSupported).toBe(true);
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
  });

  test('maps selection and sets granted=true when user picks', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///image1.jpg' }],
    });

    const res = await requestSelectedPhotos();
    expect(res.granted).toBe(true);
    expect(res.selection).toEqual([{ uri: 'file:///image1.jpg' }]);
    expect(res.reselectionSupported).toBe(true);
  });

  test('showReselectionUI triggers picker without awaiting', () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: true,
      assets: [],
    });
    showReselectionUI();
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
  });
});
