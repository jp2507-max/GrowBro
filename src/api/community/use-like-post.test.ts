/**
 * useLikePost and useUnlikePost Tests
 *
 * Tests for optimistic UI mutations with:
 * - Immediate UI updates
 * - Rollback on failure
 * - 409 conflict reconciliation
 * - Offline queue integration
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import React from 'react';
import * as flashMessage from 'react-native-flash-message';

import { ConflictError } from './client';
import type { PaginateQuery, Post } from './types';
import { useLikePost } from './use-like-post';
import { useUnlikePost } from './use-unlike-post';

// Mock dependencies
jest.mock('@/lib/watermelon', () => ({
  database: {
    write: jest.fn((fn) => fn()),
    get: jest.fn(() => ({
      create: jest.fn(),
    })),
  },
}));

// Shared mock functions for consistent behavior across tests
const mockLikePost = jest.fn();
const mockUnlikePost = jest.fn();
const mockApiClient = {
  likePost: mockLikePost,
  unlikePost: mockUnlikePost,
};

jest.mock('./client', () => ({
  getCommunityApiClient: jest.fn(() => mockApiClient),
  ConflictError: class ConflictError extends Error {
    constructor(
      message: string,
      public readonly canonicalState: any
    ) {
      super(message);
      this.name = 'ConflictError';
    }
  },
}));

jest.mock('react-native-flash-message', () => ({
  showMessage: jest.fn(),
}));

describe('useLikePost', () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: ReactNode }) => React.ReactElement;

  const mockPosts: PaginateQuery<Post> = {
    results: [
      {
        id: 'post-1',
        userId: 'user-1',
        user_id: 'user-1',
        body: 'Test post',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        like_count: 5,
        comment_count: 2,
        user_has_liked: false,
      },
      {
        id: 'post-2',
        userId: 'user-2',
        user_id: 'user-2',
        body: 'Another post',
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        like_count: 10,
        comment_count: 3,
        user_has_liked: false,
      },
    ],
    count: 2,
    next: null,
    previous: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    wrapper = ({ children }) =>
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children
      );

    // Set initial data
    queryClient.setQueryData(['posts'], mockPosts);

    // Mock API client
    mockLikePost.mockResolvedValue(undefined);
  });

  it('should optimistically update like count immediately', async () => {
    const { result } = renderHook(() => useLikePost(), { wrapper });

    // Trigger like mutation
    act(() => {
      result.current.mutate({ postId: 'post-1' });
    });

    // Check optimistic update
    const updatedData = queryClient.getQueryData<PaginateQuery<Post>>([
      'posts',
    ]);

    expect(updatedData?.results[0].like_count).toBe(6);
    expect(updatedData?.results[0].user_has_liked).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('should rollback on API failure', async () => {
    mockLikePost.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useLikePost(), { wrapper });

    act(() => {
      result.current.mutate({ postId: 'post-1' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    // Check rollback
    const rolledBackData = queryClient.getQueryData<PaginateQuery<Post>>([
      'posts',
    ]);

    expect(rolledBackData?.results[0].like_count).toBe(5);
    expect(rolledBackData?.results[0].user_has_liked).toBe(false);

    // Check error message
    expect(flashMessage.showMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to like post',
        type: 'danger',
      })
    );
  });

  it('should handle 409 conflict and reconcile to server state', async () => {
    const conflictError = new ConflictError('Conflict', {
      post_id: 'post-1',
      user_id: 'user-1',
      exists: false,
      updated_at: '2024-01-01T00:00:00Z',
      message: 'Conflict detected',
    });

    mockLikePost.mockRejectedValue(conflictError);

    const { result } = renderHook(() => useLikePost(), { wrapper });

    act(() => {
      result.current.mutate({ postId: 'post-1' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    // Check reconciliation to server state
    const reconciledData = queryClient.getQueryData<PaginateQuery<Post>>([
      'posts',
    ]);

    expect(reconciledData?.results[0].user_has_liked).toBe(false);

    // Check reconciliation message
    expect(flashMessage.showMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Action reconciled',
        type: 'info',
      })
    );
  });

  it('should queue action in outbox for offline support', async () => {
    const { database } = require('@/lib/watermelon');
    const mockCreate = jest.fn();
    database.get.mockReturnValue({ create: mockCreate });

    const { result } = renderHook(() => useLikePost(), { wrapper });

    act(() => {
      result.current.mutate({ postId: 'post-1' });
    });

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());

    expect(mockCreate).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should handle multiple rapid likes correctly', async () => {
    const { result } = renderHook(() => useLikePost(), { wrapper });

    // Trigger multiple likes rapidly
    act(() => {
      result.current.mutate({ postId: 'post-1' });
    });

    act(() => {
      result.current.mutate({ postId: 'post-2' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const updatedData = queryClient.getQueryData<PaginateQuery<Post>>([
      'posts',
    ]);

    expect(updatedData?.results[0].like_count).toBe(6);
    expect(updatedData?.results[1].like_count).toBe(11);
  });
});

describe('useUnlikePost', () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: ReactNode }) => React.ReactElement;

  const mockPosts: PaginateQuery<Post> = {
    results: [
      {
        id: 'post-1',
        userId: 'user-1',
        user_id: 'user-1',
        body: 'Test post',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        like_count: 5,
        comment_count: 2,
        user_has_liked: true, // Already liked
      },
    ],
    count: 1,
    next: null,
    previous: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    wrapper = ({ children }) =>
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children
      );

    queryClient.setQueryData(['posts'], mockPosts);

    mockUnlikePost.mockResolvedValue(undefined);
  });

  it('should optimistically update unlike count immediately', async () => {
    const { result } = renderHook(() => useUnlikePost(), { wrapper });

    act(() => {
      result.current.mutate({ postId: 'post-1' });
    });

    const updatedData = queryClient.getQueryData<PaginateQuery<Post>>([
      'posts',
    ]);

    expect(updatedData?.results[0].like_count).toBe(4);
    expect(updatedData?.results[0].user_has_liked).toBe(false);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('should rollback unlike on failure', async () => {
    mockUnlikePost.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useUnlikePost(), { wrapper });

    act(() => {
      result.current.mutate({ postId: 'post-1' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const rolledBackData = queryClient.getQueryData<PaginateQuery<Post>>([
      'posts',
    ]);

    expect(rolledBackData?.results[0].like_count).toBe(5);
    expect(rolledBackData?.results[0].user_has_liked).toBe(true);
  });
});
