import { makeObjectPath } from '@/lib/uploads/image-upload';

describe('makeObjectPath', () => {
  it('builds a path with userId as first segment', () => {
    const p = makeObjectPath({
      userId: 'u-123',
      plantId: 'p-456',
      filename: 'a.jpg',
    });
    expect(p).toBe('u-123/p-456/a.jpg');
  });

  it('sanitizes leading/trailing slashes', () => {
    const p = makeObjectPath({
      userId: '/u-1/',
      plantId: '/p-2/',
      filename: '/x.jpg/',
    });
    expect(p).toBe('u-1/p-2/x.jpg');
  });
});
