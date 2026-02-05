import React, { useState, useMemo, useEffect } from 'react';
import { X, Edit, Trash2, Users, Clock, User, BookOpen, Calendar, MapPin, FileText, BarChart3, ChevronDown, ChevronUp, UserMinus } from 'lucide-react';
import { ClassInfo, useClasses } from '../../hooks/useClasses';
import { useClassDetail, ClassStudent } from '../../hooks/useClassDetail';
import { useDeleteClass, useUpdateClass, UpdateClassData, useManageClassStudents } from '../../hooks/useClassMutations';
import { useStudents } from '../../hooks/useStudents';
import ClassStudentList from './ClassStudentList';
import { SUBJECT_LABELS, SubjectType } from '../../utils/styleUtils';
import { formatScheduleCompact, SubjectForSchedule, ENGLISH_UNIFIED_PERIODS, MATH_UNIFIED_PERIODS, convertLegacyPeriodId } from '../Timetable/constants';
import { useTeachers } from '../../hooks/useFirebaseQueries';
import { useStaff } from '../../hooks/useStaff';
import { useClassStats } from '../../hooks/useClassStats';
import { formatSchoolGrade } from '../../utils/studentUtils';
import { useSimulationOptional } from '../Timetable/English/context/SimulationContext';
import { ScenarioClass } from '../Timetable/English/context/SimulationContext';

interface ClassDetailModalProps {
  classInfo: ClassInfo;
  onClose: () => void;
  onStudentClick?: (studentId: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  isSimulationMode?: boolean;
  initialSlotTeachers?: Record<string, string>;
}

type ViewTabType = 'info' | 'students' | 'stats';
type EditTabType = 'info' | 'schedule' | 'students';

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

const ClassDetailModal: React.FC<ClassDetailModalProps> = ({
  classInfo,
  onClose,
  onStudentClick,
  canEdit = true,
  canDelete = true,
  isSimulationMode = false,
  initialSlotTeachers
}) => {
  const { className: initialClassName, subject, studentCount } = classInfo;

  // ==================== 공통 상태 ====================
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState<ViewTabType>('info');
  const [activeEditTab, setActiveEditTab] = useState<EditTabType>('info');

  // ==================== 보기 모드 훅 ====================
  const { data: classDetail, isLoading: detailLoading } = useClassDetail(initialClassName, subject);
  const deleteClassMutation = useDeleteClass();
  const { data: teachersData } = useTeachers();

  const studentIds = useMemo(() => {
    return classDetail?.students.map(s => s.id) || [];
  }, [classDetail?.students]);

  const { attendanceRate, consultationRate, isLoading: statsLoading } = useClassStats(
    initialClassName,
    subject,
    studentIds
  );

  // ==================== 편집 모드 훅 ====================
  const simulationContext = isSimulationMode ? useSimulationOptional() : null;
  const updateClassMutation = useUpdateClass();
  const manageStudentsMutation = useManageClassStudents();
  const { staff } = useStaff();
  const { students: allStudents, loading: studentsLoading } = useStudents(false);
  const { data: existingClasses } = useClasses(classInfo.subject);

  // ==================== 편집 모드 상태 ====================
  const [className, setClassName] = useState(classInfo.className);
  const [teacher, setTeacher] = useState(classInfo.teacher);
  const [room, setRoom] = useState(classInfo.room || '');
  const [memo, setMemo] = useState('');

  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [slotTeachers, setSlotTeachers] = useState<Record<string, string>>(initialSlotTeachers || {});
  const [slotRooms, setSlotRooms] = useState<Record<string, string>>({});
  const [showAdvancedSchedule, setShowAdvancedSchedule] = useState(false);

  const [studentSearch, setStudentSearch] = useState('');
  const [studentsToAdd, setStudentsToAdd] = useState<Set<string>>(new Set());
  const [studentsToRemove, setStudentsToRemove] = useState<Set<string>>(new Set());
  const [studentAttendanceDays, setStudentAttendanceDays] = useState<Record<string, string[]>>({});
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [studentUnderlines, setStudentUnderlines] = useState<Record<string, boolean>>({});
  const [studentSlotTeachers, setStudentSlotTeachers] = useState<Record<string, boolean>>({});
  const [studentStartDates, setStudentStartDates] = useState<Record<string, string>>({});

  const [error, setError] = useState('');

  // ==================== 공통 헬퍼 함수 ====================
  const getTeacherDisplayName = (teacherName: string) => {
    const staffMember = teachersData?.find(t => t.name === teacherName || t.englishName === teacherName);
    if (subject === 'english') {
      return staffMember?.englishName || staffMember?.name || teacherName;
    }
    return staffMember?.name || teacherName;
  };

  const getTeacherColor = (teacherName: string) => {
    const teacherInfo = teachersData?.find(t => t.name === teacherName || t.englishName === teacherName);
    return {
      bgColor: teacherInfo?.bgColor || '#fdb813',
      textColor: teacherInfo?.textColor || '#081429'
    };
  };

  // ==================== 편집 모드 헬퍼 함수 ====================
  const availableTeachers = useMemo(() => {
    const subjectFilter = classInfo.subject as 'math' | 'english';
    return staff.filter(member => {
      if (subjectFilter === 'math') {
        if (member.systemRole === 'math_teacher' || member.systemRole === 'math_lead') return true;
      } else if (subjectFilter === 'english') {
        if (member.systemRole === 'english_teacher' || member.systemRole === 'english_lead') return true;
      }
      if (member.role === 'teacher' && member.subjects?.includes(subjectFilter)) return true;
      return false;
    });
  }, [staff, classInfo.subject]);

  const getTeacherDisplayNameForEdit = (staffMember: typeof staff[0]) => {
    if (classInfo.subject === 'english') return staffMember.englishName || staffMember.name;
    return staffMember.name;
  };

  const getTeacherSaveValue = (staffMember: typeof staff[0]) => {
    if (classInfo.subject === 'english') return staffMember.englishName || staffMember.name;
    return staffMember.name;
  };

  const findStaffByName = (name: string) => staff.find(s => s.name === name || s.englishName === name);

  const periods = classInfo.subject === 'english' ? ENGLISH_UNIFIED_PERIODS : MATH_UNIFIED_PERIODS;

  const currentStudents = classDetail?.students || [];
  const currentStudentIds = currentStudents.map(s => s.id);

  const availableStudents = useMemo(() => {
    if (!allStudents) return [];
    return allStudents
      .filter(s => s.status === 'active' && !currentStudentIds.includes(s.id) && !studentsToAdd.has(s.id))
      .filter(s => {
        if (!studentSearch.trim()) return true;
        const search = studentSearch.toLowerCase();
        return (s.name || '').toLowerCase().includes(search) || s.school?.toLowerCase().includes(search) || s.grade?.toLowerCase().includes(search);
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
  }, [allStudents, currentStudentIds, studentsToAdd, studentSearch]);

  const studentsToAddInfo = useMemo(() => {
    if (!allStudents) return [];
    return allStudents.filter(s => studentsToAdd.has(s.id));
  }, [allStudents, studentsToAdd]);

  const classDays = useMemo(() => {
    const days = new Set<string>();
    selectedSlots.forEach(slot => {
      const day = slot.split('-')[0];
      if (day) days.add(day);
    });
    const dayOrder = ['월', '화', '수', '목', '금', '토', '일'];
    return Array.from(days).sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
  }, [selectedSlots]);

  // ==================== useEffect ====================
  useEffect(() => {
    if (staff.length > 0) {
      // classDetail?.teacher를 우선 사용하고, 없으면 classInfo.teacher 사용
      const teacherValue = classDetail?.teacher || classInfo.teacher;
      if (teacherValue) {
        const matchedStaff = findStaffByName(teacherValue);
        if (matchedStaff) setTeacher(getTeacherSaveValue(matchedStaff));
        else setTeacher(teacherValue);
      }
    }
  }, [staff, classInfo.teacher, classDetail?.teacher]);

  useEffect(() => {
    if (classInfo.schedule && classInfo.schedule.length > 0) {
      const slots = new Set<string>();
      classInfo.schedule.forEach(item => {
        const parts = item.split(' ');
        if (parts.length >= 2) slots.add(`${parts[0]}-${convertLegacyPeriodId(parts[1])}`);
      });
      setSelectedSlots(slots);
    }
    if (classInfo.slotTeachers) setSlotTeachers(classInfo.slotTeachers);
    if (classInfo.slotRooms) setSlotRooms(classInfo.slotRooms);
  }, [classInfo.schedule, classInfo.slotTeachers, classInfo.slotRooms]);

  useEffect(() => {
    if (classDetail?.memo) setMemo(classDetail.memo);
  }, [classDetail?.memo]);

  useEffect(() => {
    if (classDetail?.students) {
      const existingDays: Record<string, string[]> = {};
      const existingUnderlines: Record<string, boolean> = {};
      const existingSlotTeachers: Record<string, boolean> = {};
      classDetail.students.forEach(student => {
        if (student.attendanceDays && student.attendanceDays.length > 0) existingDays[student.id] = student.attendanceDays;
        if (student.underline) existingUnderlines[student.id] = student.underline;
        if (student.isSlotTeacher) existingSlotTeachers[student.id] = student.isSlotTeacher;
      });
      setStudentAttendanceDays(existingDays);
      setStudentUnderlines(existingUnderlines);
      setStudentSlotTeachers(existingSlotTeachers);
    }
  }, [classDetail?.students]);

  // ==================== 편집 모드 핸들러 ====================
  const toggleSlot = (day: string, periodId: string) => {
    const key = `${day}-${periodId}`;
    const newSlots = new Set(selectedSlots);
    if (newSlots.has(key)) {
      newSlots.delete(key);
      const newTeachers = { ...slotTeachers };
      const newRooms = { ...slotRooms };
      delete newTeachers[key];
      delete newRooms[key];
      setSlotTeachers(newTeachers);
      setSlotRooms(newRooms);
    } else {
      newSlots.add(key);
    }
    setSelectedSlots(newSlots);
  };

  const setSlotTeacher = (key: string, teacherName: string) => setSlotTeachers(prev => ({ ...prev, [key]: teacherName }));
  const setSlotRoom = (key: string, roomName: string) => setSlotRooms(prev => ({ ...prev, [key]: roomName }));

  const toggleAddStudent = (studentId: string) => {
    const newSet = new Set(studentsToAdd);
    if (newSet.has(studentId)) {
      newSet.delete(studentId);
      setStudentStartDates(prev => { const { [studentId]: _, ...rest } = prev; return rest; });
    } else {
      newSet.add(studentId);
      setStudentStartDates(prev => ({ ...prev, [studentId]: new Date().toISOString().split('T')[0] }));
    }
    setStudentsToAdd(newSet);
  };

  const toggleRemoveStudent = (studentId: string) => {
    const newSet = new Set(studentsToRemove);
    if (newSet.has(studentId)) newSet.delete(studentId);
    else newSet.add(studentId);
    setStudentsToRemove(newSet);
  };

  const cancelAddStudent = (studentId: string) => {
    const newSet = new Set(studentsToAdd);
    newSet.delete(studentId);
    setStudentsToAdd(newSet);
    setStudentStartDates(prev => { const { [studentId]: _, ...rest } = prev; return rest; });
  };

  const toggleStudentDay = (studentId: string, day: string) => {
    const dayOrder = ['월', '화', '수', '목', '금', '토', '일'];
    setStudentAttendanceDays(prev => {
      const currentDays = prev[studentId] || [];
      let newDays: string[];
      if (currentDays.includes(day)) newDays = currentDays.filter(d => d !== day);
      else newDays = [...currentDays, day].sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
      if (newDays.length === 0) { const { [studentId]: _, ...rest } = prev; return rest; }
      return { ...prev, [studentId]: newDays };
    });
  };

  const isStudentAttendingDay = (studentId: string, day: string): boolean => {
    const days = studentAttendanceDays[studentId];
    if (!days || days.length === 0) return true;
    return days.includes(day);
  };

  const getAttendanceDaysText = (studentId: string): string | null => {
    const days = studentAttendanceDays[studentId];
    if (!days || days.length === 0) return null;
    if (days.length === classDays.length) {
      const sorted1 = [...days].sort();
      const sorted2 = [...classDays].sort();
      if (sorted1.every((day, i) => day === sorted2[i])) return null;
    }
    return days.join(', ');
  };

  const toggleStudentUnderline = (studentId: string) => setStudentUnderlines(prev => ({ ...prev, [studentId]: !prev[studentId] }));

  // ==================== 저장 로직 ====================
  const handleSave = async () => {
    if (!className.trim()) { setError('수업명을 입력해주세요.'); return; }
    if (!teacher.trim()) { setError('담임을 입력해주세요.'); return; }

    const trimmedClassName = className.trim();
    const originalClassName = classInfo.className;
    if (trimmedClassName.toLowerCase() !== originalClassName.toLowerCase()) {
      const isDuplicate = existingClasses?.some(cls => cls.className.toLowerCase() === trimmedClassName.toLowerCase());
      if (isDuplicate) { setError(`"${trimmedClassName}" 수업명이 이미 존재합니다. 다른 이름을 사용해주세요.`); return; }
    }

    setError('');

    const schedule: string[] = [];
    selectedSlots.forEach(key => { const [day, periodId] = key.split('-'); schedule.push(`${day} ${periodId}`); });

    const filteredSlotTeachers: Record<string, string> = {};
    Object.entries(slotTeachers).forEach(([key, value]) => { if (value && value.trim()) filteredSlotTeachers[key] = value.trim(); });

    const filteredSlotRooms: Record<string, string> = {};
    Object.entries(slotRooms).forEach(([key, value]) => { if (value && value.trim()) filteredSlotRooms[key] = value.trim(); });

    try {
      if (isSimulationMode && simulationContext) {
        const scenarioSchedule = schedule.map(slot => { const [day, periodId] = slot.split(' '); return { day, periodId }; });
        const updates: Partial<ScenarioClass> = {
          className: trimmedClassName,
          teacher: teacher.trim(),
          schedule: scenarioSchedule,
          room: room.trim(),
          slotTeachers: filteredSlotTeachers,
          slotRooms: filteredSlotRooms,
        };
        simulationContext.updateScenarioClassWithHistory(classInfo.id!, updates, `수업 수정: ${originalClassName}`);
        setIsEditMode(false);
      } else {
        const updateData: UpdateClassData = {
          originalClassName: classInfo.className,
          originalSubject: classInfo.subject,
          newClassName: className.trim(),
          newTeacher: teacher.trim(),
          newSchedule: schedule,
          newRoom: room.trim(),
          slotTeachers: filteredSlotTeachers,
          slotRooms: filteredSlotRooms,
          memo: memo.trim(),
        };

        await updateClassMutation.mutateAsync(updateData);

        const hasStudentChanges = studentsToAdd.size > 0 || studentsToRemove.size > 0 || Object.keys(studentAttendanceDays).length > 0 || Object.keys(studentUnderlines).length > 0 || Object.keys(studentSlotTeachers).length > 0;
        if (hasStudentChanges) {
          await manageStudentsMutation.mutateAsync({
            className: className.trim(),
            teacher: teacher.trim(),
            subject: classInfo.subject,
            schedule,
            addStudentIds: Array.from(studentsToAdd),
            removeStudentIds: Array.from(studentsToRemove),
            studentAttendanceDays,
            studentUnderlines,
            studentSlotTeachers,
            studentStartDates,
          });
        }

        const classNameChanged = className.trim() !== classInfo.className;
        if (classNameChanged) {
          onClose();
        } else {
          setIsEditMode(false);
          setStudentsToAdd(new Set());
          setStudentsToRemove(new Set());
        }
      }
    } catch (err) {
      console.error('[ClassDetailModal] Error updating class:', err);
      setError('수업 수정에 실패했습니다.');
    }
  };

  // ==================== 보기 모드 데이터 ====================
  const teacherDisplay = classDetail?.teacher || classInfo.teacher;
  const scheduleDisplay = classDetail?.schedule || classInfo.schedule;
  const roomDisplay = classDetail?.room || classInfo.room;
  const slotTeachersDisplay = classDetail?.slotTeachers;

  const subjectForSchedule: SubjectForSchedule = subject === 'english' ? 'english' : 'math';
  const formattedSchedule = formatScheduleCompact(scheduleDisplay, subjectForSchedule, false);

  const classDisplayDays = useMemo(() => {
    const days = new Set<string>();
    (scheduleDisplay || []).forEach(item => {
      const parts = item.split(' ');
      if (parts.length >= 1) days.add(parts[0]);
    });
    const dayOrder = ['월', '화', '수', '목', '금', '토', '일'];
    return Array.from(days).sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
  }, [scheduleDisplay]);

  // ==================== 삭제 로직 ====================
  const handleDelete = async () => {
    const warningMsg = `정말로 "${initialClassName}" 수업을 삭제하시겠습니까?\n\n⚠️ 다음 항목이 모두 삭제됩니다:\n• 수업 정보 (강사, 스케줄, 교실)\n• ${studentCount || 0}명 학생의 수업 배정\n• 시간표에서 해당 수업\n\n이 작업은 되돌릴 수 없습니다.`;
    if (!window.confirm(warningMsg)) return;
    try {
      await deleteClassMutation.mutateAsync({ className: initialClassName, subject });
      onClose();
    } catch (err) {
      console.error('[ClassDetailModal] Error deleting class:', err);
      alert('수업 삭제에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setError('');
    setClassName(classInfo.className);
    // classDetail?.teacher를 우선 사용
    const teacherValue = classDetail?.teacher || classInfo.teacher;
    if (teacherValue && staff.length > 0) {
      const matchedStaff = findStaffByName(teacherValue);
      if (matchedStaff) setTeacher(getTeacherSaveValue(matchedStaff));
      else setTeacher(teacherValue);
    } else {
      setTeacher(teacherValue || '');
    }
    setRoom(classInfo.room || '');
    setStudentsToAdd(new Set());
    setStudentsToRemove(new Set());
  };

  const finalStudentCount = currentStudents.length - studentsToRemove.size + studentsToAdd.size;
  const isPending = updateClassMutation.isPending || manageStudentsMutation.isPending || deleteClassMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100]" onClick={onClose}>
      <div className="bg-white rounded-sm shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 bg-[#fdb813] text-[#081429] text-xxs font-bold">
              {SUBJECT_LABELS[subject as SubjectType] || subject}
            </span>
            <h2 className="text-sm font-bold text-[#081429]">{isEditMode ? className : initialClassName}</h2>
            {isEditMode && <span className="text-xxs text-blue-600 font-medium">편집 중</span>}
          </div>
          <div className="flex items-center gap-1">
            {isEditMode ? (
              <>
                <button onClick={handleCancelEdit} disabled={isPending} className="px-1.5 py-0.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors">취소</button>
                <button onClick={handleSave} disabled={isPending} className="bg-[#fdb813] hover:bg-[#e5a60f] text-[#081429] px-1.5 py-0.5 text-xs font-semibold disabled:opacity-50 transition-colors">{isPending ? '저장 중...' : '저장'}</button>
              </>
            ) : (
              <>
                {canEdit && (
                  <button onClick={() => setIsEditMode(true)} disabled={isPending} className="bg-[#fdb813] hover:bg-[#e5a60f] text-[#081429] px-1.5 py-0.5 text-xs font-semibold disabled:opacity-50 transition-colors flex items-center gap-1">
                    <Edit className="w-3 h-3" />수정
                  </button>
                )}
                {canDelete && (
                  <button onClick={handleDelete} disabled={isPending} className="bg-red-600 hover:bg-red-700 text-white px-1.5 py-0.5 text-xs font-semibold disabled:opacity-50 transition-colors">삭제</button>
                )}
              </>
            )}
            <button onClick={onClose} disabled={isPending} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex items-center gap-4 px-2 py-1 border-b border-gray-200 bg-white">
          {isEditMode ? (
            <>
              <button onClick={() => setActiveEditTab('info')} className={`flex items-center gap-1 text-xs font-medium transition-colors ${activeEditTab === 'info' ? 'text-[#081429]' : 'text-gray-400 hover:text-gray-600'}`}>
                <BookOpen className="w-3 h-3" />기본 정보
              </button>
              <button onClick={() => !isSimulationMode && setActiveEditTab('students')} disabled={isSimulationMode} className={`flex items-center gap-1 text-xs font-medium transition-colors ${activeEditTab === 'students' ? 'text-[#081429]' : isSimulationMode ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-gray-600'}`}>
                <Users className="w-3 h-3" />학생({finalStudentCount})
              </button>
              <button onClick={() => setActiveEditTab('schedule')} className={`flex items-center gap-1 text-xs font-medium transition-colors ${activeEditTab === 'schedule' ? 'text-[#081429]' : 'text-gray-400 hover:text-gray-600'}`}>
                <Calendar className="w-3 h-3" />스케줄
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setActiveViewTab('info')} className={`flex items-center gap-1 text-xs font-medium transition-colors ${activeViewTab === 'info' ? 'text-[#081429]' : 'text-gray-400 hover:text-gray-600'}`}>
                <BookOpen className="w-3 h-3" />수업정보
              </button>
              <button onClick={() => setActiveViewTab('students')} className={`flex items-center gap-1 text-xs font-medium transition-colors ${activeViewTab === 'students' ? 'text-[#081429]' : 'text-gray-400 hover:text-gray-600'}`}>
                <Users className="w-3 h-3" />학생({classDetail?.studentCount || studentCount || 0})
              </button>
              <button onClick={() => setActiveViewTab('stats')} className={`flex items-center gap-1 text-xs font-medium transition-colors ${activeViewTab === 'stats' ? 'text-[#081429]' : 'text-gray-400 hover:text-gray-600'}`}>
                <BarChart3 className="w-3 h-3" />통계
              </button>
            </>
          )}
        </div>

        {/* 컨텐츠 영역 - 탭 전환 시 크기 변동 방지를 위해 minHeight 고정 */}
        <div className="flex-1 overflow-y-auto p-2" style={{ minHeight: '400px' }}>
          {error && <div className="bg-red-50 border border-red-200 px-2 py-1 text-red-700 text-xs mb-2">{error}</div>}

          {/* ==================== 편집 모드 컨텐츠 ==================== */}
          {isEditMode && (
            <>
              {/* 편집: 기본 정보 탭 */}
              {activeEditTab === 'info' && (
                <div className="space-y-2">
                  <div className="bg-white border border-gray-200 overflow-hidden">
                    <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
                      <User className="w-3 h-3 text-[#081429]" />
                      <h3 className="text-[#081429] font-bold text-xs">기본 정보</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                      <div className="flex items-center gap-2 px-1.5 py-0.5">
                        <span className="w-16 shrink-0 text-xs font-medium text-[#373d41]">수업명 <span className="text-red-500">*</span></span>
                        <input type="text" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="예: LT1a" className="flex-1 px-2 py-0.5 text-xs border border-gray-300 focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none" />
                      </div>
                      <div className="flex items-center gap-2 px-1.5 py-0.5">
                        <span className="w-16 shrink-0 text-xs font-medium text-[#373d41]">담임 <span className="text-red-500">*</span></span>
                        <select value={teacher} onChange={(e) => setTeacher(e.target.value)} className="flex-1 px-2 py-0.5 text-xs border border-gray-300 focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none">
                          <option value="">선택해주세요</option>
                          {availableTeachers.map(t => <option key={t.id} value={getTeacherSaveValue(t)}>{getTeacherDisplayNameForEdit(t)}</option>)}
                        </select>
                      </div>
                      {availableTeachers.length === 0 && <div className="px-1.5 py-0.5"><p className="text-xxs text-amber-600">⚠️ {SUBJECT_LABELS[classInfo.subject as SubjectType]} 과목 강사가 없습니다.</p></div>}
                      <div className="flex items-center gap-2 px-1.5 py-0.5">
                        <span className="w-16 shrink-0 text-xs font-medium text-[#373d41]">강의실</span>
                        <input type="text" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="예: 302" className="flex-1 px-2 py-0.5 text-xs border border-gray-300 focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none" />
                      </div>
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 overflow-hidden">
                    <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
                      <FileText className="w-3 h-3 text-[#081429]" />
                      <h3 className="text-[#081429] font-bold text-xs">메모</h3>
                    </div>
                    <div className="p-1.5">
                      <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="수업에 대한 메모를 입력하세요..." rows={3} className="w-full px-2 py-1 text-xs border border-gray-300 focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none resize-none" />
                    </div>
                  </div>
                </div>
              )}

              {/* 편집: 스케줄 탭 */}
              {activeEditTab === 'schedule' && (
                <div className="space-y-2">
                  <div className="bg-white border border-gray-200 overflow-hidden">
                    <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
                      <Calendar className="w-3 h-3 text-[#081429]" />
                      <h3 className="text-[#081429] font-bold text-xs">스케줄</h3>
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      <div className="grid bg-gray-100 border-b border-gray-200 sticky top-0 z-10" style={{ gridTemplateColumns: `32px repeat(${WEEKDAYS.length}, 1fr)` }}>
                        <div className="p-1 text-center text-xxs font-semibold text-gray-400 border-r border-gray-200"></div>
                        {WEEKDAYS.map((day) => <div key={day} className="p-1 text-center text-xs font-semibold text-gray-600 border-r border-gray-200 last:border-r-0">{day}</div>)}
                      </div>
                      {periods.map(periodId => (
                        <div key={periodId} className="grid border-b border-gray-100 last:border-b-0" style={{ gridTemplateColumns: `32px repeat(${WEEKDAYS.length}, 1fr)` }}>
                          <div className="p-1 text-center text-xxs text-gray-400 bg-gray-50 flex items-center justify-center border-r border-gray-200">{periodId}</div>
                          {WEEKDAYS.map((day) => {
                            const key = `${day}-${periodId}`;
                            const isSelected = selectedSlots.has(key);
                            const slotTeacher = slotTeachers[key];
                            const displayTeacher = slotTeacher || teacher;
                            const colors = displayTeacher ? getTeacherColor(displayTeacher) : { bgColor: '#fdb813', textColor: '#081429' };
                            let displayName = '';
                            if (isSelected) {
                              if (slotTeacher) { const sm = findStaffByName(slotTeacher); displayName = sm ? getTeacherDisplayNameForEdit(sm) : slotTeacher; }
                              else if (teacher) { const sm = findStaffByName(teacher); displayName = sm ? getTeacherDisplayNameForEdit(sm) : teacher; }
                              else displayName = '✓';
                            }
                            return (
                              <button key={key} type="button" onClick={() => toggleSlot(day, periodId)} className={`p-1 transition-colors text-[10px] min-h-[24px] border-r border-gray-200 last:border-r-0 ${isSelected ? 'font-semibold' : 'hover:bg-gray-100 text-gray-300'}`} style={isSelected ? { backgroundColor: colors.bgColor, color: colors.textColor } : undefined}>{displayName}</button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                    {selectedSlots.size > 0 && (
                      <div className="px-2 py-1 border-t border-gray-100 flex items-center justify-between">
                        <p className="text-xxs text-gray-500">{selectedSlots.size}개 교시 선택</p>
                        <button type="button" onClick={() => setShowAdvancedSchedule(!showAdvancedSchedule)} className="text-xxs text-blue-600 hover:underline flex items-center gap-0.5">
                          {showAdvancedSchedule ? <ChevronUp size={10} /> : <ChevronDown size={10} />}교시별 부담임/강의실 설정
                        </button>
                      </div>
                    )}
                  </div>

                  {showAdvancedSchedule && selectedSlots.size > 0 && (
                    <div className="bg-white border border-gray-200 overflow-hidden">
                      <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
                        <Users className="w-3 h-3 text-[#081429]" />
                        <h3 className="text-[#081429] font-bold text-xs">교시별 부담임</h3>
                        <span className="text-xxs text-gray-400 ml-1">(비워두면 담임)</span>
                      </div>
                      {(() => {
                        const selectedPeriods = new Set<string>();
                        selectedSlots.forEach(key => { const [, p] = key.split('-'); selectedPeriods.add(p); });
                        const sortedPeriods = Array.from(selectedPeriods).sort((a, b) => Number(a) - Number(b));
                        return sortedPeriods.map(periodId => (
                          <div key={periodId} className="grid border-b border-gray-100 last:border-b-0" style={{ gridTemplateColumns: `32px repeat(${WEEKDAYS.length}, 1fr)` }}>
                            <div className="p-1 text-center text-[10px] text-gray-400 bg-gray-50 flex items-center justify-center border-r border-gray-200">{periodId}</div>
                            {WEEKDAYS.map((day) => {
                              const key = `${day}-${periodId}`;
                              const isSelected = selectedSlots.has(key);
                              if (!isSelected) return <div key={key} className="bg-gray-50 min-h-[28px] border-r border-gray-200 last:border-r-0" />;
                              return (
                                <div key={key} className="p-0.5 border-r border-gray-200 last:border-r-0">
                                  <select value={slotTeachers[key] || ''} onChange={(e) => setSlotTeacher(key, e.target.value)} className="w-full h-full px-1 py-0.5 border border-gray-200 rounded text-[10px] focus:ring-1 focus:ring-[#fdb813] outline-none bg-white">
                                    <option value="">{teacher ? (() => { const sm = findStaffByName(teacher); return sm ? getTeacherDisplayNameForEdit(sm) : teacher; })() : '담임'}</option>
                                    {availableTeachers.map(t => <option key={t.id} value={getTeacherSaveValue(t)}>{getTeacherDisplayNameForEdit(t)}</option>)}
                                  </select>
                                </div>
                              );
                            })}
                          </div>
                        ));
                      })()}
                    </div>
                  )}

                  {showAdvancedSchedule && selectedSlots.size > 0 && (
                    <div className="bg-white border border-gray-200 overflow-hidden">
                      <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
                        <BookOpen className="w-3 h-3 text-[#081429]" />
                        <h3 className="text-[#081429] font-bold text-xs">교시별 강의실</h3>
                        <span className="text-xxs text-gray-400 ml-1">(비워두면 기본)</span>
                      </div>
                      {(() => {
                        const selectedPeriods = new Set<string>();
                        selectedSlots.forEach(key => { const [, p] = key.split('-'); selectedPeriods.add(p); });
                        const sortedPeriods = Array.from(selectedPeriods).sort((a, b) => Number(a) - Number(b));
                        return sortedPeriods.map(periodId => (
                          <div key={periodId} className="grid border-b border-gray-100 last:border-b-0" style={{ gridTemplateColumns: `32px repeat(${WEEKDAYS.length}, 1fr)` }}>
                            <div className="p-1 text-center text-xxs text-gray-400 bg-gray-50 flex items-center justify-center border-r border-gray-200">{periodId}</div>
                            {WEEKDAYS.map((day) => {
                              const key = `${day}-${periodId}`;
                              const isSelected = selectedSlots.has(key);
                              if (!isSelected) return <div key={key} className="bg-gray-50 min-h-[28px] border-r border-gray-200 last:border-r-0" />;
                              return (
                                <div key={key} className="p-0.5 border-r border-gray-200 last:border-r-0">
                                  <input type="text" value={slotRooms[key] || ''} onChange={(e) => setSlotRoom(key, e.target.value)} placeholder={room || '-'} className="w-full h-full px-1 py-0.5 border border-gray-200 text-xxs focus:ring-1 focus:ring-[#fdb813] outline-none bg-white" />
                                </div>
                              );
                            })}
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* 편집: 학생 탭 */}
              {activeEditTab === 'students' && (
                <div className="space-y-2">
                  <div className="bg-white border border-gray-200 overflow-hidden">
                    <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
                      <Users className="w-3 h-3 text-[#081429]" />
                      <h3 className="text-[#081429] font-bold text-xs">현재 등록된 학생</h3>
                      <span className="text-xxs text-gray-500 ml-1">({currentStudents.length - studentsToRemove.size}명)</span>
                      {classInfo.subject === 'math' && classDays.length > 1 && <span className="text-xxs text-blue-500 ml-auto">클릭: 등원요일 · 체크박스: 부담임</span>}
                      {classInfo.subject === 'math' && classDays.length <= 1 && <span className="text-xxs text-blue-500 ml-auto">체크박스: 부담임</span>}
                      {classInfo.subject === 'english' && <span className="text-xxs text-blue-500 ml-auto">U: 밑줄 강조</span>}
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      {currentStudents.length === 0 ? (
                        <div className="p-3 text-center text-gray-400 text-sm">등록된 학생이 없습니다</div>
                      ) : (
                        currentStudents.map(student => {
                          const isMarkedForRemoval = studentsToRemove.has(student.id);
                          const isExpanded = expandedStudentId === student.id;
                          const attendanceDaysText = getAttendanceDaysText(student.id);
                          const hasUnderline = studentUnderlines[student.id] || false;
                          const isMath = classInfo.subject === 'math';
                          const isEnglish = classInfo.subject === 'english';
                          const canExpandForDays = isMath && classDays.length > 1 && !isMarkedForRemoval;

                          return (
                            <div key={student.id} className={isMarkedForRemoval ? 'bg-red-50' : ''}>
                              <div className={`flex items-center justify-between px-2.5 py-1.5 text-sm ${isMarkedForRemoval ? 'line-through text-gray-400' : 'hover:bg-gray-50'} ${canExpandForDays ? 'cursor-pointer' : ''}`} onClick={() => { if (canExpandForDays) setExpandedStudentId(isExpanded ? null : student.id); }}>
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {isMath && classDays.length > 1 && !isMarkedForRemoval && <Calendar size={12} className="text-gray-400 flex-shrink-0" />}
                                  {isMath && !isMarkedForRemoval && (
                                    <input type="checkbox" checked={studentSlotTeachers[student.id] || false} onChange={(e) => { e.stopPropagation(); setStudentSlotTeachers(prev => ({ ...prev, [student.id]: e.target.checked })); }} onClick={(e) => e.stopPropagation()} className="w-3.5 h-3.5 text-[#fdb813] rounded focus:ring-[#fdb813] flex-shrink-0" title="부담임으로 지정" />
                                  )}
                                  {isEnglish && !isMarkedForRemoval && (
                                    <button type="button" onClick={(e) => { e.stopPropagation(); toggleStudentUnderline(student.id); }} className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded flex-shrink-0 transition-colors ${hasUnderline ? 'bg-blue-500 text-white underline' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`} title={hasUnderline ? '밑줄 해제' : '밑줄 강조'}>U</button>
                                  )}
                                  <span className={`truncate ${isMarkedForRemoval ? 'text-gray-400' : 'text-gray-800'}`}>{student.name}</span>
                                  <span className="text-[10px] text-gray-400 flex-shrink-0">{formatSchoolGrade(student.school, student.grade)}</span>
                                  {isMath && attendanceDaysText && !isMarkedForRemoval && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">{attendanceDaysText}만</span>}
                                </div>
                                <button type="button" onClick={(e) => { e.stopPropagation(); toggleRemoveStudent(student.id); }} className={`p-1 rounded transition-colors flex-shrink-0 ${isMarkedForRemoval ? 'text-blue-600 hover:bg-blue-100' : 'text-red-500 hover:bg-red-100'}`} title={isMarkedForRemoval ? '제거 취소' : '수업에서 제외'}>
                                  {isMarkedForRemoval ? <span className="text-xs font-medium">취소</span> : <UserMinus size={14} />}
                                </button>
                              </div>
                              {isMath && isExpanded && classDays.length > 1 && (
                                <div className="px-2.5 py-2 bg-gray-50 border-t border-gray-100">
                                  <div className="text-[10px] text-gray-500 mb-1.5">등원 요일 선택 (체크 해제하면 해당 요일 미등원)</div>
                                  <div className="flex gap-1 flex-wrap">
                                    {classDays.map(day => {
                                      const isAttending = isStudentAttendingDay(student.id, day);
                                      return <button key={day} type="button" onClick={(e) => { e.stopPropagation(); toggleStudentDay(student.id, day); }} className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${isAttending ? 'bg-[#fdb813] text-[#081429]' : 'bg-gray-200 text-gray-400 line-through'}`}>{day}</button>;
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {studentsToAdd.size > 0 && (
                    <div className="bg-white border border-gray-200 overflow-hidden">
                      <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
                        <Calendar className="w-3 h-3 text-green-600" />
                        <h3 className="text-[#081429] font-bold text-xs">추가 예정</h3>
                        <span className="text-xxs text-green-600 ml-1">({studentsToAdd.size}명)</span>
                        <span className="text-xxs text-gray-400 ml-auto">시작일을 선택하세요</span>
                      </div>
                      <div className="max-h-32 overflow-y-auto">
                        {studentsToAddInfo.map(student => {
                          const startDate = studentStartDates[student.id] || new Date().toISOString().split('T')[0];
                          const today = new Date().toISOString().split('T')[0];
                          const isScheduled = startDate > today;
                          return (
                            <div key={student.id} className="px-2.5 py-1.5 text-sm bg-green-50/50 border-b border-green-100 last:border-b-0">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-green-800 font-medium">{student.name}</span>
                                  <span className="text-[10px] text-gray-400">{formatSchoolGrade(student.school, student.grade)}</span>
                                  {isScheduled && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">배정 예정</span>}
                                  {classInfo.subject === 'math' && (
                                    <label className="flex items-center gap-1 ml-1 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                      <input type="checkbox" checked={studentSlotTeachers[student.id] || false} onChange={(e) => setStudentSlotTeachers(prev => ({ ...prev, [student.id]: e.target.checked }))} className="w-3 h-3 text-[#fdb813] rounded focus:ring-[#fdb813]" />
                                      <span className="text-[10px] text-gray-600">부담임</span>
                                    </label>
                                  )}
                                </div>
                                <button type="button" onClick={() => cancelAddStudent(student.id)} className="text-xs text-gray-500 hover:text-red-500 font-medium">취소</button>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Calendar size={12} className="text-gray-400" />
                                <input type="date" value={startDate} onChange={(e) => setStudentStartDates(prev => ({ ...prev, [student.id]: e.target.value }))} className="px-2 py-0.5 text-[10px] border border-gray-200 rounded focus:ring-1 focus:ring-[#fdb813] outline-none" />
                                {isScheduled && <span className="text-[10px] text-blue-600">{startDate}부터 시작</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="bg-white border border-gray-200 overflow-hidden">
                    <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
                      <BookOpen className="w-3 h-3 text-[#081429]" />
                      <h3 className="text-[#081429] font-bold text-xs">학생 추가</h3>
                    </div>
                    <div className="p-1.5 border-b border-gray-100">
                      <input type="text" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="학생 검색하여 추가..." className="w-full px-2 py-1 border border-gray-300 text-xs focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none" />
                    </div>
                    <div className="max-h-32 overflow-y-auto">
                      {studentsLoading ? (
                        <div className="p-3 text-center text-gray-400 text-xs">로딩 중...</div>
                      ) : availableStudents.length === 0 ? (
                        <div className="p-3 text-center text-gray-400 text-xs">{studentSearch ? '검색 결과가 없습니다' : '추가 가능한 학생이 없습니다'}</div>
                      ) : (
                        availableStudents.map(student => (
                          <label key={student.id} className="flex items-center gap-2 px-2 py-1 cursor-pointer transition-colors hover:bg-gray-50 text-xs">
                            <input type="checkbox" checked={studentsToAdd.has(student.id)} onChange={() => toggleAddStudent(student.id)} className="w-3 h-3 text-[#fdb813] focus:ring-[#fdb813]" />
                            <span className="text-gray-800">{student.name}</span>
                            <span className="text-xxs text-gray-400">{formatSchoolGrade(student.school, student.grade)}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ==================== 보기 모드 컨텐츠 ==================== */}
          {!isEditMode && (
            <>
              {activeViewTab === 'info' && (
                <div className="space-y-2">
                  <div className="bg-white border border-gray-200 overflow-hidden">
                    <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
                      <User className="w-3 h-3 text-[#081429]" />
                      <h3 className="text-[#081429] font-bold text-xs">기본 정보</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                      <div className="flex items-center gap-2 px-1.5 py-0.5">
                        <span className="w-12 shrink-0 text-xs font-medium text-[#373d41]">담임</span>
                        <span className="flex-1 text-xs text-[#081429]">{teacherDisplay ? getTeacherDisplayName(teacherDisplay) : '-'}</span>
                      </div>
                      <div className="flex items-center gap-2 px-1.5 py-0.5">
                        <span className="w-12 shrink-0 text-xs font-medium text-[#373d41]">교실</span>
                        <span className="flex-1 text-xs text-[#081429]">{roomDisplay || '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 overflow-hidden">
                    <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
                      <Clock className="w-3 h-3 text-[#081429]" />
                      <h3 className="text-[#081429] font-bold text-xs">수업 시간</h3>
                    </div>
                    <div className="px-1.5 py-0.5">
                      <span className="text-xs text-[#081429]">{formattedSchedule || '-'}</span>
                    </div>
                  </div>

                  {scheduleDisplay && scheduleDisplay.length > 0 && (() => {
                    const WEEKDAYS_VIEW = ['월', '화', '수', '목', '금'];
                    const periodsView = subject === 'english' ? ENGLISH_UNIFIED_PERIODS : MATH_UNIFIED_PERIODS;
                    const selectedSlotsView = new Set<string>();
                    scheduleDisplay.forEach(item => { const parts = item.split(' '); if (parts.length >= 2) selectedSlotsView.add(`${parts[0]}-${parts[1]}`); });
                    const selectedPeriodIds = new Set<string>();
                    selectedSlotsView.forEach(key => { const [, periodId] = key.split('-'); selectedPeriodIds.add(periodId); });
                    const displayPeriods = periodsView.filter(p => selectedPeriodIds.has(p));
                    if (displayPeriods.length === 0) return null;

                    return (
                      <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
                          <Calendar className="w-3 h-3 text-[#081429]" />
                          <h3 className="text-[#081429] font-bold text-xs">스케줄</h3>
                        </div>
                        <div className="grid bg-gray-100" style={{ gridTemplateColumns: `32px repeat(${WEEKDAYS_VIEW.length}, 1fr)` }}>
                          <div className="p-1 text-center text-xxs font-semibold text-gray-400 border-r border-gray-200"></div>
                          {WEEKDAYS_VIEW.map((day, idx) => <div key={day} className={`p-1 text-center text-xs font-semibold text-gray-600 ${idx < WEEKDAYS_VIEW.length - 1 ? 'border-r border-gray-200' : ''}`}>{day}</div>)}
                        </div>
                        {displayPeriods.map(periodId => (
                          <div key={periodId} className="grid border-t border-gray-100" style={{ gridTemplateColumns: `32px repeat(${WEEKDAYS_VIEW.length}, 1fr)` }}>
                            <div className="p-1 text-center text-xxs text-gray-400 bg-gray-50 flex items-center justify-center border-r border-gray-200 font-medium">{periodId}</div>
                            {WEEKDAYS_VIEW.map((day, idx) => {
                              const key = `${day}-${periodId}`;
                              const isSelected = selectedSlotsView.has(key);
                              const slotTeacher = slotTeachersDisplay?.[key];
                              const displayTeacher = slotTeacher || teacherDisplay;
                              const colors = displayTeacher ? getTeacherColor(displayTeacher) : { bgColor: '#fdb813', textColor: '#081429' };
                              const displayName = displayTeacher ? getTeacherDisplayName(displayTeacher) : '';
                              return (
                                <div key={key} className={`p-1 text-center text-xxs min-h-[24px] flex items-center justify-center ${idx < WEEKDAYS_VIEW.length - 1 ? 'border-r border-gray-100' : ''} ${isSelected ? 'font-medium' : 'bg-white'}`} style={isSelected ? { backgroundColor: colors.bgColor, color: colors.textColor } : undefined}>{isSelected ? displayName : ''}</div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {slotTeachersDisplay && Object.keys(slotTeachersDisplay).length > 0 && (() => {
                    const visibleSlotTeachers = [...new Set(Object.values(slotTeachersDisplay))].filter(name => {
                      if (name === teacherDisplay) return false;
                      const teacherInfo = teachersData?.find(t => t.name === name || t.englishName === name);
                      return !teacherInfo?.isHidden;
                    });
                    if (visibleSlotTeachers.length === 0) return null;
                    return (
                      <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
                          <Users className="w-3 h-3 text-[#081429]" />
                          <h3 className="text-[#081429] font-bold text-xs">부담임</h3>
                        </div>
                        <div className="px-1.5 py-1 flex flex-wrap gap-1">
                          {visibleSlotTeachers.map((name) => <span key={name} className="bg-gray-100 px-1.5 py-0.5 text-xs text-[#081429] font-medium">{getTeacherDisplayName(name)}</span>)}
                        </div>
                      </div>
                    );
                  })()}

                  {classDetail?.memo && (
                    <div className="bg-white border border-gray-200 overflow-hidden">
                      <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
                        <FileText className="w-3 h-3 text-[#081429]" />
                        <h3 className="text-[#081429] font-bold text-xs">메모</h3>
                      </div>
                      <div className="px-1.5 py-1">
                        <p className="text-xs text-[#081429] whitespace-pre-wrap">{classDetail.memo}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeViewTab === 'students' && (
                <div className="bg-white border border-gray-200 overflow-hidden">
                  <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
                    <Users className="w-3 h-3 text-[#081429]" />
                    <h3 className="text-[#081429] font-bold text-xs">수강 학생</h3>
                    <span className="text-xxs text-gray-500 ml-1">({classDetail?.studentCount || studentCount || 0}명)</span>
                  </div>
                  {detailLoading ? (
                    <div className="p-6 text-center"><p className="text-gray-500 text-xs">불러오는 중...</p></div>
                  ) : classDetail ? (
                    <ClassStudentList students={classDetail.students} onStudentClick={onStudentClick} classDays={classDisplayDays} />
                  ) : (
                    <div className="p-6 text-center">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-30 text-gray-400" />
                      <p className="text-gray-500 text-xs">학생 정보를 불러올 수 없습니다.</p>
                    </div>
                  )}
                </div>
              )}

              {activeViewTab === 'stats' && (
                <div className="bg-white border border-gray-200 overflow-hidden">
                  <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
                    <BarChart3 className="w-3 h-3 text-[#081429]" />
                    <h3 className="text-[#081429] font-bold text-xs">수업 통계</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-1.5">
                    <div className="bg-gray-50 p-3 text-center border border-gray-100">
                      <p className="text-xxs text-gray-500 mb-1">활성 학생</p>
                      <p className="text-xl font-bold text-[#10b981]">{classDetail?.students.filter(s => !s.onHold).length || 0}</p>
                      <p className="text-xxs text-gray-400">전체 {classDetail?.studentCount || 0}명</p>
                    </div>
                    <div className="bg-gray-50 p-3 text-center border border-gray-100">
                      <p className="text-xxs text-gray-500 mb-1">대기 학생</p>
                      <p className="text-xl font-bold text-[#f59e0b]">{classDetail?.students.filter(s => s.onHold).length || 0}</p>
                      <p className="text-xxs text-gray-400">{(classDetail?.students.filter(s => s.onHold).length || 0) > 0 ? '휴원 중' : '휴원생 없음'}</p>
                    </div>
                    <div className="bg-gray-50 p-3 text-center border border-gray-100">
                      <p className="text-xxs text-gray-500 mb-1">이번 달 출석률</p>
                      {statsLoading ? <p className="text-xl font-bold text-gray-400">...</p> : (
                        <>
                          <p className="text-xl font-bold text-[#3b82f6]">{attendanceRate}%</p>
                          <p className="text-xxs text-gray-400">{attendanceRate >= 90 ? '우수' : attendanceRate >= 80 ? '양호' : '개선 필요'}</p>
                        </>
                      )}
                    </div>
                    <div className="bg-gray-50 p-3 text-center border border-gray-100">
                      <p className="text-xxs text-gray-500 mb-1">이번 달 상담률</p>
                      {statsLoading ? <p className="text-xl font-bold text-gray-400">...</p> : (
                        <>
                          <p className="text-xl font-bold text-[#8b5cf6]">{consultationRate}%</p>
                          <p className="text-xxs text-gray-400">{consultationRate >= 80 ? '우수' : consultationRate >= 50 ? '양호' : '개선 필요'}</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClassDetailModal;
