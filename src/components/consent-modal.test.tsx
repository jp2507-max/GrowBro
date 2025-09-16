import React from 'react';

import { cleanup, fireEvent, screen, setup } from '@/lib/test-utils';

import { ConsentModal } from './consent-modal';

jest.mock('@/lib', () => ({
  translate: (key: string) => key,
}));

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('ConsentModal: rendering', () => {
  test('renders when visible and shows toggles', async () => {
    setup(<ConsentModal isVisible mode="first-run" onComplete={jest.fn()} />);
    expect(await screen.findByTestId('consent-modal')).toBeOnTheScreen();
    expect(screen.getByTestId('toggle-telemetry-switch')).toBeOnTheScreen();
    expect(screen.getByTestId('toggle-experiments-switch')).toBeOnTheScreen();
    expect(screen.getByTestId('toggle-aiTraining-switch')).toBeOnTheScreen();
    expect(
      screen.getByTestId('toggle-crashDiagnostics-switch')
    ).toBeOnTheScreen();
  });
});

describe('ConsentModal: interactions', () => {
  test('accept all toggles all to true', async () => {
    setup(<ConsentModal isVisible mode="first-run" onComplete={jest.fn()} />);
    await screen.findByTestId('consent-modal');
    await screen.findByTestId('accept-all-btn');
    // click accept all
    fireEvent.press(screen.getByTestId('accept-all-btn'));
    expect(screen.getByTestId('toggle-telemetry-switch').props.value).toBe(
      true
    );
    expect(screen.getByTestId('toggle-experiments-switch').props.value).toBe(
      true
    );
    expect(screen.getByTestId('toggle-aiTraining-switch').props.value).toBe(
      true
    );
    expect(
      screen.getByTestId('toggle-crashDiagnostics-switch').props.value
    ).toBe(true);
  });

  test('reject all toggles all to false', async () => {
    setup(
      <ConsentModal isVisible mode="settings-update" onComplete={jest.fn()} />
    );
    await screen.findByTestId('consent-modal');
    // first turn on via accept all
    fireEvent.press(screen.getByTestId('accept-all-btn'));
    // now reject all
    fireEvent.press(screen.getByTestId('reject-all-btn'));
    expect(screen.getByTestId('toggle-telemetry-switch').props.value).toBe(
      false
    );
    expect(screen.getByTestId('toggle-experiments-switch').props.value).toBe(
      false
    );
    expect(screen.getByTestId('toggle-aiTraining-switch').props.value).toBe(
      false
    );
    expect(
      screen.getByTestId('toggle-crashDiagnostics-switch').props.value
    ).toBe(false);
  });

  test('save calls onComplete with current values', async () => {
    const onComplete = jest.fn();
    setup(<ConsentModal isVisible mode="first-run" onComplete={onComplete} />);
    await screen.findByTestId('consent-modal');
    // turn some toggles on
    fireEvent.press(screen.getByTestId('accept-all-btn'));
    fireEvent(
      screen.getByTestId('toggle-experiments-switch'),
      'valueChange',
      false
    );
    // save
    fireEvent.press(screen.getByTestId('save-btn'));
    expect(onComplete).toHaveBeenCalledTimes(1);
    const arg = onComplete.mock.calls[0][0];
    expect(arg.telemetry).toBe(true);
    expect(arg.experiments).toBe(false);
    expect(arg.aiTraining).toBe(true);
    expect(arg.crashDiagnostics).toBe(true);
    expect(arg.acceptedAt instanceof Date).toBe(true);
  });
});
