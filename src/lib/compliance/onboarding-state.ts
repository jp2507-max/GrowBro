import { create } from 'zustand';

import { storage } from '@/lib/storage';
import { createSelectors } from '@/lib/utils';

const ONBOARDING_STATE_KEY = 'compliance.onboarding.state';

/**
 * Current onboarding flow version
 * Increment this to re-show onboarding to existing users after major changes
 * Format: YYYYMMDD for easy tracking
 */
export const ONBOARDING_VERSION = 20251111;

export type OnboardingStep =
  | 'age-gate'
  | 'legal-confirmation'
  | 'consent-modal'
  | 'notification-primer'
  | 'camera-primer'
  | 'completed';

export type OnboardingStatus = 'not-started' | 'in-progress' | 'completed';

type PersistedOnboardingState = {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  lastUpdated: string;
  version?: number;
  completedAt?: string;
  status?: OnboardingStatus;
};

export type OnboardingStoreState = {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  lastUpdated: string | null;
  version: number;
  completedAt: string | null;
  status: OnboardingStatus;
  hydrate: () => void;
  setCurrentStep: (step: OnboardingStep) => void;
  completeStep: (step: OnboardingStep) => void;
  reset: () => void;
  isStepCompleted: (step: OnboardingStep) => boolean;
  isOnboardingComplete: () => boolean;
  getNextStep: () => OnboardingStep | null;
  shouldShowOnboarding: () => boolean;
  markAsCompleted: () => void;
};

const STEP_ORDER: OnboardingStep[] = [
  'age-gate',
  'legal-confirmation',
  'consent-modal',
  'notification-primer',
  'camera-primer',
  'completed',
];

export const LEGACY_STEP_MAPPING: Record<string, OnboardingStep> = {
  age_gate: 'age-gate',
  legal_confirmation: 'legal-confirmation',
  consent: 'consent-modal',
  notification_primer: 'notification-primer',
  camera_primer: 'camera-primer',
  complete: 'completed',
};

export function normalizeStepId(stepId: string): OnboardingStep | null {
  // First check if it's already a valid current step ID
  if (STEP_ORDER.includes(stepId as OnboardingStep)) {
    return stepId as OnboardingStep;
  }
  // Then check legacy mappings
  return LEGACY_STEP_MAPPING[stepId] || null;
}

export function loadPersistedState(): PersistedOnboardingState {
  try {
    const raw = storage.getString(ONBOARDING_STATE_KEY);
    if (!raw) {
      return createInitialState();
    }
    const parsed = JSON.parse(raw) as PersistedOnboardingState;

    // Normalize currentStep
    const normalizedCurrentStep = normalizeStepId(parsed?.currentStep || '');
    const currentStep = normalizedCurrentStep || 'age-gate';

    // Normalize and dedupe completedSteps
    const normalizedCompletedSteps = Array.isArray(parsed?.completedSteps)
      ? parsed.completedSteps
          .map((step) => normalizeStepId(step))
          .filter((step): step is OnboardingStep => step !== null)
      : [];
    const completedSteps = [...new Set(normalizedCompletedSteps)];

    // Determine status based on persisted data
    const status: OnboardingStatus =
      parsed?.status ||
      (currentStep === 'completed' ? 'completed' : 'in-progress');

    return {
      currentStep,
      completedSteps,
      lastUpdated:
        typeof parsed?.lastUpdated === 'string'
          ? parsed.lastUpdated
          : new Date().toISOString(),
      version: typeof parsed?.version === 'number' ? parsed.version : undefined,
      completedAt: parsed?.completedAt,
      status,
    };
  } catch {
    return createInitialState();
  }
}

function createInitialState(): PersistedOnboardingState {
  return {
    currentStep: 'age-gate',
    completedSteps: [],
    lastUpdated: new Date().toISOString(),
    status: 'not-started',
  };
}

function savePersistedState(state: PersistedOnboardingState): void {
  storage.set(ONBOARDING_STATE_KEY, JSON.stringify(state));
}

function createHydrateFunction(set: any): () => void {
  return () => {
    const persisted = loadPersistedState();
    set({
      currentStep: persisted.currentStep,
      completedSteps: persisted.completedSteps,
      lastUpdated: persisted.lastUpdated,
      version: persisted.version || 0,
      completedAt: persisted.completedAt || null,
      status: persisted.status || 'not-started',
    });
  };
}

function createSetCurrentStepFunction(
  set: any,
  get: any
): (step: OnboardingStep) => void {
  return (step: OnboardingStep) => {
    const state = get();
    const timestamp = new Date().toISOString();
    const newStatus: OnboardingStatus =
      step === 'completed' ? 'completed' : 'in-progress';

    set({
      currentStep: step,
      lastUpdated: timestamp,
      status: newStatus,
    });
    savePersistedState({
      currentStep: step,
      completedSteps: state.completedSteps,
      lastUpdated: timestamp,
      version: state.version,
      completedAt: state.completedAt,
      status: newStatus,
    });
  };
}

function createCompleteStepFunction(
  set: any,
  get: any
): (step: OnboardingStep) => void {
  return (step: OnboardingStep) => {
    const state = get();
    const timestamp = new Date().toISOString();

    // Add to completed steps if not already there
    const completedSteps = state.completedSteps.includes(step)
      ? state.completedSteps
      : [...state.completedSteps, step];

    // Determine next step
    const currentIndex = STEP_ORDER.indexOf(step);
    const nextStep =
      currentIndex >= 0 && currentIndex < STEP_ORDER.length - 1
        ? STEP_ORDER[currentIndex + 1]
        : 'completed';

    const newStatus: OnboardingStatus =
      nextStep === 'completed' ? 'completed' : 'in-progress';
    const newCompletedAt =
      nextStep === 'completed' ? timestamp : state.completedAt;
    const newVersion =
      nextStep === 'completed' ? ONBOARDING_VERSION : state.version;

    set({
      currentStep: nextStep,
      completedSteps,
      lastUpdated: timestamp,
      status: newStatus,
      completedAt: newCompletedAt,
      version: newVersion,
    });

    savePersistedState({
      currentStep: nextStep,
      completedSteps,
      lastUpdated: timestamp,
      status: newStatus,
      completedAt: newCompletedAt,
      version: newVersion,
    });
  };
}

function createResetFunction(set: any): () => void {
  return () => {
    storage.delete(ONBOARDING_STATE_KEY);
    const initialState = createInitialState();
    set({
      currentStep: initialState.currentStep,
      completedSteps: initialState.completedSteps,
      lastUpdated: initialState.lastUpdated,
      version: initialState.version || 0,
      completedAt: initialState.completedAt || null,
      status: initialState.status || 'not-started',
    });
  };
}

function createIsStepCompletedFunction(
  get: any
): (step: OnboardingStep) => boolean {
  return (step: OnboardingStep) => {
    const state = get();
    return state.completedSteps.includes(step);
  };
}

function createIsOnboardingCompleteFunction(get: any): () => boolean {
  return () => {
    const state = get();
    return state.currentStep === 'completed';
  };
}

function createGetNextStepFunction(get: any): () => OnboardingStep | null {
  return () => {
    const state = get();
    if (state.currentStep === 'completed') return null;

    const currentIndex = STEP_ORDER.indexOf(state.currentStep);
    if (currentIndex >= 0 && currentIndex < STEP_ORDER.length - 1) {
      return STEP_ORDER[currentIndex + 1];
    }
    return null;
  };
}

function createShouldShowOnboardingFunction(get: any): () => boolean {
  return () => {
    const state = get();
    // Show if not completed or if version has been bumped
    if (state.status !== 'completed') return true;
    if (
      typeof state.version === 'number' &&
      state.version < ONBOARDING_VERSION
    ) {
      return true;
    }
    return false;
  };
}

function createMarkAsCompletedFunction(set: any, get: any): () => void {
  return () => {
    const state = get();
    const timestamp = new Date().toISOString();
    const updatedState = {
      currentStep: 'completed' as OnboardingStep,
      completedSteps: [...new Set([...state.completedSteps, 'completed'])],
      lastUpdated: timestamp,
      version: ONBOARDING_VERSION,
      completedAt: timestamp,
      status: 'completed' as OnboardingStatus,
    };

    set(updatedState);
    savePersistedState(updatedState);
  };
}

function createOnboardingStore(set: any, get: any): OnboardingStoreState {
  const initialState = createInitialState();
  return {
    currentStep: initialState.currentStep,
    completedSteps: initialState.completedSteps,
    lastUpdated: null,
    version: initialState.version || 0,
    completedAt: initialState.completedAt || null,
    status: initialState.status || 'not-started',
    hydrate: createHydrateFunction(set),
    setCurrentStep: createSetCurrentStepFunction(set, get),
    completeStep: createCompleteStepFunction(set, get),
    reset: createResetFunction(set),
    isStepCompleted: createIsStepCompletedFunction(get),
    isOnboardingComplete: createIsOnboardingCompleteFunction(get),
    getNextStep: createGetNextStepFunction(get),
    shouldShowOnboarding: createShouldShowOnboardingFunction(get),
    markAsCompleted: createMarkAsCompletedFunction(set, get),
  };
}

const _useOnboardingState = create<OnboardingStoreState>((set, get) =>
  createOnboardingStore(set, get)
);

const onboardingStateStore = createSelectors(_useOnboardingState);

export const useOnboardingState = onboardingStateStore.use;

export function hydrateOnboardingState(): void {
  onboardingStateStore.getState().hydrate();
}

export function setOnboardingStep(step: OnboardingStep): void {
  onboardingStateStore.getState().setCurrentStep(step);
}

export function completeOnboardingStep(step: OnboardingStep): void {
  onboardingStateStore.getState().completeStep(step);
}

export function resetOnboardingState(): void {
  onboardingStateStore.getState().reset();
}

export function isOnboardingStepCompleted(step: OnboardingStep): boolean {
  return onboardingStateStore.getState().isStepCompleted(step);
}

export function isOnboardingComplete(): boolean {
  return onboardingStateStore.getState().isOnboardingComplete();
}

export function getNextOnboardingStep(): OnboardingStep | null {
  return onboardingStateStore.getState().getNextStep();
}

export function getCurrentOnboardingStep(): OnboardingStep {
  return onboardingStateStore.getState().currentStep;
}

export function shouldShowOnboarding(): boolean {
  return onboardingStateStore.getState().shouldShowOnboarding();
}

export function markOnboardingAsCompleted(): void {
  onboardingStateStore.getState().markAsCompleted();
}

export function getOnboardingStatus(): OnboardingStatus {
  return onboardingStateStore.getState().status;
}

export function getOnboardingVersion(): number {
  return onboardingStateStore.getState().version;
}
