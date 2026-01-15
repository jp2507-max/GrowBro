import { create, type StoreApi } from 'zustand';

import { trackActivationAction } from '@/lib/compliance/onboarding-telemetry';
import { storage } from '@/lib/storage';
import { createSelectors } from '@/lib/utils';

const ACTIVATION_STATE_KEY = 'compliance.activation.state';

export type ActivationAction =
  | 'create-task'
  | 'try-ai-diagnosis'
  | 'explore-strains';

export type ActivationActionState = {
  completed: boolean;
  completedAt: string | null;
};

type PersistedActivationState = {
  actions: Record<ActivationAction, ActivationActionState>;
  dismissed: boolean;
  dismissedAt: string | null;
  lastUpdated: string;
};

export type ActivationStoreState = {
  actions: Record<ActivationAction, ActivationActionState>;
  dismissed: boolean;
  dismissedAt: string | null;
  lastUpdated: string | null;
  hydrate: () => void;
  completeAction: (action: ActivationAction) => void;
  dismissChecklist: () => void;
  reset: () => void;
  isActionCompleted: (action: ActivationAction) => boolean;
  getCompletedCount: () => number;
  shouldShowChecklist: () => boolean;
};

const ALL_ACTIONS: ActivationAction[] = [
  'create-task',
  'try-ai-diagnosis',
  'explore-strains',
];

function createInitialState(): PersistedActivationState {
  const actions: Record<ActivationAction, ActivationActionState> = {} as Record<
    ActivationAction,
    ActivationActionState
  >;
  ALL_ACTIONS.forEach((action) => {
    actions[action] = {
      completed: false,
      completedAt: null,
    };
  });

  return {
    actions,
    dismissed: false,
    dismissedAt: null,
    lastUpdated: new Date().toISOString(),
  };
}

function loadPersistedState(): PersistedActivationState {
  try {
    const raw = storage.getString(ACTIVATION_STATE_KEY);
    if (!raw) {
      return createInitialState();
    }
    const parsed = JSON.parse(raw) as PersistedActivationState;

    // Ensure all actions exist
    const actions: Record<ActivationAction, ActivationActionState> =
      {} as Record<ActivationAction, ActivationActionState>;
    ALL_ACTIONS.forEach((action) => {
      actions[action] = parsed.actions?.[action] || {
        completed: false,
        completedAt: null,
      };
    });

    return {
      actions,
      dismissed: parsed.dismissed ?? false,
      dismissedAt: parsed.dismissedAt ?? null,
      lastUpdated:
        typeof parsed.lastUpdated === 'string'
          ? parsed.lastUpdated
          : new Date().toISOString(),
    };
  } catch {
    return createInitialState();
  }
}

function savePersistedState(state: PersistedActivationState): void {
  storage.set(ACTIVATION_STATE_KEY, JSON.stringify(state));
}

function createHydrateFunction(
  set: StoreApi<ActivationStoreState>['setState']
): () => void {
  return () => {
    const persisted = loadPersistedState();
    set({
      actions: persisted.actions,
      dismissed: persisted.dismissed,
      dismissedAt: persisted.dismissedAt,
      lastUpdated: persisted.lastUpdated,
    });
  };
}

function createCompleteActionFunction(
  set: StoreApi<ActivationStoreState>['setState'],
  get: StoreApi<ActivationStoreState>['getState']
): (action: ActivationAction) => void {
  return (action: ActivationAction) => {
    const state = get();
    const timestamp = new Date().toISOString();

    // Don't duplicate if already completed
    if (state.actions[action]?.completed) {
      return;
    }

    const updatedActions = {
      ...state.actions,
      [action]: {
        completed: true,
        completedAt: timestamp,
      },
    };

    // Count completed actions
    const completedCount = ALL_ACTIONS.filter(
      (a) => updatedActions[a]?.completed
    ).length;

    // Auto-dismiss after 2 actions completed
    const shouldAutoDismiss = completedCount >= 2;

    const newState = {
      actions: updatedActions,
      dismissed: shouldAutoDismiss ? true : state.dismissed,
      dismissedAt: shouldAutoDismiss ? timestamp : state.dismissedAt,
      lastUpdated: timestamp,
    };

    set(newState);
    savePersistedState(newState);

    // Track activation action completion
    trackActivationAction(action, true, 'activation_checklist');
  };
}

function createDismissChecklistFunction(
  set: StoreApi<ActivationStoreState>['setState'],
  get: StoreApi<ActivationStoreState>['getState']
): () => void {
  return () => {
    const state = get();
    const timestamp = new Date().toISOString();

    const newState = {
      actions: state.actions,
      dismissed: true,
      dismissedAt: timestamp,
      lastUpdated: timestamp,
    };

    set(newState);
    savePersistedState(newState);
  };
}

function createResetFunction(
  set: StoreApi<ActivationStoreState>['setState']
): () => void {
  return () => {
    storage.delete(ACTIVATION_STATE_KEY);
    const initialState = createInitialState();
    set({
      actions: initialState.actions,
      dismissed: initialState.dismissed,
      dismissedAt: initialState.dismissedAt,
      lastUpdated: initialState.lastUpdated,
    });
  };
}

function createIsActionCompletedFunction(
  get: StoreApi<ActivationStoreState>['getState']
): (action: ActivationAction) => boolean {
  return (action: ActivationAction) => {
    const state = get();
    return state.actions[action]?.completed ?? false;
  };
}

function createGetCompletedCountFunction(
  get: StoreApi<ActivationStoreState>['getState']
): () => number {
  return () => {
    const state = get();
    return ALL_ACTIONS.filter((action) => state.actions[action]?.completed)
      .length;
  };
}

function createShouldShowChecklistFunction(
  get: StoreApi<ActivationStoreState>['getState']
): () => boolean {
  return () => {
    const state = get();
    // Don't show if dismissed
    if (state.dismissed) return false;

    // Don't show if 2+ actions completed (auto-dismissed)
    const completedCount = ALL_ACTIONS.filter(
      (action) => state.actions[action]?.completed
    ).length;
    if (completedCount >= 2) return false;

    return true;
  };
}

function createActivationStore(
  set: StoreApi<ActivationStoreState>['setState'],
  get: StoreApi<ActivationStoreState>['getState']
): ActivationStoreState {
  const initialState = createInitialState();
  return {
    actions: initialState.actions,
    dismissed: initialState.dismissed,
    dismissedAt: initialState.dismissedAt,
    lastUpdated: null,
    hydrate: createHydrateFunction(set),
    completeAction: createCompleteActionFunction(set, get),
    dismissChecklist: createDismissChecklistFunction(set, get),
    reset: createResetFunction(set),
    isActionCompleted: createIsActionCompletedFunction(get),
    getCompletedCount: createGetCompletedCountFunction(get),
    shouldShowChecklist: createShouldShowChecklistFunction(get),
  };
}

const _useActivationState = create<ActivationStoreState>((set, get) =>
  createActivationStore(set, get)
);

const activationStateStore = createSelectors(_useActivationState);

export const useActivationState = activationStateStore.use;
export const useActivationStore = _useActivationState;

export function hydrateActivationState(): void {
  activationStateStore.getState().hydrate();
}

export function completeActivationAction(action: ActivationAction): void {
  activationStateStore.getState().completeAction(action);
}

export function dismissActivationChecklist(): void {
  activationStateStore.getState().dismissChecklist();
}

export function resetActivationState(): void {
  activationStateStore.getState().reset();
}

export function isActivationActionCompleted(action: ActivationAction): boolean {
  return activationStateStore.getState().isActionCompleted(action);
}

export function getActivationCompletedCount(): number {
  return activationStateStore.getState().getCompletedCount();
}

export function shouldShowActivationChecklist(): boolean {
  return activationStateStore.getState().shouldShowChecklist();
}
