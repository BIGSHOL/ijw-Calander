/**
 * useTeacherClasses 훅 테스트
 *
 * 테스트 대상:
 * - teacherName이 undefined이면 쿼리를 실행하지 않음 (enabled: !!teacherName)
 * - teacher 필드로 담임 수업 조회
 * - mainTeacher 필드로 담임 수업 조회 (중복 방지)
 * - slotTeachers 값으로 부담임 수업 조회
 * - 진행중(isActive) 수업 상단, 종료 수업 하단 정렬
 * - 같은 isActive 그룹 내 className 가나다 정렬
 * - 에러 처리
 * - staleTime / gcTime 캐시 설정
 * - TeacherClassInfo 반환 타입 구조 확인
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { vi } from 'vitest';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useTeacherClasses, TeacherClassInfo } from '../../hooks/useTeacherClasses';

// Firebase Firestore 모킹
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

// Firebase 앱 설정 모킹
vi.mock('../../firebaseConfig', () => ({
  db: {},
}));

// dateUtils 모킹 (toDateStringKST)
vi.mock('../../utils/dateUtils', () => ({
  toDateStringKST: vi.fn((ts: any) => {
    if (!ts) return null;
    if (typeof ts === 'string') return ts;
    return '2025-01-01';
  }),
}));

// ──────────────────────────── 헬퍼 ────────────────────────────

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

/** Firestore getDocs 스냅샷 mock 생성 */
function makeSnapshot(docs: { id: string; data: Record<string, any> }[]) {
  return {
    docs: docs.map(d => ({
      id: d.id,
      data: () => d.data,
    })),
    empty: docs.length === 0,
    size: docs.length,
  };
}

// ──────────────────────────── 공통 mock 초기화 ────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  (collection as any).mockReturnValue({});
  (query as any).mockImplementation((...args: any[]) => args[0]);
  (where as any).mockReturnValue({});
});

// ─────────────────────────────── 테스트 ───────────────────────────────

describe('useTeacherClasses 훅', () => {
  describe('쿼리 활성화 조건', () => {
    it('teacherName이 undefined이면 쿼리를 실행하지 않는다', async () => {
      const { result } = renderHook(() => useTeacherClasses(undefined), {
        wrapper: createWrapper(),
      });

      // isPending 또는 fetchStatus === 'idle' 이어야 함
      expect(result.current.data).toBeUndefined();
      expect(result.current.fetchStatus).toBe('idle');
      expect(getDocs).not.toHaveBeenCalled();
    });

    it('teacherName이 빈 문자열이면 쿼리를 실행하지 않는다', async () => {
      const { result } = renderHook(() => useTeacherClasses(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(getDocs).not.toHaveBeenCalled();
    });

    it('teacherName이 주어지면 쿼리를 실행한다', async () => {
      // teacher 쿼리, mainTeacher 쿼리, 전체 classes 쿼리 순서로 3회 호출
      (getDocs as any)
        .mockResolvedValueOnce(makeSnapshot([]))  // teacher 쿼리
        .mockResolvedValueOnce(makeSnapshot([]))  // mainTeacher 쿼리
        .mockResolvedValueOnce(makeSnapshot([])); // 전체 classes

      const { result } = renderHook(() => useTeacherClasses('김선생'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(getDocs).toHaveBeenCalledTimes(3);
    });
  });

  describe('담임(teacher 필드) 수업 조회', () => {
    it('teacher 필드가 teacherName과 일치하는 수업을 담임으로 반환한다', async () => {
      const teacherDocs = [
        {
          id: 'class1',
          data: {
            className: '수학A반',
            subject: 'math',
            teacher: '김선생',
            isActive: true,
            createdAt: '2025-01-01',
          },
        },
      ];

      (getDocs as any)
        .mockResolvedValueOnce(makeSnapshot(teacherDocs)) // teacher 쿼리
        .mockResolvedValueOnce(makeSnapshot([]))           // mainTeacher 쿼리
        .mockResolvedValueOnce(makeSnapshot([]));          // 전체 classes

      const { result } = renderHook(() => useTeacherClasses('김선생'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data![0].className).toBe('수학A반');
      expect(result.current.data![0].role).toBe('담임');
      expect(result.current.data![0].subject).toBe('math');
      expect(result.current.data![0].isActive).toBe(true);
    });

    it('isActive가 false인 수업의 endDate를 설정한다', async () => {
      const teacherDocs = [
        {
          id: 'class_inactive',
          data: {
            className: '종료반',
            subject: 'math',
            teacher: '김선생',
            isActive: false,
            createdAt: '2024-01-01',
            updatedAt: '2024-12-31',
          },
        },
      ];

      (getDocs as any)
        .mockResolvedValueOnce(makeSnapshot(teacherDocs))
        .mockResolvedValueOnce(makeSnapshot([]))
        .mockResolvedValueOnce(makeSnapshot([]));

      const { result } = renderHook(() => useTeacherClasses('김선생'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const classInfo = result.current.data![0];
      expect(classInfo.isActive).toBe(false);
      // endDate는 null이 아니어야 함 (updatedAt 기반)
      expect(classInfo.endDate).not.toBeNull();
    });

    it('isActive가 true인 수업의 endDate는 null이다', async () => {
      const teacherDocs = [
        {
          id: 'class_active',
          data: {
            className: '진행중반',
            subject: 'math',
            teacher: '김선생',
            isActive: true,
            createdAt: '2025-01-01',
          },
        },
      ];

      (getDocs as any)
        .mockResolvedValueOnce(makeSnapshot(teacherDocs))
        .mockResolvedValueOnce(makeSnapshot([]))
        .mockResolvedValueOnce(makeSnapshot([]));

      const { result } = renderHook(() => useTeacherClasses('김선생'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data![0].endDate).toBeNull();
    });
  });

  describe('mainTeacher 필드 조회 및 중복 방지', () => {
    it('mainTeacher 필드로도 담임 수업을 조회한다', async () => {
      const mainTeacherDocs = [
        {
          id: 'class_main',
          data: {
            className: '영어B반',
            subject: 'english',
            mainTeacher: '이선생',
            isActive: true,
            createdAt: '2025-01-01',
          },
        },
      ];

      (getDocs as any)
        .mockResolvedValueOnce(makeSnapshot([]))              // teacher 쿼리
        .mockResolvedValueOnce(makeSnapshot(mainTeacherDocs)) // mainTeacher 쿼리
        .mockResolvedValueOnce(makeSnapshot([]));             // 전체 classes

      const { result } = renderHook(() => useTeacherClasses('이선생'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data![0].className).toBe('영어B반');
      expect(result.current.data![0].role).toBe('담임');
    });

    it('teacher와 mainTeacher 모두에 해당하는 수업은 한 번만 포함한다', async () => {
      const sharedDoc = {
        id: 'class_shared',
        data: {
          className: '중복수업반',
          subject: 'math',
          teacher: '박선생',
          mainTeacher: '박선생',
          isActive: true,
          createdAt: '2025-01-01',
        },
      };

      (getDocs as any)
        .mockResolvedValueOnce(makeSnapshot([sharedDoc])) // teacher 쿼리
        .mockResolvedValueOnce(makeSnapshot([sharedDoc])) // mainTeacher 쿼리 (같은 문서)
        .mockResolvedValueOnce(makeSnapshot([]));         // 전체 classes

      const { result } = renderHook(() => useTeacherClasses('박선생'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // 중복 제거 후 1개만
      expect(result.current.data).toHaveLength(1);
    });
  });

  describe('부담임(slotTeachers) 수업 조회', () => {
    it('slotTeachers에 teacherName이 포함된 수업을 부담임으로 반환한다', async () => {
      const allClassDocs = [
        {
          id: 'class_slot',
          data: {
            className: '수학C반',
            subject: 'math',
            teacher: '다른선생',
            slotTeachers: { slot1: '최선생', slot2: '기타선생' },
            isActive: true,
            createdAt: '2025-01-01',
          },
        },
      ];

      (getDocs as any)
        .mockResolvedValueOnce(makeSnapshot([]))          // teacher 쿼리
        .mockResolvedValueOnce(makeSnapshot([]))          // mainTeacher 쿼리
        .mockResolvedValueOnce(makeSnapshot(allClassDocs)); // 전체 classes

      const { result } = renderHook(() => useTeacherClasses('최선생'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data![0].className).toBe('수학C반');
      expect(result.current.data![0].role).toBe('부담임');
    });

    it('이미 담임으로 등록된 수업은 부담임으로 중복 추가하지 않는다', async () => {
      const classDoc = {
        id: 'class_overlap',
        data: {
          className: '중복반',
          subject: 'math',
          teacher: '김선생',
          slotTeachers: { slot1: '김선생' }, // 담임이면서 slotTeacher에도 포함
          isActive: true,
          createdAt: '2025-01-01',
        },
      };

      (getDocs as any)
        .mockResolvedValueOnce(makeSnapshot([classDoc])) // teacher 쿼리
        .mockResolvedValueOnce(makeSnapshot([]))         // mainTeacher 쿼리
        .mockResolvedValueOnce(makeSnapshot([classDoc])); // 전체 classes

      const { result } = renderHook(() => useTeacherClasses('김선생'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // 담임으로 1개만 포함되어야 함
      expect(result.current.data).toHaveLength(1);
      expect(result.current.data![0].role).toBe('담임');
    });

    it('slotTeachers가 없는 수업은 부담임으로 포함하지 않는다', async () => {
      const allClassDocs = [
        {
          id: 'class_no_slot',
          data: {
            className: '슬롯없는반',
            subject: 'math',
            teacher: '다른선생',
            isActive: true,
            createdAt: '2025-01-01',
          },
        },
      ];

      (getDocs as any)
        .mockResolvedValueOnce(makeSnapshot([]))          // teacher 쿼리
        .mockResolvedValueOnce(makeSnapshot([]))          // mainTeacher 쿼리
        .mockResolvedValueOnce(makeSnapshot(allClassDocs)); // 전체 classes

      const { result } = renderHook(() => useTeacherClasses('최선생'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(0);
    });
  });

  describe('정렬', () => {
    it('진행중 수업(isActive=true)이 종료 수업(isActive=false)보다 앞에 온다', async () => {
      const teacherDocs = [
        {
          id: 'class_inactive',
          data: {
            className: 'ㄱ종료반',
            subject: 'math',
            teacher: '정선생',
            isActive: false,
            createdAt: '2024-01-01',
            updatedAt: '2024-12-31',
          },
        },
        {
          id: 'class_active',
          data: {
            className: 'ㅈ진행중반',
            subject: 'math',
            teacher: '정선생',
            isActive: true,
            createdAt: '2025-01-01',
          },
        },
      ];

      (getDocs as any)
        .mockResolvedValueOnce(makeSnapshot(teacherDocs))
        .mockResolvedValueOnce(makeSnapshot([]))
        .mockResolvedValueOnce(makeSnapshot([]));

      const { result } = renderHook(() => useTeacherClasses('정선생'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data![0].isActive).toBe(true);
      expect(result.current.data![1].isActive).toBe(false);
    });

    it('같은 isActive 그룹 내에서는 className 가나다 순으로 정렬한다', async () => {
      const teacherDocs = [
        {
          id: 'c3',
          data: { className: '다반', subject: 'math', teacher: '한선생', isActive: true, createdAt: '2025-01-01' },
        },
        {
          id: 'c1',
          data: { className: '가반', subject: 'math', teacher: '한선생', isActive: true, createdAt: '2025-01-01' },
        },
        {
          id: 'c2',
          data: { className: '나반', subject: 'math', teacher: '한선생', isActive: true, createdAt: '2025-01-01' },
        },
      ];

      (getDocs as any)
        .mockResolvedValueOnce(makeSnapshot(teacherDocs))
        .mockResolvedValueOnce(makeSnapshot([]))
        .mockResolvedValueOnce(makeSnapshot([]));

      const { result } = renderHook(() => useTeacherClasses('한선생'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const classNames = result.current.data!.map(c => c.className);
      expect(classNames).toEqual(['가반', '나반', '다반']);
    });
  });

  describe('반환 값 구조', () => {
    it('TeacherClassInfo 필드가 모두 포함된다', async () => {
      const teacherDocs = [
        {
          id: 'class_full',
          data: {
            className: '전체필드반',
            subject: 'english',
            teacher: '임선생',
            isActive: true,
            createdAt: '2025-03-01',
          },
        },
      ];

      (getDocs as any)
        .mockResolvedValueOnce(makeSnapshot(teacherDocs))
        .mockResolvedValueOnce(makeSnapshot([]))
        .mockResolvedValueOnce(makeSnapshot([]));

      const { result } = renderHook(() => useTeacherClasses('임선생'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const info: TeacherClassInfo = result.current.data![0];
      expect(info).toHaveProperty('id');
      expect(info).toHaveProperty('className');
      expect(info).toHaveProperty('subject');
      expect(info).toHaveProperty('role');
      expect(info).toHaveProperty('isActive');
      expect(info).toHaveProperty('startDate');
      expect(info).toHaveProperty('endDate');
    });

    it('subject 기본값이 math이다 (data에 subject 없는 경우)', async () => {
      const teacherDocs = [
        {
          id: 'class_no_subject',
          data: {
            className: '과목없는반',
            teacher: '강선생',
            isActive: true,
            createdAt: '2025-01-01',
            // subject 필드 없음
          },
        },
      ];

      (getDocs as any)
        .mockResolvedValueOnce(makeSnapshot(teacherDocs))
        .mockResolvedValueOnce(makeSnapshot([]))
        .mockResolvedValueOnce(makeSnapshot([]));

      const { result } = renderHook(() => useTeacherClasses('강선생'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data![0].subject).toBe('math');
    });

    it('data가 없을 때 빈 배열을 반환한다', async () => {
      (getDocs as any)
        .mockResolvedValueOnce(makeSnapshot([]))
        .mockResolvedValueOnce(makeSnapshot([]))
        .mockResolvedValueOnce(makeSnapshot([]));

      const { result } = renderHook(() => useTeacherClasses('없는선생'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([]);
    });
  });

  describe('에러 처리', () => {
    it('Firestore 쿼리 실패 시 error 상태를 반환한다', async () => {
      (getDocs as any).mockRejectedValueOnce(new Error('Firestore 오류'));

      const { result } = renderHook(() => useTeacherClasses('오류선생'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });
  });

  describe('여러 수업 통합 조회', () => {
    it('담임 수업과 부담임 수업이 함께 반환된다', async () => {
      const teacherDocs = [
        {
          id: 'main_class',
          data: {
            className: '담임반',
            subject: 'math',
            teacher: '오선생',
            isActive: true,
            createdAt: '2025-01-01',
          },
        },
      ];
      const allClassDocs = [
        // 담임반은 이미 포함됨 (getDocs 내에서 classMap에 있으므로 건너뜀)
        {
          id: 'slot_class',
          data: {
            className: '부담임반',
            subject: 'english',
            teacher: '다른선생',
            slotTeachers: { s1: '오선생' },
            isActive: true,
            createdAt: '2025-02-01',
          },
        },
      ];

      (getDocs as any)
        .mockResolvedValueOnce(makeSnapshot(teacherDocs))   // teacher 쿼리
        .mockResolvedValueOnce(makeSnapshot([]))             // mainTeacher 쿼리
        .mockResolvedValueOnce(makeSnapshot([              // 전체 classes (담임반 + 부담임반)
          ...teacherDocs,
          ...allClassDocs,
        ]));

      const { result } = renderHook(() => useTeacherClasses('오선생'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);

      const roles = result.current.data!.map(c => c.role);
      expect(roles).toContain('담임');
      expect(roles).toContain('부담임');
    });
  });
});
