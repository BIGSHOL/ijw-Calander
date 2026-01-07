import React, { useState, useMemo, useEffect } from 'react';
import { Settings, Plus, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Users, UserPlus, UserMinus, Calculator, ChevronDown } from 'lucide-react';
import { Student, SalaryConfig, SalarySettingItem, MonthlySettlement, AttendanceSubject } from './types';
import { formatCurrency, calculateStats } from './utils';
import Table from './components/Table';
import SalarySettings from './components/SalarySettings';
import StudentModal from './components/StudentModal';
import SettlementModal from './components/SettlementModal';
import StudentListModal from './components/StudentListModal';

import {
  useAttendanceStudents,
  useAttendanceConfig,
  useAddStudent,
  useDeleteStudent,
  useUpdateAttendance,
  useUpdateMemo,
  useSaveAttendanceConfig,
  useMonthlySettlement,
  useSaveMonthlySettlement
} from '../../hooks/useAttendance';
import { UserProfile, Teacher } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';

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


const AttendanceManager: React.FC<AttendanceManagerProps> = ({ userProfile, teachers = [] }) => {
  const { hasPermission } = usePermissions(userProfile);

  // Permission checks (consolidated)
  const canManageOwn = hasPermission('attendance.manage_own');
  const canEditAll = hasPermission('attendance.edit_all');
  const canManageMath = hasPermission('attendance.manage_math');
  const canManageEnglish = hasPermission('attendance.manage_english');
  const isMasterOrAdmin = userProfile?.role === 'master' || userProfile?.role === 'admin';

  // Determine user's teacherId for filtering (if they are a teacher)
  // Uses explicit User-Teacher linking from user profile (set in System Settings -> Users)
  const currentTeacherId = useMemo(() => {
    if (!userProfile) return undefined;
    // NEW: Use explicit teacherId from UserProfile (set via User Management UI)
    if (userProfile.teacherId) {
      const linkedTeacher = teachers.find(t => t.id === userProfile.teacherId);
      return linkedTeacher?.name || undefined;  // Return teacher NAME for filtering (matches hook logic)
    }
    return undefined;
  }, [userProfile, teachers]);

  // State
  const [currentDate, setCurrentDate] = useState(() => new Date());

  // Smart default subject based on permissions
  const defaultSubject = useMemo((): AttendanceSubject => {
    if (isMasterOrAdmin) return 'math';
    if (canManageMath && !canManageEnglish) return 'math';
    if (canManageEnglish && !canManageMath) return 'english';
    return 'math'; // Default fallback
  }, [isMasterOrAdmin, canManageMath, canManageEnglish]);

  const [selectedSubject, setSelectedSubject] = useState<AttendanceSubject>(defaultSubject);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | undefined>(undefined);

  // Determine if user can manage the current subject (for teacher dropdown access)
  const canManageCurrentSubject = useMemo(() => {
    if (isMasterOrAdmin) return true;
    if (selectedSubject === 'math' && canManageMath) return true;
    if (selectedSubject === 'english' && canManageEnglish) return true;
    return false;
  }, [selectedSubject, canManageMath, canManageEnglish, isMasterOrAdmin]);


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

  // Determine which teacherId to filter by
  const filterTeacherId = useMemo(() => {
    if (canManageCurrentSubject) {
      // Validate selectedTeacherId against availableTeachers
      const isValid = availableTeachers.some(t => t.name === selectedTeacherId);
      if (isValid && selectedTeacherId) return selectedTeacherId;

      // Fallback to first available teacher if selection is invalid/empty (e.g. after subject switch)
      if (availableTeachers.length > 0) return availableTeachers[0].name;

      return undefined;
    }
    // Regular teacher - only show their own students
    return currentTeacherId;
  }, [canManageCurrentSubject, selectedTeacherId, currentTeacherId, availableTeachers]);

  // Firebase Hooks - Pass yearMonth to load attendance records for current month
  const currentYearMonth = useMemo(() => {
    return currentDate.toISOString().slice(0, 7); // "YYYY-MM"
  }, [currentDate]);

  const { students: allStudents, isLoading: isLoadingStudents, refetch } = useAttendanceStudents({
    teacherId: filterTeacherId,
    subject: selectedSubject,
    yearMonth: currentYearMonth,
    enabled: !!userProfile,
  });

  // Resolve Teacher ID for Config
  const targetTeacher = useMemo(() => {
    if (!filterTeacherId) return undefined;
    return teachers.find(t => t.name === filterTeacherId);
  }, [filterTeacherId, teachers]);

  const configId = targetTeacher ? `salary_${targetTeacher.id}` : 'salary';

  const { data: firebaseConfig, isLoading: isLoadingConfig } = useAttendanceConfig(configId, !!userProfile);
  const salaryConfig = firebaseConfig || INITIAL_SALARY_CONFIG;

  // Mutations
  const addStudentMutation = useAddStudent();
  const deleteStudentMutation = useDeleteStudent();
  const updateAttendanceMutation = useUpdateAttendance();
  const updateMemoMutation = useUpdateMemo();
  const saveConfigMutation = useSaveAttendanceConfig();

  // Local state for modals
  const [isSalaryModalOpen, setSalaryModalOpen] = useState(false);
  const [isStudentModalOpen, setStudentModalOpen] = useState(false);
  const [isSettlementModalOpen, setSettlementModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [listModal, setListModal] = useState<{ isOpen: boolean, type: 'new' | 'dropped' }>({ isOpen: false, type: 'new' });

  // Group order state (per teacher, stored in localStorage)
  const groupOrderKey = `attendance_groupOrder_${filterTeacherId || 'all'}_${selectedSubject}`;
  const [groupOrder, setGroupOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(groupOrderKey);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Persist group order changes
  const handleGroupOrderChange = (newOrder: string[]) => {
    setGroupOrder(newOrder);
    localStorage.setItem(groupOrderKey, JSON.stringify(newOrder));
  };



  // Optimistic UI State: { [studentId_dateKey]: value }
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, number | null>>({});
  const [pendingMemos, setPendingMemos] = useState<Record<string, string>>({});

  // Monthly Settlement from Firebase (cost-optimized: only current month)
  const { data: currentMonthSettlement, isLoading: isLoadingSettlement } = useMonthlySettlement(currentYearMonth, !!userProfile);
  const saveSettlementMutation = useSaveMonthlySettlement();

  // Handlers
  const handleAttendanceChange = (studentId: string, dateKey: string, value: number | null) => {
    const key = `${studentId}_${dateKey}`;
    // 1. Optimistic Update (Immediate Feedback)
    setPendingUpdates(prev => ({ ...prev, [key]: value }));

    const yearMonth = dateKey.substring(0, 7);
    updateAttendanceMutation.mutate({ studentId, yearMonth, dateKey, value }, {
      onSuccess: async () => {
        // 2. Refetch to get server truth (eventually)
        await refetch();
        // 3. Clear optimistic state (optional, but good for cleanup)
        // We could leave it until refetch completes, but refetch is async.
        // Actually, best to clear it in onSettled, but here we simply rely on the fact that
        // once refetch comes back, the data source will match our optimistic value.
        // To be safe, we clear it after a short delay or just let refetch overwrite key?
        // Let's clear it to allow fresh data to take over.
        setPendingUpdates(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      },
      onError: () => {
        // Rollback on error
        setPendingUpdates(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        alert('저장에 실패했습니다.');
      }
    });
  };

  const handleMemoChange = (studentId: string, dateKey: string, memo: string) => {
    const key = `${studentId}_${dateKey}`;
    setPendingMemos(prev => ({ ...prev, [key]: memo }));

    const yearMonth = dateKey.substring(0, 7);
    updateMemoMutation.mutate({ studentId, yearMonth, dateKey, memo }, {
      onSuccess: async () => {
        await refetch();
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

  const handleSaveStudent = (student: Student) => {
    // Ensure new fields are set
    const studentWithDefaults: Student = {
      ...student,
      teacherIds: student.teacherIds || (currentTeacherId ? [currentTeacherId] : []),
      subjects: student.subjects || [selectedSubject],
      ownerId: student.ownerId || userProfile?.uid,
    };
    addStudentMutation.mutate(studentWithDefaults);
    setEditingStudent(null);
    setStudentModalOpen(false);
  };

  const handleDeleteStudent = (id: string) => {
    if (window.confirm('해당 학생을 영구 삭제하시겠습니까?\n이전 데이터도 모두 삭제됩니다.\n\n단순히 이번 달부터 보이지 않게 하려면 수정 메뉴에서 "수강 종료일"을 설정하세요.')) {
      deleteStudentMutation.mutate(id);
      setStudentModalOpen(false);
      setEditingStudent(null);
    }
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setStudentModalOpen(true);
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentDate(newDate);
  };

  const handleSaveConfig = (config: SalaryConfig) => {
    saveConfigMutation.mutate({ config, configId });
  };

  // Helper for settlement
  const currentMonthKey = currentYearMonth;
  const currentSettlement = currentMonthSettlement || {
    hasBlog: false,
    hasRetention: false,
    otherAmount: 0,
    note: ''
  };

  const handleSettlementUpdate = (data: MonthlySettlement) => {
    saveSettlementMutation.mutate({ monthKey: currentMonthKey, data });
  };

  // Filter visible students for current month
  // A student is visible if:
  // - Their startDate is on or before the last day of the month (they started before/during this month)
  // - Their endDate is missing OR on/after the first day of the month (they haven't ended before this month)
  const visibleStudents = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthFirstDay = new Date(year, month, 1).toISOString().slice(0, 10);   // YYYY-MM-01
    const monthLastDay = new Date(year, month + 1, 0).toISOString().slice(0, 10); // YYYY-MM-28/29/30/31

    const filtered = allStudents.filter(s => {
      // IMPORTANT: Always exclude students with status 'withdrawn' from attendance table
      // They should only appear in the "지난달 퇴원" dropped students list
      if (s.status === 'withdrawn') return false;

      // Exclude if startDate is in the future (after this month)
      if (s.startDate > monthLastDay) return false;

      // Exclude if endDate exists AND is before the first day of current month (already withdrawn)
      // This means: if endDate < monthFirstDay, the student left before this month started
      if (s.endDate && s.endDate < monthFirstDay) return false;

      return true;
    });

    // Custom sort: use groupOrder if available, otherwise alphabetical
    return filtered.sort((a, b) => {
      // Students without groups go last
      if (!a.group && b.group) return 1;
      if (a.group && !b.group) return -1;

      // Group ordering
      const aGroupIdx = groupOrder.indexOf(a.group || '');
      const bGroupIdx = groupOrder.indexOf(b.group || '');

      // If both in order list, use order
      if (aGroupIdx !== -1 && bGroupIdx !== -1) {
        if (aGroupIdx !== bGroupIdx) return aGroupIdx - bGroupIdx;
      } else if (aGroupIdx !== -1 && bGroupIdx === -1) {
        return -1; // Ordered groups come first
      } else if (aGroupIdx === -1 && bGroupIdx !== -1) {
        return 1;
      } else {
        // Neither in order list - alphabetical fallback
        const groupCompare = (a.group || '').localeCompare(b.group || '');
        if (groupCompare !== 0) return groupCompare;
      }

      // Same group - sort by name
      return a.name.localeCompare(b.name);
    });
  }, [allStudents, currentDate, groupOrder]);

  // Group Optimistic Updates for Component Efficiency
  const pendingUpdatesByStudent = useMemo(() => groupUpdates(pendingUpdates), [pendingUpdates]);
  const pendingMemosByStudent = useMemo(() => groupUpdates(pendingMemos), [pendingMemos]);

  // Statistics
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

  const existingGroups = useMemo(() => {
    const groups = new Set<string>();
    allStudents.forEach(s => {
      if (s.group) groups.add(s.group);
    });
    return Array.from(groups).sort();
  }, [allStudents]);

  // Loading state
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

  // Selection prompt for managers when no teacher selected
  if (canManageCurrentSubject && !selectedTeacherId) {
    return (
      <div className="flex flex-col h-full bg-white text-[#373d41]">
        {/* Header - Unified Style */}
        <div className="bg-[#081429] py-3 flex items-center px-4 gap-3 border-b border-white/10 flex-shrink-0 text-xs shadow-md z-30">
          {/* Subject Toggle */}
          <div className="flex bg-white/10 rounded-lg p-0.5 border border-white/10 shadow-sm">
            {canManageMath && (
              <button
                onClick={() => setSelectedSubject('math')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${selectedSubject === 'math' ? 'bg-[#fdb813] text-[#081429] shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
              >
                🔢 수학
              </button>
            )}
            {canManageEnglish && (
              <button
                onClick={() => setSelectedSubject('english')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${selectedSubject === 'english' ? 'bg-[#fdb813] text-[#081429] shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
              >
                🔤 영어
              </button>
            )}
          </div>

          {/* Separator */}
          <div className="w-px h-4 bg-white/20"></div>

          {/* Prompt Text */}
          <span className="text-gray-300 font-medium">담당 강사를 선택하세요</span>
        </div>

        {/* Selection Prompt */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users size={40} className="text-blue-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-3">담당 강사를 선택해주세요</h3>
            <p className="text-gray-500 mb-6">
              {selectedSubject === 'math' ? '수학' : '영어'} 출석부를 확인할 강사를 선택하세요.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {availableTeachers.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTeacherId(t.name)}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm"
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white text-[#373d41]">
      {/* Header - Unified with Timetable/Calendar */}
      <div className="bg-[#081429] h-10 flex items-center justify-between px-6 border-b border-white/10 flex-shrink-0 text-xs shadow-md z-30">
        <div className="flex items-center gap-3">
          {/* Subject Toggle */}
          <div className="flex bg-white/10 rounded-lg p-0.5 border border-white/10 shadow-sm">
            {(canManageMath || isMasterOrAdmin) && (
              <button
                onClick={() => setSelectedSubject('math')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${selectedSubject === 'math'
                  ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                📐 수학
              </button>
            )}
            {(canManageEnglish || isMasterOrAdmin) && (
              <button
                onClick={() => setSelectedSubject('english')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${selectedSubject === 'english'
                  ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                📕 영어
              </button>
            )}
          </div>

          {/* Teacher Filter */}
          {canManageCurrentSubject && availableTeachers.length > 0 && (
            <div className="relative">
              <select
                value={filterTeacherId || ''}
                onChange={(e) => setSelectedTeacherId(e.target.value || undefined)}
                className="appearance-none bg-[#1e293b] border border-gray-700 rounded-md px-3 py-1 pr-7 text-xs font-medium text-white cursor-pointer hover:border-gray-500 focus:border-[#fdb813] focus:ring-1 focus:ring-[#fdb813] outline-none"
              >
                {availableTeachers.map(t => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          )}

          {/* Separator */}
          <div className="w-px h-4 bg-white/20 mx-1"></div>

          {/* Month Navigation */}
          <div className="flex items-center gap-1">
            <button onClick={() => changeMonth(-1)} className="p-1 border border-gray-700 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 font-bold text-white text-xs min-w-[100px] text-center">
              {currentDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
            </span>
            <button onClick={() => changeMonth(1)} className="p-1 border border-gray-700 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Settings */}
          <button
            onClick={() => setSalaryModalOpen(true)}
            className="p-1.5 border border-gray-700 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="급여 설정"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-5 gap-4 shrink-0">
        <div
          onClick={() => setSettlementModalOpen(true)}
          className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4 cursor-pointer hover:border-blue-300 transition-colors"
        >
          <div className="w-12 h-12 bg-blue-50 text-[#081429] rounded-lg flex items-center justify-center">
            <span className="text-2xl font-bold leading-none">₩</span>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">이번 달 급여</p>
            <p className="text-xl font-bold text-[#373d41]">{formatCurrency(finalSalary)}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-gray-50 text-[#081429] rounded-lg">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">전체 학생</p>
            <p className="text-xl font-bold text-[#373d41]">{visibleStudents.length}명</p>
          </div>
        </div>

        <div
          onClick={() => setListModal({ isOpen: true, type: 'new' })}
          className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4 relative overflow-hidden cursor-pointer hover:border-yellow-300 transition-colors"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-50 rounded-bl-full -mr-8 -mt-8"></div>
          <div className="p-3 bg-yellow-100 text-[#081429] rounded-lg z-10">
            <UserPlus size={24} />
          </div>
          <div className="z-10">
            <p className="text-sm text-gray-500 font-medium">신입생 유입</p>
            <div className="flex items-baseline gap-1">
              <p className="text-xl font-bold text-[#fdb813]">+{stats.newStudentsCount}명</p>
              {stats.newStudentsCount > 0 && (
                <span className="text-xs font-semibold text-[#fdb813]/80">(+{stats.newStudentRate}%)</span>
              )}
            </div>
          </div>
        </div>

        <div
          onClick={() => setListModal({ isOpen: true, type: 'dropped' })}
          className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4 cursor-pointer hover:border-red-300 transition-colors"
        >
          <div className="p-3 bg-red-50 text-red-600 rounded-lg">
            <UserMinus size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">지난달 퇴원</p>
            <div className="flex items-baseline gap-1">
              <p className="text-xl font-bold text-red-500">-{stats.droppedStudentsCount}명</p>
              {stats.droppedStudentsCount > 0 && (
                <span className="text-xs font-semibold text-red-400">({stats.droppedStudentRate}%)</span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">출석률</p>
            <div className="flex items-end gap-2">
              <p className="text-xl font-bold text-[#373d41]">
                {stats.totalPresent + stats.totalAbsent === 0 ? '0' : Math.round((stats.totalPresent / (stats.totalPresent + stats.totalAbsent)) * 100)}%
              </p>
            </div>
          </div>
          <div className="h-10 w-10 rounded-full border-4 border-[#f1f5f9] border-t-[#081429] flex items-center justify-center transform -rotate-45">
          </div>
        </div>
      </div>

      {/* Main Table Area */}
      <main className="flex-1 px-6 pb-6 min-h-0 flex flex-col">
        <Table
          currentDate={currentDate}
          students={visibleStudents}
          salaryConfig={salaryConfig}
          onAttendanceChange={handleAttendanceChange}
          onEditStudent={handleEditStudent}
          onMemoChange={handleMemoChange}
          pendingUpdatesByStudent={pendingUpdatesByStudent}
          pendingMemosByStudent={pendingMemosByStudent}
          groupOrder={groupOrder}
          onGroupOrderChange={handleGroupOrderChange}
        />
      </main>

      {/* Modals */}
      <SalarySettings
        isOpen={isSalaryModalOpen}
        onClose={() => setSalaryModalOpen(false)}
        config={salaryConfig}
        onSave={handleSaveConfig}
        readOnly={true} // AttendanceManager allows only viewing settings
      />

      <StudentModal
        isOpen={isStudentModalOpen}
        onClose={() => { setStudentModalOpen(false); setEditingStudent(null); }}
        onSave={handleSaveStudent}
        onDelete={handleDeleteStudent}
        initialData={editingStudent}
        salaryConfig={salaryConfig}
        currentViewDate={currentDate}
        existingGroups={existingGroups}
      />

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
    </div>
  );
}

export default AttendanceManager;