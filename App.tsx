import React, { useState, useEffect, useMemo } from 'react';
import { addYears, subYears, format } from 'date-fns';
import { CalendarEvent, AppTab, TAB_META, TAB_GROUPS } from './types';
import { AttendanceViewMode, SessionPeriod } from './components/Attendance/types';
import { usePermissions } from './hooks/usePermissions';
import { useDepartments, useTeachers, useHolidays, useClassKeywords, useSystemConfig, useStaffWithAccounts } from './hooks/useFirebaseQueries';
import { useGanttProjects } from './hooks/useGanttProjects';
import { useSessionPeriods } from './hooks/useSessionPeriods';
import { convertGanttProjectsToCalendarEvents } from './utils/ganttToCalendar';
import { useTabPermissions } from './hooks/useTabPermissions';
import { useTabHistory } from './hooks/useTabHistory';
import { useEventCrud } from './hooks/useEventCrud';
import { useBucketItems } from './hooks/useBucketItems';
import { useTaskMemos } from './hooks/useTaskMemos';
import { useGlobalSearch } from './hooks/useGlobalSearch';
import { useAuth } from './hooks/useAuth';
import { formatUserDisplay, staffToUserLike } from './utils/staffHelpers';
import { storage, STORAGE_KEYS } from './utils/localStorage';
import { useStudents } from './hooks/useStudents';
import { useClasses } from './hooks/useClasses';
import { useGradePromotion } from './hooks/useGradePromotion';

// State management hooks
import {
  useCalendarState,
  useEventModalState,
  useModalState,
  useTimetableState,
  useStudentFilterState,
  useGradesFilterState,
  useDarkMode,
  usePendingEventMoves,
} from './hooks/useAppState';

// Core components
import Sidebar from './components/Navigation/Sidebar';
import { BreadcrumbItem } from './components/Common/Breadcrumb';
import SkipLink from './components/Common/SkipLink';
import { RoleSimulationProvider, SimulationState, getEffectiveUserProfile } from './hooks/useRoleSimulation';
import RoleSimulationBanner from './components/Common/RoleSimulationBanner';
import { HeaderCollapseProvider } from './contexts/HeaderCollapseContext';
import { INJAEWON_LOGO } from './utils/styleUtils';
import { VideoLoading } from './components/Common/VideoLoading';
import VersionUpdateToast from './components/Common/VersionUpdateToast';

// Embed Mode Support
import EmbedRouter, { isEmbedMode } from './components/Embed/EmbedRouter';

// Layout components
import { AppHeader } from './components/Layout/AppHeader';
import { TabContent } from './components/Layout/TabContent';
import { ModalManager } from './components/Layout/ModalManager';

// Firestore
import { db } from './firebaseConfig';
import { collection, onSnapshot, query, where, updateDoc, getDocs } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { eventConverter } from './converters';

const App: React.FC = () => {
  // Embed mode check
  if (isEmbedMode()) {
    return <EmbedRouter />;
  }

  // App Mode
  const [appMode, setAppMode] = useState<AppTab | null>(null);

  // Custom Hooks - State
  const calendarState = useCalendarState();
  const eventModalState = useEventModalState();
  const modalState = useModalState();
  const timetableState = useTimetableState();
  const studentFilterState = useStudentFilterState();
  const { promoteGrades, isPromoting } = useGradePromotion();
  const gradesFilterState = useGradesFilterState();
  const darkModeState = useDarkMode();
  const pendingMovesState = usePendingEventMoves();

  // Destructure states
  const {
    baseDate, setBaseDate, viewMode, setViewMode, viewColumns, setViewColumns,
    selectedDate, setSelectedDate, selectedEndDate, setSelectedEndDate,
    selectedDeptId, setSelectedDeptId, showArchived, setShowArchived,
    selectedCategory, setSelectedCategory, showFavoritesOnly, setShowFavoritesOnly,
    isFilterOpen, setIsFilterOpen, hiddenDeptIds, setHiddenDeptIds,
  } = calendarState;

  const {
    isEventModalOpen, setIsEventModalOpen, editingEvent, setEditingEvent,
    templateEvent, setTemplateEvent, initialStartTime, setInitialStartTime,
    initialEndTime, setInitialEndTime, initialTitle, setInitialTitle,
    pendingBucketId, setPendingBucketId, closeEventModal,
  } = eventModalState;

  const {
    isSettingsOpen, setIsSettingsOpen,
    isTimetableSettingsOpen, setIsTimetableSettingsOpen,
    isCalendarSettingsOpen, setIsCalendarSettingsOpen, isLoginModalOpen, setIsLoginModalOpen,
    isProfileMenuOpen, setIsProfileMenuOpen, isPermissionViewOpen, setIsPermissionViewOpen,
    isGlobalSearchOpen, setIsGlobalSearchOpen, isAttendanceAddStudentModalOpen, setIsAttendanceAddStudentModalOpen,
  } = modalState;

  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [isRoleSimulationOpen, setIsRoleSimulationOpen] = useState(false);

  const {
    timetableSubject, setTimetableSubject, timetableViewType, setTimetableViewType,
    mathViewMode, setMathViewMode,
  } = timetableState;

  const {
    studentFilters, setStudentFilters, studentSortBy, setStudentSortBy,
    updateFilter: updateStudentFilter, resetFilters: resetStudentFilters,
  } = studentFilterState;

  const {
    gradesSubjectFilter, setGradesSubjectFilter, gradesSearchQuery, setGradesSearchQuery,
  } = gradesFilterState;

  const { isDarkMode, setIsDarkMode, toggleDarkMode } = darkModeState;

  const {
    pendingEventMoves, setPendingEventMoves, addPendingMove, removePendingMove, clearPendingMoves,
  } = pendingMovesState;

  const rightDate = subYears(baseDate, 1);
  const thirdDate = subYears(baseDate, 2);

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Firestore Data
  const { data: systemConfig } = useSystemConfig(!!currentUser);
  const { data: staffWithAccounts = [] } = useStaffWithAccounts(!!currentUser);
  const { data: departments = [] } = useDepartments(!!currentUser && appMode === 'calendar');
  const { data: teachers = [] } = useTeachers(!!currentUser && (appMode === 'attendance' || appMode === 'timetable'));
  const { data: holidays = [] } = useHolidays(!!currentUser && appMode === 'calendar');
  const { data: classKeywords = [] } = useClassKeywords(!!currentUser && appMode === 'timetable');

  // Auth
  const { userProfile, setUserProfile, authLoading, handleLogout } = useAuth({
    setCurrentUser, systemConfig, onShowLogin: () => setIsLoginModalOpen(true),
  });

  // Simulation state
  const [simulationState, setSimulationState] = useState<SimulationState>({
    simulationType: null,
    simulatedRole: null,
    simulatedUserProfile: null,
  });

  const effectiveProfile = useMemo(() => {
    return getEffectiveUserProfile(
      userProfile,
      simulationState.simulatedRole,
      simulationState.simulatedUserProfile,
      simulationState.simulationType
    );
  }, [userProfile, simulationState]);

  const isSimulating = userProfile?.role === 'master' && simulationState.simulationType !== null;

  const lookbackYears = systemConfig?.eventLookbackYears || 2;
  const sysCategories = systemConfig?.categories || [];

  const usersFromStaff = useMemo(() =>
    staffWithAccounts.map(staffToUserLike),
    [staffWithAccounts]
  );

  const currentStaffMember = useMemo(() => {
    if (!currentUser || !userProfile) return undefined;
    return staffWithAccounts.find(s => s.uid === currentUser.uid || s.email === userProfile.email);
  }, [currentUser, userProfile, staffWithAccounts]);

  const effectiveStaffMember = useMemo(() => {
    if (!effectiveProfile) return undefined;
    if (!isSimulating) return currentStaffMember;
    return staffWithAccounts.find(s =>
      s.uid === effectiveProfile.uid ||
      s.id === effectiveProfile.uid ||
      s.email === effectiveProfile.email
    );
  }, [effectiveProfile, isSimulating, currentStaffMember, staffWithAccounts]);

  // Global data for search
  const shouldLoadGlobalData = !!currentUser && (isGlobalSearchOpen || appMode === 'students');
  const { students: globalStudents = [] } = useStudents(false, shouldLoadGlobalData);
  const { data: allClasses = [] } = useClasses(shouldLoadGlobalData);

  const teachersBySubject = useMemo(() => {
    const subjectTeachers: Record<string, Set<string>> = {
      math: new Set(),
      english: new Set(),
      science: new Set(),
      korean: new Set(),
      other: new Set(),
    };
    globalStudents.forEach(student => {
      student.enrollments?.forEach(enrollment => {
        if (enrollment.staffId && enrollment.subject) {
          const subject = subjectTeachers[enrollment.subject] ? enrollment.subject : 'other';
          subjectTeachers[subject].add(enrollment.staffId);
        }
      });
    });
    return {
      math: Array.from(subjectTeachers.math).sort((a, b) => a.localeCompare(b, 'ko')),
      english: Array.from(subjectTeachers.english).sort((a, b) => a.localeCompare(b, 'ko')),
      science: Array.from(subjectTeachers.science).sort((a, b) => a.localeCompare(b, 'ko')),
      korean: Array.from(subjectTeachers.korean).sort((a, b) => a.localeCompare(b, 'ko')),
      other: Array.from(subjectTeachers.other).sort((a, b) => a.localeCompare(b, 'ko')),
    };
  }, [globalStudents]);

  // Real-time events
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const uniqueCategories = Array.from(new Set(departments.map(d => d.category).filter(Boolean))) as string[];

  // Attendance State
  const [attendanceSubject, setAttendanceSubject] = useState<'math' | 'english'>('math');
  const [attendanceStaffId, setAttendanceStaffId] = useState<string | undefined>(undefined);
  const [attendanceDate, setAttendanceDate] = useState(() => new Date());
  const [attendanceViewMode, setAttendanceViewMode] = useState<AttendanceViewMode>('monthly');
  const [selectedSession, setSelectedSession] = useState<SessionPeriod | null>(null);

  const sessionCategory = useMemo((): 'math' | 'english' | 'eie' => {
    if (attendanceSubject === 'math') return 'math';
    if (attendanceSubject === 'english') return 'english';
    return 'math';
  }, [attendanceSubject]);

  const { data: sessions = [], isLoading: isLoadingSessions } = useSessionPeriods(
    attendanceDate.getFullYear(),
    sessionCategory
  );

  useEffect(() => {
    if (attendanceViewMode === 'session' && !selectedSession && sessions.length > 0) {
      const currentYear = attendanceDate.getFullYear();
      const currentMonth = attendanceDate.getMonth() + 1;
      const currentMonthSession = sessions.find(s => s.year === currentYear && s.month === currentMonth);

      if (currentMonthSession) {
        setSelectedSession(currentMonthSession);
      }
    }
  }, [attendanceViewMode, selectedSession, sessions, attendanceDate]);

  // Permission Hook
  const { hasPermission, rolePermissions } = usePermissions(effectiveProfile || null);

  // Guard: Timetable subject permission
  useEffect(() => {
    if (!effectiveProfile || appMode !== 'timetable') return;

    const canViewMath = hasPermission('timetable.math.view') || hasPermission('timetable.math.edit');
    const canViewEnglish = hasPermission('timetable.english.view') || hasPermission('timetable.english.edit');
    const canViewScience = hasPermission('timetable.science.view') || hasPermission('timetable.science.edit');
    const canViewKorean = hasPermission('timetable.korean.view') || hasPermission('timetable.korean.edit');

    const canViewCurrent =
      (timetableSubject === 'math' && canViewMath) ||
      (timetableSubject === 'english' && canViewEnglish) ||
      (timetableSubject === 'science' && canViewScience) ||
      (timetableSubject === 'korean' && canViewKorean);

    if (!canViewCurrent) {
      if (canViewMath) {
        setTimetableSubject('math');
      } else if (canViewEnglish) {
        setTimetableSubject('english');
      } else if (canViewScience) {
        setTimetableSubject('science');
      } else if (canViewKorean) {
        setTimetableSubject('korean');
      } else {
        setAppMode('dashboard');
      }
    }
  }, [timetableSubject, effectiveProfile, appMode, hasPermission]);

  // Initialize attendance subject
  useEffect(() => {
    if (!effectiveProfile) return;

    const canManageMath = hasPermission('attendance.manage_math');
    const canManageEnglish = hasPermission('attendance.manage_english');

    let initialSubject: 'math' | 'english' = 'math';

    if (canManageMath) {
      initialSubject = 'math';
    } else if (canManageMath && !canManageEnglish) {
      initialSubject = 'math';
    } else if (canManageEnglish && !canManageMath) {
      initialSubject = 'english';
    }

    setAttendanceSubject(initialSubject);
  }, [effectiveProfile, hasPermission]);

  // Tab Permissions
  const { canAccessTab, accessibleTabs, isLoading: isTabPermissionLoading } = useTabPermissions(effectiveProfile);

  // 브라우저 히스토리 연동 (뒤로/앞으로 버튼, 백스페이스 방지, URL 해시)
  const { getTabFromHash } = useTabHistory(appMode, setAppMode);

  useEffect(() => {
    if (isTabPermissionLoading || !effectiveProfile) return;

    const priority: AppTab[] = ['dashboard', 'calendar', 'timetable', 'attendance', 'payment', 'gantt', 'consultation', 'students'];

    if (appMode === null) {
      // URL 해시에서 탭 복원 시도
      const hashTab = getTabFromHash();
      if (hashTab && canAccessTab(hashTab)) {
        setAppMode(hashTab);
        return;
      }
      const firstAccessibleTab = priority.find(tab => canAccessTab(tab));
      if (firstAccessibleTab) {
        setAppMode(firstAccessibleTab);
      } else {
        setAppMode('dashboard');
      }
      return;
    }

    const isAccessible = canAccessTab(appMode);
    if (!isAccessible) {
      const firstValidTab = priority.find(tab => canAccessTab(tab));
      if (firstValidTab) {
        setAppMode(firstValidTab);
      }
    }
  }, [appMode, canAccessTab, accessibleTabs, isTabPermissionLoading, effectiveProfile]);

  useEffect(() => {
    if (currentUser) {
      // Optional: Reset hidden departments
    }
  }, [currentUser]);

  // Global Search
  const { handleGlobalSearch, handleSearchSelect } = useGlobalSearch({
    globalStudents, events, departments, allClasses, teachers,
    setAppMode, setStudentFilters, setEditingEvent, setIsEventModalOpen, setIsGlobalSearchOpen,
  });

  // Permissions
  const canViewAllDepts = hasPermission('departments.view_all');

  // Filter Departments
  const visibleDepartments = departments.filter(d => {
    let hasAccess = false;

    if (canViewAllDepts) {
      hasAccess = true;
    } else if (effectiveProfile?.departmentPermissions?.[d.id] || effectiveProfile?.departmentPermissions?.[d.name]) {
      hasAccess = true;
    } else if (effectiveProfile?.allowedDepartments?.includes(d.id)) {
      hasAccess = true;
    }

    if (!hasAccess) return false;

    if (showFavoritesOnly && effectiveProfile?.favoriteDepartments) {
      if (!effectiveProfile.favoriteDepartments.includes(d.id)) return false;
    }

    if (hiddenDeptIds.includes(d.id)) return false;

    return true;
  });

  // Event handlers
  const handleTimeSlotClick = (date: string, time: string) => {
    if (!hasPermission('events.create')) {
      alert("일정 생성 권한이 없습니다.");
      return;
    }
    setSelectedDate(date);
    setSelectedEndDate(date);
    setEditingEvent(null);
    setInitialStartTime(time);
    const [h, m] = time.split(':').map(Number);
    const endH = h + 1;
    const endTimeStr = `${String(endH > 23 ? 23 : endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    setInitialEndTime(endTimeStr);
    setIsEventModalOpen(true);
  };

  // Subscribe to Events
  useEffect(() => {
    if (!currentUser || appMode !== 'calendar') {
      setEvents([]);
      return;
    }

    const queryStartDate = format(subYears(new Date(), lookbackYears), 'yyyy-MM-dd');

    const q = query(
      collection(db, "events").withConverter(eventConverter),
      where("시작일", ">=", queryStartDate)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadEvents = snapshot.docs.map(doc => doc.data());
      setEvents(loadEvents);
    });
    return () => unsubscribe();
  }, [lookbackYears, currentUser, appMode]);

  useEffect(() => {
    storage.setJSON(STORAGE_KEYS.DEPT_HIDDEN_IDS, hiddenDeptIds);
  }, [hiddenDeptIds]);

  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);

  // Bucket Items
  const {
    bucketItems, handleAddBucketItem, handleDeleteBucketItem, handleEditBucketItem,
  } = useBucketItems({ currentUser, effectiveProfile, userProfile, usersFromStaff, hasPermission });

  // Task Memos
  const {
    taskMemos, isMemoDropdownOpen, setIsMemoDropdownOpen,
    isMemoModalOpen, setIsMemoModalOpen, memoRecipients, setMemoRecipients,
    memoMessage, setMemoMessage, selectedMemo, setSelectedMemo,
    unreadMemoCount, handleSendMemo, handleMarkMemoRead, handleDeleteMemo,
  } = useTaskMemos({ currentUser, userProfile, usersFromStaff, formatUserDisplay });

  const [isSearchFieldDropdownOpen, setIsSearchFieldDropdownOpen] = useState(false);
  const [consultationToStudentId, setConsultationToStudentId] = useState<string | undefined>(undefined);

  const handleCellClick = (date: string, deptId: string) => {
    if (!hasPermission('events.create')) return;
    setSelectedDate(date);
    setSelectedEndDate(date);
    setSelectedDeptId(deptId);
    setSelectedDeptIds([deptId]);
    setEditingEvent(null);
    setIsEventModalOpen(true);
  };

  const handleRangeSelect = (startDate: string, endDate: string, deptId: string, deptIds?: string[]) => {
    if (!hasPermission('events.create')) return;
    setSelectedDate(startDate);
    setSelectedEndDate(endDate);
    setSelectedDeptId(deptId);
    setSelectedDeptIds(deptIds || [deptId]);
    setEditingEvent(null);
    setIsEventModalOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setEditingEvent(event);
    setSelectedDate(event.startDate);
    setSelectedEndDate(event.endDate);
    setIsEventModalOpen(true);
  };

  const handleQuickAdd = (date: Date) => {
    if (!hasPermission('events.create')) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    setSelectedDate(dateStr);
    setSelectedEndDate(dateStr);
    setEditingEvent(null);
    setSelectedDeptId(departments[0]?.id || '');
    setIsEventModalOpen(true);
  };

  const handleConvertBucketToEvent = (bucket: any) => {
    const [year, month] = bucket.targetMonth.split('-').map(Number);
    const targetDate = new Date(year, month - 1, 1);
    const dateStr = format(targetDate, 'yyyy-MM-dd');

    setSelectedDate(dateStr);
    setSelectedEndDate(dateStr);
    setEditingEvent(null);
    setSelectedDeptId(bucket.departmentId || departments[0]?.id || '');
    setInitialTitle(bucket.title);
    setPendingBucketId(bucket.id);
    setIsEventModalOpen(true);
  };

  const handleCopyEvent = (event: CalendarEvent) => {
    setEditingEvent(null);
    setTemplateEvent(event);
    setIsEventModalOpen(true);
  };

  // Event CRUD
  const { handleSaveEvent, handleDeleteEvent, handleBatchUpdateAttendance } = useEventCrud({
    events,
    pendingBucketId,
    onDeleteBucketItem: handleDeleteBucketItem,
    onResetBucketState: () => { setPendingBucketId(null); setInitialTitle(''); },
  });

  const toggleDeptVisibility = (id: string) => {
    setHiddenDeptIds(
      hiddenDeptIds.includes(id) ? hiddenDeptIds.filter(d => d !== id) : [...hiddenDeptIds, id]
    );
  };

  const setAllVisibility = (visible: boolean) => {
    if (visible) {
      setHiddenDeptIds([]);
    } else {
      setHiddenDeptIds(departments.map(d => d.id));
    }
  };

  const toggleFavorite = async (deptId: string) => {
    if (!userProfile) return;
    const current = userProfile.favoriteDepartments || [];
    const updated = current.includes(deptId)
      ? current.filter(id => id !== deptId)
      : [...current, deptId];

    try {
      const staffQuery = query(
        collection(db, 'staff'),
        where('uid', '==', userProfile.uid)
      );
      const staffSnapshot = await getDocs(staffQuery);
      if (!staffSnapshot.empty) {
        await updateDoc(staffSnapshot.docs[0].ref, {
          favoriteDepartments: updated
        });
      }
    } catch (e) {
      console.error('Error updating favorites:', e);
    }
  };

  const handleEventMove = (original: CalendarEvent, updated: CalendarEvent) => {
    const isAuthor = original.authorId === userProfile?.uid;
    const canDrag = hasPermission('events.drag_move');
    const canEdit = hasPermission(isAuthor ? 'events.manage_own' : 'events.manage_others');
    const hasDeptAccess = canEditDepartment(original.departmentId);

    if (!canDrag || !canEdit || !hasDeptAccess) {
      alert('일정을 이동할 권한이 없습니다.');
      return;
    }

    setPendingEventMoves(prev => {
      const filtered = prev.filter(m => m.original.id !== original.id);
      return [...filtered, { original, updated }];
    });
  };

  const handleSavePendingMoves = async () => {
    if (pendingEventMoves.length === 0) return;
    try {
      let totalCount = 0;
      for (const move of pendingEventMoves) {
        await handleSaveEvent(move.updated);
        totalCount += (move.updated.departmentIds?.length || 1);
      }
      setPendingEventMoves([]);
      alert(`${totalCount}개의 일정이 이동되었습니다.`);
    } catch (e) {
      console.error(e);
      alert('일정 이동 중 오류가 발생했습니다.');
    }
  };

  const handleCancelPendingMoves = () => {
    setPendingEventMoves([]);
  };

  const canEditDepartment = (deptId: string): boolean => {
    if (!effectiveProfile) return false;
    if (effectiveProfile.role === 'master' || effectiveProfile.role === 'admin') return true;
    if (hasPermission('departments.manage')) return true;
    const permission = effectiveProfile.departmentPermissions?.[deptId];
    return permission === 'view';
  };

  // Gantt Projects
  const { data: ganttProjects = [] } = useGanttProjects(effectiveProfile?.uid);
  const ganttCalendarEvents = useMemo(() =>
    convertGanttProjectsToCalendarEvents(ganttProjects),
    [ganttProjects]);

  const displayEvents = useMemo(() => {
    const calendarEventsWithMoves = events.map(event => {
      const pendingMove = pendingEventMoves.find(m => m.original.id === event.id);
      return pendingMove ? pendingMove.updated : event;
    });
    return [...calendarEventsWithMoves, ...ganttCalendarEvents];
  }, [events, pendingEventMoves, ganttCalendarEvents]);

  const pendingEventIds = pendingEventMoves.map(m => m.original.id);

  // Breadcrumb
  const breadcrumbItems: BreadcrumbItem[] = React.useMemo(() => {
    if (!appMode) return [];
    const currentTabMeta = TAB_META[appMode];
    if (!currentTabMeta) return [];
    const currentGroup = TAB_GROUPS.find(group => group.tabs.includes(appMode));
    const items: BreadcrumbItem[] = [];
    if (currentGroup) {
      items.push({
        label: currentGroup.label,
        onClick: undefined,
      });
    }
    items.push({
      label: currentTabMeta.label,
      isActive: true,
    });
    return items;
  }, [appMode]);

  // Loading screen
  if (authLoading || (currentUser && isTabPermissionLoading) || (currentUser && appMode === null)) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <video autoPlay muted loop playsInline className="w-full h-screen object-contain">
          <source src="/LoadingPage2.mp4" type="video/mp4" />
        </video>
      </div>
    );
  }

  return (
    <RoleSimulationProvider
      actualRole={userProfile?.role || null}
      externalState={simulationState}
      onStateChange={setSimulationState}
    >
      <VersionUpdateToast />
      <div className="h-screen overflow-hidden flex bg-[#f0f4f8]">
        <RoleSimulationBanner
          actualRole={userProfile?.role || null}
          availableUsers={usersFromStaff}
          isOpen={isRoleSimulationOpen}
          onOpenChange={setIsRoleSimulationOpen}
          externalTrigger={true}
        />

        <SkipLink targetId="main-content">메인 콘텐츠로 건너뛰기</SkipLink>

        <Sidebar
          currentTab={appMode}
          accessibleTabs={accessibleTabs}
          onTabSelect={(tab) => setAppMode(tab as typeof appMode)}
          logoUrl={INJAEWON_LOGO}
        />

        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <AppHeader
            appMode={appMode}
            isHeaderCollapsed={isHeaderCollapsed}
            setIsHeaderCollapsed={setIsHeaderCollapsed}
            breadcrumbItems={breadcrumbItems}
            currentUser={currentUser}
            userProfile={userProfile}
            currentStaffMember={currentStaffMember}
            isProfileMenuOpen={isProfileMenuOpen}
            setIsProfileMenuOpen={setIsProfileMenuOpen}
            hasPermission={hasPermission}
            setIsSettingsOpen={setIsSettingsOpen}
            isRoleSimulationOpen={isRoleSimulationOpen}
            setIsRoleSimulationOpen={setIsRoleSimulationOpen}
            isMemoDropdownOpen={isMemoDropdownOpen}
            setIsMemoDropdownOpen={setIsMemoDropdownOpen}
            unreadMemoCount={unreadMemoCount}
            taskMemos={taskMemos}
            setIsMemoModalOpen={setIsMemoModalOpen}
            setSelectedMemo={setSelectedMemo}
            handleMarkMemoRead={handleMarkMemoRead}
            calendarFilterProps={appMode === 'calendar' ? {
              isFilterOpen,
              setIsFilterOpen,
              hiddenDeptIds,
              visibleDepartments,
              viewMode,
              setViewMode,
              viewColumns,
              setViewColumns: setViewColumns as any,
              setIsCalendarSettingsOpen,
              departments,
              effectiveProfile,
              canViewAllDepts,
              selectedCategory,
              setSelectedCategory,
              uniqueCategories,
              showFavoritesOnly,
              setShowFavoritesOnly,
              toggleDeptVisibility,
              setAllVisibility,
              toggleFavorite,
            } : undefined}
            attendanceProps={appMode === 'attendance' ? {
              effectiveProfile,
              hasPermission,
              teachers,
              attendanceSubject,
              setAttendanceSubject,
              attendanceStaffId,
              setAttendanceStaffId,
              attendanceDate,
              setAttendanceDate,
              attendanceViewMode,
              setAttendanceViewMode,
              selectedSession,
              setSelectedSession,
              sessions,
              setIsAttendanceAddStudentModalOpen,
            } : undefined}
            studentsProps={appMode === 'students' ? {
              studentFilters,
              setStudentFilters,
              isSearchFieldDropdownOpen,
              setIsSearchFieldDropdownOpen,
              teachersBySubject,
              studentSortBy,
              setStudentSortBy: setStudentSortBy as any,
              onGradePromotion: promoteGrades,
              isPromoting,
            } : undefined}
            timetableProps={appMode === 'timetable' ? {
              timetableSubject: timetableSubject as any,
              setTimetableSubject: setTimetableSubject as any,
              timetableViewType,
              setTimetableViewType: setTimetableViewType as any,
              mathViewMode,
              setMathViewMode: setMathViewMode as any,
              hasPermission,
              setIsTimetableSettingsOpen,
            } : undefined}
          />

          <main id="main-content" className="flex-1 flex flex-col md:flex-row overflow-hidden" role="main">
            <HeaderCollapseProvider isHeaderCollapsed={isHeaderCollapsed}>
              <TabContent
                appMode={appMode}
                canAccessTab={canAccessTab}
                effectiveProfile={effectiveProfile}
                effectiveStaffMember={effectiveStaffMember}
                calendarProps={appMode === 'calendar' ? {
                  baseDate,
                  setBaseDate,
                  rightDate,
                  thirdDate,
                  visibleDepartments,
                  displayEvents,
                  handleCellClick,
                  handleRangeSelect,
                  handleTimeSlotClick,
                  handleEventClick,
                  holidays,
                  viewMode,
                  handleEventMove,
                  canEditDepartment,
                  pendingEventIds,
                  setViewMode,
                  handleQuickAdd,
                  bucketItems,
                  handleAddBucketItem,
                  handleEditBucketItem,
                  handleDeleteBucketItem,
                  handleConvertBucketToEvent,
                  showArchived,
                  viewColumns,
                } : undefined}
                timetableProps={appMode === 'timetable' ? {
                  timetableSubject: timetableSubject as any,
                  setTimetableSubject: setTimetableSubject as any,
                  timetableViewType,
                  setTimetableViewType: setTimetableViewType as any,
                  teachers,
                  classKeywords,
                  mathViewMode,
                  setMathViewMode: setMathViewMode as any,
                } : undefined}
                ganttProps={appMode === 'gantt' ? {
                  usersFromStaff,
                } : undefined}
                consultationProps={appMode === 'consultation' ? {
                  onNavigateToStudent: (studentId) => {
                    setConsultationToStudentId(studentId);
                    setAppMode('students');
                  },
                } : undefined}
                attendanceProps={appMode === 'attendance' ? {
                  teachers,
                  attendanceSubject,
                  attendanceStaffId,
                  attendanceDate,
                  isAttendanceAddStudentModalOpen,
                  setIsAttendanceAddStudentModalOpen,
                  attendanceViewMode,
                  selectedSession,
                } : undefined}
                studentsProps={appMode === 'students' ? {
                  studentFilters,
                  studentSortBy,
                  consultationToStudentId,
                  setConsultationToStudentId,
                } : undefined}
                gradesProps={appMode === 'grades' ? {
                  gradesSubjectFilter,
                  gradesSearchQuery,
                  setGradesSearchQuery,
                  setGradesSubjectFilter: setGradesSubjectFilter as any,
                } : undefined}
                onNavigateToTab={setAppMode}
              />

              {/* Floating Save Button */}
              {pendingEventMoves.length > 0 && (
                <div className="fixed bottom-6 right-6 z-50 flex gap-3 animate-in slide-in-from-bottom-4 duration-300">
                  <button
                    onClick={handleCancelPendingMoves}
                    className="px-4 py-3 bg-white text-gray-700 rounded-sm font-bold shadow-lg border border-gray-200 hover:bg-gray-50 transition-all flex items-center gap-2"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSavePendingMoves}
                    className="px-6 py-3 bg-[#fdb813] text-[#081429] rounded-sm font-bold shadow-lg hover:brightness-110 transition-all flex items-center gap-2"
                  >
                    <span className="bg-[#081429] text-white px-2 py-0.5 rounded-full text-xs font-black">{pendingEventMoves.length}</span>
                    변경사항 저장
                  </button>
                </div>
              )}
            </HeaderCollapseProvider>
          </main>
        </div>

        <ModalManager
          isGlobalSearchOpen={isGlobalSearchOpen}
          setIsGlobalSearchOpen={setIsGlobalSearchOpen}
          handleGlobalSearch={handleGlobalSearch as any}
          handleSearchSelect={handleSearchSelect}
          isLoginModalOpen={isLoginModalOpen}
          setIsLoginModalOpen={setIsLoginModalOpen}
          currentUser={currentUser}
          isProfileMenuOpen={isProfileMenuOpen}
          setIsProfileMenuOpen={setIsProfileMenuOpen}
          userProfile={userProfile}
          currentStaffMember={currentStaffMember}
          setIsPermissionViewOpen={setIsPermissionViewOpen}
          handleLogout={handleLogout}
          isPermissionViewOpen={isPermissionViewOpen}
          accessibleTabs={accessibleTabs}
          rolePermissions={rolePermissions}
          isEventModalOpen={isEventModalOpen}
          setIsEventModalOpen={setIsEventModalOpen}
          setInitialTitle={setInitialTitle}
          setPendingBucketId={setPendingBucketId}
          setTemplateEvent={setTemplateEvent}
          handleSaveEvent={handleSaveEvent}
          handleDeleteEvent={handleDeleteEvent}
          selectedDate={selectedDate}
          selectedEndDate={selectedEndDate}
          selectedDeptId={selectedDeptId}
          selectedDeptIds={selectedDeptIds}
          initialStartTime={initialStartTime}
          initialEndTime={initialEndTime}
          initialTitle={initialTitle}
          editingEvent={editingEvent}
          visibleDepartments={visibleDepartments}
          usersFromStaff={usersFromStaff}
          effectiveProfile={effectiveProfile}
          events={events}
          handleBatchUpdateAttendance={handleBatchUpdateAttendance}
          handleCopyEvent={handleCopyEvent}
          templateEvent={templateEvent}
          isSettingsOpen={isSettingsOpen}
          setIsSettingsOpen={setIsSettingsOpen}
          departments={departments}
          holidays={holidays}
          sysCategories={sysCategories}
          teachers={teachers}
          showArchived={showArchived}
          onToggleArchived={() => setShowArchived(!showArchived)}
          isTimetableSettingsOpen={isTimetableSettingsOpen}
          setIsTimetableSettingsOpen={setIsTimetableSettingsOpen}
          hasPermission={hasPermission}
          isCalendarSettingsOpen={isCalendarSettingsOpen}
          setIsCalendarSettingsOpen={setIsCalendarSettingsOpen}
          logoUrl={INJAEWON_LOGO}
          isMemoModalOpen={isMemoModalOpen}
          setIsMemoModalOpen={setIsMemoModalOpen}
          memoRecipients={memoRecipients}
          setMemoRecipients={setMemoRecipients}
          memoMessage={memoMessage}
          setMemoMessage={setMemoMessage}
          handleSendMemo={handleSendMemo}
          formatUserDisplay={formatUserDisplay as any}
          selectedMemo={selectedMemo}
          setSelectedMemo={setSelectedMemo}
          handleMarkMemoRead={handleMarkMemoRead}
          handleDeleteMemo={handleDeleteMemo}
        />
      </div>
    </RoleSimulationProvider>
  );
};

export default App;
