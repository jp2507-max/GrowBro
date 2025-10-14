import { create } from 'zustand';

type DiagnosticStore = {
  aiConfidenceThreshold: number;
  setAiConfidenceThreshold: (threshold: number) => void;
};

const DEFAULT_AI_CONFIDENCE_THRESHOLD = 0.78;

export const useDiagnosticStore = create<DiagnosticStore>((set) => ({
  aiConfidenceThreshold: DEFAULT_AI_CONFIDENCE_THRESHOLD,

  setAiConfidenceThreshold: (threshold: number) => {
    // Clamp threshold between 0 and 1
    const clamped = Math.max(0, Math.min(1, threshold));
    set({ aiConfidenceThreshold: clamped });
  },
}));

export function getAiConfidenceThreshold(): number {
  return useDiagnosticStore.getState().aiConfidenceThreshold;
}
