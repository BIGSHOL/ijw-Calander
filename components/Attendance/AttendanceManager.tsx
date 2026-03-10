import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Users, UserMinus, UserPlus, Settings, Calendar, Image, CalendarOff, LayoutList, SortAsc, Receipt, RefreshCw, X, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { storage, STORAGE_KEYS } from '../../utils/localStorage';
import { VideoLoading } from '../Common/VideoLoading';
import { Student, SalaryConfig, SalarySettingItem, MonthlySettlement, AttendanceSubject, AttendanceViewMode, SessionPeriod } from './types';
import { formatCurrency, calculateStats, getCategoryLabel, getLocalYearMonth } from './utils';
import Table from './components/Table';
import SalarySettings from './components/SalarySettings';
import StudentDetailModal from '../StudentManagement/StudentDetailModal';
import SettlementModal from './components/SettlementModal';
import StudentListModal from './components/StudentListModal';
import AddStudentToAttendanceModal from './components/AddStudentToAttendanceModal';
import AttendanceSettingsModal from './AttendanceSettingsModal';
import SessionSettingsModal from './SessionSettingsModal';
import EnrollmentTermPopover from './components/EnrollmentTermPopover';

import {
  useAttendanceStudents,
  useAttendanceConfig,
  useUpdateAttendance,
  useUpdateMemo,
  useUpdateHomework,
  useUpdateCellColor,
  useUpdateSalarySettingOverride,
  useSaveAttendanceConfig,
  useMonthlySettlement,
  useSaveMonthlySettlement
} from '../../hooks/useAttendance';
import { useExamsByDateMap, useScoresByExams } from '../../hooks/useExamsByDate';
import { useCreateDailyAttendance } from '../../hooks/useDailyAttendance';
import { useVisibleAttendanceStudents } from '../../hooks/useVisibleAttendanceStudents';
import { useHolidays } from '../../hooks/useFirebaseQueries';
import { useStudents } from '../../hooks/useStudents';
import { useMonthlyEnrollmentTerms } from '../../hooks/useEnrollmentTerms';
import { useBilling } from '../../hooks/useBilling';
import { UserProfile, Teacher, UnifiedStudent } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';
import { mapAttendanceValueToStatus } from '../../utils/attendanceSync';
import { secureLog, secureWarn } from '../../utils/secureLog';
import { useEdutrixSync, SyncResult, SyncDetail } from '../../hooks/useEdutrixSync';

// Default salary config for new setups
const INITIAL_SALARY_CONFIG: SalaryConfig = {
  academyFee: 8.9,
  items: [
    { id: 'default-elem', name: '초등', color: '#FACC15', type: 'fixed', fixedRate: 25000, baseTuition: 0, ratio: 45 },
    { id: 'default-mid', name: '중등', color: '#C084FC', type: 'fixed', fixedRate: 35000, baseTuition: 0, ratio: 45 },
    { id: 'default-high', name: '고등', color: '#3B82F6', type: 'fixed', fixedRate: 45000, baseTuition: 0, ratio: 45 },
  ],
  incentives: {
    blogType: 'fixed',
    blogAmount: 50000,
    blogRate: 2,
    retentionAmount: 100000,
    retentionTargetRate: 0,
  }
};

interface AttendanceManagerProps {
  userProfile: UserProfile | null;
  teachers?: Teacher[];
  selectedSubject: AttendanceSubject;
  selectedStaffId?: string;
  currentDate: Date;
  isAddStudentModalOpen?: boolean;
  onCloseAddStudentModal?: () => void;
  viewMode?: AttendanceViewMode;
  selectedSession?: SessionPeriod | null;
}

// Helper to group updates by student ID
const groupUpdates = <T,>(updates: Record<string, T>): Record<string, Record<string, T>> => {
  const grouped: Record<string, Record<string, T>> = {};
  Object.entries(updates).forEach(([key, value]) => {
    // 키 형식: "studentId\tcompositeKey" (탭 구분자로 studentId와 복합키 분리)
    const sepIdx = key.indexOf('\t');
    if (sepIdx > 0) {
      const studentId = key.substring(0, sepIdx);
      const compositeKey = key.substring(sepIdx + 1);
      if (!grouped[studentId]) grouped[studentId] = {};
      grouped[studentId][compositeKey] = value;
    }
  });
  return grouped;
};


const AttendanceManager: React.FC<AttendanceManagerProps> = ({
  userProfile,
  teachers = [],
  selectedSubject,
  selectedStaffId,
  currentDate,
  isAddStudentModalOpen,
  onCloseAddStudentModal,
  viewMode = 'monthly',
  selectedSession = null
}) => {
  const { hasPermission } = usePermissions(userProfile);

  // Permission checks (consolidated)
  const canManageOwn = hasPermission('attendance.manage_own');
  const canEditAll = hasPermission('attendance.edit_all');
  const canManageMath = hasPermission('attendance.manage_math');
  const canManageEnglish = hasPermission('attendance.manage_english');
  const canManageSessions = hasPermission('attendance.manage_sessions');  // 세션 설정 권한

  // Determine user's staffId for filtering (if they are a teacher)
  // Uses explicit User-Teacher linking from user profile (set in System Settings -> Users)
  const currentStaffId = useMemo(() => {
    if (!userProfile) return undefined;
    // Use staffId from UserProfile
    return userProfile.staffId || undefined;
  }, [userProfile]);

  // Determine if user can manage the current subject (for teacher dropdown access)
  const canManageCurrentSubject = useMemo(() => {
    if (canManageMath && canManageEnglish) return true;
    if (selectedSubject === 'math' && canManageMath) return true;
    if (selectedSubject === 'english' && canManageEnglish) return true;
    return false;
  }, [selectedSubject, canManageMath, canManageEnglish]);

  // 이미지 저장 가능 여부 (조회 권한이 있으면 저장 가능)
  const canExportImage = useMemo(() => {
    // 해당 과목 관리 권한이 있으면 가능
    if (canManageCurrentSubject) return true;
    // 본인 출석부 관리 권한 + 연결된 강사가 있으면 본인 출석부만 저장 가능
    if (canManageOwn && currentStaffId) return true;
    return false;
  }, [canManageCurrentSubject, canManageOwn, currentStaffId]);

  // Available teachers for filter dropdown (based on manage permission for current subject)
  const availableTeachers = useMemo(() => {
    if (!canManageCurrentSubject) return [];
    // Filter by subject and exclude hidden teachers
    return teachers.filter(t => {
      // 출석부에서 숨김 처리된 강사 제외
      if (t.isHiddenInAttendance) return false;
      if (selectedSubject === 'math') return t.subjects?.includes('math');
      if (selectedSubject === 'english') return t.subjects?.includes('english');
      return true;
    });
  }, [teachers, selectedSubject, canManageCurrentSubject]);

  // Determine which staffId to filter by
  const filterStaffId = useMemo(() => {
    if (canManageCurrentSubject) {
      // Use selectedStaffId directly
      return selectedStaffId || (availableTeachers.length > 0 ? availableTeachers[0].id : undefined);
    }
    // Regular teacher - only show their own students
    return currentStaffId;
  }, [canManageCurrentSubject, selectedStaffId, currentStaffId, availableTeachers]);

  // Firebase Hooks - Pass yearMonth to load attendance records for current month
  const currentYearMonth = useMemo(() => {
    return getLocalYearMonth(currentDate);
  }, [currentDate]);

  const { students: allStudents, allStudents: rawAllStudents, isLoading: isLoadingStudents, refetch } = useAttendanceStudents({
    staffId: filterStaffId,
    subject: selectedSubject,
    yearMonth: currentYearMonth,
    enabled: !!userProfile,
  });

  // Exam/Grades Integration - Calculate date range for current month
  const examDateRange = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { startDate, endDate };
  }, [currentDate]);

  // Fetch exams for current month
  const { examsByDate, exams = [] } = useExamsByDateMap(
    examDateRange.startDate,
    examDateRange.endDate,
    selectedSubject
  );

  // Fetch scores for all students and exams in current month
  const studentIds = useMemo(() => allStudents.map(s => s.id), [allStudents]);
  const examIds = useMemo(() => exams.map(e => e.id), [exams]);
  const { data: scoresByStudent } = useScoresByExams(studentIds, examIds);

  // Fetch holidays for attendance table styling
  const { data: holidays = [] } = useHolidays(!!userProfile);

  // 등록차수 데이터 (월별)
  const { data: enrollmentTerms } = useMonthlyEnrollmentTerms(currentYearMonth);

  // Resolve Teacher by Staff ID for Config
  const targetTeacher = useMemo(() => {
    if (!filterStaffId) return undefined;
    return teachers.find(t => t.id === filterStaffId);
  }, [filterStaffId, teachers]);

  const configId = targetTeacher ? `salary_${targetTeacher.id}` : 'salary';

  const { data: firebaseConfig, isLoading: isLoadingConfig } = useAttendanceConfig(configId, !!userProfile);
  const salaryConfig = firebaseConfig || INITIAL_SALARY_CONFIG;

  // Mutations
  const updateAttendanceMutation = useUpdateAttendance();
  const updateMemoMutation = useUpdateMemo();
  const updateHomeworkMutation = useUpdateHomework();
  const updateCellColorMutation = useUpdateCellColor();
  const updateSalarySettingMutation = useUpdateSalarySettingOverride();
  const saveConfigMutation = useSaveAttendanceConfig();
  const createDailyAttendanceMutation = useCreateDailyAttendance();

  // Local state for modals
  const [activeTab, setActiveTab] = useState<'attendance' | 'salary'>('attendance');
  const [isSalaryModalOpen, setSalaryModalOpen] = useState(false);
  const [isStudentModalOpen, setStudentModalOpen] = useState(false);
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  const [isSessionSettingsModalOpen, setSessionSettingsModalOpen] = useState(false);

  // Use props if provided, otherwise default to closed (or local state if we strictly needed it, but here strict prop control is fine as App controls it)
  // Actually, we should allow local control if props aren't passed, but for now we assume App passes them.
  // To be safe: use provided prop or false.
  // Internal state is removed. IsAddStudentModalOpen is now controlled by App.
  const isAddStudentOpen = isAddStudentModalOpen || false;
  const closeAddStudent = onCloseAddStudentModal || (() => { });

  // 전체 학생 목록 (특강/보강 학생 추가용) - 모달 열릴 때만 로드
  const { students: allSystemStudents = [] } = useStudents(false, isAddStudentOpen);

  const [isSettlementModalOpen, setSettlementModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  // 등록차수 팝오버 상태
  const [enrollmentPopover, setEnrollmentPopover] = useState<{
    studentId: string;
    studentName: string;
    rect: { top: number; left: number };
  } | null>(null);

  const handleEnrollmentTermClick = useCallback((studentId: string, studentName: string, rect: { top: number; left: number }) => {
    setEnrollmentPopover({ studentId, studentName, rect });
  }, []);

  const [listModal, setListModal] = useState<{ isOpen: boolean, type: 'new' | 'dropped' }>({ isOpen: false, type: 'new' });
  const [sortMode, setSortMode] = useState<'class' | 'name'>(() => {
    const saved = storage.getString(STORAGE_KEYS.ATTENDANCE_SORT_MODE);
    return saved === 'name' ? 'name' : 'class';
  });
  const handleSortModeChange = useCallback((mode: 'class' | 'name') => {
    setSortMode(mode);
    storage.setString(STORAGE_KEYS.ATTENDANCE_SORT_MODE, mode);
  }, []);

  // 테이블 ref (이미지 내보내기용)
  const tableRef = useRef<HTMLTableElement>(null);

  // Group order state (per teacher, stored in localStorage)
  const groupOrderKey = STORAGE_KEYS.attendanceGroupOrder(filterStaffId || 'all', selectedSubject);
  const [groupOrder, setGroupOrder] = useState<string[]>(() => {
    try {
      return storage.getJSON<string[]>(groupOrderKey, []);
    } catch { return []; }
  });

  // Persist group order changes
  const handleGroupOrderChange = useCallback((newOrder: string[]) => {
    setGroupOrder(newOrder);
    storage.setJSON(groupOrderKey, newOrder);
  }, [groupOrderKey]);

  // Collapsed groups state (per teacher, stored in localStorage)
  const collapsedGroupsKey = STORAGE_KEYS.attendanceCollapsedGroups(filterStaffId || 'all', selectedSubject);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    try {
      const saved = storage.getJSON<string[]>(collapsedGroupsKey, []);
      return new Set(saved);
    } catch { return new Set(); }
  });

  // Persist collapsed groups changes
  const handleCollapsedGroupsChange = useCallback((newCollapsed: Set<string>) => {
    setCollapsedGroups(newCollapsed);
    storage.setJSON(collapsedGroupsKey, Array.from(newCollapsed));
  }, [collapsedGroupsKey]);

  // 숨긴 날짜 열 (per teacher/subject, localStorage에서 로드)
  const hiddenDatesKey = STORAGE_KEYS.attendanceHiddenDates(filterStaffId || 'all', selectedSubject);
  const [hiddenDates, setHiddenDates] = useState<Set<string>>(() => {
    try {
      const saved = storage.getJSON<string[]>(hiddenDatesKey, []);
      return new Set(saved);
    } catch { return new Set(); }
  });

  const handleHiddenDatesChange = useCallback((newHidden: Set<string>) => {
    setHiddenDates(newHidden);
    storage.setJSON(hiddenDatesKey, Array.from(newHidden));
  }, [hiddenDatesKey]);

  // Sync localStorage-backed states when key changes (teacher/subject switch)
  // useState initializer only runs on mount, so we need useEffect to reload
  useEffect(() => {
    try {
      setGroupOrder(storage.getJSON<string[]>(groupOrderKey, []));
    } catch { setGroupOrder([]); }
  }, [groupOrderKey]);

  useEffect(() => {
    try {
      const saved = storage.getJSON<string[]>(collapsedGroupsKey, []);
      setCollapsedGroups(new Set(saved));
    } catch { setCollapsedGroups(new Set()); }
  }, [collapsedGroupsKey]);

  useEffect(() => {
    try {
      const saved = storage.getJSON<string[]>(hiddenDatesKey, []);
      setHiddenDates(new Set(saved));
    } catch { setHiddenDates(new Set()); }
  }, [hiddenDatesKey]);

  // 주말 회색 처리 상태 (localStorage에서 로드)
  const [highlightWeekends, setHighlightWeekends] = useState<boolean>(() => {
    return storage.getJSON<boolean>(STORAGE_KEYS.ATTENDANCE_HIGHLIGHT_WEEKENDS, false);
  });
  const [showExpectedBilling, setShowExpectedBilling] = useState<boolean>(() => {
    return storage.getJSON<boolean>(STORAGE_KEYS.ATTENDANCE_SHOW_EXPECTED_BILLING, false);
  });

  // 주말 회색 처리 토글
  const handleToggleHighlightWeekends = useCallback(() => {
    const newValue = !highlightWeekends;
    setHighlightWeekends(newValue);
    storage.setJSON(STORAGE_KEYS.ATTENDANCE_HIGHLIGHT_WEEKENDS, newValue);
  }, [highlightWeekends]);

  const handleToggleExpectedBilling = useCallback(() => {
    const newValue = !showExpectedBilling;
    setShowExpectedBilling(newValue);
    storage.setJSON(STORAGE_KEYS.ATTENDANCE_SHOW_EXPECTED_BILLING, newValue);
  }, [showExpectedBilling]);

  const [showSettlement, setShowSettlement] = useState<boolean>(() => {
    return storage.getJSON<boolean>(STORAGE_KEYS.ATTENDANCE_SHOW_SETTLEMENT, false);
  });
  const handleToggleSettlement = useCallback(() => {
    const newValue = !showSettlement;
    setShowSettlement(newValue);
    storage.setJSON(STORAGE_KEYS.ATTENDANCE_SHOW_SETTLEMENT, newValue);
  }, [showSettlement]);

  // Optimistic UI State: { [studentId_dateKey]: value }
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, number | null>>({});
  const [pendingMemos, setPendingMemos] = useState<Record<string, string>>({});

  // Monthly Settlement from Firebase (cost-optimized: only current month)
  const { data: currentMonthSettlement, isLoading: isLoadingSettlement } = useMonthlySettlement(currentYearMonth, !!userProfile);
  const saveSettlementMutation = useSaveMonthlySettlement();

  // Edutrix 보고서 동기화
  const { syncFromEdutrix, resetSync, isSyncing, isResetting, lastResult: syncResult } = useEdutrixSync();
  const [showSyncResult, setShowSyncResult] = useState(false);
  const [showSyncLogModal, setShowSyncLogModal] = useState(false);

  const handleEdutrixSync = useCallback(async () => {
    console.log('[AttendanceManager] handleEdutrixSync:', currentYearMonth);
    try {
      const result = await syncFromEdutrix(currentYearMonth, filterStaffId);
      console.log('[AttendanceManager] 동기화 결과:', result);
      setShowSyncResult(true);
      setShowSyncLogModal(true);
    } catch (err) {
      console.error('[AttendanceManager] Edutrix 동기화 실패:', err);
      alert('Edutrix 동기화에 실패했습니다. 콘솔을 확인해주세요.');
    }
  }, [syncFromEdutrix, currentYearMonth, filterStaffId]);

  const handleEdutrixReset = useCallback(async () => {
    if (!confirm(`${currentYearMonth} 월의 전체 출석 데이터를 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      const count = await resetSync(currentYearMonth);
      alert(`${count}건의 출석 데이터가 초기화되었습니다.`);
      setShowSyncResult(false);
    } catch (err) {
      console.error('[AttendanceManager] 초기화 실패:', err);
      alert('초기화에 실패했습니다. 콘솔을 확인해주세요.');
    }
  }, [resetSync, currentYearMonth]);

  // 이미지 내보내기 상태 (MOVED: early return 전에 모든 hooks 호출)
  const [isExporting, setIsExporting] = useState(false);

  // Helper for settlement (MOVED: must be before finalSalary useMemo)
  const currentMonthKey = currentYearMonth;
  const currentSettlement = currentMonthSettlement || {
    hasBlog: false,
    hasRetention: false,
    otherAmount: 0,
    note: ''
  };

  // MOVED: All useMemo hooks must be before early return (React Hooks rules)
  // OPTIMIZATION: Vercel React Best Practices (rerender-derived-state)
  // - 90+ 줄 useMemo → useVisibleAttendanceStudents 커스텀 훅으로 분리
  // - 독립적으로 메모이제이션되어 불필요한 재계산 방지
  const visibleStudents = useVisibleAttendanceStudents(allStudents, currentDate, groupOrder);

  const pendingUpdatesByStudent = useMemo(() => groupUpdates(pendingUpdates), [pendingUpdates]);
  const pendingMemosByStudent = useMemo(() => groupUpdates(pendingMemos), [pendingMemos]);

  // 출석부 총 행 수 (수업별 확장 포함 - 그룹별 합계와 일치)
  const totalStudentRows = visibleStudents.length;

  // 전체 페이지 기준 그룹별 학생 수 (페이지네이션과 무관하게 정확한 카운트)
  const totalGroupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    visibleStudents.forEach(s => {
      const group = s.group || '그룹 없음';
      counts.set(group, (counts.get(group) || 0) + 1);
    });
    return counts;
  }, [visibleStudents]);

  // 확정된 월은 저장된 설정 사용, 미확정 월은 전역 설정 사용
  const effectiveSalaryConfig = useMemo(() =>
    currentSettlement.isFinalized && currentSettlement.salaryConfig
      ? currentSettlement.salaryConfig
      : salaryConfig,
    [currentSettlement.isFinalized, currentSettlement.salaryConfig, salaryConfig]
  );

  // 수납 데이터에서 학생별 납입금액 Map 생성
  const { records: billingRecords } = useBilling(currentYearMonth);

  const billingPaidMap = useMemo(() => {
    const map = new Map<string, number>();
    billingRecords.forEach(r => {
      if (r.status === 'paid' && r.paidAmount > 0) {
        map.set(r.studentName, (map.get(r.studentName) || 0) + r.paidAmount);
      }
    });
    return map;
  }, [billingRecords]);

  const stats = useMemo(() =>
    calculateStats(allStudents, visibleStudents, effectiveSalaryConfig, currentDate, rawAllStudents, billingPaidMap),
    [allStudents, visibleStudents, effectiveSalaryConfig, currentDate, rawAllStudents, billingPaidMap]
  );

  const finalSalary = useMemo(() => {
    let total = stats.totalSalary;
    // 블로그 인센티브: 고정금 또는 비율 가산
    if (currentSettlement.hasBlog) {
      const blogBonus = effectiveSalaryConfig.incentives.blogType === 'percentage'
        ? Math.round(stats.totalSalary * (effectiveSalaryConfig.incentives.blogRate ?? 2) / 100)
        : (effectiveSalaryConfig.incentives.blogAmount ?? 0);
      total += blogBonus;
    }
    if (currentSettlement.hasRetention) total += effectiveSalaryConfig.incentives.retentionAmount;
    total += (currentSettlement.otherAmount || 0);
    return total;
  }, [stats.totalSalary, currentSettlement, effectiveSalaryConfig.incentives]);

  // MOVED: All event handlers (useCallback) must be before early return (React Hooks rules)
  /**
   * 출석부 데이터를 출결 관리 시스템에 동기화
   * 출석부(attendance_records) → 출결 관리(daily_attendance)
   */
  const syncToDailyAttendance = useCallback((studentId: string, dateKey: string, value: number | null) => {
    const student = allStudents.find(s => s.id === studentId);
    if (!student) return;

    const enrollments = (student as any).enrollments || [];
    if (enrollments.length === 0) return;

    const primaryEnrollment = enrollments[0];
    if (!primaryEnrollment.classId || !primaryEnrollment.className) return;

    if (value === null) return;

    const status = mapAttendanceValueToStatus(value);

    createDailyAttendanceMutation.mutate({
      date: dateKey,
      studentId: student.id,
      studentName: student.name,
      classId: primaryEnrollment.classId,
      className: primaryEnrollment.className,
      status: status,
      createdBy: userProfile?.uid || 'system',
      note: '',
    });
  }, [allStudents, createDailyAttendanceMutation, userProfile?.uid]);

  // Handlers
  const handleAttendanceChange = useCallback(async (studentId: string, className: string, dateKey: string, value: number | null) => {
    const compositeKey = `${className}::${dateKey}`;
    const key = `${studentId}\t${compositeKey}`;
    // 1. Optimistic Update (Immediate Feedback)
    setPendingUpdates(prev => ({ ...prev, [key]: value }));

    const yearMonth = dateKey.substring(0, 7);

    // 2. 출석부(attendance_records)에 저장 (className 복합키로 저장)
    const student = allStudents.find(s => s.id === studentId);
    updateAttendanceMutation.mutate({ studentId, className, yearMonth, dateKey, value, staffId: filterStaffId, studentName: student?.name }, {
      onSuccess: () => {
        // 3. 출결 관리(daily_attendance)에도 동기화
        syncToDailyAttendance(studentId, dateKey, value);

        // 4. Clear pending immediately
        setPendingUpdates(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      },
      onError: () => {
        // Rollback on error immediately
        setPendingUpdates(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        alert('저장에 실패했습니다.');
      }
    });
  }, [updateAttendanceMutation, syncToDailyAttendance]);

  const handleMemoChange = useCallback(async (studentId: string, className: string, dateKey: string, memo: string) => {
    const compositeKey = `${className}::${dateKey}`;
    const key = `${studentId}\t${compositeKey}`;
    setPendingMemos(prev => ({ ...prev, [key]: memo }));

    const yearMonth = dateKey.substring(0, 7);
    updateMemoMutation.mutate({ studentId, className, yearMonth, dateKey, memo }, {
      onSuccess: () => {
        setPendingMemos(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      },
      onError: () => {
        setPendingMemos(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        alert('메모 저장에 실패했습니다.');
      }
    });
  }, [updateMemoMutation]);

  const handleHomeworkChange = useCallback(async (studentId: string, className: string, dateKey: string, completed: boolean) => {
    const yearMonth = dateKey.substring(0, 7);
    updateHomeworkMutation.mutate({ studentId, className, yearMonth, dateKey, completed }, {
      onSuccess: () => {
        // No need to refetch - optimistic update handled in mutation
      },
      onError: () => {
        alert('과제 상태 저장에 실패했습니다.');
      }
    });
  }, [updateHomeworkMutation]);

  const handleCellColorChange = useCallback(async (studentId: string, className: string, dateKey: string, color: string | null) => {
    const yearMonth = dateKey.substring(0, 7);
    updateCellColorMutation.mutate({ studentId, className, yearMonth, dateKey, color }, {
      onSuccess: () => {
        // No need to refetch - optimistic update handled in mutation
      },
      onError: () => {
        alert('셀 색상 저장에 실패했습니다.');
      }
    });
  }, [updateCellColorMutation]);

  // 급여 설정 수동 변경 핸들러 (선생님별 + 수업별로 개별 저장)
  const handleSalarySettingChange = useCallback(async (studentId: string, className: string, salarySettingId: string | null) => {
    const yearMonth = getLocalYearMonth(currentDate);
    updateSalarySettingMutation.mutate({ studentId, className, yearMonth, salarySettingId }, {
      onSuccess: () => {
        // optimistic update handles cache
      },
      onError: () => {
        secureWarn('Failed to update salary setting', { studentId, className, salarySettingId });
        alert('급여 설정 저장에 실패했습니다.');
      }
    });
  }, [updateSalarySettingMutation, currentDate]);

  const handleEditStudent = useCallback((student: Student) => {
    setEditingStudent(student);
    setStudentModalOpen(true);
  }, []);

  // IMPORTANT: Loading check moved here - AFTER all hooks to comply with React Hooks rules
  // Hooks must always be called in the same order, so early returns must come AFTER all hooks
  if (isLoadingStudents || isLoadingConfig) {
    return (
      <VideoLoading className="flex-1 h-full" />
    );
  }

  // 직접 이미지 다운로드 (모달 없이)
  // isExporting state는 컴포넌트 최상단(275번 줄)으로 이동됨
  const handleDirectExport = async () => {
    if (!tableRef.current || isExporting) return;

    setIsExporting(true);

    // 그룹 펼치기
    const savedCollapsed = new Set(collapsedGroups);
    setCollapsedGroups(new Set());

    // DOM 업데이트 대기
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const { toJpeg } = await import('html-to-image');

      const dataUrl = await toJpeg(tableRef.current, {
        quality: 0.92,
        pixelRatio: 1,
        backgroundColor: '#ffffff',
        skipFonts: true,
      });

      // 다운로드
      const teacherName = teachers.find(t => t.id === filterStaffId)?.name || '';
      const fileName = `${teacherName}_${currentDate.getFullYear()}년${String(currentDate.getMonth() + 1).padStart(2, '0')}월_출석부.jpg`;

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('이미지 저장 실패:', err);
      alert('이미지 저장에 실패했습니다.');
    } finally {
      // 그룹 상태 복원
      setCollapsedGroups(savedCollapsed);
      setIsExporting(false);
    }
  };

  // Month navigation is now handled in App.tsx header

  const handleSaveConfig = (config: SalaryConfig) => {
    saveConfigMutation.mutate({ config, configId });
  };

  // currentSettlement and currentMonthKey moved to component top (line 276+)
  // This ensures proper initialization order before useMemo hooks

  const handleSettlementUpdate = (data: MonthlySettlement) => {
    saveSettlementMutation.mutate({ monthKey: currentMonthKey, data });
  };

  // All useMemo hooks moved to component top (before early return) - see line 276+
  // This ensures React Hooks rules are followed (same number of hooks on every render)

  return (
    <div className="flex flex-col h-full min-h-0 bg-white text-primary-700">
      {/* Navigation and View Mode Toggle are now handled in App.tsx header */}

      {/* Stats Cards + Settings - Compact single row */}
      <div className="px-4 py-2 flex items-center gap-2 flex-shrink-0 border-b border-gray-100 overflow-x-auto">
        <div
          onClick={() => setSettlementModalOpen(true)}
          className="bg-white px-3 py-1.5 rounded-sm border border-gray-200 shadow-sm flex items-center gap-2 cursor-pointer hover:border-blue-300 transition-colors flex-shrink-0"
        >
          <div className="w-7 h-7 bg-blue-50 text-primary rounded-sm flex items-center justify-center">
            <span className="text-sm font-bold leading-none">₩</span>
          </div>
          <div>
            <p className="text-xxs text-gray-600 font-medium">이번 달 급여</p>
            <p className="text-sm font-bold text-primary-700">{formatCurrency(finalSalary)}</p>
          </div>
        </div>

        <div className="bg-white px-3 py-1.5 rounded-sm border border-gray-200 shadow-sm flex items-center gap-2 flex-shrink-0">
          <div className="p-1.5 bg-gray-50 text-primary rounded-sm">
            <Users size={16} />
          </div>
          <div>
            <p className="text-xxs text-gray-600 font-medium">전체 학생</p>
            <p className="text-sm font-bold text-primary-700">{totalStudentRows}명</p>
          </div>
        </div>

        <div
          onClick={() => setListModal({ isOpen: true, type: 'new' })}
          className="bg-white px-3 py-1.5 rounded-sm border border-gray-200 shadow-sm flex items-center gap-2 cursor-pointer hover:border-yellow-300 transition-colors flex-shrink-0"
        >
          <div className="p-1.5 bg-yellow-100 text-primary rounded-sm">
            <UserPlus size={16} />
          </div>
          <div>
            <p className="text-xxs text-gray-600 font-medium">신입생 유입</p>
            <p className="text-sm font-bold text-accent">+{stats.newStudentsCount}명 <span className="text-xxs font-medium text-yellow-600/70">({stats.newStudentRate}%)</span></p>
          </div>
        </div>

        <div
          onClick={() => setListModal({ isOpen: true, type: 'dropped' })}
          className="bg-white px-3 py-1.5 rounded-sm border border-gray-200 shadow-sm flex items-center gap-2 cursor-pointer hover:border-red-300 transition-colors flex-shrink-0"
        >
          <div className="p-1.5 bg-red-50 text-red-600 rounded-sm">
            <UserMinus size={16} />
          </div>
          <div>
            <p className="text-xxs text-gray-600 font-medium">지난달 퇴원</p>
            <p className="text-sm font-bold text-red-500">-{stats.droppedStudentsCount}명 <span className="text-xxs font-medium text-red-400/70">({stats.droppedStudentRate}%)</span></p>
          </div>
        </div>

        <div className="bg-white px-3 py-1.5 rounded-sm border border-gray-200 shadow-sm flex items-center gap-2 flex-shrink-0">
          <div>
            <p className="text-xxs text-gray-600 font-medium">출석률</p>
            <p className="text-sm font-bold text-primary-700">
              {stats.totalPresent + stats.totalAbsent === 0 ? '0' : Math.round((stats.totalPresent / (stats.totalPresent + stats.totalAbsent)) * 100)}%
            </p>
          </div>
        </div>

        {/* 발행예정금액 토글 */}
        <label
          className="bg-white px-3 py-1.5 rounded-sm border border-gray-200 shadow-sm flex items-center gap-2 cursor-pointer hover:border-gray-300 transition-colors flex-shrink-0"
          title="발행예정금액 열 표시 (이달 등원일 × 수업 단가)"
        >
          <input
            type="checkbox"
            checked={showExpectedBilling}
            onChange={handleToggleExpectedBilling}
            className="w-4 h-4 text-gray-600 rounded border-gray-300 focus:ring-gray-500 cursor-pointer"
          />
          <div className="flex items-center gap-1">
            <Receipt size={14} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-600">예정액</span>
          </div>
        </label>

        {/* 정산액 토글 */}
        <label
          className="bg-white px-3 py-1.5 rounded-sm border border-gray-200 shadow-sm flex items-center gap-2 cursor-pointer hover:border-gray-300 transition-colors flex-shrink-0"
          title="학생별 정산액 열 표시 (출석 기반 선생님 정산금액)"
        >
          <input
            type="checkbox"
            checked={showSettlement}
            onChange={handleToggleSettlement}
            className="w-4 h-4 text-gray-600 rounded border-gray-300 focus:ring-gray-500 cursor-pointer"
          />
          <div className="flex items-center gap-1">
            <Receipt size={14} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-600">정산액</span>
          </div>
        </label>

        {/* 주말 회색 처리 체크박스 */}
        <label
          className="bg-white px-3 py-1.5 rounded-sm border border-gray-200 shadow-sm flex items-center gap-2 cursor-pointer hover:border-gray-300 transition-colors flex-shrink-0"
          title="체크하면 주말(토/일) 열이 회색으로 표시됩니다"
        >
          <input
            type="checkbox"
            checked={highlightWeekends}
            onChange={handleToggleHighlightWeekends}
            className="w-4 h-4 text-gray-600 rounded border-gray-300 focus:ring-gray-500 cursor-pointer"
          />
          <div className="flex items-center gap-1">
            <CalendarOff size={14} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-600">주말 회색</span>
          </div>
        </label>

        {/* 수업/이름 뷰 전환 토글 */}
        <div className="flex bg-gray-100 rounded-sm p-0.5 flex-shrink-0">
          <button
            onClick={() => handleSortModeChange('class')}
            className={`flex items-center gap-1 px-2 py-1 rounded-sm text-xs font-bold transition-colors ${
              sortMode === 'class'
                ? 'bg-primary text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <LayoutList size={12} />
            수업
          </button>
          <button
            onClick={() => handleSortModeChange('name')}
            className={`flex items-center gap-1 px-2 py-1 rounded-sm text-xs font-bold transition-colors ${
              sortMode === 'name'
                ? 'bg-primary text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <SortAsc size={12} />
            이름
          </button>
        </div>

        {/* Settings Buttons - same row */}
        <div className="flex-1"></div>

        {/* Edutrix 보고서 → 출석 동기화 버튼 */}
        <button
          onClick={handleEdutrixSync}
          disabled={isSyncing || isResetting}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-bold text-xs transition-colors shadow-sm flex-shrink-0 ${
            isSyncing
              ? 'bg-gray-400 text-white cursor-wait'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
          title={`${currentYearMonth} 월 Edutrix 보고서를 기반으로 출석을 자동 처리합니다`}
        >
          <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
          {isSyncing ? '동기화 중...' : 'Edutrix 동기화'}
        </button>

        {/* 출석 초기화 버튼 */}
        <button
          onClick={handleEdutrixReset}
          disabled={isResetting || isSyncing}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-bold text-xs transition-colors shadow-sm flex-shrink-0 ${
            isResetting
              ? 'bg-gray-400 text-white cursor-wait'
              : 'bg-red-500 text-white hover:bg-red-600'
          }`}
          title={`${currentYearMonth} 월 전체 출석 데이터를 초기화합니다`}
        >
          <CalendarOff size={14} />
          {isResetting ? '초기화 중...' : '출석 초기화'}
        </button>

        {/* 동기화 결과 표시 - 클릭 시 상세 로그 모달 */}
        {showSyncResult && syncResult && (
          <button
            onClick={() => setShowSyncLogModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-sm text-xs flex-shrink-0 hover:bg-indigo-100 transition-colors cursor-pointer"
            title="클릭하면 상세 로그를 볼 수 있습니다"
          >
            <span className="font-bold text-indigo-700">
              총 {syncResult.totalReports}건
            </span>
            <span className="text-emerald-600">출석 {syncResult.matched}</span>
            <span className="text-gray-500">스킵 {syncResult.skipped}</span>
            {syncResult.errors > 0 && (
              <span className="text-red-500">오류 {syncResult.errors}</span>
            )}
            <span className="text-indigo-400 text-xxs">[상세]</span>
          </button>
        )}

        {/* 세션 설정 버튼 - 관리자 전용 */}
        {canManageSessions && (
          <button
            onClick={() => setSessionSettingsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-sm font-bold text-xs hover:bg-amber-600 transition-colors shadow-sm flex-shrink-0"
            title="세션 기간 설정 (관리자)"
          >
            <Calendar size={14} />
            세션 설정
          </button>
        )}

        {canExportImage && (
          <button
            onClick={handleDirectExport}
            disabled={isExporting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-bold text-xs transition-colors shadow-sm flex-shrink-0 ${
              isExporting
                ? 'bg-gray-400 text-white cursor-wait'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
            title="출석부 이미지로 내보내기"
          >
            <Image size={14} className={isExporting ? 'animate-pulse' : ''} />
            {isExporting ? '저장 중...' : '이미지 저장'}
          </button>
        )}

{canManageSessions && (
          <button
            onClick={() => setSettingsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 text-white rounded-sm font-bold text-xs hover:bg-gray-600 transition-colors shadow-sm flex-shrink-0"
            title="급여 설정"
          >
            <Settings size={14} />
            설정
          </button>
        )}
      </div>

      {/* Main Table Area - Fixed height with sticky horizontal scrollbar at bottom */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div
          className="flex-1 overflow-auto mx-4"
          style={{
            // maxHeight removed to let flex-1 handle height and reduce bottom margin
            // Sticky scrollbar at bottom using CSS
            scrollbarGutter: 'stable'
          }}
        >
          <Table
            ref={tableRef}
            currentDate={currentDate}
            students={visibleStudents}
            salaryConfig={salaryConfig}
            subject={selectedSubject}
            onAttendanceChange={handleAttendanceChange}
            onEditStudent={handleEditStudent}
            onMemoChange={handleMemoChange}
            onHomeworkChange={handleHomeworkChange}
            onCellColorChange={handleCellColorChange}
            onSalarySettingChange={handleSalarySettingChange}
            pendingUpdatesByStudent={pendingUpdatesByStudent}
            pendingMemosByStudent={pendingMemosByStudent}
            examsByDate={examsByDate}
            scoresByStudent={scoresByStudent}
            groupOrder={groupOrder}
            onGroupOrderChange={handleGroupOrderChange}
            collapsedGroups={collapsedGroups}
            onCollapsedGroupsChange={handleCollapsedGroupsChange}
            viewMode={viewMode}
            selectedSession={selectedSession}
            highlightWeekends={highlightWeekends}
            showExpectedBilling={showExpectedBilling}
            showSettlement={showSettlement}
            holidays={holidays}
            sortMode={sortMode}
            hiddenDates={hiddenDates}
            onHiddenDatesChange={handleHiddenDatesChange}
            totalGroupCounts={totalGroupCounts}
            enrollmentTerms={enrollmentTerms}
            onEnrollmentTermClick={handleEnrollmentTermClick}
          />
        </div>
      </div>

      {/* Modals */}
      <SalarySettings
        isOpen={isSalaryModalOpen}
        onClose={() => setSalaryModalOpen(false)}
        config={salaryConfig}
        onSave={handleSaveConfig}
        readOnly={true} // AttendanceManager allows only viewing settings
      />

      {/* 학생 상세 정보 모달 - 학생관리와 동일한 모달 사용 */}
      {isStudentModalOpen && editingStudent && (() => {
        const unifiedStudent = (rawAllStudents as UnifiedStudent[] | undefined)?.find((s) => s.id === editingStudent.id);
        return unifiedStudent ? (
          <StudentDetailModal
            student={unifiedStudent}
            onClose={() => { setStudentModalOpen(false); setEditingStudent(null); }}
            readOnly={!hasPermission('attendance.edit_student_info')}
            currentUser={userProfile}
          />
        ) : null;
      })()}

      <SettlementModal
        isOpen={isSettlementModalOpen}
        onClose={() => setSettlementModalOpen(false)}
        monthStr={currentDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
        baseSalary={stats.totalSalary}
        droppedStudentRate={stats.droppedStudentRate}
        incentiveConfig={effectiveSalaryConfig.incentives}
        salaryConfig={salaryConfig}  // 스냅샷용 전역 설정 (확정 시 저장됨)
        data={currentSettlement}
        onUpdate={handleSettlementUpdate}
      />

      <StudentListModal
        isOpen={listModal.isOpen}
        onClose={() => setListModal(prev => ({ ...prev, isOpen: false }))}
        title={listModal.type === 'new' ? '이번 달 신입생' : '지난 달 퇴원생'}
        type={listModal.type}
        students={listModal.type === 'new' ? stats.newStudents : stats.droppedStudents}
      />

      <AddStudentToAttendanceModal
        isOpen={isAddStudentOpen}
        onClose={closeAddStudent}
        allStudents={allSystemStudents as any[] || []}
        currentStaffId={filterStaffId || ''}
        currentTeacherName={teachers.find(t => t.id === filterStaffId)?.name || ''}
        currentSubject={selectedSubject}
        existingStudentIds={visibleStudents.map(s => s.id)}
        onStudentAdded={() => refetch()}
      />

      <AttendanceSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        teachers={teachers}
        canEdit={canManageSessions}
        initialStaffId={filterStaffId}
      />

      {/* 세션 설정 모달 - 관리자 전용 */}
      <SessionSettingsModal
        isOpen={isSessionSettingsModalOpen}
        onClose={() => setSessionSettingsModalOpen(false)}
      />

      {/* 등록차수 팝오버 */}
      {enrollmentPopover && (
        <EnrollmentTermPopover
          studentId={enrollmentPopover.studentId}
          studentName={enrollmentPopover.studentName}
          month={currentYearMonth}
          termSummary={enrollmentTerms?.get(enrollmentPopover.studentId)}
          anchorRect={enrollmentPopover.rect}
          onClose={() => setEnrollmentPopover(null)}
        />
      )}

      {/* 동기화 상세 로그 모달 */}
      {showSyncLogModal && syncResult && (
        <SyncLogModal result={syncResult} onClose={() => setShowSyncLogModal(false)} />
      )}

    </div>
  );
}

// ─── 동기화 상세 로그 모달 ───
const SYNC_STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  synced: { label: '성공', color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  skipped_no_match: { label: '매칭실패', color: 'text-red-700', bgColor: 'bg-red-50' },
  skipped_not_scheduled: { label: '스킵', color: 'text-amber-700', bgColor: 'bg-amber-50' },
  skipped_absent: { label: '결석스킵', color: 'text-gray-600', bgColor: 'bg-gray-50' },
  already_marked: { label: '이미처리', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  error: { label: '오류', color: 'text-red-700', bgColor: 'bg-red-50' },
};

type LogFilter = 'all' | 'synced' | 'skipped_no_match' | 'skipped_not_scheduled' | 'error';

const SyncLogModal: React.FC<{ result: SyncResult; onClose: () => void }> = ({ result, onClose }) => {
  const [filter, setFilter] = useState<LogFilter>('all');
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());

  // 학생별로 그룹화
  const groupedByStudent = useMemo(() => {
    const map = new Map<string, SyncDetail[]>();
    for (const d of result.details) {
      const key = d.studentName;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return map;
  }, [result.details]);

  // 필터별 카운트
  const counts = useMemo(() => {
    const c = { synced: 0, skipped_no_match: 0, skipped_not_scheduled: 0, error: 0, other: 0 };
    for (const d of result.details) {
      if (d.status === 'synced') c.synced++;
      else if (d.status === 'skipped_no_match') c.skipped_no_match++;
      else if (d.status === 'skipped_not_scheduled') c.skipped_not_scheduled++;
      else if (d.status === 'error') c.error++;
      else c.other++;
    }
    return c;
  }, [result.details]);

  // 필터 적용된 details
  const filteredDetails = useMemo(() => {
    if (filter === 'all') return result.details;
    return result.details.filter(d => d.status === filter);
  }, [result.details, filter]);

  // 필터된 학생별 그룹
  const filteredGrouped = useMemo(() => {
    const map = new Map<string, SyncDetail[]>();
    for (const d of filteredDetails) {
      const key = d.studentName;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return map;
  }, [filteredDetails]);

  const toggleStudent = (name: string) => {
    setExpandedStudents(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const filterButtons: { key: LogFilter; label: string; count: number; color: string }[] = [
    { key: 'all', label: '전체', count: result.details.length, color: 'bg-gray-100 text-gray-700' },
    { key: 'synced', label: '성공', count: counts.synced, color: 'bg-emerald-100 text-emerald-700' },
    { key: 'skipped_no_match', label: '매칭실패', count: counts.skipped_no_match, color: 'bg-red-100 text-red-700' },
    { key: 'skipped_not_scheduled', label: '스킵', count: counts.skipped_not_scheduled, color: 'bg-amber-100 text-amber-700' },
    { key: 'error', label: '오류', count: counts.error, color: 'bg-red-100 text-red-700' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-[700px] max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-indigo-50">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-indigo-600" />
            <h2 className="font-bold text-sm text-indigo-900">동기화 로그</h2>
            <span className="text-xs text-indigo-500">{result.yearMonth}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-indigo-100 rounded"><X size={16} /></button>
        </div>

        {/* 요약 */}
        <div className="px-5 py-3 border-b bg-gray-50 flex items-center gap-4 text-xs">
          <span className="text-gray-500">Edutrix 보고서: <b className="text-gray-800">{result.totalReports}건</b></span>
          <span className="text-emerald-600">출석 반영: <b>{result.matched}</b></span>
          <span className="text-amber-600">스킵: <b>{result.skipped}</b></span>
          {result.errors > 0 && <span className="text-red-600">오류: <b>{result.errors}</b></span>}
        </div>

        {/* 필터 버튼 */}
        <div className="px-5 py-2 border-b flex items-center gap-1.5 flex-wrap">
          {filterButtons.map(fb => (
            <button
              key={fb.key}
              onClick={() => setFilter(fb.key)}
              className={`px-2 py-0.5 rounded text-xxs font-medium transition-colors ${
                filter === fb.key
                  ? `${fb.color} ring-1 ring-current`
                  : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
              }`}
            >
              {fb.label} ({fb.count})
            </button>
          ))}
        </div>

        {/* 로그 목록 */}
        <div className="flex-1 overflow-auto px-5 py-2">
          {filteredGrouped.size === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">해당 항목이 없습니다.</div>
          ) : (
            [...filteredGrouped.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([studentName, details]) => {
                const isExpanded = expandedStudents.has(studentName);
                const syncedCount = details.filter(d => d.status === 'synced').length;
                const skippedCount = details.filter(d => d.status !== 'synced').length;
                const mainStatus = syncedCount > 0
                  ? (skippedCount > 0 ? 'partial' : 'synced')
                  : 'failed';

                return (
                  <div key={studentName} className="border-b border-gray-100 last:border-0">
                    <button
                      onClick={() => toggleStudent(studentName)}
                      className="w-full flex items-center gap-2 py-1.5 hover:bg-gray-50 text-left"
                    >
                      {isExpanded
                        ? <ChevronUp size={12} className="text-gray-400 flex-shrink-0" />
                        : <ChevronDown size={12} className="text-gray-400 flex-shrink-0" />
                      }
                      <span className="font-bold text-xs text-gray-800 w-20 flex-shrink-0">{studentName}</span>
                      <span className="text-xxs text-gray-400">{details[0]?.className}</span>
                      <span className="flex-1" />
                      {syncedCount > 0 && (
                        <span className="text-xxs px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded">
                          반영 {syncedCount}
                        </span>
                      )}
                      {skippedCount > 0 && (
                        <span className="text-xxs px-1.5 py-0.5 bg-red-50 text-red-500 rounded">
                          스킵 {skippedCount}
                        </span>
                      )}
                    </button>
                    {isExpanded && (
                      <div className="ml-5 mb-2 space-y-0.5">
                        {details
                          .sort((a, b) => a.date.localeCompare(b.date))
                          .map((d, i) => {
                            const cfg = SYNC_STATUS_CONFIG[d.status] || SYNC_STATUS_CONFIG.error;
                            return (
                              <div key={i} className={`flex items-center gap-2 px-2 py-1 rounded text-xxs ${cfg.bgColor}`}>
                                <span className="text-gray-500 w-20 flex-shrink-0">{d.date}</span>
                                <span className={`font-bold w-14 flex-shrink-0 ${cfg.color}`}>{cfg.label}</span>
                                <span className="text-gray-600 truncate">{d.message || ''}</span>
                              </div>
                            );
                          })
                        }
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>

        {/* 푸터 */}
        <div className="px-5 py-2 border-t bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttendanceManager;
