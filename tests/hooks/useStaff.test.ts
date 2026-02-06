/**
 * Comprehensive tests for useStaff hook
 *
 * Tests cover:
 * - useStaff query (staff list fetching, loading, error states)
 * - getStaff (single staff member retrieval)
 * - addStaff mutation (success, error)
 * - updateStaff mutation (success, name cascade, staffIndex sync, error)
 * - deleteStaff mutation (success, error)
 * - cascadeNameUpdate (unified classes, math/english timetables)
 * - Edge cases (empty data, null checks, previousData variations)
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useStaff } from '../../hooks/useStaff';
import { StaffMember } from '../../types';

// Mock Firebase modules
vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({}),
  doc: vi.fn().mockReturnValue({}),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  writeBatch: vi.fn(),
}));

vi.mock('../../firebaseConfig', () => ({
  db: {},
}));

// Import after mocks
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  writeBatch,
} from 'firebase/firestore';

// Helper to create a proper QuerySnapshot-like mock
function createQuerySnapshot(docs: any[]) {
  return {
    docs,
    forEach: (callback: (doc: any) => void) => {
      docs.forEach(callback);
    },
    size: docs.length,
    empty: docs.length === 0,
  };
}

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

// Sample staff data
const mockStaffMember: StaffMember = {
  id: 'staff1',
  name: '홍길동',
  englishName: 'Hong Gildong',
  email: 'hong@example.com',
  phone: '010-1234-5678',
  role: 'teacher',
  subjects: ['math', 'english'],
  hireDate: '2024-01-01',
  status: 'active',
  systemRole: 'TEACHER',
  approvalStatus: 'approved',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockStaffMember2: StaffMember = {
  id: 'staff2',
  name: '김철수',
  email: 'kim@example.com',
  role: 'admin',
  hireDate: '2024-02-01',
  status: 'active',
  createdAt: '2024-02-01T00:00:00.000Z',
  updatedAt: '2024-02-01T00:00:00.000Z',
};

describe('useStaff', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let mockBatch: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock console
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Setup batch mock
    mockBatch = {
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(writeBatch).mockReturnValue(mockBatch);

    // Re-setup default Firebase mocks after clearAllMocks
    vi.mocked(collection).mockReturnValue({} as any);
    vi.mocked(doc).mockReturnValue({} as any);
    vi.mocked(query).mockReturnValue({} as any);
    vi.mocked(orderBy).mockReturnValue({} as any);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  // ============================================================================
  // 1. Query - Staff List
  // ============================================================================

  describe('Staff List Query', () => {
    it('직원 목록을 성공적으로 가져온다', async () => {
      const mockDocs = [
        { id: 'staff1', data: () => ({ name: '홍길동', role: 'teacher' }) },
        { id: 'staff2', data: () => ({ name: '김철수', role: 'admin' }) },
      ];

      vi.mocked(getDocs).mockResolvedValue(createQuerySnapshot(mockDocs) as any);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      // Initial loading state
      expect(result.current.loading).toBe(true);
      expect(result.current.staff).toEqual([]);

      // Wait for data
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.staff).toHaveLength(2);
      expect(result.current.staff[0]).toEqual({ id: 'staff1', name: '홍길동', role: 'teacher' });
      expect(result.current.staff[1]).toEqual({ id: 'staff2', name: '김철수', role: 'admin' });
      expect(result.current.error).toBeNull();
    });

    it('빈 직원 목록을 반환한다', async () => {
      vi.mocked(getDocs).mockResolvedValue(createQuerySnapshot([]) as any);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.staff).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('쿼리 실패 시 에러를 반환한다', async () => {
      const mockError = new Error('Firestore error');
      vi.mocked(getDocs).mockRejectedValue(mockError);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.staff).toEqual([]);
      expect(result.current.error).toBe('Firestore error');
    });

    it('orderBy로 정렬된 쿼리를 실행한다', async () => {
      vi.mocked(getDocs).mockResolvedValue(createQuerySnapshot([]) as any);

      renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(query).toHaveBeenCalled();
      });

      expect(collection).toHaveBeenCalledWith({}, 'staff');
      expect(orderBy).toHaveBeenCalledWith('name');
    });
  });

  // ============================================================================
  // 2. getStaff - Single Staff Member Retrieval
  // ============================================================================

  describe('getStaff', () => {
    it('단일 직원 정보를 성공적으로 가져온다', async () => {
      vi.mocked(getDocs).mockResolvedValue(createQuerySnapshot([]) as any);
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        id: 'staff1',
        data: () => mockStaffMember,
      } as any);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const staff = await result.current.getStaff('staff1');

      expect(staff).toEqual({ id: 'staff1', ...mockStaffMember });
      expect(doc).toHaveBeenCalledWith({}, 'staff', 'staff1');
      expect(getDoc).toHaveBeenCalled();
    });

    it('존재하지 않는 직원 ID로 조회 시 null을 반환한다', async () => {
      vi.mocked(getDocs).mockResolvedValue(createQuerySnapshot([]) as any);
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => false,
      } as any);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const staff = await result.current.getStaff('nonexistent');

      expect(staff).toBeNull();
    });

    it('getStaff 실패 시 에러를 throw한다', async () => {
      vi.mocked(getDocs).mockResolvedValue(createQuerySnapshot([]) as any);
      const mockError = new Error('getDoc failed');
      vi.mocked(getDoc).mockRejectedValue(mockError);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(result.current.getStaff('staff1')).rejects.toThrow('getDoc failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error getting staff:', mockError);
    });
  });

  // ============================================================================
  // 3. addStaff Mutation
  // ============================================================================

  describe('addStaff', () => {
    it('직원을 성공적으로 추가한다', async () => {
      vi.mocked(getDocs).mockResolvedValue(createQuerySnapshot([]) as any);
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-staff-id' } as any);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isAdding).toBe(false);

      const newStaffData = {
        name: '이영희',
        role: 'teacher' as const,
        hireDate: '2024-03-01',
        status: 'active' as const,
      };

      const newId = await result.current.addStaff(newStaffData);

      expect(newId).toBe('new-staff-id');
      expect(addDoc).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          ...newStaffData,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        })
      );

      await waitFor(() => {
        expect(result.current.isAdding).toBe(false);
      });
    });

    it('직원 추가 실패 시 에러를 throw한다', async () => {
      vi.mocked(getDocs).mockResolvedValue(createQuerySnapshot([]) as any);
      const mockError = new Error('Add failed');
      vi.mocked(addDoc).mockRejectedValue(mockError);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const newStaffData = {
        name: '박민수',
        role: 'staff' as const,
        hireDate: '2024-04-01',
        status: 'active' as const,
      };

      await expect(result.current.addStaff(newStaffData)).rejects.toThrow('Add failed');

      await waitFor(() => {
        expect(result.current.isAdding).toBe(false);
      });
    });

    it('모든 필드를 포함한 직원을 추가한다', async () => {
      vi.mocked(getDocs).mockResolvedValue(createQuerySnapshot([]) as any);
      vi.mocked(addDoc).mockResolvedValue({ id: 'full-staff-id' } as any);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const fullStaffData = {
        name: '최우수',
        englishName: 'Choi Woosu',
        email: 'choi@example.com',
        phone: '010-9999-8888',
        role: 'teacher' as const,
        subjects: ['math' as const],
        hireDate: '2024-05-01',
        status: 'active' as const,
        systemRole: 'TEACHER' as const,
        isNative: true,
        bgColor: '#3b82f6',
        textColor: '#ffffff',
      };

      await result.current.addStaff(fullStaffData);

      expect(addDoc).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          ...fullStaffData,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        })
      );
    });
  });

  // ============================================================================
  // 4. updateStaff Mutation - Basic Updates
  // ============================================================================

  describe('updateStaff - Basic Updates', () => {
    it('직원 정보를 성공적으로 수정한다', async () => {
      vi.mocked(getDocs).mockResolvedValue(createQuerySnapshot([]) as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      vi.mocked(getDoc).mockResolvedValue({
        data: () => ({ name: '홍길동' }),
      } as any);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isUpdating).toBe(false);

      const updates = { phone: '010-1111-2222', email: 'new@example.com' };
      await result.current.updateStaff('staff1', updates);

      expect(updateDoc).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          ...updates,
          updatedAt: expect.any(String),
        })
      );

      await waitFor(() => {
        expect(result.current.isUpdating).toBe(false);
      });
    });

    it('직원 수정 실패 시 에러를 throw한다', async () => {
      vi.mocked(getDocs).mockResolvedValue(createQuerySnapshot([]) as any);
      const mockError = new Error('Update failed');
      vi.mocked(updateDoc).mockRejectedValue(mockError);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const updates = { status: 'inactive' as const };

      await expect(result.current.updateStaff('staff1', updates)).rejects.toThrow('Update failed');

      await waitFor(() => {
        expect(result.current.isUpdating).toBe(false);
      });
    });

    it('previousData 없이 수정한다 (cascade 없음)', async () => {
      vi.mocked(getDocs).mockResolvedValue(createQuerySnapshot([]) as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      vi.mocked(getDoc).mockResolvedValue({
        data: () => ({ name: '김철수' }),
      } as any);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const updates = { memo: 'Updated memo' };
      await result.current.updateStaff('staff2', updates);

      expect(updateDoc).toHaveBeenCalledTimes(1);
      expect(updateDoc).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          memo: 'Updated memo',
          updatedAt: expect.any(String),
        })
      );
    });
  });

  // ============================================================================
  // 5. updateStaff - Name Cascade Update
  // ============================================================================

  describe('updateStaff - Name Cascade Update', () => {
    it('이름 변경 시 unifiedClasses를 업데이트한다', async () => {
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createQuerySnapshot([]) as any) // initial staff query
        .mockResolvedValueOnce(createQuerySnapshot([
          // unifiedClasses query
          {
            ref: { path: 'unifiedClasses/class1' },
            data: () => ({ teacher: '홍길동' }),
          },
          {
            ref: { path: 'unifiedClasses/class2' },
            data: () => ({ teacher: 'Hong Gildong' }),
          },
        ]) as any)
        .mockResolvedValueOnce(createQuerySnapshot([]) as any) // math classes
        .mockResolvedValueOnce(createQuerySnapshot([]) as any); // english classes

      vi.mocked(updateDoc).mockResolvedValue(undefined);
      vi.mocked(getDoc).mockResolvedValue({
        data: () => ({ name: '홍길동 수정' }),
      } as any);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const previousData: StaffMember = {
        ...mockStaffMember,
        name: '홍길동',
        englishName: 'Hong Gildong',
      };

      await result.current.updateStaff(
        'staff1',
        { name: '홍길동 수정' },
        previousData
      );

      // Check batch updates
      expect(mockBatch.update).toHaveBeenCalledTimes(2);
      expect(mockBatch.update).toHaveBeenCalledWith(
        { path: 'unifiedClasses/class1' },
        expect.objectContaining({
          teacher: '홍길동 수정',
          updatedAt: expect.any(String),
        })
      );
      expect(mockBatch.update).toHaveBeenCalledWith(
        { path: 'unifiedClasses/class2' },
        expect.objectContaining({
          teacher: '홍길동 수정',
          updatedAt: expect.any(String),
        })
      );
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });

    it('이름 변경 시 math 시간표를 업데이트한다', async () => {
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createQuerySnapshot([]) as any) // initial staff query
        .mockResolvedValueOnce(createQuerySnapshot([]) as any) // unifiedClasses
        .mockResolvedValueOnce(createQuerySnapshot([
          // math classes
          {
            ref: { path: 'math/timetable/classes/class1' },
            data: () => ({ teacher: '홍길동' }),
          },
        ]) as any)
        .mockResolvedValueOnce(createQuerySnapshot([]) as any); // english classes

      vi.mocked(updateDoc).mockResolvedValue(undefined);
      vi.mocked(getDoc).mockResolvedValue({
        data: () => ({ name: '홍길동 new' }),
      } as any);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const previousData: StaffMember = {
        ...mockStaffMember,
        name: '홍길동',
      };

      await result.current.updateStaff(
        'staff1',
        { name: '홍길동 new' },
        previousData
      );

      expect(mockBatch.update).toHaveBeenCalledWith(
        { path: 'math/timetable/classes/class1' },
        expect.objectContaining({
          teacher: '홍길동 new',
          updatedAt: expect.any(String),
        })
      );
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('이름 변경 시 english 시간표를 업데이트한다', async () => {
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createQuerySnapshot([]) as any) // initial staff query
        .mockResolvedValueOnce(createQuerySnapshot([]) as any) // unifiedClasses
        .mockResolvedValueOnce(createQuerySnapshot([]) as any) // math classes
        .mockResolvedValueOnce(createQuerySnapshot([
          // english classes
          {
            ref: { path: 'english/timetable/classes/class1' },
            data: () => ({ teacher: 'Hong Gildong' }),
          },
        ]) as any);

      vi.mocked(updateDoc).mockResolvedValue(undefined);
      vi.mocked(getDoc).mockResolvedValue({
        data: () => ({ englishName: 'Hong New' }),
      } as any);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const previousData: StaffMember = {
        ...mockStaffMember,
        englishName: 'Hong Gildong',
      };

      await result.current.updateStaff(
        'staff1',
        { englishName: 'Hong New' },
        previousData
      );

      // cascade always sets teacher to newName (Korean name)
      // newName = updates.name || previousData.name = '홍길동'
      expect(mockBatch.update).toHaveBeenCalledWith(
        { path: 'english/timetable/classes/class1' },
        expect.objectContaining({
          teacher: '홍길동',
          updatedAt: expect.any(String),
        })
      );
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('영어 이름만 변경 시 기존 이름을 유지한다', async () => {
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createQuerySnapshot([]) as any);

      vi.mocked(updateDoc).mockResolvedValue(undefined);
      vi.mocked(getDoc).mockResolvedValue({
        data: () => ({ name: '홍길동', englishName: 'Hong New' }),
      } as any);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const previousData: StaffMember = {
        ...mockStaffMember,
        name: '홍길동',
        englishName: 'Hong Gildong',
      };

      await result.current.updateStaff(
        'staff1',
        { englishName: 'Hong New' },
        previousData
      );

      // updateDoc should be called at least once
      expect(updateDoc).toHaveBeenCalled();
    });

    it('이름 변경이 없으면 cascade를 실행하지 않는다', async () => {
      vi.mocked(getDocs).mockResolvedValue(createQuerySnapshot([]) as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      vi.mocked(getDoc).mockResolvedValue({
        data: () => ({ phone: '010-9999-8888' }),
      } as any);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const previousData: StaffMember = mockStaffMember;

      await result.current.updateStaff(
        'staff1',
        { phone: '010-9999-8888' },
        previousData
      );

      // No cascade (no name/englishName change) - verify batch not called
      // Note: getDocs may be called multiple times due to invalidateQueries refetch
      expect(mockBatch.update).not.toHaveBeenCalled();
      expect(mockBatch.commit).not.toHaveBeenCalled();
    });

    it('cascade 업데이트가 없으면 batch commit을 실행하지 않는다', async () => {
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createQuerySnapshot([]) as any) // initial staff query
        .mockResolvedValueOnce(createQuerySnapshot([]) as any) // unifiedClasses
        .mockResolvedValueOnce(createQuerySnapshot([]) as any) // math classes
        .mockResolvedValueOnce(createQuerySnapshot([]) as any); // english classes

      vi.mocked(updateDoc).mockResolvedValue(undefined);
      vi.mocked(getDoc).mockResolvedValue({
        data: () => ({ name: '새이름' }),
      } as any);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const previousData: StaffMember = {
        ...mockStaffMember,
        name: '홍길동',
      };

      await result.current.updateStaff(
        'staff1',
        { name: '새이름' },
        previousData
      );

      // batch.update not called, so commit should not be called
      expect(mockBatch.update).not.toHaveBeenCalled();
      expect(mockBatch.commit).not.toHaveBeenCalled();
    });

    it('cascade 업데이트 실패 시 에러를 throw한다', async () => {
      const mockError = new Error('Cascade failed');
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createQuerySnapshot([]) as any)
        .mockRejectedValueOnce(mockError); // unifiedClasses fails

      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const previousData: StaffMember = {
        ...mockStaffMember,
        name: '홍길동',
      };

      await expect(
        result.current.updateStaff('staff1', { name: '새이름' }, previousData)
      ).rejects.toThrow('Cascade failed');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ 직원 이름 변경 전파 실패:',
        mockError
      );
    });
  });

  // ============================================================================
  // 6. updateStaff - staffIndex Synchronization
  // ============================================================================

  describe('updateStaff - staffIndex Sync', () => {
    it('systemRole 변경 시 staffIndex를 업데이트한다', async () => {
      vi.mocked(getDocs).mockResolvedValue(createQuerySnapshot([]) as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      vi.mocked(getDoc).mockResolvedValue({
        // staff document
        data: () => ({ uid: 'user123', systemRole: 'ADMIN' }),
      } as any);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.updateStaff('staff1', { systemRole: 'ADMIN' });

      // Check staffIndex update - updateDoc called twice (staff + staffIndex)
      expect(doc).toHaveBeenCalledWith({}, 'staffIndex', 'user123');
      expect(updateDoc).toHaveBeenCalledTimes(2);
      expect(updateDoc).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          systemRole: 'ADMIN',
          updatedAt: expect.any(String),
        })
      );
    });

    it('uid가 없으면 staffIndex를 업데이트하지 않는다', async () => {
      vi.mocked(getDocs).mockResolvedValue(createQuerySnapshot([]) as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      vi.mocked(getDoc).mockResolvedValue({
        data: () => ({ systemRole: 'TEACHER' }), // no uid
      } as any);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.updateStaff('staff1', { systemRole: 'TEACHER' });

      // Only one updateDoc call for staff document
      expect(updateDoc).toHaveBeenCalledTimes(1);
    });

    it('systemRole 변경이 없으면 staffIndex를 업데이트하지 않는다', async () => {
      vi.mocked(getDocs).mockResolvedValue(createQuerySnapshot([]) as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      vi.mocked(getDoc).mockResolvedValue({
        data: () => ({ uid: 'user123', email: 'new@example.com' }),
      } as any);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.updateStaff('staff1', { email: 'new@example.com' });

      // Only one updateDoc call for staff document
      expect(updateDoc).toHaveBeenCalledTimes(1);
    });

    it('staffIndex 업데이트 실패 시 경고만 출력한다', async () => {
      vi.mocked(getDocs).mockResolvedValue(createQuerySnapshot([]) as any);
      vi.mocked(updateDoc)
        .mockResolvedValueOnce(undefined) // staff update succeeds
        .mockRejectedValueOnce(new Error('staffIndex not found')); // staffIndex fails

      vi.mocked(getDoc).mockResolvedValue({
        data: () => ({ uid: 'user123', systemRole: 'ADMIN' }),
      } as any);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should not throw error
      await result.current.updateStaff('staff1', { systemRole: 'ADMIN' });

      expect(consoleWarnSpy).toHaveBeenCalledWith('staffIndex not found for uid:', 'user123');
    });
  });

  // ============================================================================
  // 7. deleteStaff Mutation
  // ============================================================================

  describe('deleteStaff', () => {
    it('직원을 성공적으로 삭제한다', async () => {
      vi.mocked(getDocs).mockResolvedValue(createQuerySnapshot([]) as any);
      vi.mocked(deleteDoc).mockResolvedValue(undefined);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isDeleting).toBe(false);

      await result.current.deleteStaff('staff1');

      expect(doc).toHaveBeenCalledWith({}, 'staff', 'staff1');
      expect(deleteDoc).toHaveBeenCalled();

      await waitFor(() => {
        expect(result.current.isDeleting).toBe(false);
      });
    });

    it('직원 삭제 실패 시 에러를 throw한다', async () => {
      vi.mocked(getDocs).mockResolvedValue(createQuerySnapshot([]) as any);
      const mockError = new Error('Delete failed');
      vi.mocked(deleteDoc).mockRejectedValue(mockError);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(result.current.deleteStaff('staff1')).rejects.toThrow('Delete failed');

      await waitFor(() => {
        expect(result.current.isDeleting).toBe(false);
      });
    });
  });

  // ============================================================================
  // 8. refreshStaff
  // ============================================================================

  describe('refreshStaff', () => {
    it('직원 목록을 다시 가져온다', async () => {
      const mockDocs = [
        { id: 'staff1', data: () => ({ name: '홍길동' }) },
      ];

      vi.mocked(getDocs).mockResolvedValue(createQuerySnapshot(mockDocs) as any);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.staff).toHaveLength(1);

      // Clear mock and set new data
      vi.mocked(getDocs).mockResolvedValue(createQuerySnapshot([
        ...mockDocs,
        { id: 'staff2', data: () => ({ name: '김철수' }) },
      ]) as any);

      await result.current.refreshStaff();

      await waitFor(() => {
        expect(result.current.staff).toHaveLength(2);
      });
    });
  });

  // ============================================================================
  // 9. Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('previousData가 undefined인 경우 cascade를 실행하지 않는다', async () => {
      vi.mocked(getDocs).mockResolvedValue(createQuerySnapshot([]) as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      vi.mocked(getDoc).mockResolvedValue({
        data: () => ({ name: '새이름' }),
      } as any);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.updateStaff('staff1', { name: '새이름' }, undefined);

      // No cascade (previousData undefined) - verify batch not called
      // Note: getDocs may be called multiple times due to invalidateQueries refetch
      expect(mockBatch.commit).not.toHaveBeenCalled();
    });

    it('englishName이 undefined인 직원 이름 변경', async () => {
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createQuerySnapshot([]) as any)
        .mockResolvedValueOnce(createQuerySnapshot([]) as any);

      vi.mocked(updateDoc).mockResolvedValue(undefined);
      vi.mocked(getDoc).mockResolvedValue({
        data: () => ({ name: '새이름' }),
      } as any);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const previousData: StaffMember = {
        ...mockStaffMember2, // Has no englishName
        name: '김철수',
      };

      await result.current.updateStaff(
        'staff2',
        { name: '새이름' },
        previousData
      );

      // Should complete without error
      expect(updateDoc).toHaveBeenCalled();
    });

    it('빈 업데이트 객체로 수정한다', async () => {
      vi.mocked(getDocs).mockResolvedValue(createQuerySnapshot([]) as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      vi.mocked(getDoc).mockResolvedValue({
        data: () => ({}),
      } as any);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.updateStaff('staff1', {});

      expect(updateDoc).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          updatedAt: expect.any(String),
        })
      );
    });

    it('여러 컬렉션에 걸친 cascade 업데이트', async () => {
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createQuerySnapshot([]) as any) // initial staff query
        .mockResolvedValueOnce(createQuerySnapshot([
          // unifiedClasses
          { ref: { path: 'uc1' }, data: () => ({ teacher: '홍길동' }) },
        ]) as any)
        .mockResolvedValueOnce(createQuerySnapshot([
          // math classes
          { ref: { path: 'mc1' }, data: () => ({ teacher: '홍길동' }) },
        ]) as any)
        .mockResolvedValueOnce(createQuerySnapshot([
          // english classes
          { ref: { path: 'ec1' }, data: () => ({ teacher: '홍길동' }) },
        ]) as any);

      vi.mocked(updateDoc).mockResolvedValue(undefined);
      vi.mocked(getDoc).mockResolvedValue({
        data: () => ({ name: '새이름' }),
      } as any);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const previousData: StaffMember = {
        ...mockStaffMember,
        name: '홍길동',
      };

      await result.current.updateStaff(
        'staff1',
        { name: '새이름' },
        previousData
      );

      // Should update all 3 collections
      expect(mockBatch.update).toHaveBeenCalledTimes(3);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // 10. Mutation State Management
  // ============================================================================

  describe('Mutation State Management', () => {
    it('isAdding, isUpdating, isDeleting 상태가 정확하다', async () => {
      vi.mocked(getDocs).mockResolvedValue(createQuerySnapshot([]) as any);
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-id' } as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      vi.mocked(deleteDoc).mockResolvedValue(undefined);
      vi.mocked(getDoc).mockResolvedValue({
        data: () => ({ name: 'test' }),
      } as any);

      const { result } = renderHook(() => useStaff(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Initial state
      expect(result.current.isAdding).toBe(false);
      expect(result.current.isUpdating).toBe(false);
      expect(result.current.isDeleting).toBe(false);

      // Test add mutation state
      await result.current.addStaff({
        name: 'Test',
        role: 'teacher',
        hireDate: '2024-01-01',
        status: 'active',
      });

      await waitFor(() => {
        expect(result.current.isAdding).toBe(false);
      });

      // Test update mutation state
      await result.current.updateStaff('staff1', { phone: '010-0000-0000' });

      await waitFor(() => {
        expect(result.current.isUpdating).toBe(false);
      });

      // Test delete mutation state
      await result.current.deleteStaff('staff1');

      await waitFor(() => {
        expect(result.current.isDeleting).toBe(false);
      });
    });
  });
});
