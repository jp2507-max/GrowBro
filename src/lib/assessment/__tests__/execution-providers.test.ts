import { Platform } from 'react-native';

import {
  createSessionOptions,
  getAvailableExecutionProviders,
  getBestExecutionProvider,
  getExecutionProviderDisplayName,
  isExecutionProviderAvailable,
  logExecutionProviderInfo,
} from '../execution-providers';

// Mock react-native Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios', // Default to iOS for testing
  },
}));

const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();

describe('Execution Providers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isExecutionProviderAvailable', () => {
    describe('iOS platform', () => {
      beforeAll(() => {
        (Platform as any).OS = 'ios';
      });

      test('returns true for coreml', () => {
        expect(isExecutionProviderAvailable('coreml')).toBe(true);
      });

      test('returns false for xnnpack', () => {
        expect(isExecutionProviderAvailable('xnnpack')).toBe(false);
      });

      test('returns false for nnapi', () => {
        expect(isExecutionProviderAvailable('nnapi')).toBe(false);
      });

      test('returns true for cpu', () => {
        expect(isExecutionProviderAvailable('cpu')).toBe(true);
      });
    });

    describe('Android platform', () => {
      beforeAll(() => {
        (Platform as any).OS = 'android';
      });

      test('returns false for coreml', () => {
        expect(isExecutionProviderAvailable('coreml')).toBe(false);
      });

      test('returns true for xnnpack', () => {
        expect(isExecutionProviderAvailable('xnnpack')).toBe(true);
      });

      test('returns true for nnapi', () => {
        expect(isExecutionProviderAvailable('nnapi')).toBe(true);
      });

      test('returns true for cpu', () => {
        expect(isExecutionProviderAvailable('cpu')).toBe(true);
      });
    });
  });

  describe('getAvailableExecutionProviders', () => {
    test('returns only available providers for iOS', () => {
      (Platform as any).OS = 'ios';
      const providers = getAvailableExecutionProviders();
      expect(providers).toHaveLength(2);
      expect(providers.map((p) => p.name)).toEqual(['coreml', 'cpu']);
      expect(providers.every((p) => p.available)).toBe(true);
    });

    test('returns only available providers for Android', () => {
      (Platform as any).OS = 'android';
      const providers = getAvailableExecutionProviders();
      expect(providers).toHaveLength(3);
      expect(providers.map((p) => p.name)).toEqual(['nnapi', 'xnnpack', 'cpu']);
      expect(providers.every((p) => p.available)).toBe(true);
    });
  });

  describe('getBestExecutionProvider', () => {
    test('returns coreml as best for iOS', () => {
      (Platform as any).OS = 'ios';
      expect(getBestExecutionProvider()).toBe('coreml');
    });

    test('returns nnapi as best for Android', () => {
      (Platform as any).OS = 'android';
      expect(getBestExecutionProvider()).toBe('nnapi');
    });
  });

  describe('getExecutionProviderDisplayName', () => {
    test('returns correct display names', () => {
      expect(getExecutionProviderDisplayName('coreml')).toBe(
        'CoreML (Apple Neural Engine)'
      );
      expect(getExecutionProviderDisplayName('nnapi')).toBe(
        'NNAPI (Android Neural Networks)'
      );
      expect(getExecutionProviderDisplayName('xnnpack')).toBe('XNNPACK (CPU)');
      expect(getExecutionProviderDisplayName('cpu')).toBe('CPU');
    });
  });

  describe('createSessionOptions', () => {
    test('includes all available providers with preferred first', () => {
      (Platform as any).OS = 'ios';
      const options = createSessionOptions('cpu');
      expect(options.executionProviders).toEqual(['cpu', 'coreml']);
      expect(options.graphOptimizationLevel).toBe('all');
    });

    test('ensures CPU fallback is always included', () => {
      (Platform as any).OS = 'android';
      const options = createSessionOptions();
      expect(options.executionProviders).toEqual(['nnapi', 'xnnpack', 'cpu']);
    });
  });

  describe('logExecutionProviderInfo', () => {
    test('logs provider information', () => {
      (Platform as any).OS = 'ios';
      logExecutionProviderInfo('coreml');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[ExecutionProviders] Active provider:',
        'coreml'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[ExecutionProviders] Available providers:',
        'coreml, cpu'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[ExecutionProviders] Platform:',
        'ios'
      );
    });
  });
});
