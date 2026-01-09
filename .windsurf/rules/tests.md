---
trigger: always_on
---

## Testing Guidelines

- File naming: `component-name.test.tsx` (co-located with component)
- Import test utils from `@/lib/test-utils` (provides `setup`, `cleanup`, `screen`, `waitFor`)
- Use `testID` props for reliable element selection
- Avoid testing implementation details
- Avoid multiple assertions inside `waitFor`

## Test Structure

```tsx
import React from 'react';
import { cleanup, screen, setup, waitFor } from '@/lib/test-utils';
afterEach(cleanup);
describe('ComponentName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  describe('Rendering', () => {
    test('renders correctly', async () => {
      setup(<ComponentName />);
      expect(await screen.findByTestId('component-name')).toBeOnTheScreen();
    });
  });
  describe('Interactions', () => {
    test('handles user input', async () => {
      const { user } = setup(<ComponentName />);
      await user.type(screen.getByTestId('input-id'), 'test');
    });
  });
});

Run Tests
pnpm test <component-name> -- --coverage --coverageReporters="text"
```
