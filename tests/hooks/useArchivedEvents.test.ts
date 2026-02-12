import { vi } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnValue('mockRef') }),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  query: vi.fn(),
  where: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({ db: {} }));
vi.mock('../../converters', () => ({ eventConverter: {} }));

import { renderHook, waitFor } from '@testing-library/react';
import { useArchivedEvents } from '../../hooks/useArchivedEvents';

describe('useArchivedEvents', () => {
  it('enabled=false이면 빈 배열', () => {
    const { result } = renderHook(() => useArchivedEvents(false, 2026));
    expect(result.current.events).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('enabled=true이면 로딩 시작', async () => {
    const { result } = renderHook(() => useArchivedEvents(true, 2026));
    // 초기 로딩 상태
    expect(result.current.loading).toBe(true);
    // 비동기 완료 대기
    await waitFor(() => expect(result.current.loading).toBe(false));
  });
});
