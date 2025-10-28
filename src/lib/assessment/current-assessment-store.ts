import type {
  AssessmentPlantContext,
  AssessmentResult,
  CapturedPhoto,
} from '@/types/assessment';

export type AssessmentSession = {
  result: AssessmentResult;
  plantContext: AssessmentPlantContext;
  photos: CapturedPhoto[];
  createdAt: number;
};

const sessions = new Map<string, AssessmentSession>();

export function setAssessmentSession(
  assessmentId: string,
  session: AssessmentSession
): void {
  sessions.set(assessmentId, {
    result: session.result,
    plantContext: session.plantContext,
    photos: session.photos,
    createdAt: session.createdAt,
  });
}

export function getAssessmentSession(
  assessmentId: string
): AssessmentSession | undefined {
  return sessions.get(assessmentId);
}

export function clearAssessmentSession(assessmentId: string): void {
  sessions.delete(assessmentId);
}

export function clearAllAssessmentSessions(): void {
  sessions.clear();
}
