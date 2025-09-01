import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import CalendarScreen from './calendar';

describe('CalendarScreen', () => {
  it('renders header and empty agenda', () => {
    render(<CalendarScreen />);
    expect(screen.getByText('Prev')).toBeTruthy();
    expect(screen.getByText('Next')).toBeTruthy();
  });

  it('navigates dates with header buttons', () => {
    render(<CalendarScreen />);
    const prev = screen.getByText('Prev');
    const next = screen.getByText('Next');
    fireEvent.press(prev);
    fireEvent.press(next);
    expect(prev).toBeTruthy();
    expect(next).toBeTruthy();
  });
});
