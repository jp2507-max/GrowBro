import { act, renderHook } from '@testing-library/react-native';

import { storage } from '@/lib/storage';

import type { ActivationAction } from './activation-state';
import {
  completeActivationAction,
  dismissActivationChecklist,
  getActivationCompletedCount,
  hydrateActivationState,
  isActivationActionCompleted,
  resetActivationState,
  shouldShowActivationChecklist,
  useActivationState,
} from './activation-state';

describe('activation-state', () => {
  beforeEach(() => {
    // Clear storage before each test
    storage.clearAll();
    resetActivationState();
  });

  afterEach(() => {
    storage.clearAll();
  });

  describe('Initial State', () => {
    test('should have no completed actions initially', () => {
      const count = getActivationCompletedCount();
      expect(count).toBe(0);
    });

    test('should show checklist initially', () => {
      const shouldShow = shouldShowActivationChecklist();
      expect(shouldShow).toBe(true);
    });

    test('should have all actions incomplete initially', () => {
      const actions: ActivationAction[] = [
        'create-task',
        'try-ai-diagnosis',
        'explore-strains',
      ];

      actions.forEach((action) => {
        expect(isActivationActionCompleted(action)).toBe(false);
      });
    });
  });

  describe('Complete Action', () => {
    test('should mark action as completed', () => {
      act(() => {
        completeActivationAction('create-task');
      });

      expect(isActivationActionCompleted('create-task')).toBe(true);
      expect(getActivationCompletedCount()).toBe(1);
    });

    test('should not duplicate completed actions', () => {
      act(() => {
        completeActivationAction('create-task');
        completeActivationAction('create-task');
      });

      expect(getActivationCompletedCount()).toBe(1);
    });

    test('should auto-dismiss after 2 actions completed', () => {
      act(() => {
        completeActivationAction('create-task');
      });
      expect(shouldShowActivationChecklist()).toBe(true);

      act(() => {
        completeActivationAction('try-ai-diagnosis');
      });
      expect(shouldShowActivationChecklist()).toBe(false);
    });

    test('should persist completed actions', () => {
      act(() => {
        completeActivationAction('create-task');
      });

      // Simulate app restart by hydrating
      act(() => {
        hydrateActivationState();
      });

      expect(isActivationActionCompleted('create-task')).toBe(true);
      expect(getActivationCompletedCount()).toBe(1);
    });
  });

  describe('Dismiss Checklist', () => {
    test('should dismiss checklist', () => {
      act(() => {
        dismissActivationChecklist();
      });

      expect(shouldShowActivationChecklist()).toBe(false);
    });

    test('should persist dismissal', () => {
      act(() => {
        dismissActivationChecklist();
      });

      // Simulate app restart
      act(() => {
        hydrateActivationState();
      });

      expect(shouldShowActivationChecklist()).toBe(false);
    });

    test('should allow dismissal with less than 2 actions completed', () => {
      act(() => {
        completeActivationAction('create-task');
        dismissActivationChecklist();
      });

      expect(getActivationCompletedCount()).toBe(1);
      expect(shouldShowActivationChecklist()).toBe(false);
    });
  });

  describe('Hydration', () => {
    test('should load persisted state on hydration', () => {
      // Complete actions (persisted to storage)
      act(() => {
        completeActivationAction('create-task');
        completeActivationAction('try-ai-diagnosis');
        dismissActivationChecklist();
      });

      // Verify state was persisted and can be re-hydrated
      // (hydrate re-reads from storage, confirming persistence works)
      act(() => {
        hydrateActivationState();
      });

      expect(isActivationActionCompleted('create-task')).toBe(true);
      expect(isActivationActionCompleted('try-ai-diagnosis')).toBe(true);
      expect(getActivationCompletedCount()).toBe(2);
      expect(shouldShowActivationChecklist()).toBe(false);
    });

    test('should handle missing storage gracefully', () => {
      storage.clearAll();

      act(() => {
        hydrateActivationState();
      });

      expect(getActivationCompletedCount()).toBe(0);
      expect(shouldShowActivationChecklist()).toBe(true);
    });
  });

  describe('Reset', () => {
    test('should reset all state', () => {
      act(() => {
        completeActivationAction('create-task');
        completeActivationAction('try-ai-diagnosis');
        dismissActivationChecklist();
      });

      act(() => {
        resetActivationState();
      });

      expect(getActivationCompletedCount()).toBe(0);
      expect(shouldShowActivationChecklist()).toBe(true);
      expect(isActivationActionCompleted('create-task')).toBe(false);
      expect(isActivationActionCompleted('try-ai-diagnosis')).toBe(false);
    });

    test('should clear persisted state', () => {
      act(() => {
        completeActivationAction('create-task');
        resetActivationState();
      });

      act(() => {
        hydrateActivationState();
      });

      expect(getActivationCompletedCount()).toBe(0);
    });
  });

  describe('Zustand Selectors', () => {
    test('should provide reactive state updates', () => {
      const { result } = renderHook(() => ({
        actions: useActivationState.actions(),
        dismissed: useActivationState.dismissed(),
        shouldShow: useActivationState.shouldShowChecklist(),
      }));

      expect(result.current.actions['create-task']?.completed).toBe(false);
      expect(result.current.dismissed).toBe(false);
      expect(result.current.shouldShow()).toBe(true);

      act(() => {
        completeActivationAction('create-task');
      });

      expect(result.current.actions['create-task']?.completed).toBe(true);
    });
  });
});
