import { renderHook, act } from '@testing-library/react';
import { storage as mockedStorageImport } from '../../utils/localStorage';
import {
  useCalendarState,
  useEventModalState,
  useModalState,
  useTimetableState,
  useStudentFilterState,
  useGradesFilterState,
  useDarkMode,
  usePendingEventMoves,
  ViewMode,
} from '../../hooks/useAppState';
import { CalendarEvent } from '../../types';

// Mock localStorage utility
vi.mock('../../utils/localStorage', () => ({
  storage: {
    getString: vi.fn(() => null),
    setString: vi.fn(),
    getJSON: vi.fn(() => []),
    setJSON: vi.fn(),
    getBoolean: vi.fn(() => false),
    setBoolean: vi.fn(),
    remove: vi.fn(),
  },
  STORAGE_KEYS: {
    CALENDAR_VIEW_MODE: 'calendar_view_mode',
    CALENDAR_VIEW_COLUMNS: 'calendar_view_columns',
    DEPT_HIDDEN_IDS: 'dept_hidden_ids',
    DARK_MODE: 'dark_mode',
  },
}));

// Mock usePermissions
vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    hasPermission: vi.fn(() => true),
  }),
}));

// Mock useRoleSimulation
vi.mock('../../hooks/useRoleSimulation', () => ({
  useRoleSimulation: () => ({
    simulatedRole: null,
    simulatedUserProfile: null,
    simulationType: null,
    isSimulating: false,
  }),
  getEffectiveRole: (actual: any) => actual,
  getEffectiveUserProfile: (actual: any) => actual,
}));

describe('useCalendarState Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('initializes with default values', () => {
    const { result } = renderHook(() => useCalendarState());

    expect(result.current.baseDate).toBeInstanceOf(Date);
    expect(result.current.viewMode).toBe('yearly');
    expect(result.current.viewColumns).toBe(2);
    expect(result.current.selectedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.current.selectedEndDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.current.selectedDeptId).toBe('');
    expect(result.current.showArchived).toBe(false);
    expect(result.current.selectedCategory).toBeNull();
    expect(result.current.showFavoritesOnly).toBe(false);
    expect(result.current.isFilterOpen).toBe(false);
    expect(result.current.hiddenDeptIds).toEqual([]);
  });

  it('loads viewMode from storage', () => {
    const storage = vi.mocked(mockedStorageImport);
    storage.getString.mockReturnValueOnce('monthly');

    const { result } = renderHook(() => useCalendarState());

    expect(result.current.viewMode).toBe('monthly');
  });

  it('loads viewColumns from storage', () => {
    const storage = vi.mocked(mockedStorageImport);
    storage.getString.mockReturnValueOnce('monthly'); // viewMode (non-yearly to allow 3 columns)
    storage.getString.mockReturnValueOnce('3'); // viewColumns

    const { result } = renderHook(() => useCalendarState());

    expect(result.current.viewColumns).toBe(3);
  });

  it('migrates old localStorage keys for viewMode', () => {
    const storage = vi.mocked(mockedStorageImport);
    storage.getString.mockReturnValueOnce(null);
    // Set old localStorage key for migration
    localStorage.setItem('calendar_view_mode', 'weekly');

    const { result } = renderHook(() => useCalendarState());

    expect(result.current.viewMode).toBe('weekly');
    expect(storage.setString).toHaveBeenCalledWith('calendar_view_mode', 'weekly');
    expect(localStorage.getItem('calendar_view_mode')).toBeNull();
  });

  it('migrates old localStorage keys for viewColumns', () => {
    const storage = vi.mocked(mockedStorageImport);
    storage.getString
      .mockReturnValueOnce(null) // viewMode
      .mockReturnValueOnce(null); // viewColumns
    // Set old localStorage key for migration
    localStorage.setItem('calendar_view_columns', '1');

    const { result } = renderHook(() => useCalendarState());

    expect(result.current.viewColumns).toBe(1);
    expect(storage.setString).toHaveBeenCalledWith('calendar_view_columns', '1');
    expect(localStorage.getItem('calendar_view_columns')).toBeNull();
  });

  it('loads hiddenDeptIds from storage', () => {
    const storage = vi.mocked(mockedStorageImport);
    storage.getJSON.mockReturnValueOnce(['dept1', 'dept2']);

    const { result } = renderHook(() => useCalendarState());

    expect(result.current.hiddenDeptIds).toEqual(['dept1', 'dept2']);
  });

  it('migrates old localStorage keys for hiddenDeptIds', () => {
    const storage = vi.mocked(mockedStorageImport);
    storage.getJSON.mockReturnValueOnce([]);
    // Set old localStorage key for migration
    localStorage.setItem('dept_hidden_ids', '["dept3","dept4"]');

    const { result } = renderHook(() => useCalendarState());

    expect(result.current.hiddenDeptIds).toEqual(['dept3', 'dept4']);
    expect(storage.setJSON).toHaveBeenCalledWith('dept_hidden_ids', ['dept3', 'dept4']);
    expect(localStorage.getItem('dept_hidden_ids')).toBeNull();
  });

  it('persists viewMode changes to storage', () => {
    const storage = vi.mocked(mockedStorageImport);
    const { result } = renderHook(() => useCalendarState());

    act(() => {
      result.current.setViewMode('daily');
    });

    expect(storage.setString).toHaveBeenCalledWith('calendar_view_mode', 'daily');
  });

  it('persists viewColumns changes to storage', () => {
    const storage = vi.mocked(mockedStorageImport);
    const { result } = renderHook(() => useCalendarState());

    act(() => {
      result.current.setViewColumns(3);
    });

    expect(storage.setString).toHaveBeenCalledWith('calendar_view_columns', '3');
  });

  it('auto-corrects viewColumns from 3 to 2 when viewMode is yearly', () => {
    const storage = vi.mocked(mockedStorageImport);
    storage.getString
      .mockReturnValueOnce('yearly') // viewMode
      .mockReturnValueOnce('3'); // viewColumns

    const { result } = renderHook(() => useCalendarState());

    // Should auto-correct to 2
    expect(result.current.viewColumns).toBe(2);
  });

  it('updates and persists hiddenDeptIds', () => {
    const storage = vi.mocked(mockedStorageImport);
    const { result } = renderHook(() => useCalendarState());

    act(() => {
      result.current.setHiddenDeptIds(['dept1', 'dept2']);
    });

    expect(result.current.hiddenDeptIds).toEqual(['dept1', 'dept2']);
    expect(storage.setJSON).toHaveBeenCalledWith('dept_hidden_ids', ['dept1', 'dept2']);
  });

  it('updates baseDate', () => {
    const { result } = renderHook(() => useCalendarState());
    const newDate = new Date('2025-01-01');

    act(() => {
      result.current.setBaseDate(newDate);
    });

    expect(result.current.baseDate).toEqual(newDate);
  });

  it('updates selectedDate and selectedEndDate', () => {
    const { result } = renderHook(() => useCalendarState());

    act(() => {
      result.current.setSelectedDate('2025-06-15');
      result.current.setSelectedEndDate('2025-06-20');
    });

    expect(result.current.selectedDate).toBe('2025-06-15');
    expect(result.current.selectedEndDate).toBe('2025-06-20');
  });

  it('updates filter states', () => {
    const { result } = renderHook(() => useCalendarState());

    act(() => {
      result.current.setShowArchived(true);
      result.current.setSelectedCategory('category1');
      result.current.setShowFavoritesOnly(true);
      result.current.setIsFilterOpen(true);
    });

    expect(result.current.showArchived).toBe(true);
    expect(result.current.selectedCategory).toBe('category1');
    expect(result.current.showFavoritesOnly).toBe(true);
    expect(result.current.isFilterOpen).toBe(true);
  });
});

describe('useEventModalState Hook', () => {
  it('initializes with closed state', () => {
    const { result } = renderHook(() => useEventModalState());

    expect(result.current.isEventModalOpen).toBe(false);
    expect(result.current.editingEvent).toBeNull();
    expect(result.current.templateEvent).toBeNull();
    expect(result.current.initialStartTime).toBe('');
    expect(result.current.initialEndTime).toBe('');
    expect(result.current.initialTitle).toBe('');
    expect(result.current.pendingBucketId).toBeNull();
  });

  it('opens modal with no options', () => {
    const { result } = renderHook(() => useEventModalState());

    act(() => {
      result.current.openEventModal();
    });

    expect(result.current.isEventModalOpen).toBe(true);
  });

  it('opens modal with event option', () => {
    const { result } = renderHook(() => useEventModalState());
    const mockEvent: CalendarEvent = {
      id: 'event1',
      title: 'Test Event',
      start: '2025-01-01',
      end: '2025-01-01',
      deptId: 'dept1',
    } as CalendarEvent;

    act(() => {
      result.current.openEventModal({ event: mockEvent });
    });

    expect(result.current.isEventModalOpen).toBe(true);
    expect(result.current.editingEvent).toEqual(mockEvent);
  });

  it('opens modal with template option', () => {
    const { result } = renderHook(() => useEventModalState());
    const mockTemplate: CalendarEvent = {
      id: 'template1',
      title: 'Template Event',
      start: '2025-01-01',
      end: '2025-01-01',
      deptId: 'dept1',
    } as CalendarEvent;

    act(() => {
      result.current.openEventModal({ template: mockTemplate });
    });

    expect(result.current.isEventModalOpen).toBe(true);
    expect(result.current.templateEvent).toEqual(mockTemplate);
  });

  it('opens modal with time and title options', () => {
    const { result } = renderHook(() => useEventModalState());

    act(() => {
      result.current.openEventModal({
        startTime: '09:00',
        endTime: '10:00',
        title: 'New Event',
      });
    });

    expect(result.current.isEventModalOpen).toBe(true);
    expect(result.current.initialStartTime).toBe('09:00');
    expect(result.current.initialEndTime).toBe('10:00');
    expect(result.current.initialTitle).toBe('New Event');
  });

  it('opens modal with bucketId option', () => {
    const { result } = renderHook(() => useEventModalState());

    act(() => {
      result.current.openEventModal({ bucketId: 'bucket1' });
    });

    expect(result.current.isEventModalOpen).toBe(true);
    expect(result.current.pendingBucketId).toBe('bucket1');
  });

  it('closes modal and resets all state', () => {
    const { result } = renderHook(() => useEventModalState());
    const mockEvent: CalendarEvent = {
      id: 'event1',
      title: 'Test Event',
      start: '2025-01-01',
      end: '2025-01-01',
      deptId: 'dept1',
    } as CalendarEvent;

    act(() => {
      result.current.openEventModal({
        event: mockEvent,
        startTime: '09:00',
        endTime: '10:00',
        title: 'Test',
        bucketId: 'bucket1',
      });
    });

    act(() => {
      result.current.closeEventModal();
    });

    expect(result.current.isEventModalOpen).toBe(false);
    expect(result.current.editingEvent).toBeNull();
    expect(result.current.templateEvent).toBeNull();
    expect(result.current.initialStartTime).toBe('');
    expect(result.current.initialEndTime).toBe('');
    expect(result.current.initialTitle).toBe('');
    expect(result.current.pendingBucketId).toBeNull();
  });

  it('allows manual state setters', () => {
    const { result } = renderHook(() => useEventModalState());
    const mockEvent: CalendarEvent = {
      id: 'event1',
      title: 'Test Event',
      start: '2025-01-01',
      end: '2025-01-01',
      deptId: 'dept1',
    } as CalendarEvent;

    act(() => {
      result.current.setIsEventModalOpen(true);
      result.current.setEditingEvent(mockEvent);
      result.current.setInitialStartTime('14:00');
      result.current.setInitialEndTime('15:00');
      result.current.setInitialTitle('Manual Title');
      result.current.setPendingBucketId('bucket2');
    });

    expect(result.current.isEventModalOpen).toBe(true);
    expect(result.current.editingEvent).toEqual(mockEvent);
    expect(result.current.initialStartTime).toBe('14:00');
    expect(result.current.initialEndTime).toBe('15:00');
    expect(result.current.initialTitle).toBe('Manual Title');
    expect(result.current.pendingBucketId).toBe('bucket2');
  });
});

describe('useModalState Hook', () => {
  it('initializes all modals as closed', () => {
    const { result } = renderHook(() => useModalState());

    expect(result.current.isSettingsOpen).toBe(false);
    expect(result.current.isTimetableSettingsOpen).toBe(false);
    expect(result.current.isCalendarSettingsOpen).toBe(false);
    expect(result.current.isLoginModalOpen).toBe(false);
    expect(result.current.isProfileMenuOpen).toBe(false);
    expect(result.current.isPermissionViewOpen).toBe(false);
    expect(result.current.isGlobalSearchOpen).toBe(false);
    expect(result.current.isAttendanceAddStudentModalOpen).toBe(false);
  });

  it('opens and closes settings modal', () => {
    const { result } = renderHook(() => useModalState());

    act(() => {
      result.current.setIsSettingsOpen(true);
    });

    expect(result.current.isSettingsOpen).toBe(true);

    act(() => {
      result.current.setIsSettingsOpen(false);
    });

    expect(result.current.isSettingsOpen).toBe(false);
  });

  it('opens and closes all modals independently', () => {
    const { result } = renderHook(() => useModalState());

    act(() => {
      result.current.setIsTimetableSettingsOpen(true);
      result.current.setIsCalendarSettingsOpen(true);
      result.current.setIsLoginModalOpen(true);
      result.current.setIsProfileMenuOpen(true);
      result.current.setIsPermissionViewOpen(true);
      result.current.setIsGlobalSearchOpen(true);
      result.current.setIsAttendanceAddStudentModalOpen(true);
    });

    expect(result.current.isTimetableSettingsOpen).toBe(true);
    expect(result.current.isCalendarSettingsOpen).toBe(true);
    expect(result.current.isLoginModalOpen).toBe(true);
    expect(result.current.isProfileMenuOpen).toBe(true);
    expect(result.current.isPermissionViewOpen).toBe(true);
    expect(result.current.isGlobalSearchOpen).toBe(true);
    expect(result.current.isAttendanceAddStudentModalOpen).toBe(true);
  });
});

describe('useTimetableState Hook', () => {
  it('initializes with default values', () => {
    const { result } = renderHook(() => useTimetableState());

    expect(result.current.timetableSubject).toBe('math');
    expect(result.current.timetableViewType).toBe('teacher');
    expect(result.current.mathViewMode).toBe('teacher-based');
  });

  it('updates timetableSubject', () => {
    const { result } = renderHook(() => useTimetableState());

    act(() => {
      result.current.setTimetableSubject('english');
    });

    expect(result.current.timetableSubject).toBe('english');
  });

  it('updates timetableViewType', () => {
    const { result } = renderHook(() => useTimetableState());

    act(() => {
      result.current.setTimetableViewType('room');
    });

    expect(result.current.timetableViewType).toBe('room');

    act(() => {
      result.current.setTimetableViewType('class');
    });

    expect(result.current.timetableViewType).toBe('class');
  });

  it('updates mathViewMode', () => {
    const { result } = renderHook(() => useTimetableState());

    act(() => {
      result.current.setMathViewMode('day-based');
    });

    expect(result.current.mathViewMode).toBe('day-based');

    act(() => {
      result.current.setMathViewMode('teacher-based');
    });

    expect(result.current.mathViewMode).toBe('teacher-based');
  });
});

describe('useStudentFilterState Hook', () => {
  it('initializes with default filter values', () => {
    const { result } = renderHook(() => useStudentFilterState());

    expect(result.current.studentFilters).toEqual({
      searchQuery: '',
      searchField: 'all',
      grade: 'all',
      status: 'active',
      subjects: [],
      subjectFilterMode: 'OR',
      teacher: 'all',
      excludeNoEnrollment: false,
      gradeMismatch: false,
    });
    expect(result.current.studentSortBy).toBe('name');
  });

  it('updates filter using updateFilter function', () => {
    const { result } = renderHook(() => useStudentFilterState());

    act(() => {
      result.current.updateFilter('searchQuery', 'John Doe');
    });

    expect(result.current.studentFilters.searchQuery).toBe('John Doe');

    act(() => {
      result.current.updateFilter('grade', '10');
    });

    expect(result.current.studentFilters.grade).toBe('10');
  });

  it('updates multiple filters', () => {
    const { result } = renderHook(() => useStudentFilterState());

    act(() => {
      result.current.updateFilter('status', 'withdrawn');
      result.current.updateFilter('subjects', ['math', 'english']);
      result.current.updateFilter('teacher', 'Teacher A');
    });

    expect(result.current.studentFilters.status).toBe('withdrawn');
    expect(result.current.studentFilters.subjects).toEqual(['math', 'english']);
    expect(result.current.studentFilters.teacher).toBe('Teacher A');
  });

  it('resets all filters', () => {
    const { result } = renderHook(() => useStudentFilterState());

    act(() => {
      result.current.updateFilter('searchQuery', 'Test');
      result.current.updateFilter('grade', '12');
      result.current.updateFilter('status', 'on_hold');
      result.current.updateFilter('excludeNoEnrollment', true);
    });

    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.studentFilters).toEqual({
      searchQuery: '',
      searchField: 'all',
      grade: 'all',
      status: 'active',
      subjects: [],
      subjectFilterMode: 'OR',
      teacher: 'all',
      excludeNoEnrollment: false,
      gradeMismatch: false,
    });
  });

  it('updates sort by', () => {
    const { result } = renderHook(() => useStudentFilterState());

    act(() => {
      result.current.setStudentSortBy('grade');
    });

    expect(result.current.studentSortBy).toBe('grade');

    act(() => {
      result.current.setStudentSortBy('startDate');
    });

    expect(result.current.studentSortBy).toBe('startDate');
  });

  it('updates searchField filter', () => {
    const { result } = renderHook(() => useStudentFilterState());

    act(() => {
      result.current.updateFilter('searchField', 'name');
    });

    expect(result.current.studentFilters.searchField).toBe('name');

    act(() => {
      result.current.updateFilter('searchField', 'phone');
    });

    expect(result.current.studentFilters.searchField).toBe('phone');
  });

  it('updates subjectFilterMode', () => {
    const { result } = renderHook(() => useStudentFilterState());

    act(() => {
      result.current.updateFilter('subjectFilterMode', 'AND');
    });

    expect(result.current.studentFilters.subjectFilterMode).toBe('AND');
  });

  it('updates boolean filters', () => {
    const { result } = renderHook(() => useStudentFilterState());

    act(() => {
      result.current.updateFilter('excludeNoEnrollment', true);
      result.current.updateFilter('gradeMismatch', true);
    });

    expect(result.current.studentFilters.excludeNoEnrollment).toBe(true);
    expect(result.current.studentFilters.gradeMismatch).toBe(true);
  });
});

describe('useGradesFilterState Hook', () => {
  it('initializes with default values', () => {
    const { result } = renderHook(() => useGradesFilterState());

    expect(result.current.gradesSubjectFilter).toBe('all');
    expect(result.current.gradesSearchQuery).toBe('');
  });

  it('updates subject filter', () => {
    const { result } = renderHook(() => useGradesFilterState());

    act(() => {
      result.current.setGradesSubjectFilter('math');
    });

    expect(result.current.gradesSubjectFilter).toBe('math');

    act(() => {
      result.current.setGradesSubjectFilter('english');
    });

    expect(result.current.gradesSubjectFilter).toBe('english');
  });

  it('updates search query', () => {
    const { result } = renderHook(() => useGradesFilterState());

    act(() => {
      result.current.setGradesSearchQuery('student name');
    });

    expect(result.current.gradesSearchQuery).toBe('student name');
  });

  it('allows empty search query', () => {
    const { result } = renderHook(() => useGradesFilterState());

    act(() => {
      result.current.setGradesSearchQuery('test');
    });

    act(() => {
      result.current.setGradesSearchQuery('');
    });

    expect(result.current.gradesSearchQuery).toBe('');
  });
});

describe('useDarkMode Hook', () => {
  const mockedStorage = vi.mocked(mockedStorageImport);

  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('initializes with default dark mode off', () => {
    mockedStorage.getString.mockReturnValue(null);
    localStorage.clear();

    const { result } = renderHook(() => useDarkMode());

    expect(result.current.isDarkMode).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('loads dark mode from storage', () => {
    mockedStorage.getString.mockReturnValue('true');

    const { result } = renderHook(() => useDarkMode());

    expect(result.current.isDarkMode).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('migrates old localStorage key', () => {
    mockedStorage.getString.mockReturnValue(null);
    // Set old localStorage key for migration
    localStorage.setItem('dark_mode', 'true');

    const { result } = renderHook(() => useDarkMode());

    expect(result.current.isDarkMode).toBe(true);
    expect(mockedStorage.setBoolean).toHaveBeenCalledWith('dark_mode', true);
    expect(localStorage.getItem('dark_mode')).toBeNull();
  });

  it('toggles dark mode on', () => {
    mockedStorage.getString.mockReturnValue(null);
    localStorage.clear();

    const { result } = renderHook(() => useDarkMode());

    act(() => {
      result.current.toggleDarkMode();
    });

    expect(result.current.isDarkMode).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(mockedStorage.setBoolean).toHaveBeenCalledWith('dark_mode', true);
  });

  it('toggles dark mode off', () => {
    mockedStorage.getString.mockReturnValue('true');

    const { result } = renderHook(() => useDarkMode());

    act(() => {
      result.current.toggleDarkMode();
    });

    expect(result.current.isDarkMode).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(mockedStorage.setBoolean).toHaveBeenCalledWith('dark_mode', false);
  });

  it('toggles dark mode multiple times', () => {
    mockedStorage.getString.mockReturnValue(null);
    localStorage.clear();

    const { result } = renderHook(() => useDarkMode());

    act(() => {
      result.current.toggleDarkMode();
    });
    expect(result.current.isDarkMode).toBe(true);

    act(() => {
      result.current.toggleDarkMode();
    });
    expect(result.current.isDarkMode).toBe(false);

    act(() => {
      result.current.toggleDarkMode();
    });
    expect(result.current.isDarkMode).toBe(true);
  });

  it('allows manual dark mode setter', () => {
    const { result } = renderHook(() => useDarkMode());

    act(() => {
      result.current.setIsDarkMode(true);
    });

    expect(result.current.isDarkMode).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => {
      result.current.setIsDarkMode(false);
    });

    expect(result.current.isDarkMode).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});

describe('usePendingEventMoves Hook', () => {
  const createMockEvent = (id: string, title: string): CalendarEvent => ({
    id,
    title,
    start: '2025-01-01',
    end: '2025-01-01',
    deptId: 'dept1',
  } as CalendarEvent);

  it('initializes with empty array', () => {
    const { result } = renderHook(() => usePendingEventMoves());

    expect(result.current.pendingEventMoves).toEqual([]);
  });

  it('adds a pending move', () => {
    const { result } = renderHook(() => usePendingEventMoves());
    const original = createMockEvent('event1', 'Original Event');
    const updated = createMockEvent('event1', 'Updated Event');

    act(() => {
      result.current.addPendingMove(original, updated);
    });

    expect(result.current.pendingEventMoves).toHaveLength(1);
    expect(result.current.pendingEventMoves[0].original).toEqual(original);
    expect(result.current.pendingEventMoves[0].updated).toEqual(updated);
  });

  it('adds multiple pending moves', () => {
    const { result } = renderHook(() => usePendingEventMoves());
    const original1 = createMockEvent('event1', 'Event 1');
    const updated1 = createMockEvent('event1', 'Updated Event 1');
    const original2 = createMockEvent('event2', 'Event 2');
    const updated2 = createMockEvent('event2', 'Updated Event 2');

    act(() => {
      result.current.addPendingMove(original1, updated1);
      result.current.addPendingMove(original2, updated2);
    });

    expect(result.current.pendingEventMoves).toHaveLength(2);
    expect(result.current.pendingEventMoves[0].original.id).toBe('event1');
    expect(result.current.pendingEventMoves[1].original.id).toBe('event2');
  });

  it('removes a pending move by event id', () => {
    const { result } = renderHook(() => usePendingEventMoves());
    const original1 = createMockEvent('event1', 'Event 1');
    const updated1 = createMockEvent('event1', 'Updated Event 1');
    const original2 = createMockEvent('event2', 'Event 2');
    const updated2 = createMockEvent('event2', 'Updated Event 2');

    act(() => {
      result.current.addPendingMove(original1, updated1);
      result.current.addPendingMove(original2, updated2);
    });

    act(() => {
      result.current.removePendingMove('event1');
    });

    expect(result.current.pendingEventMoves).toHaveLength(1);
    expect(result.current.pendingEventMoves[0].original.id).toBe('event2');
  });

  it('removes non-existent event without error', () => {
    const { result } = renderHook(() => usePendingEventMoves());
    const original = createMockEvent('event1', 'Event 1');
    const updated = createMockEvent('event1', 'Updated Event 1');

    act(() => {
      result.current.addPendingMove(original, updated);
    });

    act(() => {
      result.current.removePendingMove('nonexistent');
    });

    expect(result.current.pendingEventMoves).toHaveLength(1);
  });

  it('clears all pending moves', () => {
    const { result } = renderHook(() => usePendingEventMoves());
    const original1 = createMockEvent('event1', 'Event 1');
    const updated1 = createMockEvent('event1', 'Updated Event 1');
    const original2 = createMockEvent('event2', 'Event 2');
    const updated2 = createMockEvent('event2', 'Updated Event 2');

    act(() => {
      result.current.addPendingMove(original1, updated1);
      result.current.addPendingMove(original2, updated2);
    });

    act(() => {
      result.current.clearPendingMoves();
    });

    expect(result.current.pendingEventMoves).toEqual([]);
  });

  it('allows manual setPendingEventMoves', () => {
    const { result } = renderHook(() => usePendingEventMoves());
    const original1 = createMockEvent('event1', 'Event 1');
    const updated1 = createMockEvent('event1', 'Updated Event 1');
    const original2 = createMockEvent('event2', 'Event 2');
    const updated2 = createMockEvent('event2', 'Updated Event 2');

    act(() => {
      result.current.setPendingEventMoves([
        { original: original1, updated: updated1 },
        { original: original2, updated: updated2 },
      ]);
    });

    expect(result.current.pendingEventMoves).toHaveLength(2);
    expect(result.current.pendingEventMoves[0].original.id).toBe('event1');
    expect(result.current.pendingEventMoves[1].original.id).toBe('event2');
  });
});
