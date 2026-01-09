import { getCommunityImageProps } from './image-optimization';

describe('getCommunityImageProps', () => {
  it('should prioritize recyclingKey if provided', () => {
    const props = getCommunityImageProps({
      recyclingKey: 'manual-key',
      uri: 'http://source.com/img.jpg',
      thumbnailUri: 'http://source.com/thumb.jpg',
      resizedUri: 'http://source.com/resized.jpg',
    });
    expect(props.recyclingKey).toBe('manual-key');
  });

  it('should use resizedUri as effectiveRecyclingKey when no explicit key provided', () => {
    const props = getCommunityImageProps({
      uri: 'http://source.com/img.jpg',
      thumbnailUri: 'http://source.com/thumb.jpg',
      resizedUri: 'http://source.com/resized.jpg',
    });
    expect(props.recyclingKey).toBe('http://source.com/resized.jpg');
  });

  it('should use uri as effectiveRecyclingKey when resizedUri is missing', () => {
    const props = getCommunityImageProps({
      uri: 'http://source.com/img.jpg',
      thumbnailUri: 'http://source.com/thumb.jpg',
      resizedUri: null,
    });
    expect(props.recyclingKey).toBe('http://source.com/img.jpg');
  });

  it('should use thumbnailUri as effectiveRecyclingKey when uri and resizedUri are missing', () => {
    const props = getCommunityImageProps({
      thumbnailUri: 'http://source.com/thumb.jpg',
      uri: null,
      resizedUri: null,
    });
    expect(props.recyclingKey).toBe('http://source.com/thumb.jpg');
  });

  it('should return undefined recyclingKey if no keys provided', () => {
    const props = getCommunityImageProps({});
    expect(props.recyclingKey).toBeUndefined();
  });
});
