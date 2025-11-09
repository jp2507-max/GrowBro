import type { AttachmentInput } from './use-add-post';
import { processRemoteAttachment } from './use-add-post';

describe('processRemoteAttachment', () => {
  test('handles prefill attachments without metadata', () => {
    // Simulate a prefill attachment from parsePrefillImages()
    const prefillAttachment: AttachmentInput = {
      uri: 'https://example.com/image.jpg',
      filename: 'suggested-photo.jpg',
      // No metadata provided (typical for prefill)
    };

    const result = processRemoteAttachment(prefillAttachment);

    // Should provide defaults instead of throwing
    expect(result).toEqual({
      originalPath: 'https://example.com/image.jpg',
      resizedPath: 'https://example.com/image.jpg',
      thumbnailPath: 'https://example.com/image.jpg',
      width: 800,
      height: 600,
      aspectRatio: 4 / 3,
      bytes: 102400,
    });
  });

  test('handles attachments with complete metadata', () => {
    const attachmentWithMetadata: AttachmentInput = {
      uri: 'https://example.com/image.jpg',
      filename: 'photo.jpg',
      metadata: {
        width: 1200,
        height: 800,
        bytes: 204800,
        aspectRatio: 1.5,
        resizedPath: 'https://example.com/resized.jpg',
        thumbnailPath: 'https://example.com/thumb.jpg',
      },
    };

    const result = processRemoteAttachment(attachmentWithMetadata);

    expect(result).toEqual({
      originalPath: 'https://example.com/image.jpg',
      resizedPath: 'https://example.com/resized.jpg',
      thumbnailPath: 'https://example.com/thumb.jpg',
      width: 1200,
      height: 800,
      aspectRatio: 1.5,
      bytes: 204800,
    });
  });

  test('rejects attachments with incomplete metadata', () => {
    const incompleteAttachment: AttachmentInput = {
      uri: 'https://example.com/image.jpg',
      filename: 'photo.jpg',
      metadata: {
        width: 1200,
        // Missing height and bytes
      },
    };

    expect(() => processRemoteAttachment(incompleteAttachment)).toThrow(
      'Remote attachments must include width, height, and byte size metadata'
    );
  });
});
