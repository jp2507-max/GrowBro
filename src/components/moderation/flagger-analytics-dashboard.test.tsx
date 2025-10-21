import React from 'react';

import { cleanup, screen, setup } from '@/lib/test-utils';

import { FlaggerAnalyticsDashboard } from './flagger-analytics-dashboard';
afterEach(cleanup);

const mockAnalytics = {
  total_flaggers: 10,
  active_flaggers: 8,
  aggregate_metrics: {
    average_accuracy: 0.85,
    average_response_time_ms: 3600000, // 1 hour
    total_reports_this_month: 150,
  },
  flaggers: [],
};

describe('FlaggerAnalyticsDashboard', () => {
  test('renders correctly with analytics data', async () => {
    setup(<FlaggerAnalyticsDashboard analytics={mockAnalytics} />);
    expect(await screen.findByTestId('flagger-analytics')).toBeOnTheScreen();
  });

  test('displays translated labels', async () => {
    setup(<FlaggerAnalyticsDashboard analytics={mockAnalytics} />);
    expect(await screen.findByText('Total Flaggers')).toBeOnTheScreen();
    expect(screen.getByText('Avg Accuracy')).toBeOnTheScreen();
    expect(screen.getByText('Avg Response')).toBeOnTheScreen();
    expect(screen.getByText('Reports/Month')).toBeOnTheScreen();
    expect(screen.getByText('8 active')).toBeOnTheScreen();
  });

  test('displays correct metrics', async () => {
    setup(<FlaggerAnalyticsDashboard analytics={mockAnalytics} />);
    expect(await screen.findByText('10')).toBeOnTheScreen();
    expect(screen.getByText('85.0%')).toBeOnTheScreen();
    expect(screen.getByText('1h')).toBeOnTheScreen();
    expect(screen.getByText('150')).toBeOnTheScreen();
  });
});
