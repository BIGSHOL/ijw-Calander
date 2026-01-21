/**
 * App.tsx 상태 관리 훅들
 * Vercel React Best Practices: rerender-derived-state
 * 52개 useState를 도메인별로 그룹화하여 리렌더링 최적화
 */

import { useState, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarEvent, UserProfile, AppTab, SubjectType } from '../types';
import { storage, STORAGE_KEYS } from '../utils/localStorage';
import { usePermissions } from './usePermissions';

// ============================================
// 1. Calendar State Hook
// ============================================
export type ViewMode = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface CalendarState {
  baseDate: Date;
  viewMode: ViewMode;
  viewColumns: 1 | 2 | 3;
  selectedDate: string;
  selectedEndDate: string;
  selectedDeptId: string;
  showArchived: boolean;
  selectedCategory: string | null;
  showFavoritesOnly: boolean;
  isFilterOpen: boolean;
  hiddenDeptIds: string[];
}

export function useCalendarState() {
  const [baseDate, setBaseDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('calendar_view_mode');
    return (saved as ViewMode) || 'yearly';
  });
  const [viewColumns, setViewColumns] = useState<1 | 2 | 3>(() => {
    const saved = localStorage.getItem('calendar_view_columns');
    return saved ? (parseInt(saved) as 1 | 2 | 3) : 2;
  });
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedEndDate, setSelectedEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [hiddenDeptIds, setHiddenDeptIds] = useState<string[]>(() => {
    return storage.getJSON<string[]>(STORAGE_KEYS.DEPT_HIDDEN_IDS, []);
  });

  // Persist viewMode to localStorage
  useEffect(() => {
    localStorage.setItem('calendar_view_mode', viewMode);
  }, [viewMode]);

  // Persist viewColumns to localStorage
  useEffect(() => {
    localStorage.setItem('calendar_view_columns', viewColumns.toString());
  }, [viewColumns]);

  // Force viewColumns to 2 if currently 3 when switching to yearly view
  useEffect(() => {
    if (viewMode === 'yearly' && viewColumns === 3) {
      setViewColumns(2);
    }
  }, [viewMode, viewColumns]);

  // Persist hidden departments
  const updateHiddenDeptIds = useCallback((ids: string[]) => {
    setHiddenDeptIds(ids);
    storage.setJSON(STORAGE_KEYS.DEPT_HIDDEN_IDS, ids);
  }, []);

  return {
    // State
    baseDate,
    viewMode,
    viewColumns,
    selectedDate,
    selectedEndDate,
    selectedDeptId,
    showArchived,
    selectedCategory,
    showFavoritesOnly,
    isFilterOpen,
    hiddenDeptIds,
    // Setters
    setBaseDate,
    setViewMode,
    setViewColumns,
    setSelectedDate,
    setSelectedEndDate,
    setSelectedDeptId,
    setShowArchived,
    setSelectedCategory,
    setShowFavoritesOnly,
    setIsFilterOpen,
    setHiddenDeptIds: updateHiddenDeptIds,
  };
}

// ============================================
// 2. Event Modal State Hook
// ============================================
export interface EventModalState {
  isOpen: boolean;
  editingEvent: CalendarEvent | null;
  templateEvent: CalendarEvent | null;
  initialStartTime: string;
  initialEndTime: string;
  initialTitle: string;
  pendingBucketId: string | null;
}

export function useEventModalState() {
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [templateEvent, setTemplateEvent] = useState<CalendarEvent | null>(null);
  const [initialStartTime, setInitialStartTime] = useState('');
  const [initialEndTime, setInitialEndTime] = useState('');
  const [initialTitle, setInitialTitle] = useState('');
  const [pendingBucketId, setPendingBucketId] = useState<string | null>(null);

  const openEventModal = useCallback((options?: {
    event?: CalendarEvent;
    template?: CalendarEvent;
    startTime?: string;
    endTime?: string;
    title?: string;
    bucketId?: string;
  }) => {
    if (options?.event) setEditingEvent(options.event);
    if (options?.template) setTemplateEvent(options.template);
    if (options?.startTime) setInitialStartTime(options.startTime);
    if (options?.endTime) setInitialEndTime(options.endTime);
    if (options?.title) setInitialTitle(options.title);
    if (options?.bucketId) setPendingBucketId(options.bucketId);
    setIsEventModalOpen(true);
  }, []);

  const closeEventModal = useCallback(() => {
    setIsEventModalOpen(false);
    setEditingEvent(null);
    setTemplateEvent(null);
    setInitialStartTime('');
    setInitialEndTime('');
    setInitialTitle('');
    setPendingBucketId(null);
  }, []);

  return {
    isEventModalOpen,
    editingEvent,
    templateEvent,
    initialStartTime,
    initialEndTime,
    initialTitle,
    pendingBucketId,
    setIsEventModalOpen,
    setEditingEvent,
    setTemplateEvent,
    setInitialStartTime,
    setInitialEndTime,
    setInitialTitle,
    setPendingBucketId,
    openEventModal,
    closeEventModal,
  };
}

// ============================================
// 3. Modal State Hook (Settings, Login 등)
// ============================================
export function useModalState() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTimetableSettingsOpen, setIsTimetableSettingsOpen] = useState(false);
  const [isCalendarSettingsOpen, setIsCalendarSettingsOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isPermissionViewOpen, setIsPermissionViewOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isAttendanceAddStudentModalOpen, setIsAttendanceAddStudentModalOpen] = useState(false);

  return {
    isSettingsOpen,
    isTimetableSettingsOpen,
    isCalendarSettingsOpen,
    isLoginModalOpen,
    isProfileMenuOpen,
    isPermissionViewOpen,
    isGlobalSearchOpen,
    isAttendanceAddStudentModalOpen,
    setIsSettingsOpen,
    setIsTimetableSettingsOpen,
    setIsCalendarSettingsOpen,
    setIsLoginModalOpen,
    setIsProfileMenuOpen,
    setIsPermissionViewOpen,
    setIsGlobalSearchOpen,
    setIsAttendanceAddStudentModalOpen,
  };
}

// ============================================
// 4. Timetable State Hook
// ============================================
export function useTimetableState() {
  const [timetableSubject, setTimetableSubject] = useState<SubjectType>('math');
  const [timetableViewType, setTimetableViewType] = useState<'teacher' | 'room' | 'class'>('teacher');
  const [mathViewMode, setMathViewMode] = useState<'day-based' | 'teacher-based'>('teacher-based');

  return {
    timetableSubject,
    timetableViewType,
    mathViewMode,
    setTimetableSubject,
    setTimetableViewType,
    setMathViewMode,
  };
}

// ============================================
// 5. Attendance State Hook
// ============================================
export function useAttendanceState(userProfile: UserProfile | null) {
  const { hasPermission } = usePermissions(userProfile);

  const [attendanceSubject, setAttendanceSubject] = useState<'math' | 'english'>('math');
  const [attendanceTeacherId, setAttendanceTeacherId] = useState<string | undefined>(undefined);
  const [attendanceDate, setAttendanceDate] = useState(() => new Date());

  // Initialize attendance subject based on user's permissions
  useEffect(() => {
    if (!userProfile) return;

    const isMasterOrAdmin = userProfile.role === 'master' || userProfile.role === 'admin';
    const canManageMath = hasPermission('attendance.manage_math');
    const canManageEnglish = hasPermission('attendance.manage_english');

    let initialSubject: 'math' | 'english' = 'math';

    if (isMasterOrAdmin) {
      initialSubject = 'math';
    } else if (canManageMath && !canManageEnglish) {
      initialSubject = 'math';
    } else if (canManageEnglish && !canManageMath) {
      initialSubject = 'english';
    }

    setAttendanceSubject(initialSubject);
  }, [userProfile, hasPermission]);

  return {
    attendanceSubject,
    attendanceTeacherId,
    attendanceDate,
    setAttendanceSubject,
    setAttendanceTeacherId,
    setAttendanceDate,
  };
}

// ============================================
// 6. Student Filter State Hook
// ============================================
export interface StudentFilters {
  searchQuery: string;
  grade: string;
  status: 'all' | 'prospect' | 'active' | 'on_hold' | 'withdrawn';
  subjects: string[];  // 선택된 과목 배열 (빈 배열 = 전체)
  teacher: string;  // 'all' 또는 선생님 이름
}

export function useStudentFilterState() {
  const [studentFilters, setStudentFilters] = useState<StudentFilters>({
    searchQuery: '',
    grade: 'all',
    status: 'active',
    subjects: [],
    teacher: 'all',
  });
  const [studentSortBy, setStudentSortBy] = useState<'name' | 'grade' | 'startDate'>('name');

  // Functional setState for better performance
  const updateFilter = useCallback(<K extends keyof StudentFilters>(
    key: K,
    value: StudentFilters[K]
  ) => {
    setStudentFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setStudentFilters({
      searchQuery: '',
      grade: 'all',
      status: 'active',
      subjects: [],
      teacher: 'all',
    });
  }, []);

  return {
    studentFilters,
    studentSortBy,
    setStudentFilters,
    setStudentSortBy,
    updateFilter,
    resetFilters,
  };
}

// ============================================
// 7. Grades Filter State Hook
// ============================================
export function useGradesFilterState() {
  const [gradesSubjectFilter, setGradesSubjectFilter] = useState<'all' | 'math' | 'english'>('all');
  const [gradesSearchQuery, setGradesSearchQuery] = useState('');

  return {
    gradesSubjectFilter,
    gradesSearchQuery,
    setGradesSubjectFilter,
    setGradesSearchQuery,
  };
}

// ============================================
// 8. Dark Mode State Hook
// ============================================
export function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return storage.getBoolean(STORAGE_KEYS.DARK_MODE, false);
  });

  // Apply dark mode class to document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    storage.setBoolean(STORAGE_KEYS.DARK_MODE, isDarkMode);
  }, [isDarkMode]);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => !prev);
  }, []);

  return {
    isDarkMode,
    setIsDarkMode,
    toggleDarkMode,
  };
}

// ============================================
// 9. Pending Event Moves State Hook
// ============================================
export function usePendingEventMoves() {
  const [pendingEventMoves, setPendingEventMoves] = useState<{
    original: CalendarEvent;
    updated: CalendarEvent;
  }[]>([]);

  const addPendingMove = useCallback((original: CalendarEvent, updated: CalendarEvent) => {
    setPendingEventMoves(prev => [...prev, { original, updated }]);
  }, []);

  const removePendingMove = useCallback((eventId: string) => {
    setPendingEventMoves(prev => prev.filter(m => m.original.id !== eventId));
  }, []);

  const clearPendingMoves = useCallback(() => {
    setPendingEventMoves([]);
  }, []);

  return {
    pendingEventMoves,
    setPendingEventMoves,
    addPendingMove,
    removePendingMove,
    clearPendingMoves,
  };
}
