import { renderHook, act } from '@testing-library/react';
import { useGlobalSearch } from '../../hooks/useGlobalSearch';

// Mock date-fns
vi.mock('date-fns', () => ({
  format: vi.fn((date: any, fmt: string) => '2026-01-15'),
  parseISO: vi.fn((str: string) => new Date(str)),
}));

const mockStudents = [
  { id: 's1', name: '김철수', englishName: 'Chulsoo', school: '대명초', grade: '초3', status: 'active' },
  { id: 's2', name: '이영희', englishName: 'Younghee', school: '경북중', grade: '중1', status: 'active' },
  { id: 's3', name: '박민수', school: '대구고', grade: '고2', status: 'active' },
  { id: 's4', name: '김지훈', status: 'withdrawn' }, // withdrawn, should be excluded
];

const mockEvents = [
  { id: 'e1', title: '수학 기말고사', description: '2학기 기말', startDate: '2026-01-15', endDate: '2026-01-15', departmentId: 'dept1' },
  { id: 'e2', title: '영어 중간고사', startDate: '2026-02-10', endDate: '2026-02-10', departmentId: 'dept1' },
];

const mockDepartments = [
  { id: 'dept1', name: '수학과' },
];

const mockClasses = [
  { id: 'c1', className: '수학 A반', teacher: '김선생', subject: 'math' as const, schedule: [], studentCount: 5 },
  { id: 'c2', className: '영어 B반', teacher: '이선생', subject: 'english' as const, schedule: [], studentCount: 8 },
];

const mockTeachers = [
  { id: 't1', name: '김선생', subjects: ['math'] as any },
  { id: 't2', name: '이선생', subjects: ['english'] as any, defaultRoom: 'Room A' },
];

const createDefaultParams = (overrides: any = {}) => ({
  globalStudents: mockStudents as any,
  events: mockEvents as any,
  departments: mockDepartments as any,
  allClasses: mockClasses as any,
  teachers: mockTeachers as any,
  setAppMode: vi.fn(),
  setStudentFilters: vi.fn(),
  setEditingEvent: vi.fn(),
  setIsEventModalOpen: vi.fn(),
  setIsGlobalSearchOpen: vi.fn(),
  ...overrides,
});

describe('useGlobalSearch', () => {
  describe('handleGlobalSearch', () => {
    it('should search students by name', async () => {
      const { result } = renderHook(() => useGlobalSearch(createDefaultParams()));
      const results = await result.current.handleGlobalSearch('김철수');

      const studentResults = results.filter(r => r.type === 'student');
      expect(studentResults.length).toBe(1);
      expect(studentResults[0].title).toBe('김철수');
      expect(studentResults[0].subtitle).toBe('Chulsoo');
    });

    it('should search students by english name', async () => {
      const { result } = renderHook(() => useGlobalSearch(createDefaultParams()));
      const results = await result.current.handleGlobalSearch('chulsoo');

      const studentResults = results.filter(r => r.type === 'student');
      expect(studentResults.length).toBe(1);
      expect(studentResults[0].title).toBe('김철수');
    });

    it('should search students by school', async () => {
      const { result } = renderHook(() => useGlobalSearch(createDefaultParams()));
      const results = await result.current.handleGlobalSearch('대명');

      const studentResults = results.filter(r => r.type === 'student');
      expect(studentResults.length).toBe(1);
      expect(studentResults[0].title).toBe('김철수');
    });

    it('should exclude withdrawn students', async () => {
      const { result } = renderHook(() => useGlobalSearch(createDefaultParams()));
      const results = await result.current.handleGlobalSearch('김지훈');

      expect(results.filter(r => r.type === 'student').length).toBe(0);
    });

    it('should search events by title', async () => {
      const { result } = renderHook(() => useGlobalSearch(createDefaultParams()));
      const results = await result.current.handleGlobalSearch('기말');

      const eventResults = results.filter(r => r.type === 'event');
      expect(eventResults.length).toBe(1);
      expect(eventResults[0].title).toBe('수학 기말고사');
      expect(eventResults[0].subtitle).toBe('수학과');
    });

    it('should search events by description', async () => {
      const { result } = renderHook(() => useGlobalSearch(createDefaultParams()));
      const results = await result.current.handleGlobalSearch('2학기');

      const eventResults = results.filter(r => r.type === 'event');
      expect(eventResults.length).toBe(1);
    });

    it('should search classes by name', async () => {
      const { result } = renderHook(() => useGlobalSearch(createDefaultParams()));
      const results = await result.current.handleGlobalSearch('수학 A반');

      const classResults = results.filter(r => r.type === 'class');
      expect(classResults.length).toBe(1);
      expect(classResults[0].subtitle).toBe('강사: 김선생');
      expect(classResults[0].metadata).toBe('수학');
    });

    it('should search teachers by name', async () => {
      const { result } = renderHook(() => useGlobalSearch(createDefaultParams()));
      const results = await result.current.handleGlobalSearch('이선생');

      const teacherResults = results.filter(r => r.type === 'teacher');
      expect(teacherResults.length).toBe(1);
      expect(teacherResults[0].subtitle).toBe('영어');
      expect(teacherResults[0].metadata).toBe('Room A');
    });

    it('should limit results to 5 per category', async () => {
      // Create more than 5 students
      const manyStudents = Array.from({ length: 10 }, (_, i) => ({
        id: `s${i}`, name: `김학생${i}`, status: 'active',
      }));

      const { result } = renderHook(() =>
        useGlobalSearch(createDefaultParams({ globalStudents: manyStudents }))
      );
      const results = await result.current.handleGlobalSearch('김학생');

      const studentResults = results.filter(r => r.type === 'student');
      expect(studentResults.length).toBe(5);
    });

    it('should return empty for no matches', async () => {
      const { result } = renderHook(() => useGlobalSearch(createDefaultParams()));
      const results = await result.current.handleGlobalSearch('존재하지않는검색어');
      expect(results.length).toBe(0);
    });
  });

  describe('handleSearchSelect', () => {
    it('should navigate to students tab on student select', () => {
      const setAppMode = vi.fn();
      const setStudentFilters = vi.fn();
      const { result } = renderHook(() =>
        useGlobalSearch(createDefaultParams({ setAppMode, setStudentFilters }))
      );

      act(() => {
        result.current.handleSearchSelect({ id: 's1', type: 'student', title: '김철수' });
      });

      expect(setAppMode).toHaveBeenCalledWith('students');
      expect(setStudentFilters).toHaveBeenCalled();
    });

    it('should navigate to calendar and open event modal on event select', () => {
      const setAppMode = vi.fn();
      const setEditingEvent = vi.fn();
      const setIsEventModalOpen = vi.fn();
      const { result } = renderHook(() =>
        useGlobalSearch(createDefaultParams({ setAppMode, setEditingEvent, setIsEventModalOpen }))
      );

      act(() => {
        result.current.handleSearchSelect({ id: 'e1', type: 'event', title: '수학 기말고사' });
      });

      expect(setAppMode).toHaveBeenCalledWith('calendar');
      expect(setEditingEvent).toHaveBeenCalledWith(mockEvents[0]);
      expect(setIsEventModalOpen).toHaveBeenCalledWith(true);
    });

    it('should navigate to classes tab on class select', () => {
      const setAppMode = vi.fn();
      const { result } = renderHook(() =>
        useGlobalSearch(createDefaultParams({ setAppMode }))
      );

      act(() => {
        result.current.handleSearchSelect({ id: 'c1', type: 'class', title: '수학 A반' });
      });

      expect(setAppMode).toHaveBeenCalledWith('classes');
    });

    it('should navigate to timetable tab on teacher select', () => {
      const setAppMode = vi.fn();
      const { result } = renderHook(() =>
        useGlobalSearch(createDefaultParams({ setAppMode }))
      );

      act(() => {
        result.current.handleSearchSelect({ id: 't1', type: 'teacher', title: '김선생' });
      });

      expect(setAppMode).toHaveBeenCalledWith('timetable');
    });
  });

  describe('Cmd+K shortcut', () => {
    it('should open search on Ctrl+K', () => {
      const setIsGlobalSearchOpen = vi.fn();
      renderHook(() =>
        useGlobalSearch(createDefaultParams({ setIsGlobalSearchOpen }))
      );

      const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
      window.dispatchEvent(event);

      expect(setIsGlobalSearchOpen).toHaveBeenCalledWith(true);
    });

    it('should open search on Meta+K', () => {
      const setIsGlobalSearchOpen = vi.fn();
      renderHook(() =>
        useGlobalSearch(createDefaultParams({ setIsGlobalSearchOpen }))
      );

      const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
      window.dispatchEvent(event);

      expect(setIsGlobalSearchOpen).toHaveBeenCalledWith(true);
    });

    it('should not open search on plain K', () => {
      const setIsGlobalSearchOpen = vi.fn();
      renderHook(() =>
        useGlobalSearch(createDefaultParams({ setIsGlobalSearchOpen }))
      );

      const event = new KeyboardEvent('keydown', { key: 'k' });
      window.dispatchEvent(event);

      expect(setIsGlobalSearchOpen).not.toHaveBeenCalled();
    });
  });
});
