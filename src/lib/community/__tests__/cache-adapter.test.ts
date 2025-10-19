import { createQueryCacheAdapter } from '../use-community-feed-realtime';

describe('createQueryCacheAdapter', () => {
  let mockQueryClient: any;

  beforeEach(() => {
    mockQueryClient = {
      getQueriesData: jest.fn(),
      setQueriesData: jest.fn(),
    };
  });

  describe('with query key prefixes', () => {
    it('should work with queries that have the same prefix', () => {
      const adapter = createQueryCacheAdapter(mockQueryClient, {
        queryKeyPrefix: ['posts'],
        keySelector: (item: any) => item.id,
      });

      // Mock multiple queries with different pagination params
      mockQueryClient.getQueriesData.mockReturnValue([
        [['posts'], [{ id: '1', title: 'Post 1' }]],
        [['posts', 'cursor1', 10], [{ id: '2', title: 'Post 2' }]],
        [['posts', 'cursor2', 10], [{ id: '3', title: 'Post 3' }]],
        [['comments'], [{ id: 'c1', body: 'Comment' }]], // Different prefix
      ]);

      // Should find item from any matching query
      const result = adapter.get('2');
      expect(result).toEqual({ id: '2', title: 'Post 2' });
    });

    it('should update all queries with matching prefix', () => {
      const adapter = createQueryCacheAdapter(mockQueryClient, {
        queryKeyPrefix: ['posts'],
        keySelector: (item: any) => item.id,
      });

      const newPost = { id: '4', title: 'New Post' };

      adapter.upsert(newPost);

      // Should call setQueriesData with predicate that matches prefix
      expect(mockQueryClient.setQueriesData).toHaveBeenCalledWith(
        { predicate: expect.any(Function) },
        expect.any(Function)
      );

      // Verify the predicate works
      const call = mockQueryClient.setQueriesData.mock.calls[0];
      const predicate = call[0].predicate;

      expect(predicate({ queryKey: ['posts'] })).toBe(true);
      expect(predicate({ queryKey: ['posts', 'cursor', 10] })).toBe(true);
      expect(predicate({ queryKey: ['comments'] })).toBe(false);
      expect(predicate({ queryKey: ['posts-infinite'] })).toBe(false);
    });

    it('should remove from all queries with matching prefix', () => {
      const adapter = createQueryCacheAdapter(mockQueryClient, {
        queryKeyPrefix: ['comments'],
        keySelector: (item: any) => item.id,
      });

      adapter.remove('comment-1');

      expect(mockQueryClient.setQueriesData).toHaveBeenCalledWith(
        { predicate: expect.any(Function) },
        expect.any(Function)
      );

      // Verify the predicate works for comments
      const call = mockQueryClient.setQueriesData.mock.calls[0];
      const predicate = call[0].predicate;

      expect(predicate({ queryKey: ['comments'] })).toBe(true);
      expect(
        predicate({ queryKey: ['comments', 'post-1', 'cursor', 10] })
      ).toBe(true);
      expect(predicate({ queryKey: ['posts'] })).toBe(false);
    });
  });
});
