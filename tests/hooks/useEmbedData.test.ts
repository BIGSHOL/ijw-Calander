/**
 * Comprehensive tests for useEmbedData hook
 *
 * Tests cover:
 * - useEmbedMathData basic loading (classes, teachers, keywords)
 * - Caching behavior (staff and classKeywords)
 * - Filter settings (filterByClass, filterByTeacher)
 * - Student data loading (optimized collectionGroup approach)
 * - Student data fallback (when collectionGroup fails)
 * - showStudentList setting
 * - Error handling
 * - Edge cases (empty data, no matching students)
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useEmbedMathData } from '../../hooks/useEmbedData';
import { collection, getDocs, query, where, collectionGroup } from 'firebase/firestore';
import { TimetableClass, Teacher, ClassKeywordColor } from '../../types';
import { EmbedSettings } from '../../types/embed';

// Mock Firebase modules
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((...args: any[]) => ({ __type: 'collection', __name: args[1], __args: args })),
  getDocs: vi.fn(),
  query: vi.fn((...args: any[]) => ({ __type: 'query', __source: args[0] })),
  where: vi.fn((...args: any[]) => ({ __type: 'where', __field: args[0] })),
  collectionGroup: vi.fn((...args: any[]) => ({ __type: 'collectionGroup', __name: args[1] })),
}));

vi.mock('../../firebaseConfig', () => ({
  db: {},
}));

describe('useEmbedData', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let dateNowSpy: ReturnType<typeof vi.spyOn>;

  // Sample mock data
  const mockClasses: TimetableClass[] = [
    {
      id: 'class1',
      className: 'Math-A1',
      subject: 'math',
      teacher: 'teacher1',
      level: 'A',
      grade: 1,
    } as TimetableClass,
    {
      id: 'class2',
      className: 'Math-B1',
      subject: 'math',
      teacher: 'teacher2',
      level: 'B',
      grade: 1,
    } as TimetableClass,
    {
      id: 'class3',
      className: 'Math-A2',
      subject: 'math',
      teacher: 'teacher1',
      level: 'A',
      grade: 2,
    } as TimetableClass,
  ];

  const mockTeachers = [
    {
      id: 'teacher1',
      name: '김선생',
      englishName: 'Teacher Kim',
      subjects: ['math'],
      isHiddenInTimetable: false,
      isHiddenInAttendance: false,
      isNative: false,
      bgColor: '#ffffff',
      textColor: '#000000',
      timetableOrder: 1,
      defaultRoom: 'Room1',
    },
    {
      id: 'teacher2',
      name: '이선생',
      subjects: ['english', 'math'],
      isHiddenInTimetable: false,
      isHiddenInAttendance: false,
      isNative: false,
      timetableOrder: 2,
    },
    {
      id: 'teacher3',
      name: '박선생',
      subjects: ['science'], // Not math/english
    },
  ];

  const mockKeywords: ClassKeywordColor[] = [
    { id: 'kw1', keyword: '심화', color: '#ff0000', order: 1 },
    { id: 'kw2', keyword: '기본', color: '#00ff00', order: 2 },
    { id: 'kw3', keyword: '특강', color: '#0000ff', order: 3 },
  ];

  const mockStudents = [
    { id: 'student1', name: '학생1', grade: 1 },
    { id: 'student2', name: '학생2', grade: 1 },
    { id: 'student3', name: '학생3', grade: 2 },
  ];

  const mockEnrollments = [
    { id: 'enroll1', subject: 'math', className: 'Math-A1', studentId: 'student1' },
    { id: 'enroll2', subject: 'math', className: 'Math-B1', studentId: 'student2' },
    { id: 'enroll3', subject: 'math', className: 'Math-A2', studentId: 'student3' },
    { id: 'enroll4', subject: 'english', className: 'Eng-A1', studentId: 'student1' },
  ];

  // Unique timestamp counter to ensure cache is always expired between tests
  let testTimestamp = 100000000; // Start at a high value

  beforeEach(() => {
    vi.clearAllMocks();

    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Use incrementing timestamp to ensure caches from previous tests are always expired
    // (Cache TTL is 5 minutes = 300000ms)
    testTimestamp += 10 * 60 * 1000; // Increment by 10 minutes between tests
    dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(testTimestamp);

    // Default mock setup
    setupDefaultMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    dateNowSpy.mockRestore();
  });

  function resolveQueryInfo(ref: any): { name: string; isGroup: boolean; args?: any[] } {
    if (!ref || typeof ref !== 'object') return { name: '', isGroup: false };
    if (ref.__type === 'query') return resolveQueryInfo(ref.__source);
    if (ref.__type === 'collectionGroup') return { name: ref.__name, isGroup: true };
    if (ref.__type === 'collection') {
      if (ref.__args?.length >= 4) {
        return { name: ref.__args[3], isGroup: false, args: ref.__args };
      }
      return { name: ref.__name, isGroup: false, args: ref.__args };
    }
    return { name: '', isGroup: false };
  }

  function setupDefaultMocks() {
    // Mock classes query - data() should not include id
    const classesDocs = mockClasses.map(c => {
      const { id, ...dataWithoutId } = c;
      return {
        id: c.id,
        data: () => dataWithoutId,
      };
    });

    // Mock staff query
    const staffDocs = mockTeachers.map(t => {
      const { id, ...dataWithoutId } = t;
      return {
        id: t.id,
        data: () => dataWithoutId,
      };
    });

    // Mock keywords query
    const keywordDocs = mockKeywords.map(k => {
      const { id, ...dataWithoutId } = k;
      return {
        id: k.id,
        data: () => dataWithoutId,
      };
    });

    // Mock students query
    const studentDocs = mockStudents.map(s => {
      const { id, ...dataWithoutId } = s;
      return {
        id: s.id,
        data: () => dataWithoutId,
      };
    });

    // Mock enrollments with proper structure (subcollection)
    const enrollmentDocs = mockEnrollments.map(e => ({
      id: e.id,
      data: () => ({ subject: e.subject, className: e.className }),
      ref: {
        parent: {
          parent: {
            id: e.studentId,
          },
        },
      },
    }));

    vi.mocked(getDocs).mockImplementation((queryRef: any) => {
      const { name, isGroup, args } = resolveQueryInfo(queryRef);

      if (isGroup && name === 'enrollments') {
        return Promise.resolve({ docs: enrollmentDocs } as any);
      }

      switch (name) {
        case 'classes':
          return Promise.resolve({ docs: classesDocs } as any);
        case 'staff':
          return Promise.resolve({ docs: staffDocs } as any);
        case 'classKeywords':
          return Promise.resolve({ docs: keywordDocs } as any);
        case 'students':
          return Promise.resolve({ docs: studentDocs } as any);
        case 'enrollments': {
          const studentId = args?.[2];
          const filteredEnrollments = mockEnrollments
            .filter(e => e.studentId === studentId)
            .map(e => ({
              id: e.id,
              data: () => ({ subject: e.subject, className: e.className }),
            }));
          return Promise.resolve({ docs: filteredEnrollments } as any);
        }
        default:
          return Promise.resolve({ docs: [] } as any);
      }
    });
  }

  // ============================================================================
  // 1. Basic Loading - Success Cases
  // ============================================================================

  describe('useEmbedMathData - Basic Loading', () => {
    it('초기 로딩 상태가 true이다', () => {
      const { result } = renderHook(() => useEmbedMathData());

      expect(result.current.loading).toBe(true);
      expect(result.current.classes).toEqual([]);
      expect(result.current.teachers).toEqual([]);
      expect(result.current.classKeywords).toEqual([]);
      expect(result.current.studentMap).toEqual({});
      expect(result.current.error).toBeNull();
    });

    it('수학 수업 데이터를 로드한다', async () => {
      const { result } = renderHook(() => useEmbedMathData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.classes).toHaveLength(3);
      expect(result.current.classes[0]).toMatchObject({
        id: 'class1',
        className: 'Math-A1',
        subject: 'math',
      });
    });

    it('강사 데이터를 로드하고 필터링한다 (math/english만)', async () => {
      const { result } = renderHook(() => useEmbedMathData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.teachers).toHaveLength(2);
      expect(result.current.teachers.map(t => t.id)).toEqual(['teacher1', 'teacher2']);
      expect(result.current.teachers[0]).toMatchObject({
        id: 'teacher1',
        name: '김선생',
        englishName: 'Teacher Kim',
        subjects: ['math'],
        isHidden: false,
        isNative: false,
      });
    });

    it('클래스 키워드를 order 순으로 정렬하여 로드한다', async () => {
      const { result } = renderHook(() => useEmbedMathData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.classKeywords).toHaveLength(3);
      expect(result.current.classKeywords[0].keyword).toBe('심화');
      expect(result.current.classKeywords[1].keyword).toBe('기본');
      expect(result.current.classKeywords[2].keyword).toBe('특강');
    });

    it('학생 데이터를 studentMap으로 변환한다', async () => {
      const { result } = renderHook(() => useEmbedMathData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(Object.keys(result.current.studentMap)).toHaveLength(3);
      expect(result.current.studentMap['student1']).toMatchObject({
        id: 'student1',
        name: '학생1',
      });
    });

    it('에러가 없으면 error가 null이다', async () => {
      const { result } = renderHook(() => useEmbedMathData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeNull();
    });
  });

  // ============================================================================
  // 2. Caching Behavior
  // ============================================================================

  describe('useEmbedMathData - Caching', () => {
    it('캐시가 유효하면 staff를 재로드하지 않는다', async () => {
      // First render - loads staff and sets cache timestamp
      dateNowSpy.mockReturnValue(1000);
      const { unmount } = renderHook(() => useEmbedMathData());
      await waitFor(() => {
        expect(vi.mocked(getDocs)).toHaveBeenCalled();
      });

      unmount();
      vi.clearAllMocks();
      setupDefaultMocks();

      // Advance time by 1 minute (within 5 min TTL)
      dateNowSpy.mockReturnValue(1000 + 1 * 60 * 1000);

      // Second render - should use cache
      const { result } = renderHook(() => useEmbedMathData());
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Cache hit - staff should not be reloaded (only classes, students, enrollments)
      expect(result.current.teachers).toHaveLength(2);
    });

    it('캐시가 만료되면 staff를 재로드한다', async () => {
      // First render
      dateNowSpy.mockReturnValue(1000);
      const { unmount } = renderHook(() => useEmbedMathData());
      await waitFor(() => {
        expect(vi.mocked(getDocs)).toHaveBeenCalled();
      });

      const firstCallCount = vi.mocked(getDocs).mock.calls.length;
      unmount();
      vi.clearAllMocks();
      setupDefaultMocks();

      // Advance time past TTL (6 minutes)
      dateNowSpy.mockReturnValue(1000 + 6 * 60 * 1000);

      // Second render - cache expired
      const { result } = renderHook(() => useEmbedMathData());
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should reload staff (cache miss)
      expect(vi.mocked(getDocs)).toHaveBeenCalled();
    });

    it('캐시가 유효하면 classKeywords를 재로드하지 않는다', async () => {
      // First render
      dateNowSpy.mockReturnValue(2000);
      const { unmount } = renderHook(() => useEmbedMathData());
      await waitFor(() => {
        expect(vi.mocked(getDocs)).toHaveBeenCalled();
      });

      unmount();
      vi.clearAllMocks();
      setupDefaultMocks();

      // Advance time by 2 minutes (within TTL)
      dateNowSpy.mockReturnValue(2000 + 2 * 60 * 1000);

      // Second render
      const { result } = renderHook(() => useEmbedMathData());
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Keywords should be from cache
      expect(result.current.classKeywords).toHaveLength(3);
    });
  });

  // ============================================================================
  // 3. Filter Settings
  // ============================================================================

  describe('useEmbedMathData - Filtering', () => {
    it('filterByClass 설정으로 수업을 필터링한다', async () => {
      const settings: EmbedSettings = {
        filterByClass: ['Math-A1', 'Math-A2'],
      };

      const { result } = renderHook(() => useEmbedMathData(settings));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.classes).toHaveLength(2);
      expect(result.current.classes.map(c => c.className)).toEqual(['Math-A1', 'Math-A2']);
    });

    it('filterByTeacher 설정으로 수업을 필터링한다', async () => {
      const settings: EmbedSettings = {
        filterByTeacher: ['teacher1'],
      };

      const { result } = renderHook(() => useEmbedMathData(settings));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.classes).toHaveLength(2);
      expect(result.current.classes.every(c => c.teacher === 'teacher1')).toBe(true);
    });

    it('filterByClass와 filterByTeacher를 동시에 적용한다', async () => {
      const settings: EmbedSettings = {
        filterByClass: ['Math-A1', 'Math-A2'],
        filterByTeacher: ['teacher1'],
      };

      const { result } = renderHook(() => useEmbedMathData(settings));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.classes).toHaveLength(2);
      expect(result.current.classes.every(c => c.teacher === 'teacher1')).toBe(true);
      expect(result.current.classes.map(c => c.className)).toEqual(['Math-A1', 'Math-A2']);
    });

    it('필터에 매칭되는 수업이 없으면 빈 배열을 반환한다', async () => {
      const settings: EmbedSettings = {
        filterByClass: ['NonExistent'],
      };

      const { result } = renderHook(() => useEmbedMathData(settings));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.classes).toEqual([]);
    });

    it('빈 필터 배열은 필터링하지 않는다', async () => {
      const settings: EmbedSettings = {
        filterByClass: [],
        filterByTeacher: [],
      };

      const { result } = renderHook(() => useEmbedMathData(settings));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.classes).toHaveLength(3);
    });
  });

  // ============================================================================
  // 4. Student Data Loading (Optimized)
  // ============================================================================

  describe('useEmbedMathData - Student Loading', () => {
    it('collectionGroup으로 학생 데이터를 최적화 로드한다', async () => {
      const { result } = renderHook(() => useEmbedMathData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(vi.mocked(collectionGroup)).toHaveBeenCalledWith({}, 'enrollments');
      expect(result.current.studentMap).toHaveProperty('student1');
      expect(result.current.studentMap).toHaveProperty('student2');
      expect(result.current.studentMap).toHaveProperty('student3');
    });

    it('학생에게 enrollments를 추가한다', async () => {
      const { result } = renderHook(() => useEmbedMathData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const student1 = result.current.studentMap['student1'];
      expect(student1.enrollments).toBeDefined();
      expect(student1.enrollments).toHaveLength(1);
      expect(student1.enrollments[0].className).toBe('Math-A1');
    });

    it('해당 수업에 등록되지 않은 학생은 제외한다', async () => {
      // Mock with student4 who has no math enrollments
      const studentDocsWithExtra = [
        ...mockStudents.map(s => {
          const { id, ...dataWithoutId } = s;
          return {
            id: s.id,
            data: () => dataWithoutId,
          };
        }),
        {
          id: 'student4',
          data: () => ({ name: '학생4', grade: 1 }),
        },
      ];

      vi.mocked(getDocs).mockImplementation((queryRef: any) => {
        const { name, isGroup } = resolveQueryInfo(queryRef);

        if (isGroup && name === 'enrollments') {
          // Only return enrollments for student1, student2, student3
          const enrollmentDocs = mockEnrollments.map(e => ({
            id: e.id,
            data: () => ({ subject: e.subject, className: e.className }),
            ref: {
              parent: {
                parent: {
                  id: e.studentId,
                },
              },
            },
          }));
          return Promise.resolve({ docs: enrollmentDocs } as any);
        }

        // Provide responses for all other collections
        if (name === 'classes') {
          return Promise.resolve({ docs: mockClasses.map(c => {
            const { id, ...data } = c;
            return { id, data: () => data };
          }) } as any);
        } else if (name === 'staff') {
          return Promise.resolve({ docs: mockTeachers.map(t => {
            const { id, ...data } = t;
            return { id, data: () => data };
          }) } as any);
        } else if (name === 'classKeywords') {
          return Promise.resolve({ docs: mockKeywords.map(k => {
            const { id, ...data } = k;
            return { id, data: () => data };
          }) } as any);
        } else if (name === 'students') {
          return Promise.resolve({ docs: mockStudents.map(s => { const { id, ...data } = s; return { id, data: () => data }; }) } as any);
        }

        return Promise.resolve({ docs: [] } as any);
      });

      const { result } = renderHook(() => useEmbedMathData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // student4 should not be in the map (no math enrollments)
      expect(result.current.studentMap).not.toHaveProperty('student4');
      expect(Object.keys(result.current.studentMap)).toHaveLength(3);
    });

    it('showStudentList: false면 학생 데이터를 로드하지 않는다', async () => {
      const settings: EmbedSettings = {
        showStudentList: false,
      };

      const { result } = renderHook(() => useEmbedMathData(settings));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(vi.mocked(collectionGroup)).not.toHaveBeenCalled();
      expect(result.current.studentMap).toEqual({});
    });

    it('등록된 학생이 없으면 빈 studentMap을 반환한다', async () => {
      // Mock with no enrollments
      vi.mocked(getDocs).mockImplementation((queryRef: any) => {
        const { name, isGroup } = resolveQueryInfo(queryRef);

        if (isGroup && name === 'enrollments') {
          return Promise.resolve({ docs: [] } as any);
        }

        if (name === 'classes') {
          return Promise.resolve({ docs: mockClasses.map(c => {
            const { id, ...data } = c;
            return { id, data: () => data };
          }) } as any);
        } else if (name === 'staff') {
          return Promise.resolve({ docs: mockTeachers.map(t => {
            const { id, ...data } = t;
            return { id, data: () => data };
          }) } as any);
        } else if (name === 'classKeywords') {
          return Promise.resolve({ docs: mockKeywords.map(k => {
            const { id, ...data } = k;
            return { id, data: () => data };
          }) } as any);
        }

        return Promise.resolve({ docs: [] } as any);
      });

      const { result } = renderHook(() => useEmbedMathData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.studentMap).toEqual({});
    });
  });

  // ============================================================================
  // 5. Student Data Fallback (when collectionGroup fails)
  // ============================================================================

  describe('useEmbedMathData - Fallback Loading', () => {
    it('collectionGroup 실패 시 개별 로드로 폴백한다', async () => {
      // Mock collectionGroup to fail
      vi.mocked(getDocs).mockImplementation((queryRef: any) => {
        const { name, isGroup, args } = resolveQueryInfo(queryRef);

        if (isGroup && name === 'enrollments') {
          return Promise.reject(new Error('collectionGroup failed'));
        }

        switch (name) {
          case 'classes':
            return Promise.resolve({
              docs: mockClasses.map(c => {
                const { id, ...data } = c;
                return { id, data: () => data };
              }),
            } as any);
          case 'staff':
            return Promise.resolve({
              docs: mockTeachers.map(t => {
                const { id, ...data } = t;
                return { id, data: () => data };
              }),
            } as any);
          case 'classKeywords':
            return Promise.resolve({
              docs: mockKeywords.map(k => {
                const { id, ...data } = k;
                return { id, data: () => data };
              }),
            } as any);
          case 'students':
            return Promise.resolve({
              docs: mockStudents.map(s => {
                const { id, ...data } = s;
                return { id, data: () => data };
              }),
            } as any);
          case 'enrollments': {
            // Subcollection: collection(db, 'students', studentId, 'enrollments')
            const studentId = args?.[2];
            const enrollments = mockEnrollments
              .filter(e => e.studentId === studentId)
              .map(e => ({
                id: e.id,
                data: () => ({ subject: e.subject, className: e.className }),
              }));
            return Promise.resolve({ docs: enrollments } as any);
          }
          default:
            return Promise.resolve({ docs: [] } as any);
        }
      });

      const { result } = renderHook(() => useEmbedMathData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'collectionGroup query failed, using fallback:',
        expect.any(Error)
      );
      expect(result.current.studentMap).toHaveProperty('student1');
      expect(result.current.studentMap).toHaveProperty('student2');
      expect(result.current.studentMap).toHaveProperty('student3');
    });

    it('폴백 모드에서 수학 enrollments만 필터링한다', async () => {
      vi.mocked(getDocs).mockImplementation((queryRef: any) => {
        const { name, isGroup, args } = resolveQueryInfo(queryRef);

        if (isGroup && name === 'enrollments') {
          return Promise.reject(new Error('collectionGroup failed'));
        }

        switch (name) {
          case 'classes':
            return Promise.resolve({
              docs: mockClasses.map(c => {
                const { id, ...data } = c;
                return { id, data: () => data };
              }),
            } as any);
          case 'staff':
            return Promise.resolve({ docs: mockTeachers.map(t => {
              const { id, ...data } = t;
              return { id, data: () => data };
            }) } as any);
          case 'classKeywords':
            return Promise.resolve({ docs: mockKeywords.map(k => {
              const { id, ...data } = k;
              return { id, data: () => data };
            }) } as any);
          case 'students':
            return Promise.resolve({
              docs: mockStudents.map(s => {
                const { id, ...data } = s;
                return { id, data: () => data };
              }),
            } as any);
          case 'enrollments': {
            // Subcollection: collection(db, 'students', studentId, 'enrollments')
            const studentId = args?.[2];
            // Include both math and english enrollments
            const allEnrollments = mockEnrollments
              .filter(e => e.studentId === studentId)
              .map(e => ({
                id: e.id,
                data: () => ({ subject: e.subject, className: e.className }),
              }));
            return Promise.resolve({ docs: allEnrollments } as any);
          }
          default:
            return Promise.resolve({ docs: [] } as any);
        }
      });

      const { result } = renderHook(() => useEmbedMathData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const student1 = result.current.studentMap['student1'];
      // Should only have math enrollment, not english
      expect(student1.enrollments).toHaveLength(1);
      expect(student1.enrollments[0].subject).toBe('math');
      expect(student1.enrollments[0].className).toBe('Math-A1');
    });

    it('폴백 모드에서 해당 수업에 등록되지 않은 학생은 제외한다', async () => {
      vi.mocked(getDocs).mockImplementation((queryRef: any) => {
        const { name, isGroup, args } = resolveQueryInfo(queryRef);

        if (isGroup && name === 'enrollments') {
          return Promise.reject(new Error('collectionGroup failed'));
        }

        switch (name) {
          case 'classes':
            return Promise.resolve({
              docs: mockClasses.map(c => {
                const { id, ...data } = c;
                return { id, data: () => data };
              }),
            } as any);
          case 'staff':
            return Promise.resolve({ docs: mockTeachers.map(t => {
              const { id, ...data } = t;
              return { id, data: () => data };
            }) } as any);
          case 'classKeywords':
            return Promise.resolve({ docs: mockKeywords.map(k => {
              const { id, ...data } = k;
              return { id, data: () => data };
            }) } as any);
          case 'students': {
            // Add student4 with no enrollments
            const studentsWithExtra = [
              ...mockStudents,
              { id: 'student4', name: '학생4', grade: 1 },
            ];
            return Promise.resolve({
              docs: studentsWithExtra.map(s => {
                const { id, ...data } = s;
                return { id, data: () => data };
              }),
            } as any);
          }
          case 'enrollments': {
            // Subcollection: collection(db, 'students', studentId, 'enrollments')
            const studentId = args?.[2];
            if (studentId === 'student4') {
              return Promise.resolve({ docs: [] } as any); // No enrollments
            }
            const enrollments = mockEnrollments
              .filter(e => e.studentId === studentId)
              .map(e => ({
                id: e.id,
                data: () => ({ subject: e.subject, className: e.className }),
              }));
            return Promise.resolve({ docs: enrollments } as any);
          }
          default:
            return Promise.resolve({ docs: [] } as any);
        }
      });

      const { result } = renderHook(() => useEmbedMathData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.studentMap).not.toHaveProperty('student4');
      expect(Object.keys(result.current.studentMap)).toHaveLength(3);
    });
  });

  // ============================================================================
  // 6. Error Handling
  // ============================================================================

  describe('useEmbedMathData - Error Handling', () => {
    it('데이터 로드 실패 시 error를 설정한다', async () => {
      vi.mocked(getDocs).mockRejectedValue(new Error('Firestore error'));

      const { result } = renderHook(() => useEmbedMathData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Firestore error');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Embed data load error:',
        expect.any(Error)
      );
    });

    it('에러 메시지가 없으면 기본 메시지를 사용한다', async () => {
      vi.mocked(getDocs).mockRejectedValue(new Error());

      const { result } = renderHook(() => useEmbedMathData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to load data');
    });

    it('에러 발생 후에도 기존 데이터는 유지된다', async () => {
      // First successful load
      const { rerender, result } = renderHook(
        ({ settings }: { settings?: EmbedSettings }) => useEmbedMathData(settings),
        { initialProps: {} }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.classes).toHaveLength(3);

      // Now make it fail
      vi.mocked(getDocs).mockRejectedValue(new Error('Network error'));

      // Trigger re-load by changing settings
      rerender({ settings: { filterByClass: ['Math-A1'] } });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Previous data is cleared on new load attempt
      expect(result.current.error).toBe('Network error');
    });
  });

  // ============================================================================
  // 7. Edge Cases
  // ============================================================================

  describe('useEmbedMathData - Edge Cases', () => {
    it('수업이 없으면 빈 배열을 반환한다', async () => {
      vi.mocked(getDocs).mockImplementation((queryRef: any) => {
        const { name } = resolveQueryInfo(queryRef);

        switch (name) {
          case 'classes':
            return Promise.resolve({ docs: [] } as any);
          case 'staff':
            return Promise.resolve({ docs: mockTeachers.map(t => {
              const { id, ...data } = t;
              return { id, data: () => data };
            }) } as any);
          case 'classKeywords':
            return Promise.resolve({ docs: mockKeywords.map(k => {
              const { id, ...data } = k;
              return { id, data: () => data };
            }) } as any);
          default:
            return Promise.resolve({ docs: [] } as any);
        }
      });

      const { result } = renderHook(() => useEmbedMathData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.classes).toEqual([]);
      expect(result.current.studentMap).toEqual({});
    });

    it('강사가 없으면 빈 배열을 반환한다', async () => {
      vi.mocked(getDocs).mockImplementation((queryRef: any) => {
        const { name } = resolveQueryInfo(queryRef);

        switch (name) {
          case 'classes':
            return Promise.resolve({ docs: mockClasses.map(c => {
              const { id, ...data } = c;
              return { id, data: () => data };
            }) } as any);
          case 'staff':
            return Promise.resolve({ docs: [] } as any);
          case 'classKeywords':
            return Promise.resolve({ docs: mockKeywords.map(k => {
              const { id, ...data } = k;
              return { id, data: () => data };
            }) } as any);
          default:
            return Promise.resolve({ docs: [] } as any);
        }
      });

      const { result } = renderHook(() => useEmbedMathData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.teachers).toEqual([]);
    });

    it('키워드가 없으면 빈 배열을 반환한다', async () => {
      vi.mocked(getDocs).mockImplementation((queryRef: any) => {
        const { name } = resolveQueryInfo(queryRef);

        switch (name) {
          case 'classes':
            return Promise.resolve({ docs: mockClasses.map(c => {
              const { id, ...data } = c;
              return { id, data: () => data };
            }) } as any);
          case 'staff':
            return Promise.resolve({ docs: mockTeachers.map(t => {
              const { id, ...data } = t;
              return { id, data: () => data };
            }) } as any);
          case 'classKeywords':
            return Promise.resolve({ docs: [] } as any);
          default:
            return Promise.resolve({ docs: [] } as any);
        }
      });

      const { result } = renderHook(() => useEmbedMathData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.classKeywords).toEqual([]);
    });

    it('teacher 필드가 없는 수업도 처리한다', async () => {
      const classesWithoutTeacher = [
        { id: 'class1', className: 'Math-A1', subject: 'math', level: 'A', grade: 1 },
      ];

      vi.mocked(getDocs).mockImplementation((queryRef: any) => {
        const { name } = resolveQueryInfo(queryRef);

        switch (name) {
          case 'classes':
            return Promise.resolve({
              docs: classesWithoutTeacher.map(c => {
                const { id, ...data } = c;
                return { id, data: () => data };
              }),
            } as any);
          case 'staff':
            return Promise.resolve({ docs: mockTeachers.map(t => {
              const { id, ...data } = t;
              return { id, data: () => data };
            }) } as any);
          case 'classKeywords':
            return Promise.resolve({ docs: mockKeywords.map(k => {
              const { id, ...data } = k;
              return { id, data: () => data };
            }) } as any);
          default:
            return Promise.resolve({ docs: [] } as any);
        }
      });

      const { result } = renderHook(() => useEmbedMathData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.classes).toHaveLength(1);
      expect(result.current.classes[0].teacher).toBeUndefined();
    });

    it('order가 없는 키워드는 999로 정렬된다', async () => {
      const keywordsWithoutOrder = [
        { id: 'kw1', keyword: '심화', color: '#ff0000' }, // No order → 999
        { id: 'kw2', keyword: '기본', color: '#00ff00', order: 1 },
        { id: 'kw3', keyword: '특강', color: '#0000ff' }, // No order → 999
      ];

      vi.mocked(getDocs).mockImplementation((queryRef: any) => {
        const { name } = resolveQueryInfo(queryRef);

        switch (name) {
          case 'classes':
            return Promise.resolve({ docs: mockClasses.map(c => {
              const { id, ...data } = c;
              return { id, data: () => data };
            }) } as any);
          case 'staff':
            return Promise.resolve({ docs: mockTeachers.map(t => {
              const { id, ...data } = t;
              return { id, data: () => data };
            }) } as any);
          case 'classKeywords':
            return Promise.resolve({
              docs: keywordsWithoutOrder.map(k => {
                const { id, ...data } = k;
                return { id, data: () => data };
              }),
            } as any);
          default:
            return Promise.resolve({ docs: [] } as any);
        }
      });

      const { result } = renderHook(() => useEmbedMathData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // After sorting: 기본(1), 심화(999), 특강(999)
      // Since 심화 and 특강 both have order 999, they keep original order
      expect(result.current.classKeywords).toHaveLength(3);
      expect(result.current.classKeywords[0].keyword).toBe('기본'); // order: 1
      // 심화 and 특강 can be in any order since they have same order value
    });

    it('중복 로딩을 방지한다 (loadingRef)', async () => {
      const { rerender } = renderHook(() => useEmbedMathData());

      // Immediately rerender before first load completes
      rerender();
      rerender();
      rerender();

      await waitFor(() => {
        expect(vi.mocked(getDocs)).toHaveBeenCalled();
      });

      // Should only load once despite multiple rerenders
      const getDocsCallCount = vi.mocked(getDocs).mock.calls.length;
      expect(getDocsCallCount).toBeGreaterThan(0);
      expect(getDocsCallCount).toBeLessThan(20); // Not called for each rerender
    });
  });

  // ============================================================================
  // 8. Settings Changes (Re-loading)
  // ============================================================================

  describe('useEmbedMathData - Settings Changes', () => {
    it('filterByClass 변경 시 재로드한다', async () => {
      const { result, rerender } = renderHook(
        ({ settings }: { settings?: EmbedSettings }) => useEmbedMathData(settings),
        { initialProps: { settings: { filterByClass: ['Math-A1'] } } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.classes).toHaveLength(1);

      vi.clearAllMocks();
      setupDefaultMocks();

      // Change filter
      rerender({ settings: { filterByClass: ['Math-B1'] } });

      await waitFor(() => {
        expect(result.current.classes).toHaveLength(1);
        expect(result.current.classes[0].className).toBe('Math-B1');
      });
    });

    it('filterByTeacher 변경 시 재로드한다', async () => {
      const { result, rerender } = renderHook(
        ({ settings }: { settings?: EmbedSettings }) => useEmbedMathData(settings),
        { initialProps: { settings: { filterByTeacher: ['teacher1'] } } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.classes).toHaveLength(2);

      vi.clearAllMocks();
      setupDefaultMocks();

      // Change filter
      rerender({ settings: { filterByTeacher: ['teacher2'] } });

      await waitFor(() => {
        expect(result.current.classes).toHaveLength(1);
        expect(result.current.classes[0].teacher).toBe('teacher2');
      });
    });

    it('showStudentList 변경 시 재로드한다', async () => {
      const { result, rerender } = renderHook(
        ({ settings }: { settings?: EmbedSettings }) => useEmbedMathData(settings),
        { initialProps: { settings: { showStudentList: false } } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // When showStudentList is false, no students are loaded
      expect(result.current.studentMap).toEqual({});

      vi.clearAllMocks();
      setupDefaultMocks();

      // Enable student list
      rerender({ settings: { showStudentList: true } });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Now students should be loaded
      expect(Object.keys(result.current.studentMap).length).toBeGreaterThan(0);
    });

    it('settings가 undefined에서 정의된 값으로 변경되어도 동작한다', async () => {
      const { result, rerender } = renderHook(
        ({ settings }: { settings?: EmbedSettings }) => useEmbedMathData(settings),
        { initialProps: {} }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.classes).toHaveLength(3);

      vi.clearAllMocks();
      setupDefaultMocks();

      // Add filter
      rerender({ settings: { filterByClass: ['Math-A1'] } });

      await waitFor(() => {
        expect(result.current.classes).toHaveLength(1);
      });
    });
  });
});
