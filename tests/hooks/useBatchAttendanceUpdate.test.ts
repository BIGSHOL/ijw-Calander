import { renderHook } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testHelpers';
import { useBatchAttendanceUpdate } from '../../hooks/useBatchAttendanceUpdate';

vi.mock('firebase/firestore', () => ({
  writeBatch: vi.fn().mockReturnValue({
    update: vi.fn(),
    set: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  }),
  doc: vi.fn(),
  collection: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({
    exists: () => true,
    data: () => ({ status: 'present' }),
  }),
}));

vi.mock('../../firebaseConfig', () => ({ db: {} }));
vi.mock('../../utils/attendanceSync', () => ({
  mapAttendanceStatusToValue: vi.fn().mockReturnValue('O'),
}));

describe('useBatchAttendanceUpdate', () => {
  const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  it('hook 초기화 - mutateAsync 존재', () => {
    const { result } = renderHook(() => useBatchAttendanceUpdate(), {
      wrapper: createWrapper(),
    });
    expect(result.current.mutateAsync).toBeDefined();
    expect(result.current.isIdle).toBe(true);
  });
});
