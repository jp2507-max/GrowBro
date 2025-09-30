/**
 * @jest-environment node
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

import { notificationAnalytics } from './notification-analytics';
import * as notificationMonitor from './notification-monitor';
import {
  useDeliveryRateAlerts,
  useNotificationAnalytics,
  useNotificationMetrics,
} from './use-notification-analytics';

jest.mock('./notification-analytics');
jest.mock('./notification-monitor');

const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
};

describe('useNotificationAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch dashboard stats', async () => {
    const mockStats = {
      deliveryRate: 97.5,
      engagementRate: 65.2,
      optInRate: 88.0,
      recentFailures: 5,
      alerts: [],
    };

    (notificationAnalytics.getDashboardStats as jest.Mock).mockResolvedValue(
      mockStats
    );

    const { result } = renderHook(() => useNotificationAnalytics(), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockStats);
  });
});

describe('useDeliveryRateAlerts', () => {
  it('should fetch alerts below threshold', async () => {
    const mockAlerts = [
      {
        notificationType: 'community.like',
        deliveryRatePercent: 92.5,
        alertMessage: 'Delivery rate below threshold (95%)',
      },
    ];

    (
      notificationAnalytics.checkDeliveryRateAlerts as jest.Mock
    ).mockResolvedValue(mockAlerts);

    const { result } = renderHook(() => useDeliveryRateAlerts(95.0), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockAlerts);
  });
});

describe('useNotificationMetrics', () => {
  it('should fetch client-side performance metrics', async () => {
    const mockMetrics = {
      latency: {
        requestToSent: { p50: 100, p95: 250 },
        sentToDelivered: { p50: 400, p95: 800 },
        deliveredToOpened: { p50: 1500, p95: 3000 },
        endToEnd: { p50: 2000, p95: 4000 },
      },
      targets: { endToEndTarget: 5000, deliveryRateThreshold: 95 },
      current: {
        avgEndToEndLatency: 2200,
        deliveryRatePercent: 97.5,
        targetViolations: 2,
      },
      alerts: { slowDeliveries: 2, belowThreshold: false },
    };

    (notificationMonitor.getNotificationMetrics as jest.Mock).mockReturnValue(
      mockMetrics
    );

    const { result } = renderHook(() => useNotificationMetrics(), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockMetrics);
  });
});
