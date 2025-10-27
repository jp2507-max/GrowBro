import React from 'react';

import { cleanup, screen, setup } from '@/lib/test-utils';

import { QueueStatusSheet } from './queue-status-sheet';
afterEach(cleanup);

describe('QueueStatusSheet', () => {
  // Setup section
  beforeAll(() => {
    // Global setup
  });

  beforeEach(() => {
    // Reset mocks and state
    jest.clearAllMocks();
  });

  // Test cases grouped by functionality
  describe('Rendering', () => {
    test('renders loading state correctly', async () => {
      setup(<QueueStatusSheet status={null} />);
      expect(await screen.findByText('Loading...')).toBeOnTheScreen();
    });

    test('renders title correctly', async () => {
      const mockStatus = {
        pending: 1,
        processing: 0,
        completed: 0,
        failed: 0,
        stalled: 0,
        lastUpdated: Date.now(),
      };
      setup(<QueueStatusSheet status={mockStatus} />);
      expect(await screen.findByText('Assessment Queue')).toBeOnTheScreen();
    });

    test('renders status rows correctly', async () => {
      const mockStatus = {
        pending: 2,
        processing: 1,
        completed: 3,
        failed: 1,
        stalled: 0,
        lastUpdated: Date.now(),
      };
      setup(<QueueStatusSheet status={mockStatus} />);
      expect(await screen.findByText('Pending')).toBeOnTheScreen();
      expect(await screen.findByText('Processing')).toBeOnTheScreen();
      expect(await screen.findByText('Completed')).toBeOnTheScreen();
      expect(await screen.findByText('Failed')).toBeOnTheScreen();
    });

    test('renders stalled status when count > 0', async () => {
      const mockStatus = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        stalled: 1,
        lastUpdated: Date.now(),
      };
      setup(<QueueStatusSheet status={mockStatus} />);
      expect(await screen.findByText('Stalled')).toBeOnTheScreen();
    });

    test('does not render stalled status when count is 0', async () => {
      const mockStatus = {
        pending: 1,
        processing: 0,
        completed: 0,
        failed: 0,
        stalled: 0,
        lastUpdated: Date.now(),
      };
      setup(<QueueStatusSheet status={mockStatus} />);
      expect(screen.queryByText('Stalled')).not.toBeOnTheScreen();
    });

    test('renders last updated correctly', async () => {
      const mockTime = Date.now();
      const mockStatus = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        stalled: 0,
        lastUpdated: mockTime,
      };
      setup(<QueueStatusSheet status={mockStatus} />);
      const expectedTime = new Date(mockTime).toLocaleTimeString();
      expect(
        await screen.findByText(`Last updated: ${expectedTime}`)
      ).toBeOnTheScreen();
    });
  });

  describe('Interactions', () => {
    test('renders sync now button when pending > 0', async () => {
      const mockStatus = {
        pending: 1,
        processing: 0,
        completed: 0,
        failed: 0,
        stalled: 0,
        lastUpdated: Date.now(),
      };
      setup(<QueueStatusSheet status={mockStatus} />);
      expect(await screen.findByText('Sync Now')).toBeOnTheScreen();
    });

    test('does not render sync now button when pending is 0', async () => {
      const mockStatus = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        stalled: 0,
        lastUpdated: Date.now(),
      };
      setup(<QueueStatusSheet status={mockStatus} />);
      expect(screen.queryByText('Sync Now')).not.toBeOnTheScreen();
    });

    test('renders retry failed button when failed > 0', async () => {
      const mockStatus = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 1,
        stalled: 0,
        lastUpdated: Date.now(),
      };
      setup(<QueueStatusSheet status={mockStatus} />);
      expect(await screen.findByText('Retry Failed')).toBeOnTheScreen();
    });

    test('renders close button when onClose is provided', async () => {
      const mockStatus = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        stalled: 0,
        lastUpdated: Date.now(),
      };
      const mockOnClose = jest.fn();
      setup(<QueueStatusSheet status={mockStatus} onClose={mockOnClose} />);
      expect(await screen.findByText('Close')).toBeOnTheScreen();
    });
  });
});
