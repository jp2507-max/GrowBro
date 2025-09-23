import { isHidden as isHiddenLocal } from './auto-hide';

export function isContentHidden(contentId: string | number): boolean {
  return isHiddenLocal(contentId);
}
