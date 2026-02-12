import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// TAB_META mock
vi.mock('../../types', async (importOriginal) => {
  const orig = await importOriginal<Record<string, unknown>>();
  return {
    ...orig,
    TAB_META: {
      calendar: { label: '캘린더' },
      timetable: { label: '시간표' },
      attendance: { label: '출결' },
    },
  };
});

import { useTabHistory } from '../../hooks/useTabHistory';

describe('useTabHistory', () => {
  let pushStateSpy: ReturnType<typeof vi.spyOn>;
  let replaceStateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
    replaceStateSpy = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    window.location.hash = '';
  });

  afterEach(() => {
    pushStateSpy.mockRestore();
    replaceStateSpy.mockRestore();
  });

  it('getTabFromHash 반환', () => {
    const setAppMode = vi.fn();
    const { result } = renderHook(() => useTabHistory(null, setAppMode));
    expect(result.current.getTabFromHash).toBeDefined();
    expect(typeof result.current.getTabFromHash).toBe('function');
  });

  it('첫 탭 설정 시 replaceState 호출', () => {
    const setAppMode = vi.fn();
    renderHook(() => useTabHistory('calendar' as any, setAppMode));
    expect(replaceStateSpy).toHaveBeenCalledWith(
      { tab: 'calendar' },
      '',
      '#calendar'
    );
  });

  it('탭 전환 시 pushState 호출', () => {
    const setAppMode = vi.fn();
    const { rerender } = renderHook(
      ({ tab }) => useTabHistory(tab as any, setAppMode),
      { initialProps: { tab: 'calendar' } }
    );

    // 첫 탭은 replaceState
    expect(replaceStateSpy).toHaveBeenCalled();

    // 탭 전환 → pushState
    rerender({ tab: 'timetable' });
    expect(pushStateSpy).toHaveBeenCalledWith(
      { tab: 'timetable' },
      '',
      '#timetable'
    );
  });

  it('같은 탭이면 히스토리 변경 없음', () => {
    const setAppMode = vi.fn();
    const { rerender } = renderHook(
      ({ tab }) => useTabHistory(tab as any, setAppMode),
      { initialProps: { tab: 'calendar' } }
    );

    const pushCallCount = pushStateSpy.mock.calls.length;
    rerender({ tab: 'calendar' });
    // 같은 탭이므로 pushState 추가 호출 없음
    expect(pushStateSpy.mock.calls.length).toBe(pushCallCount);
  });

  it('appMode null이면 히스토리 변경 없음', () => {
    const setAppMode = vi.fn();
    renderHook(() => useTabHistory(null, setAppMode));
    expect(replaceStateSpy).not.toHaveBeenCalled();
    expect(pushStateSpy).not.toHaveBeenCalled();
  });
});
