import React, { useState, useEffect, useRef, useMemo, Suspense, lazy } from 'react';
import { addYears, subYears, format } from 'date-fns';
import { CalendarEvent, Department, UserProfile, Holiday, ROLE_LABELS, Teacher, BucketItem, ClassKeywordColor, AppTab, TAB_META, TAB_GROUPS } from './types';
import { AttendanceViewMode, SessionPeriod } from './components/Attendance/types';
import { INITIAL_DEPARTMENTS } from './constants';
import { usePermissions } from './hooks/usePermissions';
import { useDepartments, useTeachers, useHolidays, useClassKeywords, useSystemConfig, useStaffWithAccounts, useAllStaff } from './hooks/useFirebaseQueries';
import { useGanttProjects } from './hooks/useGanttProjects';
import { useSessionPeriods } from './hooks/useSessionPeriods';
import { convertGanttProjectsToCalendarEvents } from './utils/ganttToCalendar';
import { useTabPermissions } from './hooks/useTabPermissions';
import { useEventCrud } from './hooks/useEventCrud';
import { useBucketItems } from './hooks/useBucketItems';
import { useTaskMemos } from './hooks/useTaskMemos';
import { useGlobalSearch } from './hooks/useGlobalSearch';
import { useAuth } from './hooks/useAuth';
import { formatUserDisplay, staffToUserLike } from './utils/staffHelpers';
import { storage, STORAGE_KEYS } from './utils/localStorage';

import { useStudents } from './hooks/useStudents';
import { useClasses } from './hooks/useClasses';
// State management hooks (Vercel React Best Practices: rerender-derived-state)
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

// 항상 필요한 컴포넌트 (즉시 로딩)
import LoginModal from './components/Auth/LoginModal';
import CalendarBoard from './components/Calendar/CalendarBoard';
import Sidebar from './components/Navigation/Sidebar';
import Breadcrumb, { BreadcrumbItem } from './components/Common/Breadcrumb';
import SkipLink from './components/Common/SkipLink';
import GlobalSearch from './components/Common/GlobalSearch';
import { RoleSimulationProvider, SimulationState, getEffectiveUserProfile } from './hooks/useRoleSimulation';
import RoleSimulationBanner from './components/Common/RoleSimulationBanner';
import ErrorBoundary from './components/Common/ErrorBoundary';
import { TimetableNavBar } from './components/Header/TimetableNavBar';
import { CalendarFilterBar } from './components/Header/CalendarFilterBar';
import { CalendarFilterPopover } from './components/Header/CalendarFilterPopover';
import { AttendanceNavBar } from './components/Header/AttendanceNavBar';
import { StudentsNavBar } from './components/Header/StudentsNavBar';
import { PendingApprovalOverlay } from './components/Auth/PendingApprovalOverlay';
import { ProfileDropdown } from './components/Header/ProfileDropdown';
import { PermissionViewModal } from './components/Header/PermissionViewModal';
import { MemoDropdown } from './components/Header/MemoDropdown';
import { MemoSendModal } from './components/TaskMemo/MemoSendModal';
import { MemoDetailModal } from './components/TaskMemo/MemoDetailModal';

// Performance: bundle-dynamic-imports - 모달 컴포넌트 lazy loading (~30-50KB 번들 감소)
const EventModal = lazy(() => import('./components/Calendar/EventModal'));
const SettingsModal = lazy(() => import('./components/settings/SettingsModal'));

// 탭별 컴포넌트 (lazy loading - 해당 탭 진입 시 로딩)
const TimetableManager = lazy(() => import('./components/Timetable/TimetableManager'));
const TimetableSettingsModal = lazy(() => import('./components/Timetable/TimetableSettingsModal'));
const AttendanceManager = lazy(() => import('./components/Attendance/AttendanceManager'));
const PaymentReport = lazy(() => import('./components/PaymentReport/PaymentReport'));
const GanttManager = lazy(() => import('./components/Gantt/GanttManager'));
const ConsultationManager = lazy(() => import('./components/RegistrationConsultation/ConsultationManager'));
const StudentManagementTab = lazy(() => import('./components/StudentManagement/StudentManagementTab'));
const GradesManager = lazy(() => import('./components/Grades/GradesManager'));
const ClassManagementTab = lazy(() => import('./components/ClassManagement').then(m => ({ default: m.ClassManagementTab })));
const ClassroomTab = lazy(() => import('./components/Classroom').then(m => ({ default: m.ClassroomTab })));
const ClassroomAssignmentTab = lazy(() => import('./components/ClassroomAssignment').then(m => ({ default: m.ClassroomAssignmentTab })));
const StudentConsultationTab = lazy(() => import('./components/StudentConsultation').then(m => ({ default: m.ConsultationManagementTab })));

// 신규 탭 (lazy loading)
const DashboardTab = lazy(() => import('./components/Dashboard/DashboardTab'));
const BillingManager = lazy(() => import('./components/Billing').then(m => ({ default: m.BillingManager })));
const DailyAttendanceManager = lazy(() => import('./components/DailyAttendance').then(m => ({ default: m.DailyAttendanceManager })));
const StaffManager = lazy(() => import('./components/Staff').then(m => ({ default: m.StaffManager })));
const RoleManagementPage = lazy(() => import('./components/RoleManagement/RoleManagementPage'));
const ResourceDashboard = lazy(() => import('./components/Resources').then(m => ({ default: m.ResourceDashboard })));
const WithdrawalManagementTab = lazy(() => import('./components/WithdrawalManagement/WithdrawalManagementTab'));
const CalendarSettingsModal = lazy(() => import('./components/Calendar/CalendarSettingsModal'));
// ProspectManagementTab removed - merged into ConsultationManager
import { Settings, User as UserIcon } from 'lucide-react';
import { db, auth } from './firebaseConfig';
import { collection, onSnapshot, doc, deleteDoc, query, where, updateDoc, getDocs } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { StaffMember } from './types';

// ViewMode is imported from useAppState (used by CalendarFilterBar)

// Import Firestore Converters from separate file
import { eventConverter } from './converters';

// Import Style Utilities
import { INJAEWON_LOGO, getJobTitleStyle } from './utils/styleUtils';

import { VideoLoading } from './components/Common/VideoLoading';

// Lazy loading 폴백 컴포넌트
const TabLoadingFallback = () => <VideoLoading className="flex-1 h-full" />;

const App: React.FC = () => {

  // App Mode (Top-level navigation) - null until permissions are loaded
  const [appMode, setAppMode] = useState<AppTab | null>(null);

  // ============================================
  // Custom Hooks (Vercel Best Practices: rerender-derived-state)
  // ============================================
  const calendarState = useCalendarState();
  const eventModalState = useEventModalState();
  const modalState = useModalState();
  const timetableState = useTimetableState();
  const studentFilterState = useStudentFilterState();
  const gradesFilterState = useGradesFilterState();
  const darkModeState = useDarkMode();
  const pendingMovesState = usePendingEventMoves();

  // Destructure for backward compatibility
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

  const rightDate = subYears(baseDate, 1);  // 2단: 1년 전
  const thirdDate = subYears(baseDate, 2);  // 3단: 2년 전

  // Auth State: currentUser는 useSystemConfig 등 의존성 순서 때문에 App에서 유지
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Firestore Data State - React Query for static data (cached 30-60min)
  const { data: departments = [] } = useDepartments(!!currentUser);
  const { data: teachers = [] } = useTeachers(!!currentUser);
  const { data: holidays = [] } = useHolidays(!!currentUser);
  const { data: classKeywords = [] } = useClassKeywords(!!currentUser);
  const { data: systemConfig } = useSystemConfig(!!currentUser);
  const { data: staffWithAccounts = [] } = useStaffWithAccounts(!!currentUser);

  // Auth: 프로필 동기화 + 로그아웃 (extracted to hooks/useAuth.ts)
  const { userProfile, setUserProfile, authLoading, handleLogout } = useAuth({
    setCurrentUser, systemConfig, onShowLogin: () => setIsLoginModalOpen(true),
  });

  // ========== 시뮬레이션 상태 (App 레벨 관리) ==========
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
  // ====================================================

  const lookbackYears = systemConfig?.eventLookbackYears || 2;
  const sysCategories = systemConfig?.categories || [];

  // staff 데이터를 UserProfile 형태로 변환 (기존 users 대체)
  const usersFromStaff = useMemo(() =>
    staffWithAccounts.map(staffToUserLike),
    [staffWithAccounts]
  );

  // 현재 로그인한 사용자의 StaffMember 정보
  const currentStaffMember = useMemo(() => {
    if (!currentUser || !userProfile) return undefined;
    return staffWithAccounts.find(s => s.uid === currentUser.uid || s.email === userProfile.email);
  }, [currentUser, userProfile, staffWithAccounts]);

  // 시뮬레이션 적용된 StaffMember (시뮬레이션 시 해당 사용자의 StaffMember)
  const effectiveStaffMember = useMemo(() => {
    if (!effectiveProfile) return undefined;
    // 시뮬레이션 중이 아니면 currentStaffMember 반환
    if (!isSimulating) return currentStaffMember;
    // 시뮬레이션 중이면 effectiveProfile에 해당하는 StaffMember 찾기
    // uid 또는 id 또는 email로 매칭
    return staffWithAccounts.find(s =>
      s.uid === effectiveProfile.uid ||
      s.id === effectiveProfile.uid ||
      s.email === effectiveProfile.email
    );
  }, [effectiveProfile, isSimulating, currentStaffMember, staffWithAccounts]);

  // Students and Classes for Global Search
  const { students: globalStudents = [] } = useStudents(false, !!currentUser);
  const { data: allClasses = [] } = useClasses(!!currentUser);

  // 선생님 목록 추출 (학생 enrollments에서 staffId 수집, 과목별 그룹화)
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

  // Tab Permissions


  // Real-time data (still uses onSnapshot for events)
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  // Derive unique categories from available departments
  const uniqueCategories = Array.from(new Set(departments.map(d => d.category).filter(Boolean))) as string[];

  // Attendance State (depends on userProfile)
  const [attendanceSubject, setAttendanceSubject] = useState<'math' | 'english'>('math');
  const [attendanceStaffId, setAttendanceStaffId] = useState<string | undefined>(undefined);
  const [attendanceDate, setAttendanceDate] = useState(() => new Date());

  // 세션 모드 상태 (월별/세션 토글)
  const [attendanceViewMode, setAttendanceViewMode] = useState<AttendanceViewMode>('monthly');
  const [selectedSession, setSelectedSession] = useState<SessionPeriod | null>(null);

  // 세션 카테고리 매핑: attendanceSubject -> session category
  const sessionCategory = useMemo((): 'math' | 'english' | 'eie' => {
    if (attendanceSubject === 'math') return 'math';
    if (attendanceSubject === 'english') return 'english';
    return 'math'; // 기본값
  }, [attendanceSubject]);

  // 세션 데이터 조회
  const { data: sessions = [], isLoading: isLoadingSessions } = useSessionPeriods(
    attendanceDate.getFullYear(),
    sessionCategory
  );

  // 세션 모드에서 현재 월에 맞는 세션 자동 선택
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
  // 시뮬레이션 적용된 프로필로 권한 체크
  const { hasPermission, rolePermissions } = usePermissions(effectiveProfile || null);

  // TEMPORARY: Disabled auto-initialization based on permissions
  // TODO: Re-enable after fixing permission configuration
  // Initialize timetable subject based on user's permissions (edit permission takes priority)
  // useEffect(() => {
  //   if (!userProfile) return;

  //   let initialSubject: 'math' | 'english' = 'math';

  //   // Priority 1: Edit permission (user's primary subject)
  //   if (hasPermission('timetable.english.edit')) {
  //     initialSubject = 'english';
  //   } else if (hasPermission('timetable.math.edit')) {
  //     initialSubject = 'math';
  //   }
  //   // Priority 2: View permission (if no edit permission)
  //   else if (hasPermission('timetable.english.view') && !hasPermission('timetable.math.view')) {
  //     initialSubject = 'english';
  //   }
  //   // else: default 'math'

  //   if (timetableSubject !== initialSubject) {
  //     console.log(`[Init] Setting initial timetableSubject to: ${initialSubject}`);
  //     setTimetableSubject(initialSubject);
  //   }
  // }, [userProfile, hasPermission, timetableSubject]);

  // Guard: Strictly enforce permission access to subjects (시뮬레이션 적용)
  // If a user somehow lands on a subject they don't have permission for, switch them.
  useEffect(() => {
    if (!effectiveProfile || appMode !== 'timetable') return;

    const canViewMath = hasPermission('timetable.math.view') || hasPermission('timetable.math.edit');
    const canViewEnglish = hasPermission('timetable.english.view') || hasPermission('timetable.english.edit');
    const canViewScience = hasPermission('timetable.science.view') || hasPermission('timetable.science.edit');
    const canViewKorean = hasPermission('timetable.korean.view') || hasPermission('timetable.korean.edit');

    // Check if current subject is accessible
    const canViewCurrent =
      (timetableSubject === 'math' && canViewMath) ||
      (timetableSubject === 'english' && canViewEnglish) ||
      (timetableSubject === 'science' && canViewScience) ||
      (timetableSubject === 'korean' && canViewKorean);

    if (!canViewCurrent) {
      // Switch to first available subject
      if (canViewMath) {
        console.log('[Guard] Switching to Math (first available)');
        setTimetableSubject('math');
      } else if (canViewEnglish) {
        console.log('[Guard] Switching to English (first available)');
        setTimetableSubject('english');
      } else if (canViewScience) {
        console.log('[Guard] Switching to Science (first available)');
        setTimetableSubject('science');
      } else if (canViewKorean) {
        console.log('[Guard] Switching to Korean (first available)');
        setTimetableSubject('korean');
      } else {
        console.log('[Guard] No timetable permissions, redirecting to dashboard');
        setAppMode('dashboard');
      }
    }
  }, [timetableSubject, effectiveProfile, appMode, hasPermission]);

  // Initialize attendance subject based on user's permissions (시뮬레이션 적용)
  useEffect(() => {
    if (!effectiveProfile) return;

    const isMasterOrAdmin = effectiveProfile.role === 'master' || effectiveProfile.role === 'admin';
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
  }, [effectiveProfile, hasPermission]);

  // Tab Permissions
  /* ----------------------------------------------------
     Tab Access Redirection Logic
     ---------------------------------------------------- */
  // 시뮬레이션 적용된 프로필로 탭 권한 체크
  const { canAccessTab, accessibleTabs, isLoading: isTabPermissionLoading } = useTabPermissions(effectiveProfile);

  useEffect(() => {
    // Wait for permissions to load (시뮬레이션 적용)
    if (isTabPermissionLoading || !effectiveProfile) return;

    // Priority order for tabs (dashboard first!)
    const priority: AppTab[] = ['dashboard', 'calendar', 'timetable', 'attendance', 'payment', 'gantt', 'consultation', 'students'];

    // Initial setup: if appMode is null, set to first accessible tab
    if (appMode === null) {
      const firstAccessibleTab = priority.find(tab => canAccessTab(tab));
      if (firstAccessibleTab) {
        setAppMode(firstAccessibleTab);
      } else {
        setAppMode('dashboard');
      }
      return;
    }

    // Redirect: if current mode is not accessible, redirect to first accessible tab
    const isAccessible = canAccessTab(appMode);
    if (!isAccessible) {
      const firstValidTab = priority.find(tab => canAccessTab(tab));
      if (firstValidTab) {
        setAppMode(firstValidTab);
      }
    }
  }, [appMode, canAccessTab, accessibleTabs, isTabPermissionLoading, effectiveProfile]);

  // Reset visibility when user changes (optional convenience)
  useEffect(() => {
    if (currentUser) {
      // Optional: Reset hidden departments on fresh login to ensure everything is visible
      // setHiddenDeptIds([]); 
    }
  }, [currentUser]);

  // Global Search (extracted to hooks/useGlobalSearch.ts)
  const { handleGlobalSearch, handleSearchSelect } = useGlobalSearch({
    globalStudents, events, departments, allClasses, teachers,
    setAppMode, setStudentFilters, setEditingEvent, setIsEventModalOpen, setIsGlobalSearchOpen,
  });

  // Derive Permissions (시뮬레이션 적용된 프로필 기준)
  const isMaster = effectiveProfile?.role === 'master';
  const isAdmin = effectiveProfile?.role === 'admin';
  // canEdit is now derived/overridden by departmental permissions, but global override remains for Master
  const canGlobalEdit = isMaster || isAdmin; // Admin generally has high privileges, but let's stick to granular?
  // User asked for "Admin" who can "give permissions". This implies Admin manages Users.
  // Docs say: "2. 마스터계정과 같이 '권한'들을 내려줄 수 있는 '어드민' 계정 지정"

  // Filter Departments based on RBAC AND Local Toggles (시뮬레이션 적용)
  const visibleDepartments = departments.filter(d => {
    // 1. Access Control Check
    let hasAccess = false;

    // Master and Admin have access to everything
    if (isMaster || isAdmin) {
      hasAccess = true;
    }
    // Check Granular Permissions (by ID or by name for legacy compatibility)
    else if (effectiveProfile?.departmentPermissions?.[d.id] || effectiveProfile?.departmentPermissions?.[d.name]) {
      hasAccess = true;
    }
    // Legacy Fallback
    else if (effectiveProfile?.allowedDepartments?.includes(d.id)) {
      hasAccess = true;
    }

    if (!hasAccess) return false;

    // 2. Favorites Filter (시뮬레이션 적용)
    if (showFavoritesOnly && effectiveProfile?.favoriteDepartments) {
      if (!effectiveProfile.favoriteDepartments.includes(d.id)) return false;
    }

    // 3. Local Visibility Toggle Check
    // (Users can hide departments locally even if they have access)
    if (hiddenDeptIds.includes(d.id)) return false;

    return true;
  });

  // Handle time slot click from Daily View
  const handleTimeSlotClick = (date: string, time: string) => {
    if (!hasPermission('events.create')) {
      alert("일정 생성 권한이 없습니다.");
      return;
    }
    setSelectedDate(date);
    setSelectedEndDate(date);
    setEditingEvent(null);

    setInitialStartTime(time);

    // Calculate End Time (1 hour later)
    const [h, m] = time.split(':').map(Number);
    const endH = h + 1;
    const endTimeStr = `${String(endH > 23 ? 23 : endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    setInitialEndTime(endTimeStr);

    setIsEventModalOpen(true);
  };

  // Subscribe to Events - REAL-TIME (필수)
  useEffect(() => {
    // Optimization: Fetch events from configured lookback years (default 2)
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
  }, [lookbackYears]);

  // Note: departments, staff, holidays, classKeywords, systemConfig are now handled by React Query hooks


  useEffect(() => {
    storage.setJSON(STORAGE_KEYS.DEPT_HIDDEN_IDS, hiddenDeptIds);
  }, [hiddenDeptIds]);

  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);

  // Bucket Items (extracted to hooks/useBucketItems.ts)
  const {
    bucketItems, handleAddBucketItem, handleDeleteBucketItem, handleEditBucketItem,
  } = useBucketItems({ currentUser, effectiveProfile, userProfile, usersFromStaff, hasPermission });

  // Task Memos (extracted to hooks/useTaskMemos.ts)
  const {
    taskMemos, isMemoDropdownOpen, setIsMemoDropdownOpen,
    isMemoModalOpen, setIsMemoModalOpen, memoRecipients, setMemoRecipients,
    memoMessage, setMemoMessage, selectedMemo, setSelectedMemo,
    unreadMemoCount, handleSendMemo, handleMarkMemoRead, handleDeleteMemo,
  } = useTaskMemos({ currentUser, userProfile, usersFromStaff, formatUserDisplay });

  // Search Field Dropdown State
  const [isSearchFieldDropdownOpen, setIsSearchFieldDropdownOpen] = useState(false);

  const handleCellClick = (date: string, deptId: string) => {
    if (!hasPermission('events.create')) {
      // Silent return or alert
      return;
    }

    setSelectedDate(date);
    setSelectedEndDate(date);
    setSelectedDeptId(deptId);
    setSelectedDeptIds([deptId]); // Reset to single
    setEditingEvent(null);
    setIsEventModalOpen(true);
  };

  const handleRangeSelect = (startDate: string, endDate: string, deptId: string, deptIds?: string[]) => {
    console.log('DEBUG: App handleRangeSelect', { startDate, endDate, deptId, deptIds });
    if (!hasPermission('events.create')) return;

    setSelectedDate(startDate);
    setSelectedEndDate(endDate);
    setSelectedDeptId(deptId);
    setSelectedDeptIds(deptIds || [deptId]); // Set multi-dept if present
    setEditingEvent(null);
    setIsEventModalOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setEditingEvent(event);
    setSelectedDate(event.startDate);
    setSelectedEndDate(event.endDate);
    setIsEventModalOpen(true);
  };

  // Quick Add: Click date cell in Yearly View to create new event
  const handleQuickAdd = (date: Date) => {
    if (!hasPermission('events.create')) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    setSelectedDate(dateStr);
    setSelectedEndDate(dateStr);
    setEditingEvent(null);
    setSelectedDeptId(departments[0]?.id || ''); // Default to first department
    setIsEventModalOpen(true);
  };

  const handleConvertBucketToEvent = (bucket: BucketItem) => {
    // Get first day of target month as default date
    const [year, month] = bucket.targetMonth.split('-').map(Number);
    const targetDate = new Date(year, month - 1, 1);
    const dateStr = format(targetDate, 'yyyy-MM-dd');

    // Set up modal with bucket data
    setSelectedDate(dateStr);
    setSelectedEndDate(dateStr);
    setEditingEvent(null);
    setSelectedDeptId(bucket.departmentId || departments[0]?.id || '');
    setInitialTitle(bucket.title); // Pass bucket title to modal
    setPendingBucketId(bucket.id); // Mark bucket for deletion after save
    setIsEventModalOpen(true);
    // NOTE: Do NOT delete bucket here - wait for save confirmation
  };

  const handleCopyEvent = (event: CalendarEvent) => {
    setEditingEvent(null);
    setTemplateEvent(event);
    setIsEventModalOpen(true);
  };

  // Event CRUD (extracted to hooks/useEventCrud.ts)
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

  // Toggle Favorite Department
  const toggleFavorite = async (deptId: string) => {
    if (!userProfile) return;
    const current = userProfile.favoriteDepartments || [];
    const updated = current.includes(deptId)
      ? current.filter(id => id !== deptId)
      : [...current, deptId];

    try {
      // staff 컬렉션에서 uid로 문서 찾기
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

  // --- Event Drag and Drop ---
  // --- Event Drag and Drop ---
  const handleEventMove = (original: CalendarEvent, updated: CalendarEvent) => {
    // Permission Check
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
        // Count linked events if present, otherwise 1
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
    // 부서 가시성 체크 - 'view' 권한이 있으면 해당 부서의 일정을 편집할 수 있음
    // 실제 일정 편집 권한은 events.manage_own/events.manage_others로 별도 체크됨
    const permission = effectiveProfile.departmentPermissions?.[deptId];
    return permission === 'view';
  };

  // Fetch Gantt Projects for Calendar Integration (Phase 7.3) - 시뮬레이션 적용
  const { data: ganttProjects = [] } = useGanttProjects(effectiveProfile?.uid);
  const ganttCalendarEvents = useMemo(() =>
    convertGanttProjectsToCalendarEvents(ganttProjects),
    [ganttProjects]);

  // Compute display events (apply pending moves for preview) + Merge Gantt Events
  const displayEvents = useMemo(() => {
    const calendarEventsWithMoves = events.map(event => {
      const pendingMove = pendingEventMoves.find(m => m.original.id === event.id);
      return pendingMove ? pendingMove.updated : event;
    });
    return [...calendarEventsWithMoves, ...ganttCalendarEvents];
  }, [events, pendingEventMoves, ganttCalendarEvents]);

  const pendingEventIds = pendingEventMoves.map(m => m.original.id);

  // IMPORTANT: 현재 월의 세션 찾기 - 컴포넌트 최상단에서 호출 (React Hooks 규칙 준수)
  // JSX 내부에서 조건부로 호출하면 안 됨!
  const currentMonthSession = useMemo(() => {
    const currentYear = attendanceDate.getFullYear();
    const currentMonth = attendanceDate.getMonth() + 1;
    return sessions.find(s => s.year === currentYear && s.month === currentMonth);
  }, [sessions, attendanceDate]);

  // Generate breadcrumb items based on current tab
  const breadcrumbItems: BreadcrumbItem[] = React.useMemo(() => {
    if (!appMode) return [];

    const currentTabMeta = TAB_META[appMode];
    if (!currentTabMeta) return [];

    // Find the group that contains this tab
    const currentGroup = TAB_GROUPS.find(group => group.tabs.includes(appMode));

    const items: BreadcrumbItem[] = [];

    if (currentGroup) {
      items.push({
        label: currentGroup.label,
        onClick: undefined, // Group is not clickable
      });
    }

    items.push({
      label: currentTabMeta.label,
      isActive: true,
    });

    return items;
  }, [appMode]);

  // Initial Loading Screen (Waiting for Auth or Tab Permissions or appMode initialization)
  // This prevents flashing of unauthorized content before we know which tab user can access.
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
    <div className="h-screen overflow-hidden flex bg-[#f0f4f8]">
      {/* Role Simulation Banner (마스터만 표시) */}
      <RoleSimulationBanner
        actualRole={userProfile?.role || null}
        availableUsers={usersFromStaff}
      />

      {/* Skip Link for Keyboard Navigation - Addresses Issue #7 */}
      <SkipLink targetId="main-content">메인 콘텐츠로 건너뛰기</SkipLink>

      {/* Sidebar Navigation - Addresses Issues #1, #2 */}
      <Sidebar
        currentTab={appMode}
        accessibleTabs={accessibleTabs}
        onTabSelect={(tab) => setAppMode(tab as typeof appMode)}
        logoUrl={INJAEWON_LOGO}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="no-print z-40 sticky top-0 bg-[#081429] shadow-lg flex flex-col" role="banner">
          {/* Row 1: Primary Header (Navy) */}
          <div className="bg-[#081429] h-16 flex items-center justify-between px-4 md:px-6 border-b border-white/10 z-50 relative">

            {/* Left: Breadcrumb Navigation - Addresses Issue #21 */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <Breadcrumb items={breadcrumbItems} showHome={false} />

              {/* User Info Display (Desktop) */}
              {currentUser && (
                <div className="hidden lg:flex flex-row items-center gap-1.5 ml-4 pl-4 border-l border-white/10">
                  {/* Role Badge */}
                  {userProfile?.role && (
                    <span className={`text-white text-micro px-1 py-0.5 rounded font-black tracking-tighter shadow-sm ${userProfile.role === 'master' ? 'bg-red-600' :
                      userProfile.role === 'admin' ? 'bg-indigo-600' :
                        userProfile.role === 'manager' ? 'bg-purple-600' :
                          userProfile.role === 'math_lead' ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
                            userProfile.role === 'english_lead' ? 'bg-gradient-to-r from-orange-500 to-red-500' :
                              userProfile.role === 'math_teacher' ? 'bg-green-500' :
                                userProfile.role === 'english_teacher' ? 'bg-orange-500' :
                                  'bg-gray-500'
                      }`}>
                      {ROLE_LABELS[userProfile.role] || userProfile.role.toUpperCase()}
                    </span>
                  )}
                  {/* Name */}
                  <span className="text-xs font-bold text-white whitespace-nowrap">
                    {currentStaffMember
                      ? (currentStaffMember.englishName ? `${currentStaffMember.name}(${currentStaffMember.englishName})` : currentStaffMember.name)
                      : (userProfile?.displayName || (userProfile?.email || currentUser?.email)?.split('@')[0])}
                  </span>
                  {/* Job Title Badge */}
                  <span className={`text-xxs px-1.5 py-0.5 rounded flex items-center justify-center font-bold tracking-tight whitespace-nowrap ${getJobTitleStyle(userProfile?.jobTitle)}`}>
                    {userProfile?.jobTitle || '직급 미설정'}
                  </span>
                </div>
              )}
            </div>


            {/* Right: Actions */}
            <div className="flex items-center justify-end gap-3 w-[250px]">

              {hasPermission('settings.access') && (
                <button onClick={() => setIsSettingsOpen(true)} className="text-gray-400 hover:text-white transition-colors">
                  <Settings size={20} />
                </button>
              )}
              {/* Memo/Messenger */}
              {currentUser && (
                <MemoDropdown
                  isMemoDropdownOpen={isMemoDropdownOpen}
                  setIsMemoDropdownOpen={setIsMemoDropdownOpen}
                  unreadMemoCount={unreadMemoCount}
                  taskMemos={taskMemos}
                  setIsMemoModalOpen={setIsMemoModalOpen}
                  setSelectedMemo={setSelectedMemo}
                  handleMarkMemoRead={handleMarkMemoRead}
                />
              )}

              {/* Profile Dropdown */}
              {currentUser && (
                <div className="relative">
                  <button
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    className={`transition-colors mt-[5px] ${isProfileMenuOpen ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    <UserIcon size={20} />
                  </button>


                </div>
              )}
            </div>
          </div>

          {/* Row 2: Filter Bar (Slate) - Only show in calendar mode */}
          {appMode === 'calendar' && (
            <CalendarFilterBar
              isFilterOpen={isFilterOpen}
              setIsFilterOpen={setIsFilterOpen}
              hiddenDeptIds={hiddenDeptIds}
              visibleDepartments={visibleDepartments}
              viewMode={viewMode}
              setViewMode={setViewMode}
              viewColumns={viewColumns}
              setViewColumns={setViewColumns}
              setIsCalendarSettingsOpen={setIsCalendarSettingsOpen}
            />
          )}

          {/* Row 3: Attendance Navigation Bar - Only show in attendance mode */}
          {appMode === 'attendance' && (
            <AttendanceNavBar
              effectiveProfile={effectiveProfile}
              hasPermission={hasPermission}
              teachers={teachers}
              attendanceSubject={attendanceSubject}
              setAttendanceSubject={setAttendanceSubject}
              attendanceStaffId={attendanceStaffId}
              setAttendanceStaffId={setAttendanceStaffId}
              attendanceDate={attendanceDate}
              setAttendanceDate={setAttendanceDate}
              attendanceViewMode={attendanceViewMode}
              setAttendanceViewMode={setAttendanceViewMode}
              selectedSession={selectedSession}
              setSelectedSession={setSelectedSession}
              sessions={sessions}
              setIsAttendanceAddStudentModalOpen={setIsAttendanceAddStudentModalOpen}
            />
          )}

          {/* Row 4: Students Navigation Bar - Only show in students mode */}
          {appMode === 'students' && (
            <StudentsNavBar
              studentFilters={studentFilters}
              setStudentFilters={setStudentFilters}
              isSearchFieldDropdownOpen={isSearchFieldDropdownOpen}
              setIsSearchFieldDropdownOpen={setIsSearchFieldDropdownOpen}
              teachersBySubject={teachersBySubject}
              studentSortBy={studentSortBy}
              setStudentSortBy={setStudentSortBy}
            />
          )}

          {/* Filter Popover Panel */}
          {appMode === 'calendar' && (
            <CalendarFilterPopover
              isFilterOpen={isFilterOpen}
              setIsFilterOpen={setIsFilterOpen}
              departments={departments}
              hiddenDeptIds={hiddenDeptIds}
              effectiveProfile={effectiveProfile}
              isMaster={isMaster}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              uniqueCategories={uniqueCategories}
              showFavoritesOnly={showFavoritesOnly}
              setShowFavoritesOnly={setShowFavoritesOnly}
              toggleDeptVisibility={toggleDeptVisibility}
              setAllVisibility={setAllVisibility}
              toggleFavorite={toggleFavorite}
            />
          )}

          {/* Row 2: Timetable Filter Bar - Only show in timetable mode */}
          {appMode === 'timetable' && (
            <TimetableNavBar
              timetableSubject={timetableSubject}
              setTimetableSubject={setTimetableSubject}
              timetableViewType={timetableViewType}
              setTimetableViewType={setTimetableViewType}
              mathViewMode={mathViewMode}
              setMathViewMode={setMathViewMode}
              hasPermission={hasPermission}
              setIsTimetableSettingsOpen={setIsTimetableSettingsOpen}
            />
          )}

          {/* Timetable Filter Popover Panel Removed */}
          {/* Grades Filter Bar Removed - Filter is now inside GradesManager component */}
        </header >

        <main id="main-content" className="flex-1 flex flex-col md:flex-row overflow-hidden" role="main">
          {/* Render Gating: If permission fails, show nothing (Redirect will happen in useEffect) */}
          <ErrorBoundary key={appMode}>
          {!canAccessTab(appMode) ? (
            <div className="flex-1 flex items-center justify-center bg-white">
              <VideoLoading className="flex-1 h-full" />
            </div>
          ) : appMode === 'dashboard' ? (
            /* Dashboard View */
            <Suspense fallback={<TabLoadingFallback />}>
              <div className="w-full flex-1 overflow-hidden">
                <DashboardTab userProfile={effectiveProfile} staffMember={effectiveStaffMember} />
              </div>
            </Suspense>
          ) : appMode === 'calendar' ? (
            /* Calendar View */
            <div className="w-full flex-1 max-w-full mx-auto h-full print:p-0 flex flex-col xl:flex-row print:flex-row print:gap-2 overflow-x-auto">
              {/* 1단: 현재 년도 (항상 표시) */}
              <div className={`flex-1 flex flex-col overflow-y-auto ${viewColumns >= 2 ? 'min-w-[320px] border-r-4 border-gray-400' : 'min-w-0'}`}>
                <CalendarBoard
                  currentDate={baseDate}
                  onDateChange={setBaseDate}
                  departments={visibleDepartments}
                  events={displayEvents}
                  onCellClick={handleCellClick}
                  onRangeSelect={handleRangeSelect}
                  onTimeSlotClick={handleTimeSlotClick}
                  onEventClick={handleEventClick}
                  holidays={holidays}
                  viewMode={viewMode}
                  currentUser={effectiveProfile}
                  onEventMove={handleEventMove}
                  canEditDepartment={canEditDepartment}
                  pendingEventIds={pendingEventIds}
                  onViewChange={setViewMode}
                  showSidePanel={viewColumns === 1} // Only show detail side panel in single column mode
                  onQuickAdd={handleQuickAdd}
                  bucketItems={bucketItems}
                  onAddBucket={handleAddBucketItem}
                  onEditBucket={handleEditBucketItem}
                  onDeleteBucket={handleDeleteBucketItem}
                  onConvertBucket={handleConvertBucketToEvent}
                  showArchived={showArchived} // Phase 9
                />
              </div>

              {/* 2단: 1년 전 (viewColumns >= 2 일 때 표시) */}
              <div className={`flex-1 flex flex-col overflow-hidden min-w-[320px] transition-all duration-300 ${viewColumns >= 2 ? (viewColumns >= 3 ? 'border-r-4 border-gray-400' : '') : 'hidden'}`}>
                <CalendarBoard
                  currentDate={rightDate}
                  onDateChange={(date) => setBaseDate(addYears(date, 1))}
                  departments={visibleDepartments}
                  events={displayEvents}
                  onCellClick={handleCellClick}
                  onRangeSelect={handleRangeSelect}
                  onTimeSlotClick={handleTimeSlotClick}
                  onEventClick={handleEventClick}
                  holidays={holidays}
                  viewMode={viewMode}
                  onEventMove={handleEventMove}
                  canEditDepartment={canEditDepartment}
                  pendingEventIds={pendingEventIds}
                  isPrimaryView={false} // Hide My Events
                  onViewChange={setViewMode}
                  showSidePanel={false} // Always hide side panel for comparison views
                  currentUser={effectiveProfile}
                  showArchived={showArchived} // Phase 9
                />
              </div>

              {/* 3단: 2년 전 (viewColumns >= 3 일 때 표시) */}
              <div className={`flex-1 flex flex-col overflow-hidden min-w-[320px] transition-all duration-300 ${viewColumns >= 3 ? '' : 'hidden'}`}>
                <CalendarBoard
                  currentDate={thirdDate}
                  onDateChange={(date) => setBaseDate(addYears(date, 2))}
                  departments={visibleDepartments}
                  events={displayEvents}
                  onCellClick={handleCellClick}
                  onRangeSelect={handleRangeSelect}
                  onTimeSlotClick={handleTimeSlotClick}
                  onEventClick={handleEventClick}
                  holidays={holidays}
                  viewMode={viewMode}
                  onEventMove={handleEventMove}
                  canEditDepartment={canEditDepartment}
                  pendingEventIds={pendingEventIds}
                  isPrimaryView={false} // Hide My Events
                  onViewChange={setViewMode}
                  showSidePanel={false}
                  currentUser={effectiveProfile}
                  showArchived={showArchived} // Phase 9
                />
              </div>
            </div>
          ) : appMode === 'timetable' ? (
            /* Timetable View */
            <Suspense fallback={<TabLoadingFallback />}>
              <div className="w-full flex-1 overflow-hidden">
                <TimetableManager
                  subjectTab={timetableSubject}
                  onSubjectChange={setTimetableSubject}
                  viewType={timetableViewType}
                  onViewTypeChange={setTimetableViewType}
                  currentUser={effectiveProfile}
                  /* Removed global state props */
                  teachers={teachers}
                  classKeywords={classKeywords}
                  mathViewMode={mathViewMode}
                  onMathViewModeChange={setMathViewMode}
                />
              </div>
            </Suspense>
          ) : appMode === 'payment' ? (
            /* Payment Report View */
            <Suspense fallback={<TabLoadingFallback />}>
              <div className="w-full flex-1 overflow-auto">
                <PaymentReport />
              </div>
            </Suspense>
          ) : appMode === 'gantt' ? (
            /* Gantt Chart View */
            <Suspense fallback={<TabLoadingFallback />}>
              <div className="w-full flex-1 overflow-auto bg-[#f8f9fa]">
                <GanttManager userProfile={effectiveProfile} allUsers={usersFromStaff} />
              </div>
            </Suspense>
          ) : appMode === 'consultation' ? (
            /* Consultation Manager View */
            <Suspense fallback={<TabLoadingFallback />}>
              <div className="w-full flex-1 overflow-auto">
                <ConsultationManager
                  userProfile={effectiveProfile}
                />
              </div>
            </Suspense>
          ) : appMode === 'attendance' ? (
            /* Attendance Manager View */
            <Suspense fallback={<TabLoadingFallback />}>
              <div className="w-full flex-1 flex flex-col overflow-hidden">
                <AttendanceManager
                  userProfile={effectiveProfile}
                  teachers={teachers}
                  selectedSubject={attendanceSubject}
                  selectedStaffId={attendanceStaffId}
                  currentDate={attendanceDate}
                  isAddStudentModalOpen={isAttendanceAddStudentModalOpen}
                  onCloseAddStudentModal={() => setIsAttendanceAddStudentModalOpen(false)}
                  viewMode={attendanceViewMode}
                  selectedSession={selectedSession}
                />
              </div>
            </Suspense>
          ) : appMode === 'students' ? (
            /* Student Management View */
            <Suspense fallback={<TabLoadingFallback />}>
              <div className="w-full flex-1 overflow-auto">
                <StudentManagementTab
                  filters={studentFilters}
                  sortBy={studentSortBy}
                  currentUser={effectiveProfile}
                />
              </div>
            </Suspense>
            /* prospects tab removed - merged into consultation */
          ) : appMode === 'grades' ? (
            /* Grades Management View */
            <Suspense fallback={<TabLoadingFallback />}>
              <div className="w-full flex-1 overflow-auto">
                <GradesManager
                  subjectFilter={gradesSubjectFilter}
                  searchQuery={gradesSearchQuery}
                  onSearchChange={setGradesSearchQuery}
                  onSubjectFilterChange={setGradesSubjectFilter}
                  currentUser={effectiveProfile}
                />
              </div>
            </Suspense>
          ) : appMode === 'classes' ? (
            /* Class Management View */
            <Suspense fallback={<TabLoadingFallback />}>
              <div className="w-full flex-1 min-h-0 overflow-hidden">
                <ClassManagementTab currentUser={effectiveProfile} />
              </div>
            </Suspense>
          ) : appMode === 'classroom' ? (
            /* Classroom Usage Grid View */
            <Suspense fallback={<TabLoadingFallback />}>
              <div className="w-full flex-1 min-h-0 overflow-hidden">
                <ClassroomTab />
              </div>
            </Suspense>
          ) : appMode === 'classroom-assignment' ? (
            /* Classroom Auto-Assignment View */
            <Suspense fallback={<TabLoadingFallback />}>
              <div className="w-full flex-1 min-h-0 overflow-hidden">
                <ClassroomAssignmentTab />
              </div>
            </Suspense>
          ) : appMode === 'student-consultations' ? (
            /* Student Consultation Management View */
            <Suspense fallback={<TabLoadingFallback />}>
              <div className="w-full flex-1 overflow-auto">
                <StudentConsultationTab currentUser={effectiveProfile} />
              </div>
            </Suspense>
          ) : appMode === 'billing' ? (
            /* Billing Management View */
            <Suspense fallback={<TabLoadingFallback />}>
              <div className="w-full flex-1 overflow-auto">
                <BillingManager userProfile={effectiveProfile} />
              </div>
            </Suspense>
          ) : appMode === 'daily-attendance' ? (
            /* Daily Attendance Management View */
            <Suspense fallback={<TabLoadingFallback />}>
              <div className="w-full flex-1 overflow-auto">
                <DailyAttendanceManager userProfile={effectiveProfile} />
              </div>
            </Suspense>
          ) : appMode === 'staff' ? (
            /* Staff Management View */
            <Suspense fallback={<TabLoadingFallback />}>
              <div className="w-full flex-1 overflow-auto">
                <StaffManager
                  currentUserProfile={effectiveProfile}
                />
              </div>
            </Suspense>
          ) : appMode === 'role-management' ? (
            /* Role Management View */
            <Suspense fallback={<TabLoadingFallback />}>
              <div className="w-full flex-1 overflow-hidden">
                <RoleManagementPage
                  currentUser={effectiveProfile}
                />
              </div>
            </Suspense>
          ) : appMode === 'resources' ? (
            /* Resources Dashboard View */
            <Suspense fallback={<TabLoadingFallback />}>
              <div className="w-full flex-1 overflow-hidden">
                <ResourceDashboard
                  userProfile={effectiveProfile}
                />
              </div>
            </Suspense>
          ) : appMode === 'withdrawal' ? (
            /* Withdrawal Management View */
            <Suspense fallback={<TabLoadingFallback />}>
              <div className="w-full flex-1 overflow-auto">
                <WithdrawalManagementTab
                  currentUser={effectiveProfile}
                />
              </div>
            </Suspense>
          ) : null}
          </ErrorBoundary>

          {/* Floating Save Button for Pending Moves */}
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
        </main>
      </div>

      {/* Global Search Modal - Addresses Issue #10 */}
      <GlobalSearch
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        onSearch={handleGlobalSearch}
        onSelect={handleSearchSelect}
      />

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        canClose={!!currentUser} // Only allow close if logged in
      />

      {/* Profile Dropdown Menu (Moved to Root to avoid z-index trap) */}
      <ProfileDropdown
        isOpen={isProfileMenuOpen}
        onClose={() => setIsProfileMenuOpen(false)}
        userProfile={userProfile}
        currentStaffMember={currentStaffMember}
        onOpenPermissionView={() => setIsPermissionViewOpen(true)}
        onLogout={handleLogout}
      />

      {/* Permission View Modal */}
      <PermissionViewModal
        isOpen={isPermissionViewOpen}
        onClose={() => setIsPermissionViewOpen(false)}
        userProfile={userProfile}
        accessibleTabs={accessibleTabs}
        rolePermissions={rolePermissions}
      />

      {/* Event Modal - Performance: lazy loaded */}
      {isEventModalOpen && (
        <Suspense fallback={<div className="fixed inset-0 bg-white/80 flex items-center justify-center z-50"><VideoLoading className="h-screen" /></div>}>
          <EventModal
            isOpen={isEventModalOpen}
            onClose={() => { setIsEventModalOpen(false); setInitialTitle(''); setPendingBucketId(null); setTemplateEvent(null); }}
            onSave={handleSaveEvent}
            onDelete={handleDeleteEvent}
            initialDate={selectedDate}
            initialEndDate={selectedEndDate}
            initialDepartmentId={selectedDeptId}
            initialDepartmentIds={selectedDeptIds} // Pass multi-select
            initialStartTime={initialStartTime}
            initialEndTime={initialEndTime}
            initialTitle={initialTitle}
            existingEvent={editingEvent}
            departments={visibleDepartments} // ONLY Pass visible
            // Granular Permission Update:
            // We do NOT forcefully set readOnly based on global edit anymore.
            // EventModal will check `userProfile.departmentPermissions` vs `selectedDeptId`.
            readOnly={false}
            users={usersFromStaff}
            currentUser={effectiveProfile}
            allEvents={events}
            onBatchUpdateAttendance={handleBatchUpdateAttendance}
            onCopy={handleCopyEvent}
            templateEvent={templateEvent}
          />
        </Suspense>
      )}

      {/* Settings Modal - Performance: lazy loaded */}
      {isSettingsOpen && (
        <Suspense fallback={<div className="fixed inset-0 bg-white/80 flex items-center justify-center z-50"><VideoLoading className="h-screen" /></div>}>
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            departments={departments}
            currentUserProfile={effectiveProfile}
            users={usersFromStaff}
            holidays={holidays}
            events={events}
            sysCategories={sysCategories}
            teachers={teachers}
            showArchived={showArchived}
            onToggleArchived={() => setShowArchived(!showArchived)}
          />
        </Suspense>
      )}

      {/* Timetable Settings Modal - 시간표 탭 상단에서 열림 */}
      {isTimetableSettingsOpen && (
        <Suspense fallback={null}>
          <TimetableSettingsModal
            isOpen={isTimetableSettingsOpen}
            onClose={() => setIsTimetableSettingsOpen(false)}
            canEdit={hasPermission('timetable.math.edit') || hasPermission('timetable.english.edit')}
            currentUser={effectiveProfile}
          />
        </Suspense>
      )}

      {/* Calendar Settings Modal - 연간 일정 네비게이션에서 열림 */}
      {isCalendarSettingsOpen && (
        <Suspense fallback={null}>
          <CalendarSettingsModal
            isOpen={isCalendarSettingsOpen}
            onClose={() => setIsCalendarSettingsOpen(false)}
            currentUser={effectiveProfile}
          />
        </Suspense>
      )}

      {/* Access Denied / Pending Approval Overlay */}
      {currentUser && userProfile?.status === 'pending' && (
        <PendingApprovalOverlay logoUrl={INJAEWON_LOGO} onLogout={handleLogout} />
      )}

      {/* Memo Send Modal */}
      <MemoSendModal
        isOpen={isMemoModalOpen}
        onClose={() => setIsMemoModalOpen(false)}
        usersFromStaff={usersFromStaff}
        currentUser={currentUser}
        memoRecipients={memoRecipients}
        setMemoRecipients={setMemoRecipients}
        memoMessage={memoMessage}
        setMemoMessage={setMemoMessage}
        handleSendMemo={handleSendMemo}
        formatUserDisplay={formatUserDisplay}
      />

      {/* Memo Detail Modal */}
      <MemoDetailModal
        selectedMemo={selectedMemo}
        onClose={() => setSelectedMemo(null)}
        onReply={(senderUid) => {
          setMemoRecipients([senderUid]);
          setIsMemoModalOpen(true);
          setSelectedMemo(null);
        }}
        handleMarkMemoRead={handleMarkMemoRead}
        handleDeleteMemo={handleDeleteMemo}
      />
    </div >
    </RoleSimulationProvider>
  );
};

export default App;
