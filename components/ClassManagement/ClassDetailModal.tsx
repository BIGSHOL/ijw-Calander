import React, { useState, useMemo, useEffect } from 'react';
import { X, Edit, Trash2, Users, Clock, User, BookOpen, Calendar, MapPin, FileText, BarChart3, ChevronDown, ChevronUp, UserMinus, UserCheck } from 'lucide-react';
import TeacherHandoverModal from './TeacherHandoverModal';
import { ClassInfo, useClasses } from '../../hooks/useClasses';
import { useClassDetail, ClassStudent } from '../../hooks/useClassDetail';
import { useDeleteClass, useUpdateClass, UpdateClassData, useManageClassStudents, useCancelTeacherHandover } from '../../hooks/useClassMutations';
import { useStudents } from '../../hooks/useStudents';
import ClassStudentList from './ClassStudentList';
import SubjectBadges from '../Common/SubjectBadges';
import { SUBJECT_LABELS, SubjectType } from '../../utils/styleUtils';
import { formatScheduleCompact, SubjectForSchedule, ENGLISH_UNIFIED_PERIODS, MATH_UNIFIED_PERIODS, convertLegacyPeriodId } from '../Timetable/constants';
import { useTeachers } from '../../hooks/useFirebaseQueries';
import { useStaff } from '../../hooks/useStaff';
import { useClassStats } from '../../hooks/useClassStats';
import { formatSchoolGrade } from '../../utils/studentUtils';
import { useSimulationOptional } from '../Timetable/English/context/SimulationContext';
import { ScenarioClass } from '../Timetable/English/context/SimulationContext';
import { useEscapeClose } from '../../hooks/useEscapeClose';
import { getTodayKST } from '../../utils/dateUtils';
import { useClassOperations } from '../Timetable/Math/hooks/useClassOperations';
import { useRooms } from '../../hooks/useRooms';
import { useDraggable } from '../../hooks/useDraggable';

interface ClassDetailModalProps {
  classInfo: ClassInfo;
  onClose: () => void;
  onStudentClick?: (studentId: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  isSimulationMode?: boolean;
  initialSlotTeachers?: Record<string, string>;
}

type ViewTabType = 'schedule' | 'info' | 'students' | 'stats';
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
  useEscapeClose(onClose);
  const { handleMouseDown: handleDragMouseDown, dragStyle } = useDraggable();
  const { className: initialClassName, subject, studentCount } = classInfo;

  // ==================== 공통 상태 ====================
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState<ViewTabType>('schedule');
  const [activeEditTab, setActiveEditTab] = useState<EditTabType>('info');
  const [showHandoverModal, setShowHandoverModal] = useState(false);

  // ==================== 보기 모드 훅 ====================
  const { data: classDetail, isLoading: detailLoading } = useClassDetail(initialClassName, subject);
  const deleteClassMutation = useDeleteClass();
  const cancelHandoverMutation = useCancelTeacherHandover();
  const { data: teachersData } = useTeachers();
  // useClasses로 해당 과목의 최신 class 목록 조회 (pending 필드 fallback 용)
  // — prop으로 들어온 classInfo.pendingTeacher가 undefined여도 Firestore 최신값을 신뢰
  // — 예약 취소 직후 stale prop을 무시하고 즉시 UI 반영
  const { data: subjectClassesList } = useClasses(subject);

  // 최신 Firestore pending 정보를 prop에 오버레이한 effective classInfo
  const effectiveClassInfo = useMemo(() => {
    if (!classInfo.id) return classInfo;
    const latest = subjectClassesList?.find(c => c.id === classInfo.id);
    if (!latest) return classInfo;
    return {
      ...classInfo,
      // pending 필드는 Firestore를 단일 소스로 신뢰 (undefined면 undefined 그대로 반영)
      pendingTeacher: latest.pendingTeacher,
      pendingTeacherDate: latest.pendingTeacherDate,
      pendingTeacherReason: latest.pendingTeacherReason,
    } as typeof classInfo;
  }, [classInfo, subjectClassesList]);

  // 강사 인수인계 예약 정보 (classes/{id}.pendingTeacher*)
  const hasPendingHandover = !!(effectiveClassInfo.pendingTeacher && effectiveClassInfo.pendingTeacherDate);

  const handleCancelHandover = async () => {
    if (!effectiveClassInfo.id || !effectiveClassInfo.pendingTeacher) return;
    const confirmMsg = `"${initialClassName}" 수업의 강사 인수인계 예약을 취소하시겠습니까?\n\n` +
      `- 예정일: ${effectiveClassInfo.pendingTeacherDate}\n` +
      `- ${effectiveClassInfo.teacher} → ${effectiveClassInfo.pendingTeacher}\n\n` +
      `사전 생성된 새 enrollment가 삭제되고, 기존 enrollment의 endDate가 복구됩니다.`;
    if (!window.confirm(confirmMsg)) return;
    try {
      await cancelHandoverMutation.mutateAsync({
        classId: effectiveClassInfo.id,
        className: initialClassName,
        subject: subject as SubjectType,
        currentTeacher: effectiveClassInfo.teacher,
        pendingTeacher: effectiveClassInfo.pendingTeacher,
      });
    } catch (err: any) {
      alert('취소 실패: ' + (err?.message || '알 수 없는 오류'));
    }
  };

  const [showModifyHandoverModal, setShowModifyHandoverModal] = useState(false);

  const handleModifyHandover = () => {
    // 수정 모달 오픈 — 기존 예약은 건드리지 않음
    // 사용자가 모달에서 "수정 저장" 클릭 시에만 기존 예약 취소 + 새 예약 생성 순서로 실행
    // (사용자가 모달을 닫으면 기존 예약은 그대로 유지되어 UX 보호)
    if (!effectiveClassInfo.id || !effectiveClassInfo.pendingTeacher) return;
    setShowModifyHandoverModal(true);
  };

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
  const { data: roomsList = [] } = useRooms();

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
  const [studentEnrollmentDates, setStudentEnrollmentDates] = useState<Record<string, string>>({});
  const [showEditWithdrawn, setShowEditWithdrawn] = useState(false);
  const { deleteEnrollmentRecord } = useClassOperations();

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

  // 학생 3분류: 재원생 / 대기생(배정 예정) / 퇴원생
  const activeStudents = useMemo(() => currentStudents.filter(s => !s.isScheduled && !s.isWithdrawn), [currentStudents]);
  const scheduledStudents = useMemo(() => currentStudents.filter(s => s.isScheduled), [currentStudents]);
  const withdrawnStudents = useMemo(() => currentStudents.filter(s => s.isWithdrawn), [currentStudents]);
  const [showScheduled, setShowScheduled] = useState(false);
  const [showWithdrawn, setShowWithdrawn] = useState(false);

  // 학생 추가 시 제외 대상: 재원생 + 배정 예정만 (퇴원생은 재배정 가능)
  const enrolledStudentIds = useMemo(() =>
    currentStudents.filter(s => !s.isWithdrawn).map(s => s.id),
    [currentStudents]
  );

  const availableStudents = useMemo(() => {
    if (!allStudents) return [];
    return allStudents
      .filter(s => s.status === 'active' && !enrolledStudentIds.includes(s.id) && !studentsToAdd.has(s.id))
      .filter(s => {
        if (!studentSearch.trim()) return true;
        const search = studentSearch.toLowerCase();
        return (
          (s.name || '').toLowerCase().includes(search) ||
          s.school?.toLowerCase().includes(search) ||
          s.grade?.toLowerCase().includes(search)
        );
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

  // classInfo에 schedule이 없는 경우 classDetail에서 fallback 로드
  // (영어 통합뷰에서 반정보 클릭 시 classInfo에 schedule이 포함되지 않음)
  useEffect(() => {
    if (classInfo.schedule && classInfo.schedule.length > 0) return;
    if (!classDetail?.schedule || classDetail.schedule.length === 0) return;

    const slots = new Set<string>();
    classDetail.schedule.forEach(item => {
      const parts = item.split(' ');
      if (parts.length >= 2) slots.add(`${parts[0]}-${convertLegacyPeriodId(parts[1])}`);
    });
    setSelectedSlots(slots);
    if (classDetail.slotTeachers && !classInfo.slotTeachers) setSlotTeachers(classDetail.slotTeachers);
    if (classDetail.slotRooms && !classInfo.slotRooms) setSlotRooms(classDetail.slotRooms);
  }, [classDetail?.schedule, classDetail?.slotTeachers, classDetail?.slotRooms, classInfo.schedule, classInfo.slotTeachers, classInfo.slotRooms]);

  useEffect(() => {
    if (classDetail?.memo) setMemo(classDetail.memo);
  }, [classDetail?.memo]);

  useEffect(() => {
    if (classDetail?.students) {
      const existingDays: Record<string, string[]> = {};
      const existingUnderlines: Record<string, boolean> = {};
      const existingSlotTeachers: Record<string, boolean> = {};
      const existingEnrollmentDates: Record<string, string> = {};
      classDetail.students.forEach(student => {
        if (student.attendanceDays && student.attendanceDays.length > 0) existingDays[student.id] = student.attendanceDays;
        if (student.underline) existingUnderlines[student.id] = student.underline;
        if (student.isSlotTeacher) existingSlotTeachers[student.id] = student.isSlotTeacher;
        if (student.enrollmentDate) existingEnrollmentDates[student.id] = student.enrollmentDate;
      });
      setStudentAttendanceDays(existingDays);
      setStudentUnderlines(existingUnderlines);
      setStudentSlotTeachers(existingSlotTeachers);
      setStudentEnrollmentDates(existingEnrollmentDates);
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
      setStudentStartDates(prev => ({ ...prev, [studentId]: getTodayKST() }));
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

      if (currentDays.length === 0) {
        // 전체 등원 상태 → 클릭한 요일만 제외
        newDays = classDays.filter(d => d !== day);
      } else if (currentDays.includes(day)) {
        newDays = currentDays.filter(d => d !== day);
      } else {
        newDays = [...currentDays, day].sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
      }

      // 빈 배열이거나 전체 요일 선택 시 빈 배열로 유지 (mutation에서 변경 감지용)
      if (newDays.length === 0) { return { ...prev, [studentId]: [] }; }
      const sortedNew = [...newDays].sort();
      const sortedAll = [...classDays].sort();
      if (sortedNew.length === sortedAll.length && sortedNew.every((d, i) => d === sortedAll[i])) {
        return { ...prev, [studentId]: [] };
      }

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

        const hasStudentChanges = studentsToAdd.size > 0 || studentsToRemove.size > 0 || Object.keys(studentAttendanceDays).length > 0 || Object.keys(studentUnderlines).length > 0 || Object.keys(studentSlotTeachers).length > 0 || Object.keys(studentEnrollmentDates).length > 0;
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
            studentEnrollmentDates,
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

  const finalStudentCount = activeStudents.length - studentsToRemove.size + studentsToAdd.size;
  const isPending = updateClassMutation.isPending || manageStudentsMutation.isPending || deleteClassMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100]">
      <div style={dragStyle} className="bg-white rounded-sm shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div onMouseDown={handleDragMouseDown} className="flex items-center justify-between px-2 py-1.5 border-b border-gray-200 cursor-move select-none">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 bg-accent text-primary text-xxs font-bold">
              {SUBJECT_LABELS[subject as SubjectType] || subject}
            </span>
            <h2 className="text-sm font-bold text-primary">{isEditMode ? className : initialClassName}</h2>
            {isEditMode && <span className="text-xxs text-blue-600 font-medium">편집 중</span>}
          </div>
          <div className="flex items-center gap-1">
            {isEditMode ? (
              <>
                <button onClick={handleCancelEdit} disabled={isPending} className="px-1.5 py-0.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors">취소</button>
                <button onClick={handleSave} disabled={isPending} className="bg-accent hover:bg-[#e5a60f] text-primary px-1.5 py-0.5 text-xs font-semibold disabled:opacity-50 transition-colors">{isPending ? '저장 중...' : '저장'}</button>
              </>
            ) : (
              <>
                {canEdit && !isSimulationMode && classInfo.id && !hasPendingHandover && (
                  <button
                    onClick={() => setShowHandoverModal(true)}
                    disabled={isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-1.5 py-0.5 text-xs font-semibold disabled:opacity-50 transition-colors flex items-center gap-1"
                    title="지정한 날짜부터 담임을 새 강사로 교체 (기존 담임의 수강 이력은 보존)"
                  >
                    <UserCheck className="w-3 h-3" />인수인계
                  </button>
                )}
                {canEdit && (
                  <button onClick={() => { setActiveEditTab('schedule'); setIsEditMode(true); }} disabled={isPending} className="bg-accent hover:bg-[#e5a60f] text-primary px-1.5 py-0.5 text-xs font-semibold disabled:opacity-50 transition-colors flex items-center gap-1">
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

        {/* 강사 인수인계 예약 배너 (pending 상태일 때만 표시) */}
        {hasPendingHandover && !isEditMode && !isSimulationMode && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-2 py-1.5 flex items-center gap-2">
            <UserCheck className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
            <div className="text-xxs text-emerald-900 flex-1 min-w-0">
              <span className="font-bold">강사 인수인계 예약됨</span>
              <span className="mx-1.5 text-emerald-600">·</span>
              <span>
                <span className="font-medium">{effectiveClassInfo.pendingTeacherDate}</span>부터
                <span className="mx-1 text-emerald-700">{effectiveClassInfo.teacher}</span>
                →
                <span className="ml-1 font-bold text-emerald-800">{effectiveClassInfo.pendingTeacher}</span>
              </span>
              {effectiveClassInfo.pendingTeacherReason && (
                <span className="ml-2 text-emerald-700 italic">({effectiveClassInfo.pendingTeacherReason})</span>
              )}
            </div>
            {canEdit && classInfo.id && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={handleModifyHandover}
                  disabled={cancelHandoverMutation.isPending || isPending}
                  className="px-1.5 py-0.5 text-xxs font-semibold bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                  title="기존 예약을 취소하고 다시 설정"
                >
                  수정
                </button>
                <button
                  onClick={handleCancelHandover}
                  disabled={cancelHandoverMutation.isPending || isPending}
                  className="px-1.5 py-0.5 text-xxs font-semibold bg-white border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
                  title="예약 취소 — 찢어진 enrollment 롤백"
                >
                  {cancelHandoverMutation.isPending ? '...' : '취소'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 탭 네비게이션 */}
        <div className="flex items-center gap-4 px-2 py-1 border-b border-gray-200 bg-white">
          {isEditMode ? (
            <>
              <button onClick={() => setActiveEditTab('schedule')} className={`flex items-center gap-1 text-xs font-medium transition-colors ${activeEditTab === 'schedule' ? 'text-primary' : 'text-gray-400 hover:text-gray-600'}`}>
                <Calendar className="w-3 h-3" />스케줄
              </button>
              <button onClick={() => setActiveEditTab('info')} className={`flex items-center gap-1 text-xs font-medium transition-colors ${activeEditTab === 'info' ? 'text-primary' : 'text-gray-400 hover:text-gray-600'}`}>
                <BookOpen className="w-3 h-3" />수업정보
              </button>
              <button onClick={() => !isSimulationMode && setActiveEditTab('students')} disabled={isSimulationMode} className={`flex items-center gap-1 text-xs font-medium transition-colors ${activeEditTab === 'students' ? 'text-primary' : isSimulationMode ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-gray-600'}`}>
                <Users className="w-3 h-3" />학생({finalStudentCount})
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setActiveViewTab('schedule')} className={`flex items-center gap-1 text-xs font-medium transition-colors ${activeViewTab === 'schedule' ? 'text-primary' : 'text-gray-400 hover:text-gray-600'}`}>
                <Calendar className="w-3 h-3" />스케줄
              </button>
              <button onClick={() => setActiveViewTab('info')} className={`flex items-center gap-1 text-xs font-medium transition-colors ${activeViewTab === 'info' ? 'text-primary' : 'text-gray-400 hover:text-gray-600'}`}>
                <BookOpen className="w-3 h-3" />수업정보
              </button>
              <button onClick={() => setActiveViewTab('students')} className={`flex items-center gap-1 text-xs font-medium transition-colors ${activeViewTab === 'students' ? 'text-primary' : 'text-gray-400 hover:text-gray-600'}`}>
                <Users className="w-3 h-3" />학생({classDetail?.studentCount || studentCount || 0})
              </button>
              <button onClick={() => setActiveViewTab('stats')} className={`flex items-center gap-1 text-xs font-medium transition-colors ${activeViewTab === 'stats' ? 'text-primary' : 'text-gray-400 hover:text-gray-600'}`}>
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
                      <User className="w-3 h-3 text-primary" />
                      <h3 className="text-primary font-bold text-xs">기본 정보</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                      <div className="flex items-center gap-2 px-1.5 py-0.5">
                        <span className="w-16 shrink-0 text-xs font-medium text-primary-700">수업명 <span className="text-red-500">*</span></span>
                        <input type="text" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="예: LT1a" className="flex-1 px-2 py-0.5 text-xs border border-gray-300 focus:ring-1 focus:ring-accent focus:border-accent outline-none" />
                      </div>
                      <div className="flex items-center gap-2 px-1.5 py-0.5">
                        <span className="w-16 shrink-0 text-xs font-medium text-primary-700">담임 <span className="text-red-500">*</span></span>
                        <select value={teacher} onChange={(e) => setTeacher(e.target.value)} className="flex-1 px-2 py-0.5 text-xs border border-gray-300 focus:ring-1 focus:ring-accent focus:border-accent outline-none">
                          <option value="">선택해주세요</option>
                          {availableTeachers.map(t => <option key={t.id} value={getTeacherSaveValue(t)}>{getTeacherDisplayNameForEdit(t)}</option>)}
                        </select>
                      </div>
                      {availableTeachers.length === 0 && <div className="px-1.5 py-0.5"><p className="text-xxs text-amber-600">⚠️ {SUBJECT_LABELS[classInfo.subject as SubjectType]} 과목 강사가 없습니다.</p></div>}
                      <div className="flex items-center gap-2 px-1.5 py-0.5">
                        <span className="w-16 shrink-0 text-xs font-medium text-primary-700">강의실</span>
                        <select value={room} onChange={(e) => setRoom(e.target.value)} className="flex-1 px-2 py-0.5 text-xs border border-gray-300 focus:ring-1 focus:ring-accent focus:border-accent outline-none bg-white">
                          <option value="">선택 안 함</option>
                          {roomsList.length > 0 ? (
                            (() => {
                              const grouped = new Map<string, typeof roomsList>();
                              roomsList.forEach(r => {
                                const key = r.building || r.floor || '기타';
                                if (!grouped.has(key)) grouped.set(key, []);
                                grouped.get(key)!.push(r);
                              });
                              // 현재 room 값이 목록에 없으면 추가
                              const allNames = roomsList.map(r => r.name);
                              const extraOption = room && !allNames.includes(room) ? <option key="current" value={room}>{room} (기존값)</option> : null;
                              return (
                                <>
                                  {extraOption}
                                  {[...grouped.entries()].map(([building, rms]) => (
                                    <optgroup key={building} label={building}>
                                      {rms.map(r => (
                                        <option key={r.id} value={r.name}>{r.name} ({r.capacity}명)</option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </>
                              );
                            })()
                          ) : (
                            <>
                              {room && <option value={room}>{room}</option>}
                              <option disabled>강의실 데이터 없음</option>
                            </>
                          )}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 overflow-hidden">
                    <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
                      <FileText className="w-3 h-3 text-primary" />
                      <h3 className="text-primary font-bold text-xs">메모</h3>
                    </div>
                    <div className="p-1.5">
                      <textarea value={memo} onChange={(e) => setMemo(e.target.value)} spellCheck={false} placeholder="수업에 대한 메모를 입력하세요..." rows={3} className="w-full px-2 py-1 text-xs border border-gray-300 focus:ring-1 focus:ring-accent focus:border-accent outline-none resize-none" />
                    </div>
                  </div>
                </div>
              )}

              {/* 편집: 스케줄 탭 */}
              {activeEditTab === 'schedule' && (
                <div className="space-y-2">
                  <div className="bg-white border border-gray-200 overflow-hidden">
                    <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
                      <Calendar className="w-3 h-3 text-primary" />
                      <h3 className="text-primary font-bold text-xs">스케줄</h3>
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
                        <Users className="w-3 h-3 text-primary" />
                        <h3 className="text-primary font-bold text-xs">교시별 부담임</h3>
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
                                  <select value={slotTeachers[key] || ''} onChange={(e) => setSlotTeacher(key, e.target.value)} className="w-full h-full px-1 py-0.5 border border-gray-200 rounded text-[10px] focus:ring-1 focus:ring-accent outline-none bg-white">
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
                        <BookOpen className="w-3 h-3 text-primary" />
                        <h3 className="text-primary font-bold text-xs">교시별 강의실</h3>
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
                                  <input type="text" value={slotRooms[key] || ''} onChange={(e) => setSlotRoom(key, e.target.value)} placeholder={room || '-'} className="w-full h-full px-1 py-0.5 border border-gray-200 text-xxs focus:ring-1 focus:ring-accent outline-none bg-white" />
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
                      <Users className="w-3 h-3 text-primary" />
                      <h3 className="text-primary font-bold text-xs">현재 등록된 학생</h3>
                      <span className="text-xxs text-gray-500 ml-1">({activeStudents.length - studentsToRemove.size}명)</span>
                      {classInfo.subject === 'math' && classDays.length > 1 && <span className="text-xxs text-blue-500 ml-auto">클릭: 등원일/요일 · 체크박스: 부담임</span>}
                      {classInfo.subject === 'math' && classDays.length <= 1 && <span className="text-xxs text-blue-500 ml-auto">클릭: 등원일 · 체크박스: 부담임</span>}
                      {classInfo.subject === 'english' && <span className="text-xxs text-blue-500 ml-auto">클릭: 등원일 · U: 밑줄 강조</span>}
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      {activeStudents.length === 0 ? (
                        <div className="p-3 text-center text-gray-400 text-sm">등록된 학생이 없습니다</div>
                      ) : (
                        activeStudents.map(student => {
                          const isMarkedForRemoval = studentsToRemove.has(student.id);
                          const isExpanded = expandedStudentId === student.id;
                          const attendanceDaysText = getAttendanceDaysText(student.id);
                          const hasUnderline = studentUnderlines[student.id] || false;
                          const isMath = classInfo.subject === 'math';
                          const isEnglish = classInfo.subject === 'english';
                          const canExpandForDays = !isMarkedForRemoval;

                          return (
                            <div key={student.id} className={isMarkedForRemoval ? 'bg-red-50' : ''}>
                              <div className={`flex items-center justify-between px-2.5 py-1.5 text-sm ${isMarkedForRemoval ? 'line-through text-gray-400' : 'hover:bg-gray-50'} ${canExpandForDays ? 'cursor-pointer' : ''}`} onClick={() => { if (canExpandForDays) setExpandedStudentId(isExpanded ? null : student.id); }}>
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {!isMarkedForRemoval && <Calendar size={12} className="text-gray-400 flex-shrink-0" />}
                                  {isMath && !isMarkedForRemoval && (
                                    <input type="checkbox" checked={studentSlotTeachers[student.id] || false} onChange={(e) => { e.stopPropagation(); setStudentSlotTeachers(prev => ({ ...prev, [student.id]: e.target.checked })); }} onClick={(e) => e.stopPropagation()} className="w-3.5 h-3.5 text-accent rounded focus:ring-accent flex-shrink-0" title="부담임으로 지정" />
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
                              {isExpanded && (
                                <div className="px-2.5 py-2 bg-gray-50 border-t border-gray-100 space-y-2">
                                  {/* 등원일 변경 */}
                                  <div>
                                    <div className="text-[10px] text-gray-500 mb-1">등원일</div>
                                    <div className="flex items-center gap-2">
                                      <Calendar size={12} className="text-gray-400" />
                                      <input
                                        type="date"
                                        value={studentEnrollmentDates[student.id] || ''}
                                        onChange={(e) => { e.stopPropagation(); setStudentEnrollmentDates(prev => ({ ...prev, [student.id]: e.target.value })); }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="px-2 py-0.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-accent outline-none"
                                      />
                                      {studentEnrollmentDates[student.id] && (
                                        <span className="text-[10px] text-gray-500">{studentEnrollmentDates[student.id]}~</span>
                                      )}
                                    </div>
                                  </div>
                                  {/* 등원 요일 선택 (수학, 다중 요일일 때만) */}
                                  {isMath && classDays.length > 1 && (
                                    <div>
                                      <div className="text-[10px] text-gray-500 mb-1">등원 요일 (체크 해제하면 해당 요일 미등원)</div>
                                      <div className="flex gap-1 flex-wrap">
                                        {classDays.map(day => {
                                          const isAttending = isStudentAttendingDay(student.id, day);
                                          return <button key={day} type="button" onClick={(e) => { e.stopPropagation(); toggleStudentDay(student.id, day); }} className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${isAttending ? 'bg-accent text-primary' : 'bg-gray-200 text-gray-400 line-through'}`}>{day}</button>;
                                        })}
                                      </div>
                                    </div>
                                  )}
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
                        <h3 className="text-primary font-bold text-xs">추가 예정</h3>
                        <span className="text-xxs text-green-600 ml-1">({studentsToAdd.size}명)</span>
                        <span className="text-xxs text-gray-400 ml-auto">시작일을 선택하세요</span>
                      </div>
                      <div className="max-h-32 overflow-y-auto">
                        {studentsToAddInfo.map(student => {
                          const startDate = studentStartDates[student.id] || getTodayKST();
                          const today = getTodayKST();
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
                                      <input type="checkbox" checked={studentSlotTeachers[student.id] || false} onChange={(e) => setStudentSlotTeachers(prev => ({ ...prev, [student.id]: e.target.checked }))} className="w-3 h-3 text-accent rounded focus:ring-accent" />
                                      <span className="text-[10px] text-gray-600">부담임</span>
                                    </label>
                                  )}
                                </div>
                                <button type="button" onClick={() => cancelAddStudent(student.id)} className="text-xs text-gray-500 hover:text-red-500 font-medium">취소</button>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Calendar size={12} className="text-gray-400" />
                                <input type="date" value={startDate} onChange={(e) => setStudentStartDates(prev => ({ ...prev, [student.id]: e.target.value }))} className="px-2 py-0.5 text-[10px] border border-gray-200 rounded focus:ring-1 focus:ring-accent outline-none" />
                                {isScheduled && <span className="text-[10px] text-blue-600">{startDate}부터 시작</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 퇴원생 - 접이식 (편집 모드) */}
                  {withdrawnStudents.length > 0 && (
                    <div className="bg-white border border-gray-200 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowEditWithdrawn(!showEditWithdrawn)}
                        className="flex items-center gap-1 px-2 py-1 bg-gray-100 border-b border-gray-200 w-full text-left hover:bg-gray-200 transition-colors"
                      >
                        {showEditWithdrawn ? <ChevronUp className="w-3 h-3 text-gray-500" /> : <ChevronDown className="w-3 h-3 text-gray-500" />}
                        <UserMinus className="w-3 h-3 text-gray-500" />
                        <h3 className="text-gray-600 font-bold text-xs">퇴원생</h3>
                        <span className="text-xxs text-gray-500 ml-1">({withdrawnStudents.length}명)</span>
                      </button>
                      {showEditWithdrawn && (
                        <div className="max-h-32 overflow-y-auto divide-y divide-gray-100">
                          {withdrawnStudents.map(student => (
                            <div key={student.id} className="flex items-center justify-between px-2.5 py-1.5 text-sm hover:bg-gray-50">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 line-through">{student.name}</span>
                                <span className="text-[10px] text-gray-400">{formatSchoolGrade(student.school, student.grade)}</span>
                                {student.withdrawalDate && <span className="text-xxs text-gray-400">~{student.withdrawalDate}</span>}
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (window.confirm(`${student.name}의 수업 기록을 완전히 삭제하시겠습니까?`)) {
                                    await deleteEnrollmentRecord(classInfo.className, student.id, classInfo.subject);
                                  }
                                }}
                                className="text-red-400 hover:text-red-600 p-1 transition-colors"
                                title="수업 기록 삭제"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bg-white border border-gray-200 overflow-hidden">
                    <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
                      <BookOpen className="w-3 h-3 text-primary" />
                      <h3 className="text-primary font-bold text-xs">학생 추가</h3>
                    </div>
                    <div className="p-1.5 border-b border-gray-100">
                      <input type="text" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="학생 검색하여 추가..." className="w-full px-2 py-1 border border-gray-300 text-xs focus:ring-1 focus:ring-accent focus:border-accent outline-none" />
                    </div>
                    <div className="max-h-32 overflow-y-auto">
                      {studentsLoading ? (
                        <div className="p-3 text-center text-gray-400 text-xs">로딩 중...</div>
                      ) : availableStudents.length === 0 ? (
                        <div className="p-3 text-center text-gray-400 text-xs">{studentSearch ? '검색 결과가 없습니다' : '추가 가능한 학생이 없습니다'}</div>
                      ) : (
                        availableStudents.map(student => (
                          <label key={student.id} className="flex items-start gap-2 px-2 py-1 cursor-pointer transition-colors hover:bg-gray-50 text-xs">
                            <input type="checkbox" checked={studentsToAdd.has(student.id)} onChange={() => toggleAddStudent(student.id)} className="w-3 h-3 text-accent focus:ring-accent mt-0.5" />
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1">
                                <span className="text-gray-800">{student.name}</span>
                                <span className="text-xxs text-gray-400">{formatSchoolGrade(student.school, student.grade)}</span>
                              </div>
                              <SubjectBadges enrollments={student.enrollments} />
                            </div>
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
              {activeViewTab === 'schedule' && (
                <div className="space-y-2">
                  <div className="bg-white border border-gray-200 overflow-hidden">
                    <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
                      <Clock className="w-3 h-3 text-primary" />
                      <h3 className="text-primary font-bold text-xs">수업 시간</h3>
                    </div>
                    <div className="px-1.5 py-0.5">
                      <span className="text-xs text-primary">{formattedSchedule || '-'}</span>
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
                          <Users className="w-3 h-3 text-primary" />
                          <h3 className="text-primary font-bold text-xs">부담임</h3>
                        </div>
                        <div className="px-1.5 py-1 flex flex-wrap gap-1">
                          {visibleSlotTeachers.map((name) => <span key={name} className="bg-gray-100 px-1.5 py-0.5 text-xs text-primary font-medium">{getTeacherDisplayName(name)}</span>)}
                        </div>
                      </div>
                    );
                  })()}

                  {/* 강사 인수인계 예정 상세 섹션 */}
                  {hasPendingHandover && !isSimulationMode && (
                    <div className="bg-white border border-emerald-300 overflow-hidden">
                      <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 border-b border-emerald-200">
                        <UserCheck className="w-3 h-3 text-emerald-700" />
                        <h3 className="text-emerald-800 font-bold text-xs">강사 인수인계 예정</h3>
                      </div>
                      <div className="px-2 py-2 space-y-1.5">
                        {/* 날짜 + 담임 변경 정보 */}
                        <div className="flex items-center gap-2 text-xs">
                          <span className="shrink-0 w-16 text-gray-500">적용일</span>
                          <span className="font-bold text-emerald-800">{effectiveClassInfo.pendingTeacherDate}</span>
                          <span className="text-xxs text-gray-400">(이 날부터 새 담임 수업 시작 — 전날까지는 현재 담임)</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="shrink-0 w-16 text-gray-500">담임 교체</span>
                          <span className="font-medium text-gray-700">{getTeacherDisplayName(effectiveClassInfo.teacher)}</span>
                          <span className="text-emerald-600 font-bold">→</span>
                          <span className="font-bold text-emerald-800">{getTeacherDisplayName(effectiveClassInfo.pendingTeacher || '')}</span>
                        </div>
                        {effectiveClassInfo.pendingTeacherReason && (
                          <div className="flex items-start gap-2 text-xs">
                            <span className="shrink-0 w-16 text-gray-500">사유</span>
                            <span className="flex-1 text-gray-700 italic whitespace-pre-wrap">{effectiveClassInfo.pendingTeacherReason}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs pt-0.5">
                          <span className="shrink-0 w-16 text-gray-500">상태</span>
                          <span className="text-gray-700">
                            학생 수강 이력 <span className="font-medium text-emerald-700">사전 분리 완료</span>
                            <span className="mx-1 text-gray-300">·</span>
                            효력일 도달 시 <span className="font-medium">자동 적용</span>
                          </span>
                        </div>

                        {/* 수정/취소 버튼 */}
                        {canEdit && classInfo.id && (
                          <div className="flex items-center justify-end gap-1.5 pt-1.5 mt-1 border-t border-emerald-100">
                            <button
                              onClick={handleModifyHandover}
                              disabled={cancelHandoverMutation.isPending || isPending}
                              className="px-2 py-0.5 text-xxs font-semibold bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 transition-colors"
                            >
                              예약 수정
                            </button>
                            <button
                              onClick={handleCancelHandover}
                              disabled={cancelHandoverMutation.isPending || isPending}
                              className="px-2 py-0.5 text-xxs font-semibold bg-white border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
                            >
                              {cancelHandoverMutation.isPending ? '취소 중...' : '예약 취소'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeViewTab === 'info' && (
                <div className="space-y-2">
                  <div className="bg-white border border-gray-200 overflow-hidden">
                    <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
                      <User className="w-3 h-3 text-primary" />
                      <h3 className="text-primary font-bold text-xs">기본 정보</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                      <div className="flex items-center gap-2 px-1.5 py-0.5">
                        <span className="w-12 shrink-0 text-xs font-medium text-primary-700">담임</span>
                        <span className="flex-1 text-xs text-primary">{teacherDisplay ? getTeacherDisplayName(teacherDisplay) : '-'}</span>
                      </div>
                      <div className="flex items-center gap-2 px-1.5 py-0.5">
                        <span className="w-12 shrink-0 text-xs font-medium text-primary-700">교실</span>
                        <span className="flex-1 text-xs text-primary">{roomDisplay || '-'}</span>
                      </div>
                    </div>
                  </div>

                  {classDetail?.memo && (
                    <div className="bg-white border border-gray-200 overflow-hidden">
                      <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
                        <FileText className="w-3 h-3 text-primary" />
                        <h3 className="text-primary font-bold text-xs">메모</h3>
                      </div>
                      <div className="px-1.5 py-1">
                        <p className="text-xs text-primary whitespace-pre-wrap">{classDetail.memo}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeViewTab === 'students' && (
                <div className="space-y-2">
                  {/* 재원생 */}
                  <div className="bg-white border border-gray-200 overflow-hidden">
                    <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
                      <Users className="w-3 h-3 text-primary" />
                      <h3 className="text-primary font-bold text-xs">수강 학생</h3>
                      <span className="text-xxs text-gray-500 ml-1">({classDetail?.studentCount || studentCount || 0}명)</span>
                    </div>
                    {detailLoading ? (
                      <div className="p-6 text-center"><p className="text-gray-500 text-xs">불러오는 중...</p></div>
                    ) : classDetail ? (
                      <ClassStudentList students={activeStudents} onStudentClick={onStudentClick} classDays={classDisplayDays} allStudents={allStudents} />
                    ) : (
                      <div className="p-6 text-center">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-30 text-gray-400" />
                        <p className="text-gray-500 text-xs">학생 정보를 불러올 수 없습니다.</p>
                      </div>
                    )}
                  </div>

                  {/* 대기생 (배정 예정) - 접이식 */}
                  {scheduledStudents.length > 0 && (
                    <div className="bg-white border border-blue-200 overflow-hidden">
                      <button
                        onClick={() => setShowScheduled(!showScheduled)}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-50 border-b border-blue-200 w-full text-left hover:bg-blue-100 transition-colors"
                      >
                        {showScheduled ? <ChevronUp className="w-3 h-3 text-blue-600" /> : <ChevronDown className="w-3 h-3 text-blue-600" />}
                        <Calendar className="w-3 h-3 text-blue-600" />
                        <h3 className="text-blue-700 font-bold text-xs">배정 예정</h3>
                        <span className="text-xxs text-blue-500 ml-1">({scheduledStudents.length}명)</span>
                      </button>
                      {showScheduled && (
                        <div className="divide-y divide-blue-100 max-h-[200px] overflow-y-auto">
                          {scheduledStudents.map(student => (
                            <div
                              key={student.id}
                              className="flex items-center justify-between gap-2 px-2 py-1.5 hover:bg-blue-50/50 transition-colors"
                            >
                              <div
                                onClick={() => onStudentClick?.(student.id)}
                                className={`flex items-center gap-2 flex-1 ${onStudentClick ? 'cursor-pointer hover:text-accent' : ''}`}
                              >
                                <span className="text-xs font-medium text-primary">{student.name}</span>
                                <span className="text-xs text-primary-700">{formatSchoolGrade(student.school, student.grade)}</span>
                                <span className="text-xxs bg-blue-100 text-blue-700 px-1.5 py-0.5 font-medium">배정 예정</span>
                                {student.enrollmentDate && (
                                  <span className="text-xxs text-blue-500">{student.enrollmentDate}~</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 퇴원생 - 접이식 */}
                  {withdrawnStudents.length > 0 && (
                    <div className="bg-white border border-gray-300 overflow-hidden">
                      <button
                        onClick={() => setShowWithdrawn(!showWithdrawn)}
                        className="flex items-center gap-1 px-2 py-1 bg-gray-100 border-b border-gray-300 w-full text-left hover:bg-gray-200 transition-colors"
                      >
                        {showWithdrawn ? <ChevronUp className="w-3 h-3 text-gray-500" /> : <ChevronDown className="w-3 h-3 text-gray-500" />}
                        <UserMinus className="w-3 h-3 text-gray-500" />
                        <h3 className="text-gray-600 font-bold text-xs">퇴원생</h3>
                        <span className="text-xxs text-gray-500 ml-1">({withdrawnStudents.length}명)</span>
                      </button>
                      {showWithdrawn && (
                        <div className="divide-y divide-gray-100 max-h-[200px] overflow-y-auto">
                          {withdrawnStudents.map(student => (
                            <div
                              key={student.id}
                              className="flex items-center justify-between gap-2 px-2 py-1.5 hover:bg-gray-50 transition-colors"
                            >
                              <div
                                onClick={() => onStudentClick?.(student.id)}
                                className={`flex items-center gap-2 flex-1 ${onStudentClick ? 'cursor-pointer hover:text-accent' : ''}`}
                              >
                                <span className="text-xs font-medium text-gray-400 line-through">{student.name}</span>
                                <span className="text-xs text-gray-400">{formatSchoolGrade(student.school, student.grade)}</span>
                                {student.withdrawalDate && (
                                  <span className="text-xxs text-gray-400">~{student.withdrawalDate}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeViewTab === 'stats' && (
                <div className="bg-white border border-gray-200 overflow-hidden">
                  <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
                    <BarChart3 className="w-3 h-3 text-primary" />
                    <h3 className="text-primary font-bold text-xs">수업 통계</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-1.5">
                    <div className="bg-gray-50 p-3 text-center border border-gray-100">
                      <p className="text-xxs text-gray-500 mb-1">활성 학생</p>
                      <p className="text-xl font-bold text-success">{activeStudents.filter(s => !s.onHold).length || 0}</p>
                      <p className="text-xxs text-gray-400">전체 {classDetail?.studentCount || 0}명</p>
                    </div>
                    <div className="bg-gray-50 p-3 text-center border border-gray-100">
                      <p className="text-xxs text-gray-500 mb-1">대기 학생</p>
                      <p className="text-xl font-bold text-warning">{activeStudents.filter(s => s.onHold).length || 0}</p>
                      <p className="text-xxs text-gray-400">{(activeStudents.filter(s => s.onHold).length || 0) > 0 ? '휴원 중' : '휴원생 없음'}</p>
                    </div>
                    <div className="bg-gray-50 p-3 text-center border border-gray-100">
                      <p className="text-xxs text-gray-500 mb-1">이번 달 출석률</p>
                      {statsLoading ? <p className="text-xl font-bold text-gray-400">...</p> : (
                        <>
                          <p className="text-xl font-bold text-info">{attendanceRate}%</p>
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

      {/* 강사 인수인계 모달 (신규 예약) */}
      {showHandoverModal && classInfo.id && (
        <TeacherHandoverModal
          classId={classInfo.id}
          className={initialClassName}
          subject={subject as SubjectType}
          currentTeacher={classInfo.teacher}
          onClose={() => setShowHandoverModal(false)}
          onSuccess={() => {
            // 캐시 무효화는 mutation의 onSuccess에서 처리됨
          }}
        />
      )}

      {/* 강사 인수인계 수정 모달 (기존 예약 대체) */}
      {showModifyHandoverModal && effectiveClassInfo.id && effectiveClassInfo.pendingTeacher && effectiveClassInfo.pendingTeacherDate && (
        <TeacherHandoverModal
          classId={effectiveClassInfo.id}
          className={initialClassName}
          subject={subject as SubjectType}
          currentTeacher={effectiveClassInfo.teacher}
          isModifying
          initialNewTeacher={effectiveClassInfo.pendingTeacher}
          initialEffectiveDate={effectiveClassInfo.pendingTeacherDate}
          initialReason={effectiveClassInfo.pendingTeacherReason}
          onClose={() => setShowModifyHandoverModal(false)}
        />
      )}
    </div>
  );
};

export default ClassDetailModal;
