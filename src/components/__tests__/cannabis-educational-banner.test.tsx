import React from 'react';

import { CannabisEducationalBanner } from '@/components/cannabis-educational-banner';
import { translate } from '@/lib/i18n';
import { render, screen } from '@/lib/test-utils';

describe('CannabisEducationalBanner', () => {
  test('renders educational copy', () => {
    render(<CannabisEducationalBanner />);
    expect(
      screen.getByText(translate('cannabis.educational_banner_title'))
    ).toBeTruthy();
    expect(
      screen.getByText(translate('cannabis.educational_banner_body'))
    ).toBeTruthy();
  });
});
