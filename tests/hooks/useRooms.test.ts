import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { useRooms, detectBuilding, detectFloor, needsPrefix, addBuildingPrefix } from '../../hooks/useRooms';
import { createTestQueryClient } from '../utils/testHelpers';
import { QueryClientProvider } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  where: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn(),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../firebaseConfig', () => ({
  db: {},
}));

describe('useRooms Hook', () => {
  const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  const mockRoomDocs = [
    { id: 'room1', data: () => ({ name: '본원201', floor: '2층', capacity: 20, building: '본원', order: 1, isActive: true, preferredSubjects: ['math'] }) },
    { id: 'room2', data: () => ({ name: '본원301', floor: '3층', capacity: 20, building: '본원', order: 2, isActive: true, preferredSubjects: ['english'] }) },
    { id: 'room3', data: () => ({ name: '프리미엄1', floor: '프리미엄관', capacity: 12, building: '프리미엄관', order: 3, isActive: false, preferredSubjects: ['english'] }) },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    (collection as any).mockReturnValue({});
  });

  describe('데이터 조회', () => {
    it('활성 강의실만 반환한다', async () => {
      // Given: rooms 컬렉션에 활성/비활성 강의실이 혼재할 때
      (getDocs as any).mockResolvedValue({ docs: mockRoomDocs });

      // When: 훅이 데이터를 로드하면
      const { result } = renderHook(() => useRooms(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Then: isActive가 false인 강의실은 제외된다
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data!.every(r => r.isActive !== false)).toBe(true);
    });

    it('order 필드 기준으로 오름차순 정렬된다', async () => {
      // Given: 순서가 섞인 강의실 데이터가 있을 때
      const shuffledDocs = [
        { id: 'r2', data: () => ({ name: '본원301', order: 10, isActive: true, preferredSubjects: [] }) },
        { id: 'r1', data: () => ({ name: '본원201', order: 2, isActive: true, preferredSubjects: [] }) },
      ];
      (getDocs as any).mockResolvedValue({ docs: shuffledDocs });

      // When: 훅이 데이터를 로드하면
      const { result } = renderHook(() => useRooms(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Then: order 기준으로 정렬된다
      expect(result.current.data![0].order).toBeLessThan(result.current.data![1].order);
    });

    it('강의실이 없을 때 빈 배열을 반환한다', async () => {
      // Given: 강의실 데이터가 없을 때
      (getDocs as any).mockResolvedValue({ docs: [] });

      // When: 훅이 데이터를 로드하면
      const { result } = renderHook(() => useRooms(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Then: 빈 배열을 반환한다
      expect(result.current.data).toEqual([]);
    });

    it('invalidate 함수를 반환한다', async () => {
      // Given: 훅이 렌더링되면
      (getDocs as any).mockResolvedValue({ docs: [] });
      const { result } = renderHook(() => useRooms(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Then: invalidate 함수가 존재한다
      expect(result.current.invalidate).toBeInstanceOf(Function);
    });
  });

  describe('에러 처리', () => {
    it('Firestore 조회 실패 시 isError가 true가 된다', async () => {
      // Given: getDocs가 실패하도록 설정하면
      (getDocs as any).mockRejectedValue(new Error('Firestore 오류'));

      // When: 훅이 데이터를 로드하면
      const { result } = renderHook(() => useRooms(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Then: 에러 상태가 된다
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useRooms 유틸리티 함수', () => {
  describe('detectBuilding', () => {
    it('프리미엄이 포함된 이름은 프리미엄관으로 분류된다', () => {
      expect(detectBuilding('프리미엄1')).toBe('프리미엄관');
      expect(detectBuilding('LAB')).toBe('프리미엄관');
    });

    it('바른이 포함된 이름은 바른학습관으로 분류된다', () => {
      expect(detectBuilding('바른201')).toBe('바른학습관');
    });

    it('bs가 포함된 이름은 BS관으로 분류된다', () => {
      expect(detectBuilding('BS101')).toBe('BS관');
    });

    it('그 외는 본원으로 분류된다', () => {
      expect(detectBuilding('본원201')).toBe('본원');
      expect(detectBuilding('201')).toBe('본원');
    });
  });

  describe('detectFloor', () => {
    it('200번대 강의실은 2층으로 분류된다', () => {
      expect(detectFloor('본원201')).toBe('2층');
      expect(detectFloor('201')).toBe('2층');
    });

    it('300번대 강의실은 3층으로 분류된다', () => {
      expect(detectFloor('본원301')).toBe('3층');
    });

    it('600번대 강의실은 6층으로 분류된다', () => {
      expect(detectFloor('본원601')).toBe('6층');
    });
  });

  describe('needsPrefix', () => {
    it('본원 접두사가 없는 숫자형 강의실은 true를 반환한다', () => {
      expect(needsPrefix('201')).toBe(true);
    });

    it('이미 본원이 붙은 강의실은 false를 반환한다', () => {
      expect(needsPrefix('본원201')).toBe(false);
    });

    it('프리미엄/바른/bs/lab이 포함된 경우 false를 반환한다', () => {
      expect(needsPrefix('프리미엄1')).toBe(false);
      expect(needsPrefix('바른201')).toBe(false);
      expect(needsPrefix('BS101')).toBe(false);
      expect(needsPrefix('LAB')).toBe(false);
    });

    it('빈 문자열은 false를 반환한다', () => {
      expect(needsPrefix('')).toBe(false);
    });
  });

  describe('addBuildingPrefix', () => {
    it('접두사가 필요한 강의실 이름에 본원을 붙인다', () => {
      expect(addBuildingPrefix('201')).toBe('본원201');
    });

    it('이미 본원이 붙어 있으면 그대로 반환한다', () => {
      expect(addBuildingPrefix('본원201')).toBe('본원201');
    });

    it('빈 문자열은 그대로 반환한다', () => {
      expect(addBuildingPrefix('')).toBe('');
    });
  });
});
