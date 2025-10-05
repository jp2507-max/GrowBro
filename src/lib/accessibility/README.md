# Accessibility Utilities

This module provides utilities and constants for ensuring accessibility compliance in the GrowBro app.

## Touch Target Guidelines

### Minimum Sizes

- **iOS**: 44pt minimum (Human Interface Guidelines)
- **Android**: 48dp minimum (Material Design Guidelines)
- **Recommended**: 48pt/dp for better accessibility

### Usage

```typescript
import {
  MIN_TOUCH_TARGET_SIZE,
  validateTouchTarget,
  createAccessibleTouchTarget,
  calculateRequiredPadding,
} from '@/lib/accessibility';

// Validate touch target dimensions
const validation = validateTouchTarget({ width: 40, height: 40 });
if (!validation.isValid) {
  console.warn('Touch target violations:', validation.violations);
}

// Create accessible touch target styles
const touchTargetStyle = createAccessibleTouchTarget();
// Returns: { minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' }

// Calculate required padding
const padding = calculateRequiredPadding({ width: 30, height: 30 });
// Returns: { horizontal: 9, vertical: 9 }
```

## Accessibility Labels

### Creating Accessible Components

```typescript
import { createA11yProps } from '@/lib/accessibility';

// Basic button
const buttonProps = createA11yProps({
  label: 'Submit form',
  role: 'button',
  hint: 'Double tap to submit',
});

// Checkbox with state
const checkboxProps = createA11yProps({
  label: 'Accept terms',
  role: 'checkbox',
  state: {
    checked: true,
    disabled: false,
  },
});
```

### Playbook-Specific Labels

```typescript
import {
  createPlaybookA11yLabel,
  createTaskA11yLabel,
  createPhaseA11yLabel,
  createShiftScheduleA11yHint,
  createTrichomeA11yLabel,
} from '@/lib/accessibility';

// Playbook card
const playbookLabel = createPlaybookA11yLabel({
  name: 'Auto Indoor',
  setup: 'auto_indoor',
  weekCount: 12,
  taskCount: 45,
});
// "Auto Indoor playbook, auto_indoor setup, 12 weeks, 45 tasks"

// Task item
const taskLabel = createTaskA11yLabel({
  title: 'Water plants',
  dueDate: 'tomorrow',
  status: 'pending',
  hasReminder: true,
});
// "Water plants, due tomorrow, pending, has reminder"

// Phase progress
const phaseLabel = createPhaseA11yLabel({
  phase: 'Vegetative',
  completedTasks: 10,
  totalTasks: 20,
  isActive: true,
});
// "Vegetative phase, active, 10 of 20 tasks completed"

// Shift schedule hint
const shiftHint = createShiftScheduleA11yHint(3);
// "Shifts all tasks forward by 3 days"

// Trichome assessment
const trichomeLabel = createTrichomeA11yLabel({
  clearPercent: 10,
  milkyPercent: 70,
  amberPercent: 20,
  recommendation: 'Harvest now for balanced effects',
});
// "Trichome assessment: 10% clear, 70% milky, 20% amber. Recommendation: Harvest now for balanced effects"
```

## Best Practices

### 1. Always Use Minimum Touch Targets

```typescript
import { MIN_TOUCH_TARGET_SIZE } from '@/lib/accessibility';

// ✅ Good
<Pressable
  style={{
    minWidth: MIN_TOUCH_TARGET_SIZE,
    minHeight: MIN_TOUCH_TARGET_SIZE,
  }}
/>

// ❌ Bad
<Pressable style={{ width: 30, height: 30 }} />
```

### 2. Provide Meaningful Labels

```typescript
// ✅ Good
<Pressable
  accessibilityLabel="Apply Auto Indoor playbook to plant"
  accessibilityRole="button"
  accessibilityHint="Double tap to apply this playbook"
/>

// ❌ Bad
<Pressable accessibilityLabel="Button" />
```

### 3. Include State Information

```typescript
// ✅ Good
<Pressable
  accessibilityLabel="Water plants"
  accessibilityState={{
    disabled: isLoading,
    selected: isSelected,
  }}
/>

// ❌ Bad
<Pressable accessibilityLabel="Water plants" />
```

### 4. Use Semantic Roles

```typescript
// ✅ Good
<Pressable accessibilityRole="button" />
<View accessibilityRole="header" />
<TextInput accessibilityRole="search" />

// ❌ Bad
<Pressable /> // No role specified
```

## Testing

### Unit Tests

```bash
pnpm test touch-target.test
pnpm test labels.test
```

### CI Accessibility Check

```bash
pnpm accessibility:check
```

This script scans all components for:

- Missing accessibility labels
- Touch targets below minimum size
- Interactive elements without proper roles

## Automated Checks

The CI pipeline includes automated accessibility checks:

1. **Touch Target Validation**: Ensures all interactive elements meet minimum size requirements
2. **Label Validation**: Checks that all interactive elements have accessibility labels
3. **Role Validation**: Verifies proper accessibility roles are assigned

## Resources

- [iOS Human Interface Guidelines - Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Material Design - Accessibility](https://m3.material.io/foundations/accessible-design/overview)
- [React Native Accessibility](https://reactnative.dev/docs/accessibility)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
