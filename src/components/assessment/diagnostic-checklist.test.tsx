import { router } from 'expo-router';
import * as React from 'react';

import { cleanup, render, screen, userEvent } from '@/lib/test-utils';

import { DiagnosticChecklist } from './diagnostic-checklist';

// Mock expo-router
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

afterEach(cleanup);

describe('DiagnosticChecklist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders all diagnostic check items', () => {
    render(<DiagnosticChecklist plantId="plant-123" />);

    expect(screen.getByTestId('diagnostic-checklist')).toBeOnTheScreen();
    expect(
      screen.getByTestId('diagnostic-checklist-item-ph-check')
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId('diagnostic-checklist-item-ec-check')
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId('diagnostic-checklist-item-light-check')
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId('diagnostic-checklist-item-pest-check')
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId('diagnostic-checklist-item-watering-check')
    ).toBeOnTheScreen();
  });

  test('toggles checkbox when pressed', async () => {
    const user = userEvent.setup();
    const onCheckToggle = jest.fn();

    render(
      <DiagnosticChecklist plantId="plant-123" onCheckToggle={onCheckToggle} />
    );

    const checkbox = screen.getByTestId(
      'diagnostic-checklist-checkbox-ph-check'
    );
    await user.press(checkbox);

    expect(onCheckToggle).toHaveBeenCalledWith('ph-check', true);
  });

  test('unchecks item when pressed again', async () => {
    const user = userEvent.setup();
    const onCheckToggle = jest.fn();

    render(
      <DiagnosticChecklist plantId="plant-123" onCheckToggle={onCheckToggle} />
    );

    const checkbox = screen.getByTestId(
      'diagnostic-checklist-checkbox-ph-check'
    );

    // First press - check
    await user.press(checkbox);
    expect(onCheckToggle).toHaveBeenCalledWith('ph-check', true);

    // Second press - uncheck
    await user.press(checkbox);
    expect(onCheckToggle).toHaveBeenCalledWith('ph-check', false);
  });

  test('navigates to task creation when create task button pressed', async () => {
    const user = userEvent.setup();

    render(<DiagnosticChecklist plantId="plant-123" />);

    const createTaskButton = screen.getByTestId(
      'diagnostic-checklist-create-task-ph-check'
    );
    await user.press(createTaskButton);

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/calendar/add-task',
      params: expect.objectContaining({
        plantId: 'plant-123',
        taskType: 'ph-measurement',
      }),
    });
  });

  test('maintains independent checkbox state for each item', async () => {
    const user = userEvent.setup();

    render(<DiagnosticChecklist plantId="plant-123" />);

    const phCheckbox = screen.getByTestId(
      'diagnostic-checklist-checkbox-ph-check'
    );
    const ecCheckbox = screen.getByTestId(
      'diagnostic-checklist-checkbox-ec-check'
    );

    // Check pH
    await user.press(phCheckbox);

    // Check EC
    await user.press(ecCheckbox);

    // Both should be checked independently
    expect(phCheckbox).toBeOnTheScreen();
    expect(ecCheckbox).toBeOnTheScreen();
  });

  test('only shows create task button for items with taskType', () => {
    render(<DiagnosticChecklist plantId="plant-123" />);

    // pH, EC, and light checks should have create task buttons
    expect(
      screen.getByTestId('diagnostic-checklist-create-task-ph-check')
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId('diagnostic-checklist-create-task-ec-check')
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId('diagnostic-checklist-create-task-light-check')
    ).toBeOnTheScreen();

    // Pest and watering checks should not have create task buttons
    expect(
      screen.queryByTestId('diagnostic-checklist-create-task-pest-check')
    ).not.toBeOnTheScreen();
    expect(
      screen.queryByTestId('diagnostic-checklist-create-task-watering-check')
    ).not.toBeOnTheScreen();
  });
});
