import { renderHook } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testHelpers';
import {
  useCreateConsultation,
  useUpdateConsultation,
  useDeleteConsultation,
  useCompleteFollowUp,
} from '../../hooks/useConsultationMutations';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn().mockResolvedValue({ id: 'new-id' }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../firebaseConfig', () => ({ db: {} }));
vi.mock('../../hooks/useStudentConsultations', () => ({
  COL_STUDENT_CONSULTATIONS: 'student_consultations',
}));

describe('useConsultationMutations', () => {
  const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  it('useCreateConsultation hook 초기화', () => {
    const { result } = renderHook(() => useCreateConsultation(), {
      wrapper: createWrapper(),
    });
    expect(result.current.mutateAsync).toBeDefined();
    expect(result.current.isIdle).toBe(true);
  });

  it('useUpdateConsultation hook 초기화', () => {
    const { result } = renderHook(() => useUpdateConsultation(), {
      wrapper: createWrapper(),
    });
    expect(result.current.mutateAsync).toBeDefined();
  });

  it('useDeleteConsultation hook 초기화', () => {
    const { result } = renderHook(() => useDeleteConsultation(), {
      wrapper: createWrapper(),
    });
    expect(result.current.mutateAsync).toBeDefined();
  });

  it('useCompleteFollowUp hook 초기화', () => {
    const { result } = renderHook(() => useCompleteFollowUp(), {
      wrapper: createWrapper(),
    });
    expect(result.current.mutateAsync).toBeDefined();
  });
});
