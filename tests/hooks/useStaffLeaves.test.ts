import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useStaffLeaves, COL_STAFF_LEAVES } from '../../hooks/useStaffLeaves';
import type { StaffLeave } from '../../types';

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({}),
  doc: vi.fn().mockReturnValue({}),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

// Mock firebaseConfig
vi.mock('../../firebaseConfig', () => ({
  db: {},
  auth: {
    currentUser: {
      displayName: 'Admin User',
      email: 'admin@test.com'
    }
  },
}));

import { getDocs, addDoc, updateDoc, deleteDoc, doc, collection, query, where, orderBy } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';

// Helper to create QueryClient wrapper
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

// Mock data
const mockLeaveData: Omit<StaffLeave, 'id'> = {
  staffId: 'staff-001',
  staffName: '홍길동',
  type: 'annual',
  startDate: '2026-02-10',
  endDate: '2026-02-12',
  reason: '개인 사유',
  status: 'pending',
  createdAt: '2026-02-07T10:00:00.000Z',
};

const mockLeave1: StaffLeave = {
  id: 'leave-001',
  ...mockLeaveData,
};

const mockLeave2: StaffLeave = {
  id: 'leave-002',
  staffId: 'staff-002',
  staffName: '김영희',
  type: 'sick',
  startDate: '2026-02-08',
  endDate: '2026-02-08',
  reason: '몸살',
  status: 'approved',
  approvedBy: 'Admin User',
  approvedAt: '2026-02-07T09:00:00.000Z',
  createdAt: '2026-02-06T10:00:00.000Z',
};

const mockLeave3: StaffLeave = {
  id: 'leave-003',
  staffId: 'staff-001',
  staffName: '홍길동',
  type: 'personal',
  startDate: '2026-03-01',
  endDate: '2026-03-01',
  status: 'pending',
  createdAt: '2026-02-05T10:00:00.000Z',
};

describe('useStaffLeaves', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock doc and collection to return empty objects
    vi.mocked(doc).mockReturnValue({} as any);
    vi.mocked(collection).mockReturnValue({} as any);
    vi.mocked(query).mockReturnValue({} as any);
    vi.mocked(where).mockReturnValue({} as any);
    vi.mocked(orderBy).mockReturnValue({} as any);
  });

  describe('Query - Fetch Leaves', () => {
    it('초기 로딩 상태를 반환한다', () => {
      vi.mocked(getDocs).mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useStaffLeaves(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loading).toBe(true);
      expect(result.current.leaves).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('staffId 없이 호출 시 전체 휴가 목록을 가져온다', async () => {
      const mockSnapshot = {
        docs: [
          { id: mockLeave1.id, data: () => mockLeave1 },
          { id: mockLeave2.id, data: () => mockLeave2 },
          { id: mockLeave3.id, data: () => mockLeave3 },
        ],
      };

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

      const { result } = renderHook(() => useStaffLeaves(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(getDocs).toHaveBeenCalledTimes(1);
      expect(collection).toHaveBeenCalledWith(db, COL_STAFF_LEAVES);
      expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
      expect(where).not.toHaveBeenCalled();
      expect(result.current.leaves).toHaveLength(3);
    });

    it('staffId 제공 시 해당 직원의 휴가만 가져온다', async () => {
      const mockSnapshot = {
        docs: [
          { id: mockLeave1.id, data: () => mockLeave1 },
          { id: mockLeave3.id, data: () => mockLeave3 },
        ],
      };

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

      const { result } = renderHook(() => useStaffLeaves('staff-001'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(getDocs).toHaveBeenCalledTimes(1);
      expect(collection).toHaveBeenCalledWith(db, COL_STAFF_LEAVES);
      expect(where).toHaveBeenCalledWith('staffId', '==', 'staff-001');
      expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
      expect(result.current.leaves).toHaveLength(2);
      expect(result.current.leaves.every(l => l.staffId === 'staff-001')).toBe(true);
    });

    it('Firestore 문서를 StaffLeave 객체로 올바르게 매핑한다', async () => {
      const mockSnapshot = {
        docs: [
          { id: 'leave-001', data: () => mockLeaveData },
        ],
      };

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

      const { result } = renderHook(() => useStaffLeaves(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.leaves[0]).toEqual({
        id: 'leave-001',
        staffId: 'staff-001',
        staffName: '홍길동',
        type: 'annual',
        startDate: '2026-02-10',
        endDate: '2026-02-12',
        reason: '개인 사유',
        status: 'pending',
        createdAt: '2026-02-07T10:00:00.000Z',
      });
    });

    it('필드가 누락된 문서도 기본값으로 처리한다', async () => {
      const incompleteData = {
        staffId: 'staff-999',
      };

      const mockSnapshot = {
        docs: [
          { id: 'leave-999', data: () => incompleteData },
        ],
      };

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

      const { result } = renderHook(() => useStaffLeaves(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.leaves[0]).toEqual({
        id: 'leave-999',
        staffId: 'staff-999',
        staffName: '',
        type: 'other',
        startDate: '',
        endDate: '',
        reason: undefined,
        status: 'pending',
        approvedBy: undefined,
        approvedAt: undefined,
        createdAt: '',
      });
    });

    it('쿼리 실패 시 에러 메시지를 반환한다', async () => {
      const errorMessage = 'Firestore query failed';
      vi.mocked(getDocs).mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useStaffLeaves(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.error).toBe(errorMessage);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.leaves).toEqual([]);
    });

    it('빈 결과를 올바르게 처리한다', async () => {
      const mockSnapshot = {
        docs: [],
      };

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

      const { result } = renderHook(() => useStaffLeaves(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.leaves).toEqual([]);
      expect(result.current.pendingCount).toBe(0);
    });
  });

  describe('Computed - Pending Count', () => {
    it('status가 pending인 휴가 개수를 계산한다', async () => {
      const mockSnapshot = {
        docs: [
          { id: mockLeave1.id, data: () => mockLeave1 }, // pending
          { id: mockLeave2.id, data: () => mockLeave2 }, // approved
          { id: mockLeave3.id, data: () => mockLeave3 }, // pending
        ],
      };

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

      const { result } = renderHook(() => useStaffLeaves(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.pendingCount).toBe(2);
    });

    it('모든 휴가가 승인/반려된 경우 pendingCount는 0이다', async () => {
      const approvedLeave = { ...mockLeave1, status: 'approved' as const };
      const rejectedLeave = { ...mockLeave2, status: 'rejected' as const };

      const mockSnapshot = {
        docs: [
          { id: approvedLeave.id, data: () => approvedLeave },
          { id: rejectedLeave.id, data: () => rejectedLeave },
        ],
      };

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

      const { result } = renderHook(() => useStaffLeaves(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.pendingCount).toBe(0);
    });

    it('휴가 목록이 비어있을 때 pendingCount는 0이다', async () => {
      const mockSnapshot = { docs: [] };
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

      const { result } = renderHook(() => useStaffLeaves(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.pendingCount).toBe(0);
    });
  });

  describe('Mutation - Add Leave', () => {
    it('addLeave 호출 시 createdAt 타임스탬프와 함께 addDoc을 호출한다', async () => {
      const mockSnapshot = { docs: [] };
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-leave-id' } as any);

      const { result } = renderHook(() => useStaffLeaves(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const newLeaveData: Omit<StaffLeave, 'id' | 'createdAt'> = {
        staffId: 'staff-003',
        staffName: '이철수',
        type: 'annual',
        startDate: '2026-02-15',
        endDate: '2026-02-17',
        reason: '가족 여행',
        status: 'pending',
      };

      await result.current.addLeave(newLeaveData);

      expect(addDoc).toHaveBeenCalledTimes(1);
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          staffId: 'staff-003',
          staffName: '이철수',
          type: 'annual',
          startDate: '2026-02-15',
          endDate: '2026-02-17',
          reason: '가족 여행',
          status: 'pending',
          createdAt: expect.any(String),
        })
      );

      // Check that createdAt is a valid ISO string
      const callArgs = vi.mocked(addDoc).mock.calls[0][1] as any;
      expect(new Date(callArgs.createdAt).toISOString()).toBe(callArgs.createdAt);
    });

    it('addLeave 성공 시 staff_leaves 쿼리를 무효화한다', async () => {
      const mockSnapshot = { docs: [] };
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-leave-id' } as any);

      const { result } = renderHook(() => useStaffLeaves(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialCallCount = vi.mocked(getDocs).mock.calls.length;

      const newLeaveData: Omit<StaffLeave, 'id' | 'createdAt'> = {
        staffId: 'staff-003',
        staffName: '이철수',
        type: 'sick',
        startDate: '2026-02-20',
        endDate: '2026-02-20',
        status: 'pending',
      };

      await result.current.addLeave(newLeaveData);

      // Wait for query invalidation to trigger refetch
      await waitFor(() => {
        expect(vi.mocked(getDocs).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it('isAdding 상태가 올바르게 변경된다', async () => {
      const mockSnapshot = { docs: [] };
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

      let resolveAddDoc: (value: any) => void;
      const addDocPromise = new Promise((resolve) => {
        resolveAddDoc = resolve;
      });
      vi.mocked(addDoc).mockReturnValue(addDocPromise as any);

      const { result } = renderHook(() => useStaffLeaves(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isAdding).toBe(false);

      const newLeaveData: Omit<StaffLeave, 'id' | 'createdAt'> = {
        staffId: 'staff-003',
        staffName: '이철수',
        type: 'personal',
        startDate: '2026-02-25',
        endDate: '2026-02-25',
        status: 'pending',
      };

      const addPromise = result.current.addLeave(newLeaveData);

      await waitFor(() => {
        expect(result.current.isAdding).toBe(true);
      });

      resolveAddDoc!({ id: 'new-id' });
      await addPromise;

      await waitFor(() => {
        expect(result.current.isAdding).toBe(false);
      });
    });

    it('addLeave 실패 시 에러를 던진다', async () => {
      const mockSnapshot = { docs: [] };
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);
      vi.mocked(addDoc).mockRejectedValue(new Error('Failed to add leave'));

      const { result } = renderHook(() => useStaffLeaves(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const newLeaveData: Omit<StaffLeave, 'id' | 'createdAt'> = {
        staffId: 'staff-003',
        staffName: '이철수',
        type: 'other',
        startDate: '2026-03-01',
        endDate: '2026-03-01',
        status: 'pending',
      };

      await expect(result.current.addLeave(newLeaveData)).rejects.toThrow('Failed to add leave');
    });
  });

  describe('Mutation - Approve Leave', () => {
    it('approveLeave 호출 시 status를 approved로 updateDoc을 호출한다', async () => {
      const mockSnapshot = { docs: [] };
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useStaffLeaves(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.approveLeave('leave-001');

      expect(doc).toHaveBeenCalledWith(db, COL_STAFF_LEAVES, 'leave-001');
      expect(updateDoc).toHaveBeenCalledTimes(1);
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'approved',
          approvedBy: 'Admin User',
          approvedAt: expect.any(String),
        })
      );

      // Check that approvedAt is a valid ISO string
      const callArgs = vi.mocked(updateDoc).mock.calls[0][1] as any;
      expect(new Date(callArgs.approvedAt).toISOString()).toBe(callArgs.approvedAt);
    });

    it('approvedBy에 displayName을 사용한다', async () => {
      const mockSnapshot = { docs: [] };
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useStaffLeaves(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.approveLeave('leave-002');

      const callArgs = vi.mocked(updateDoc).mock.calls[0][1] as any;
      expect(callArgs.approvedBy).toBe('Admin User');
    });

    it('displayName이 없으면 email을 사용한다', async () => {
      // Temporarily change auth.currentUser
      const originalAuth = auth.currentUser;
      (auth as any).currentUser = { email: 'test@example.com' };

      const mockSnapshot = { docs: [] };
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useStaffLeaves(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.approveLeave('leave-003');

      const callArgs = vi.mocked(updateDoc).mock.calls[0][1] as any;
      expect(callArgs.approvedBy).toBe('test@example.com');

      // Restore original auth
      (auth as any).currentUser = originalAuth;
    });

    it('approveLeave 성공 시 staff_leaves 쿼리를 무효화한다', async () => {
      const mockSnapshot = { docs: [] };
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useStaffLeaves(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialCallCount = vi.mocked(getDocs).mock.calls.length;

      await result.current.approveLeave('leave-001');

      await waitFor(() => {
        expect(vi.mocked(getDocs).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it('isApproving 상태가 올바르게 변경된다', async () => {
      const mockSnapshot = { docs: [] };
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

      let resolveUpdateDoc: (value: any) => void;
      const updateDocPromise = new Promise((resolve) => {
        resolveUpdateDoc = resolve;
      });
      vi.mocked(updateDoc).mockReturnValue(updateDocPromise as any);

      const { result } = renderHook(() => useStaffLeaves(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isApproving).toBe(false);

      const approvePromise = result.current.approveLeave('leave-001');

      await waitFor(() => {
        expect(result.current.isApproving).toBe(true);
      });

      resolveUpdateDoc!(undefined);
      await approvePromise;

      await waitFor(() => {
        expect(result.current.isApproving).toBe(false);
      });
    });
  });

  describe('Mutation - Reject Leave', () => {
    it('rejectLeave 호출 시 status를 rejected로 updateDoc을 호출한다', async () => {
      const mockSnapshot = { docs: [] };
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useStaffLeaves(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.rejectLeave('leave-001');

      expect(doc).toHaveBeenCalledWith(db, COL_STAFF_LEAVES, 'leave-001');
      expect(updateDoc).toHaveBeenCalledTimes(1);
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'rejected',
          approvedBy: 'Admin User',
          approvedAt: expect.any(String),
        })
      );
    });

    it('rejectLeave 성공 시 staff_leaves 쿼리를 무효화한다', async () => {
      const mockSnapshot = { docs: [] };
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useStaffLeaves(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialCallCount = vi.mocked(getDocs).mock.calls.length;

      await result.current.rejectLeave('leave-002');

      await waitFor(() => {
        expect(vi.mocked(getDocs).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it('isRejecting 상태가 올바르게 변경된다', async () => {
      const mockSnapshot = { docs: [] };
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

      let resolveUpdateDoc: (value: any) => void;
      const updateDocPromise = new Promise((resolve) => {
        resolveUpdateDoc = resolve;
      });
      vi.mocked(updateDoc).mockReturnValue(updateDocPromise as any);

      const { result } = renderHook(() => useStaffLeaves(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isRejecting).toBe(false);

      const rejectPromise = result.current.rejectLeave('leave-001');

      await waitFor(() => {
        expect(result.current.isRejecting).toBe(true);
      });

      resolveUpdateDoc!(undefined);
      await rejectPromise;

      await waitFor(() => {
        expect(result.current.isRejecting).toBe(false);
      });
    });
  });

  describe('Mutation - Delete Leave', () => {
    it('deleteLeave 호출 시 deleteDoc을 호출한다', async () => {
      const mockSnapshot = { docs: [] };
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);
      vi.mocked(deleteDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useStaffLeaves(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.deleteLeave('leave-001');

      expect(doc).toHaveBeenCalledWith(db, COL_STAFF_LEAVES, 'leave-001');
      expect(deleteDoc).toHaveBeenCalledTimes(1);
      expect(deleteDoc).toHaveBeenCalledWith(expect.anything());
    });

    it('deleteLeave 성공 시 staff_leaves 쿼리를 무효화한다', async () => {
      const mockSnapshot = { docs: [] };
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);
      vi.mocked(deleteDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useStaffLeaves(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialCallCount = vi.mocked(getDocs).mock.calls.length;

      await result.current.deleteLeave('leave-003');

      await waitFor(() => {
        expect(vi.mocked(getDocs).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it('isDeleting 상태가 올바르게 변경된다', async () => {
      const mockSnapshot = { docs: [] };
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

      let resolveDeleteDoc: (value: any) => void;
      const deleteDocPromise = new Promise((resolve) => {
        resolveDeleteDoc = resolve;
      });
      vi.mocked(deleteDoc).mockReturnValue(deleteDocPromise as any);

      const { result } = renderHook(() => useStaffLeaves(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isDeleting).toBe(false);

      const deletePromise = result.current.deleteLeave('leave-001');

      await waitFor(() => {
        expect(result.current.isDeleting).toBe(true);
      });

      resolveDeleteDoc!(undefined);
      await deletePromise;

      await waitFor(() => {
        expect(result.current.isDeleting).toBe(false);
      });
    });
  });

  describe('RefreshLeaves', () => {
    it('refreshLeaves 호출 시 쿼리를 다시 실행한다', async () => {
      const mockSnapshot = { docs: [] };
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

      const { result } = renderHook(() => useStaffLeaves(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialCallCount = vi.mocked(getDocs).mock.calls.length;

      await result.current.refreshLeaves();

      expect(vi.mocked(getDocs).mock.calls.length).toBeGreaterThan(initialCallCount);
    });

    it('refreshLeaves가 최신 데이터를 반환한다', async () => {
      const initialSnapshot = {
        docs: [
          { id: mockLeave1.id, data: () => mockLeave1 },
        ],
      };

      const updatedSnapshot = {
        docs: [
          { id: mockLeave1.id, data: () => mockLeave1 },
          { id: mockLeave2.id, data: () => mockLeave2 },
        ],
      };

      vi.mocked(getDocs)
        .mockResolvedValueOnce(initialSnapshot as any)
        .mockResolvedValueOnce(updatedSnapshot as any);

      const { result } = renderHook(() => useStaffLeaves(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.leaves).toHaveLength(1);

      await result.current.refreshLeaves();

      await waitFor(() => {
        expect(result.current.leaves).toHaveLength(2);
      });
    });
  });

  describe('Edge Cases', () => {
    it('auth.currentUser가 null일 때 approvedBy를 Unknown으로 설정한다', async () => {
      // Temporarily set currentUser to null
      const originalAuth = auth.currentUser;
      (auth as any).currentUser = null;

      const mockSnapshot = { docs: [] };
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useStaffLeaves(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.approveLeave('leave-001');

      const callArgs = vi.mocked(updateDoc).mock.calls[0][1] as any;
      expect(callArgs.approvedBy).toBe('Unknown');

      // Restore original auth
      (auth as any).currentUser = originalAuth;
    });

    it('여러 mutation을 동시에 실행할 수 있다', async () => {
      const mockSnapshot = { docs: [] };
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-id' } as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      vi.mocked(deleteDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useStaffLeaves(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const newLeaveData: Omit<StaffLeave, 'id' | 'createdAt'> = {
        staffId: 'staff-004',
        staffName: '박민수',
        type: 'annual',
        startDate: '2026-03-01',
        endDate: '2026-03-05',
        status: 'pending',
      };

      // Execute multiple mutations simultaneously
      await Promise.all([
        result.current.addLeave(newLeaveData),
        result.current.approveLeave('leave-001'),
        result.current.deleteLeave('leave-002'),
      ]);

      expect(addDoc).toHaveBeenCalledTimes(1);
      expect(updateDoc).toHaveBeenCalledTimes(1);
      expect(deleteDoc).toHaveBeenCalledTimes(1);
    });

    it('staffId가 변경되면 새로운 쿼리를 실행한다', async () => {
      const allLeavesSnapshot = {
        docs: [
          { id: mockLeave1.id, data: () => mockLeave1 },
          { id: mockLeave2.id, data: () => mockLeave2 },
          { id: mockLeave3.id, data: () => mockLeave3 },
        ],
      };

      const filteredSnapshot = {
        docs: [
          { id: mockLeave1.id, data: () => mockLeave1 },
          { id: mockLeave3.id, data: () => mockLeave3 },
        ],
      };

      vi.mocked(getDocs)
        .mockResolvedValueOnce(allLeavesSnapshot as any)
        .mockResolvedValueOnce(filteredSnapshot as any);

      const { result, rerender } = renderHook(
        ({ staffId }: { staffId?: string }) => useStaffLeaves(staffId),
        {
          wrapper: createWrapper(),
          initialProps: { staffId: undefined },
        }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.leaves).toHaveLength(3);

      // Change staffId
      rerender({ staffId: 'staff-001' });

      await waitFor(() => {
        expect(result.current.leaves).toHaveLength(2);
      });

      expect(where).toHaveBeenCalledWith('staffId', '==', 'staff-001');
    });
  });
});
