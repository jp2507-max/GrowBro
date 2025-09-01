import { shouldAutoScroll } from '@/components/calendar/drag-drop-provider';

describe('shouldAutoScroll', () => {
  it('returns 0 when viewport height invalid', () => {
    expect(shouldAutoScroll(10, 0, 60)).toBe(0);
  });

  it('returns -1 near top edge', () => {
    expect(shouldAutoScroll(30, 600, 60)).toBe(-1);
  });

  it('returns 1 near bottom edge', () => {
    expect(shouldAutoScroll(600 - 20, 600, 60)).toBe(1);
  });

  it('returns 0 in safe middle area', () => {
    expect(shouldAutoScroll(300, 600, 60)).toBe(0);
  });
});


