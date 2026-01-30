import React, { useState, useMemo, useRef } from 'react';
import { Users, UserMinus, UserPlus, Settings, Calendar, Image, CalendarOff, RefreshCw } from 'lucide-react';
import { storage, STORAGE_KEYS } from '../../utils/localStorage';
import { Student, SalaryConfig, SalarySettingItem, MonthlySettlement, AttendanceSubject, AttendanceViewMode, SessionPeriod } from './types';
import { formatCurrency, calculateStats, getCategoryLabel } from './utils';
import Table from './components/Table';
import SalarySettings from './components/SalarySettings';
import StudentDetailModal from '../StudentManagement/StudentDetailModal';
import SettlementModal from './components/SettlementModal';
import StudentListModal from './components/StudentListModal';
import AddStudentToAttendanceModal from './components/AddStudentToAttendanceModal';
import AttendanceSettingsModal from './AttendanceSettingsModal';
import SessionSettingsModal from './SessionSettingsModal';

import {
  useAttendanceStudents,
  useAttendanceConfig,
  useUpdateAttendance,
  useUpdateMemo,
  useUpdateHomework,
  useUpdateCellColor,
  useSaveAttendanceConfig,
  useMonthlySettlement,
  useSaveMonthlySettlement
} from '../../hooks/useAttendance';
import { useExamsByDateMap, useScoresByExams } from '../../hooks/useExamsByDate';
import { useCreateDailyAttendance } from '../../hooks/useDailyAttendance';
import { UserProfile, Teacher, UnifiedStudent } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';
import { mapAttendanceValueToStatus } from '../../utils/attendanceSync';
import { secureLog, secureWarn } from '../../utils/secureLog';

// Default salary config for new setups
const INITIAL_SALARY_CONFIG: SalaryConfig = {
  academyFee: 8.9,
  items: [
    { id: 'default-elem', name: '초등', color: '#FACC15', type: 'fixed', fixedRate: 25000, baseTuition: 0, ratio: 45 },
    { id: 'default-mid', name: '중등', color: '#C084FC', type: 'fixed', fixedRate: 35000, baseTuition: 0, ratio: 45 },
    { id: 'default-high', name: '고등', color: '#3B82F6', type: 'fixed', fixedRate: 45000, baseTuition: 0, ratio: 45 },
  ],
  incentives: {
    blogAmount: 50000,
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
    const parts = key.split('_');
    if (parts.length >= 2) {
      // studentId might contain underscores? No, usually generated ids.
      // But to be safe, dateKey is YYYY-MM-DD (fixed length 10 or 3 parts).
      // safely split: dateKey is last part (if format is ID_YYYY-MM-DD)
      // Actually standard format is `${studentId}_${dateKey}`.
      // dateKey examples: 2024-01-01.
      const dateKey = parts.pop()!;
      const studentId = parts.join('_');

      if (!grouped[studentId]) grouped[studentId] = {};
      grouped[studentId][dateKey] = value;
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
  const isMasterOrAdmin = userProfile?.role === 'master' || userProfile?.role === 'admin';

  // Determine user's staffId for filtering (if they are a teacher)
  // Uses explicit User-Teacher linking from user profile (set in System Settings -> Users)
  const currentStaffId = useMemo(() => {
    if (!userProfile) return undefined;
    // Use staffId from UserProfile
    return userProfile.staffId || undefined;
  }, [userProfile]);

  // Determine if user can manage the current subject (for teacher dropdown access)
  const canManageCurrentSubject = useMemo(() => {
    if (isMasterOrAdmin) return true;
    if (selectedSubject === 'math' && canManageMath) return true;
    if (selectedSubject === 'english' && canManageEnglish) return true;
    return false;
  }, [selectedSubject, canManageMath, canManageEnglish, isMasterOrAdmin]);

  // 이미지 저장 가능 여부 (조회 권한이 있으면 저장 가능)
  const canExportImage = useMemo(() => {
    // 마스터/관리자는 항상 가능
    if (isMasterOrAdmin) return true;
    // 해당 과목 관리 권한이 있으면 가능
    if (canManageCurrentSubject) return true;
    // 본인 출석부 관리 권한 + 연결된 강사가 있으면 본인 출석부만 저장 가능
    if (canManageOwn && currentStaffId) return true;
    return false;
  }, [isMasterOrAdmin, canManageCurrentSubject, canManageOwn, currentStaffId]);

  // Available teachers for filter dropdown (based on manage permission for current subject)
  const availableTeachers = useMemo(() => {
    if (!canManageCurrentSubject) return [];
    // Filter by subject
    return teachers.filter(t => {
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
    return currentDate.toISOString().slice(0, 7); // "YYYY-MM"
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

  const [isSettlementModalOpen, setSettlementModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [listModal, setListModal] = useState<{ isOpen: boolean, type: 'new' | 'dropped' }>({ isOpen: false, type: 'new' });

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
  const handleGroupOrderChange = (newOrder: string[]) => {
    setGroupOrder(newOrder);
    storage.setJSON(groupOrderKey, newOrder);
  };

  // Collapsed groups state (per teacher, stored in localStorage)
  const collapsedGroupsKey = STORAGE_KEYS.attendanceCollapsedGroups(filterStaffId || 'all', selectedSubject);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    try {
      const saved = storage.getJSON<string[]>(collapsedGroupsKey, []);
      return new Set(saved);
    } catch { return new Set(); }
  });

  // Persist collapsed groups changes
  const handleCollapsedGroupsChange = (newCollapsed: Set<string>) => {
    setCollapsedGroups(newCollapsed);
    storage.setJSON(collapsedGroupsKey, Array.from(newCollapsed));
  };

  // 주말 회색 처리 상태 (localStorage에서 로드)
  const [highlightWeekends, setHighlightWeekends] = useState<boolean>(() => {
    return storage.getJSON<boolean>(STORAGE_KEYS.ATTENDANCE_HIGHLIGHT_WEEKENDS, false);
  });

  // 주말 회색 처리 토글
  const handleToggleHighlightWeekends = () => {
    const newValue = !highlightWeekends;
    setHighlightWeekends(newValue);
    storage.setJSON(STORAGE_KEYS.ATTENDANCE_HIGHLIGHT_WEEKENDS, newValue);
  };



  // Optimistic UI State: { [studentId_dateKey]: value }
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, number | null>>({});
  const [pendingMemos, setPendingMemos] = useState<Record<string, string>>({});

  // Monthly Settlement from Firebase (cost-optimized: only current month)
  const { data: currentMonthSettlement, isLoading: isLoadingSettlement } = useMonthlySettlement(currentYearMonth, !!userProfile);
  const saveSettlementMutation = useSaveMonthlySettlement();

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
  // 학생 ID 목록을 안정적인 의존성으로 생성 (무한 렌더링 방지)
  const studentIdsKey = useMemo(() =>
    allStudents.map(s => s.id).sort().join(','),
    [allStudents]
  );

  // Filter visible students for current month
  const visibleStudents = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthFirstDay = new Date(year, month, 1).toISOString().slice(0, 10);
    const monthLastDay = new Date(year, month + 1, 0).toISOString().slice(0, 10);

    const filtered = allStudents.filter(s => {
      if (s.status === 'withdrawn') return false;
      if (s.startDate && typeof s.startDate === 'string' && s.startDate > monthLastDay) return false;
      if (s.endDate && typeof s.endDate === 'string' && s.endDate < monthFirstDay) return false;
      return true;
    });

    // 학생을 클래스별로 확장 (한 학생이 여러 클래스에 있으면 여러 행으로 표시)
    const expandedStudents: Student[] = [];
    filtered.forEach(student => {
      const mainClasses = student.mainClasses || [];
      const slotClasses = student.slotClasses || [];
      const allClasses = [...mainClasses, ...slotClasses];

      if (allClasses.length === 0) {
        // 클래스가 없는 학생은 그대로 추가
        expandedStudents.push(student);
      } else {
        // 각 클래스별로 별도의 행 생성
        allClasses.forEach(className => {
          expandedStudents.push({
            ...student,
            group: className, // 단일 클래스명으로 설정
            mainClasses: mainClasses.includes(className) ? [className] : [],
            slotClasses: slotClasses.includes(className) ? [className] : [],
          });
        });
      }
    });

    return expandedStudents.sort((a, b) => {
      if (!a.group && b.group) return 1;
      if (a.group && !b.group) return -1;

      const aGroupIdx = groupOrder.indexOf(a.group || '');
      const bGroupIdx = groupOrder.indexOf(b.group || '');

      if (aGroupIdx !== -1 && bGroupIdx !== -1) {
        if (aGroupIdx !== bGroupIdx) return aGroupIdx - bGroupIdx;
      } else if (aGroupIdx !== -1 && bGroupIdx === -1) {
        return -1;
      } else if (aGroupIdx === -1 && bGroupIdx !== -1) {
        return 1;
      } else {
        const groupCompare = (a.group || '').localeCompare(b.group || '');
        if (groupCompare !== 0) return groupCompare;
      }

      return (a.name || '').localeCompare(b.name || '', 'ko');
    });
  }, [studentIdsKey, currentDate, groupOrder]);

  const pendingUpdatesByStudent = useMemo(() => groupUpdates(pendingUpdates), [pendingUpdates]);
  const pendingMemosByStudent = useMemo(() => groupUpdates(pendingMemos), [pendingMemos]);

  // 고유 학생 수 계산 (중복 제거)
  const uniqueStudentCount = useMemo(() => {
    const uniqueIds = new Set(visibleStudents.map(s => s.id));
    return uniqueIds.size;
  }, [visibleStudents]);

  const stats = useMemo(() =>
    calculateStats(allStudents, visibleStudents, salaryConfig, currentDate),
    [allStudents, visibleStudents, salaryConfig, currentDate]
  );

  const finalSalary = useMemo(() => {
    let total = stats.totalSalary;
    if (currentSettlement.hasBlog) total += salaryConfig.incentives.blogAmount;
    if (currentSettlement.hasRetention) total += salaryConfig.incentives.retentionAmount;
    total += (currentSettlement.otherAmount || 0);
    return total;
  }, [stats.totalSalary, currentSettlement, salaryConfig.incentives]);

  // DEBUG: Log for simulation mode debugging
  console.log('🔍 AttendanceManager Debug:', {
    userProfile: !!userProfile,
    userRole: userProfile?.role,
    staffId: userProfile?.staffId,
    currentStaffId,
    filterStaffId,
    canManageCurrentSubject,
    isLoadingStudents,
    isLoadingConfig,
    availableTeachersCount: availableTeachers.length,
    allStudentsCount: allStudents.length,
    visibleStudentsCount: visibleStudents.length
  });

  // IMPORTANT: Loading check moved here - AFTER all hooks to comply with React Hooks rules
  // Hooks must always be called in the same order, so early returns must come AFTER all hooks
  if (isLoadingStudents || isLoadingConfig) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">출석부를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // Handlers
  const handleAttendanceChange = async (studentId: string, dateKey: string, value: number | null) => {
    const key = `${studentId}_${dateKey}`;
    // 1. Optimistic Update (Immediate Feedback)
    setPendingUpdates(prev => ({ ...prev, [key]: value }));

    const yearMonth = dateKey.substring(0, 7);

    // 2. 출석부(attendance_records)에 저장
    updateAttendanceMutation.mutate({ studentId, yearMonth, dateKey, value }, {
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
  };

  /**
   * 출석부 데이터를 출결 관리 시스템에 동기화
   * 출석부(attendance_records) → 출결 관리(daily_attendance)
   */
  const syncToDailyAttendance = (studentId: string, dateKey: string, value: number | null) => {
    const student = allStudents.find(s => s.id === studentId);
    if (!student) {
      console.warn(`[Sync] Student not found: ${studentId}`);
      return;
    }

    // 학생의 수업 정보 가져오기 (enrollments에서)
    const enrollments = (student as any).enrollments || [];
    if (enrollments.length === 0) {
      secureWarn('[Sync] No enrollments found for student', {
        studentId: student.id,
        studentName: student.name
      });
      return;
    }

    // 첫 번째 enrollment 사용 (주 수업)
    const primaryEnrollment = enrollments[0];

    // classId가 없으면 동기화 스킵 ('unknown' 저장 방지)
    if (!primaryEnrollment.classId || !primaryEnrollment.className) {
      secureWarn('[Sync] Invalid enrollment data for student', {
        studentId: student.id,
        studentName: student.name
      });
      return;
    }

    if (value === null) {
      // TODO: 출결 관리에서도 기록 제거 (useDeleteDailyAttendance 훅 필요)
      secureLog('[Sync] Attendance deleted - daily_attendance deletion not implemented yet', {
        studentId: student.id,
        studentName: student.name,
        dateKey
      });
      return;
    }

    // 숫자 → 문자열 출석 상태 변환
    const status = mapAttendanceValueToStatus(value);

    // daily_attendance에 저장 (에러 핸들링 추가)
    createDailyAttendanceMutation.mutate({
      date: dateKey,
      studentId: student.id,
      studentName: student.name,
      classId: primaryEnrollment.classId,
      className: primaryEnrollment.className,
      status: status,
      createdBy: userProfile?.uid || 'system',
      note: '', // 메모는 별도 처리
    }, {
      onError: (error) => {
        console.error('[Sync] Failed to sync to daily_attendance:', error);
        // 사용자에게 알림 (선택적 - 메인 저장은 성공했으므로 경고 수준)
        secureWarn('출결 관리 동기화 실패', {
          studentId: student.id,
          studentName: student.name,
          dateKey
        });
      },
      onSuccess: () => {
        secureLog('[Sync] Successfully synced to daily_attendance', {
          studentId: student.id,
          studentName: student.name,
          dateKey
        });
      }
    });
  };

  const handleMemoChange = async (studentId: string, dateKey: string, memo: string) => {
    const key = `${studentId}_${dateKey}`;
    setPendingMemos(prev => ({ ...prev, [key]: memo }));

    const yearMonth = dateKey.substring(0, 7);
    updateMemoMutation.mutate({ studentId, yearMonth, dateKey, memo }, {
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
  };

  const handleHomeworkChange = async (studentId: string, dateKey: string, completed: boolean) => {
    const yearMonth = dateKey.substring(0, 7);
    updateHomeworkMutation.mutate({ studentId, yearMonth, dateKey, completed }, {
      onSuccess: () => {
        // No need to refetch - optimistic update handled in mutation
      },
      onError: () => {
        alert('과제 상태 저장에 실패했습니다.');
      }
    });
  };

  const handleCellColorChange = async (studentId: string, dateKey: string, color: string | null) => {
    const yearMonth = dateKey.substring(0, 7);
    updateCellColorMutation.mutate({ studentId, yearMonth, dateKey, color }, {
      onSuccess: () => {
        // No need to refetch - optimistic update handled in mutation
      },
      onError: () => {
        alert('셀 색상 저장에 실패했습니다.');
      }
    });
  };

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

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setStudentModalOpen(true);
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
    <div className="flex flex-col h-full min-h-0 bg-white text-[#373d41]">
      {/* Navigation and View Mode Toggle are now handled in App.tsx header */}

      {/* Stats Cards + Settings - Compact single row */}
      <div className="px-4 py-2 flex items-center gap-2 flex-shrink-0 border-b border-gray-100 overflow-x-auto">
        <div
          onClick={() => setSettlementModalOpen(true)}
          className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm flex items-center gap-2 cursor-pointer hover:border-blue-300 transition-colors flex-shrink-0"
        >
          <div className="w-7 h-7 bg-blue-50 text-[#081429] rounded-md flex items-center justify-center">
            <span className="text-sm font-bold leading-none">₩</span>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-medium">이번 달 급여</p>
            <p className="text-sm font-bold text-[#373d41]">{formatCurrency(finalSalary)}</p>
          </div>
        </div>

        <div className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm flex items-center gap-2 flex-shrink-0">
          <div className="p-1.5 bg-gray-50 text-[#081429] rounded-md">
            <Users size={16} />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-medium">전체 학생</p>
            <p className="text-sm font-bold text-[#373d41]">{uniqueStudentCount}명</p>
          </div>
        </div>

        <div
          onClick={() => setListModal({ isOpen: true, type: 'new' })}
          className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm flex items-center gap-2 cursor-pointer hover:border-yellow-300 transition-colors flex-shrink-0"
        >
          <div className="p-1.5 bg-yellow-100 text-[#081429] rounded-md">
            <UserPlus size={16} />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-medium">신입생 유입</p>
            <p className="text-sm font-bold text-[#fdb813]">+{stats.newStudentsCount}명</p>
          </div>
        </div>

        <div
          onClick={() => setListModal({ isOpen: true, type: 'dropped' })}
          className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm flex items-center gap-2 cursor-pointer hover:border-red-300 transition-colors flex-shrink-0"
        >
          <div className="p-1.5 bg-red-50 text-red-600 rounded-md">
            <UserMinus size={16} />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-medium">지난달 퇴원</p>
            <p className="text-sm font-bold text-red-500">-{stats.droppedStudentsCount}명</p>
          </div>
        </div>

        <div className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm flex items-center gap-2 flex-shrink-0">
          <div>
            <p className="text-[10px] text-gray-500 font-medium">출석률</p>
            <p className="text-sm font-bold text-[#373d41]">
              {stats.totalPresent + stats.totalAbsent === 0 ? '0' : Math.round((stats.totalPresent / (stats.totalPresent + stats.totalAbsent)) * 100)}%
            </p>
          </div>
        </div>

        {/* 주말 회색 처리 체크박스 */}
        <label
          className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm flex items-center gap-2 cursor-pointer hover:border-gray-300 transition-colors flex-shrink-0"
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

        {/* 새로고침 버튼 */}
        <button
          onClick={() => {
            console.log('🔄 새로고침 버튼 클릭:', {
              staffId: filterStaffId,
              subject: selectedSubject,
              yearMonth: currentYearMonth
            });
            refetch();
          }}
          disabled={isLoadingStudents}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors shadow-sm flex-shrink-0 ${
            isLoadingStudents
              ? 'bg-gray-400 text-white cursor-wait'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
          title="학생 목록 새로고침"
        >
          <RefreshCw size={14} className={isLoadingStudents ? 'animate-spin' : ''} />
          {isLoadingStudents ? '불러오는 중...' : '새로고침'}
        </button>

        {/* Settings Buttons - same row */}
        <div className="flex-1"></div>

        {/* 세션 설정 버튼 - 관리자 전용 */}
        {(canManageSessions || isMasterOrAdmin) && (
          <button
            onClick={() => setSessionSettingsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg font-bold text-xs hover:bg-amber-600 transition-colors shadow-sm flex-shrink-0"
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors shadow-sm flex-shrink-0 ${
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 text-white rounded-lg font-bold text-xs hover:bg-gray-600 transition-colors shadow-sm flex-shrink-0"
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
            onAttendanceChange={handleAttendanceChange}
            onEditStudent={handleEditStudent}
            onMemoChange={handleMemoChange}
            onHomeworkChange={handleHomeworkChange}
            onCellColorChange={handleCellColorChange}
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
          />
        ) : null;
      })()}

      <SettlementModal
        isOpen={isSettlementModalOpen}
        onClose={() => setSettlementModalOpen(false)}
        monthStr={currentDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
        baseSalary={stats.totalSalary}
        droppedStudentRate={stats.droppedStudentRate}
        incentiveConfig={salaryConfig.incentives}
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
        allStudents={rawAllStudents as any[] || []}
        currentStaffId={filterStaffId || ''}
        currentTeacherName={teachers.find(t => t.id === filterStaffId)?.name || ''}
        existingStudentIds={visibleStudents.map(s => s.id)}
        onStudentAdded={() => refetch()}
      />

      <AttendanceSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        teachers={teachers}
        canEdit={canManageSessions}
      />

      {/* 세션 설정 모달 - 관리자 전용 */}
      <SessionSettingsModal
        isOpen={isSessionSettingsModalOpen}
        onClose={() => setSessionSettingsModalOpen(false)}
      />

    </div>
  );
}

export default AttendanceManager;
