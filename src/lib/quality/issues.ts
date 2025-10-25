import type { IssueFactoryArgs } from './types';

export function buildIssue({ type, severity, suggestion }: IssueFactoryArgs) {
  return {
    type,
    severity,
    suggestion,
  };
}
