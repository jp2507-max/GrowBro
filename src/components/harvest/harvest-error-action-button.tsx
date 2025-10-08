/**
 * Action button component for harvest error banners
 */

import * as React from 'react';

import { Text } from '@/components/ui';
import { Button } from '@/components/ui/button';
import type { ErrorAction } from '@/lib/harvest/harvest-error-types';

type Props = {
  action: ErrorAction;
  variant: 'error' | 'warning' | 'info';
  testID: string;
};

export function HarvestErrorActionButton({ action, variant, testID }: Props) {
  const buttonVariant = React.useMemo(() => {
    if (action.action === 'retry') return 'default';
    if (action.action === 're_auth') return 'default';
    return 'outline';
  }, [action.action]);

  const buttonClasses = React.useMemo(() => {
    const base = 'min-h-[44px]';
    if (variant === 'error' && action.action === 'retry') {
      return `${base} bg-danger-600 dark:bg-danger-700`;
    }
    if (variant === 'warning' && action.action === 'retry') {
      return `${base} bg-warning-600 dark:bg-warning-700`;
    }
    return base;
  }, [variant, action.action]);

  return (
    <Button
      variant={buttonVariant}
      size="sm"
      onPress={action.onPress}
      testID={testID}
      className={buttonClasses}
      accessibilityLabel={action.label}
      accessibilityHint={`Double-tap to ${action.label.toLowerCase()}`}
    >
      <Text
        className={
          buttonVariant === 'outline' ? 'text-sm' : 'text-sm text-white'
        }
      >
        {action.label}
      </Text>
    </Button>
  );
}
