import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import React from 'react';

import {
  useTemplate,
  useTemplateComments,
  useTemplates,
} from './use-templates';

// Mock supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          is: jest.fn(() => ({
            order: jest.fn(() => ({
              range: jest.fn(() => ({
                limit: jest.fn(() => ({
                  single: jest.fn(),
                })),
              })),
            })),
            single: jest.fn(),
          })),
        })),
      })),
    })),
  },
}));

describe('use-templates hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('useTemplates', () => {
    it('should preserve helper methods from React Query Kit', () => {
      // Test that the hook has the expected static methods
      expect(typeof useTemplates.getKey).toBe('function');
      expect(typeof useTemplates.getOptions).toBe('function');
      expect(typeof useTemplates.getFetchOptions).toBe('function');
    });

    it('should accept variables parameter', () => {
      const { result } = renderHook(
        () => useTemplates({ limit: 10, offset: 0 }),
        { wrapper }
      );

      // The hook should not throw and should return a query result
      expect(result.current).toBeDefined();
      expect(result.current.isLoading).toBeDefined();
    });

    it('should accept options parameter', () => {
      const { result } = renderHook(
        () => useTemplates({ limit: 10, offset: 0 }, { enabled: false }),
        { wrapper }
      );

      // The hook should not throw
      expect(result.current).toBeDefined();
    });
  });

  describe('useTemplate', () => {
    it('should preserve helper methods from React Query Kit', () => {
      expect(typeof useTemplate.getKey).toBe('function');
      expect(typeof useTemplate.getOptions).toBe('function');
      expect(typeof useTemplate.getFetchOptions).toBe('function');
    });

    it('should accept variables parameter', () => {
      const { result } = renderHook(() => useTemplate({ id: 'test-id' }), {
        wrapper,
      });

      expect(result.current).toBeDefined();
    });

    it('should accept options parameter', () => {
      const { result } = renderHook(
        () => useTemplate({ id: 'test-id' }, { enabled: false }),
        { wrapper }
      );

      expect(result.current).toBeDefined();
    });
  });

  describe('useTemplateComments', () => {
    it('should preserve helper methods from React Query Kit', () => {
      expect(typeof useTemplateComments.getKey).toBe('function');
      expect(typeof useTemplateComments.getOptions).toBe('function');
      expect(typeof useTemplateComments.getFetchOptions).toBe('function');
    });

    it('should accept variables parameter', () => {
      const { result } = renderHook(
        () => useTemplateComments({ templateId: 'test-id' }),
        { wrapper }
      );

      expect(result.current).toBeDefined();
    });

    it('should accept options parameter', () => {
      const { result } = renderHook(
        () =>
          useTemplateComments({ templateId: 'test-id' }, { enabled: false }),
        { wrapper }
      );

      expect(result.current).toBeDefined();
    });
  });
});
