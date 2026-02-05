import React, { useState, useEffect, useMemo } from 'react';
import { X, Edit, ChevronDown, ChevronUp, Users, UserMinus, Calendar, User, FileText, BookOpen } from 'lucide-react';
import { useUpdateClass, UpdateClassData, useManageClassStudents } from '../../hooks/useClassMutations';
import { ClassInfo, useClasses } from '../../hooks/useClasses';
import { useClassDetail, ClassStudent } from '../../hooks/useClassDetail';
import { useStudents } from '../../hooks/useStudents';
import { SUBJECT_LABELS, SubjectType } from '../../utils/styleUtils';
import { ENGLISH_UNIFIED_PERIODS, MATH_UNIFIED_PERIODS, convertLegacyPeriodId } from '../Timetable/constants';
import { useTeachers } from '../../hooks/useFirebaseQueries';
import { useStaff } from '../../hooks/useStaff';
import { formatSchoolGrade } from '../../utils/studentUtils';
import { useSimulationOptional } from '../Timetable/English/context/SimulationContext';
import { ScenarioClass } from '../Timetable/English/context/SimulationContext';

interface EditClassModalProps {
  classInfo: ClassInfo;
  initialSlotTeachers?: Record<string, string>;
  onClose: (saved?: boolean, newClassName?: string) => void;
  isSimulationMode?: boolean;
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
const WEEKDAY_ORDER: Record<string, number> = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 };

const EditClassModal: React.FC<EditClassModalProps> = ({ classInfo, initialSlotTeachers, onClose, isSimulationMode = false }) => {
  const simulationContext = isSimulationMode ? useSimulationOptional() : null;
  const [className, setClassName] = useState(classInfo.className);
  const [teacher, setTeacher] = useState(classInfo.teacher);
  const [room, setRoom] = useState(classInfo.room || '');
  const [memo, setMemo] = useState('');

  // 스케줄 그리드
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [slotTeachers, setSlotTeachers] = useState<Record<string, string>>(initialSlotTeachers || {});
  const [slotRooms, setSlotRooms] = useState<Record<string, string>>({});
  const [showAdvancedSchedule, setShowAdvancedSchedule] = useState(false);

  // 탭 관리
  const [activeTab, setActiveTab] = useState<'info' | 'schedule' | 'students'>('info');

  // 학생 관리
  const [showStudentList, setShowStudentList] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentsToAdd, setStudentsToAdd] = useState<Set<string>>(new Set());
  const [studentsToRemove, setStudentsToRemove] = useState<Set<string>>(new Set());
  const [studentAttendanceDays, setStudentAttendanceDays] = useState<Record<string, string[]>>({});  // 학생별 등원 요일 (수학용)
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);  // 요일 설정 펼친 학생
  const [studentUnderlines, setStudentUnderlines] = useState<Record<string, boolean>>({});  // 학생별 밑줄 강조 (영어용)
  const [studentSlotTeachers, setStudentSlotTeachers] = useState<Record<string, boolean>>({});  // 학생별 부담임 여부 (수학용)
  const [studentStartDates, setStudentStartDates] = useState<Record<string, string>>({});  // 학생별 시작일 (YYYY-MM-DD)

  const [error, setError] = useState('');

  const updateClassMutation = useUpdateClass();
  const manageStudentsMutation = useManageClassStudents();
  const { data: teachersData } = useTeachers();
  const { staff } = useStaff();
  const { data: classDetail } = useClassDetail(classInfo.className, classInfo.subject);
  const { students: allStudents, loading: studentsLoading } = useStudents(false);
  const { data: existingClasses } = useClasses(classInfo.subject); // 해당 과목의 기존 수업 목록

  // 현재 등록된 학생 목록
  const currentStudents = classDetail?.students || [];
  const currentStudentIds = currentStudents.map(s => s.id);

  // 과목별 강사 필터링 (systemRole 또는 role='teacher' + subjects)
  const availableTeachers = useMemo(() => {
    const subjectFilter = classInfo.subject as 'math' | 'english';
    return staff.filter(member => {
      // systemRole 기반 체크
      if (subjectFilter === 'math') {
        if (member.systemRole === 'math_teacher' || member.systemRole === 'math_lead') {
          return true;
        }
      } else if (subjectFilter === 'english') {
        if (member.systemRole === 'english_teacher' || member.systemRole === 'english_lead') {
          return true;
        }
      }

      // 레거시: role='teacher' + subjects 체크
      if (member.role === 'teacher' && member.subjects?.includes(subjectFilter)) {
        return true;
      }

      return false;
    });
  }, [staff, classInfo.subject]);

  // 강사 이름 표시 헬퍼 (과목별 다른 표시)
  const getTeacherDisplayName = (staffMember: typeof staff[0]) => {
    if (classInfo.subject === 'english') {
      return staffMember.englishName || staffMember.name;
    }
    return staffMember.name;
  };

  // 강사 저장값 헬퍼 (영어 과목은 englishName 저장, 다른 과목은 name 저장)
  const getTeacherSaveValue = (staffMember: typeof staff[0]) => {
    if (classInfo.subject === 'english') {
      return staffMember.englishName || staffMember.name;
    }
    return staffMember.name;
  };

  // 강사 이름으로 staff 찾기 (name 또는 englishName 매칭)
  const findStaffByName = (name: string) => {
    return staff.find(s => s.name === name || s.englishName === name);
  };

  // 강사 색상 가져오기
  const getTeacherColor = (teacherName: string) => {
    const teacherInfo = teachersData?.find(t => t.name === teacherName || t.englishName === teacherName);
    return {
      bgColor: teacherInfo?.bgColor || '#fdb813',
      textColor: teacherInfo?.textColor || '#081429'
    };
  };

  // 과목별 교시
  const periods = classInfo.subject === 'english' ? ENGLISH_UNIFIED_PERIODS : MATH_UNIFIED_PERIODS;

  // 추가 가능한 학생 필터링 (현재 수업에 없고, 재원 상태인 학생)
  const availableStudents = useMemo(() => {
    if (!allStudents) return [];
    return allStudents
      .filter(s =>
        s.status === 'active' &&
        !currentStudentIds.includes(s.id) &&
        !studentsToAdd.has(s.id)
      )
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

  // 추가 예정 학생 정보
  const studentsToAddInfo = useMemo(() => {
    if (!allStudents) return [];
    return allStudents.filter(s => studentsToAdd.has(s.id));
  }, [allStudents, studentsToAdd]);

  // 담임 강사 자동 매칭 (staff 데이터 로드 후)
  useEffect(() => {
    if (staff.length > 0 && classInfo.teacher) {
      const matchedStaff = findStaffByName(classInfo.teacher);
      if (matchedStaff) {
        // 드롭다운 value와 일치하도록 저장값 형식으로 설정
        setTeacher(getTeacherSaveValue(matchedStaff));
      } else {
        // 매칭 실패 시 원본 값 사용
        setTeacher(classInfo.teacher);
      }
    }
  }, [staff, classInfo.teacher]);

  // 기존 스케줄을 그리드로 변환
  useEffect(() => {
    if (classInfo.schedule && classInfo.schedule.length > 0) {
      const slots = new Set<string>();
      classInfo.schedule.forEach(item => {
        const parts = item.split(' ');
        if (parts.length >= 2) {
          const day = parts[0];
          const periodId = convertLegacyPeriodId(parts[1]); // 레거시 ID 변환
          slots.add(`${day}-${periodId}`);
        }
      });
      setSelectedSlots(slots);
    }

    if (classInfo.slotTeachers) {
      setSlotTeachers(classInfo.slotTeachers);
    }

    if (classInfo.slotRooms) {
      setSlotRooms(classInfo.slotRooms);
    }
  }, [classInfo.schedule, classInfo.slotTeachers, classInfo.slotRooms]);

  // classDetail에서 메모 로드
  useEffect(() => {
    if (classDetail?.memo) {
      setMemo(classDetail.memo);
    }
  }, [classDetail?.memo]);

  // classDetail에서 기존 학생 attendanceDays, underline, isSlotTeacher 로드
  useEffect(() => {
    if (classDetail?.students) {
      const existingDays: Record<string, string[]> = {};
      const existingUnderlines: Record<string, boolean> = {};
      const existingSlotTeachers: Record<string, boolean> = {};
      classDetail.students.forEach(student => {
        if (student.attendanceDays && student.attendanceDays.length > 0) {
          existingDays[student.id] = student.attendanceDays;
        }
        if (student.underline) {
          existingUnderlines[student.id] = student.underline;
        }
        if (student.isSlotTeacher) {
          existingSlotTeachers[student.id] = student.isSlotTeacher;
        }
      });
      setStudentAttendanceDays(existingDays);
      setStudentUnderlines(existingUnderlines);
      setStudentSlotTeachers(existingSlotTeachers);
    }
  }, [classDetail?.students]);

  // 수업 스케줄에서 요일 목록 추출
  const classDays = useMemo(() => {
    const days = new Set<string>();
    selectedSlots.forEach(slot => {
      const day = slot.split('-')[0];
      if (day) days.add(day);
    });
    // 요일 순서대로 정렬
    const dayOrder = ['월', '화', '수', '목', '금', '토', '일'];
    return Array.from(days).sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
  }, [selectedSlots]);

  // 스케줄 겹침 감지 (자기 자신 제외)
  const scheduleConflicts = useMemo(() => {
    if (!existingClasses || selectedSlots.size === 0) return [];

    const conflicts: { slot: string; className: string; teacher: string }[] = [];

    // 기존 수업의 스케줄을 "day-unifiedPeriodId" 형태로 맵 구성
    const slotMap = new Map<string, { className: string; teacher: string }[]>();

    existingClasses.forEach(cls => {
      // 자기 자신 제외
      if (cls.className === classInfo.className) return;

      cls.schedule?.forEach(slot => {
        const parts = slot.split(' ');
        if (parts.length >= 2) {
          const normalizedPeriod = convertLegacyPeriodId(parts[1]);
          const key = `${parts[0]}-${normalizedPeriod}`;
          if (!slotMap.has(key)) slotMap.set(key, []);
          slotMap.get(key)!.push({ className: cls.className, teacher: cls.teacher });
        }
      });
    });

    // 선택된 슬롯과 기존 수업 비교
    selectedSlots.forEach(slotKey => {
      const existing = slotMap.get(slotKey);
      if (existing && existing.length > 0) {
        existing.forEach(e => {
          conflicts.push({ slot: slotKey, className: e.className, teacher: e.teacher });
        });
      }
    });

    return conflicts;
  }, [existingClasses, selectedSlots, classInfo.className]);

  // 슬롯 토글
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

  // 슬롯 강사 설정
  const setSlotTeacher = (key: string, teacherName: string) => {
    setSlotTeachers(prev => ({ ...prev, [key]: teacherName }));
  };

  // 슬롯 강의실 설정
  const setSlotRoom = (key: string, roomName: string) => {
    setSlotRooms(prev => ({ ...prev, [key]: roomName }));
  };

  // 학생 추가 토글
  const toggleAddStudent = (studentId: string) => {
    const newSet = new Set(studentsToAdd);
    if (newSet.has(studentId)) {
      newSet.delete(studentId);
      // 시작일도 제거
      setStudentStartDates(prev => {
        const { [studentId]: _, ...rest } = prev;
        return rest;
      });
    } else {
      newSet.add(studentId);
      // 기본 시작일: 오늘
      setStudentStartDates(prev => ({
        ...prev,
        [studentId]: new Date().toISOString().split('T')[0]
      }));
    }
    setStudentsToAdd(newSet);
  };

  // 기존 학생 제거 토글
  const toggleRemoveStudent = (studentId: string) => {
    const newSet = new Set(studentsToRemove);
    if (newSet.has(studentId)) {
      newSet.delete(studentId);
    } else {
      newSet.add(studentId);
    }
    setStudentsToRemove(newSet);
  };

  // 추가 예정 학생 취소
  const cancelAddStudent = (studentId: string) => {
    const newSet = new Set(studentsToAdd);
    newSet.delete(studentId);
    setStudentsToAdd(newSet);
    // 시작일도 제거
    setStudentStartDates(prev => {
      const { [studentId]: _, ...rest } = prev;
      return rest;
    });
  };

  // 학생 등원 요일 토글
  const toggleStudentDay = (studentId: string, day: string) => {
    const dayOrder = ['월', '화', '수', '목', '금', '토', '일'];

    setStudentAttendanceDays(prev => {
      const currentDays = prev[studentId] || [];
      let newDays: string[];

      if (currentDays.includes(day)) {
        // 해당 요일 제거
        newDays = currentDays.filter(d => d !== day);
      } else {
        // 해당 요일 추가 후 정렬
        newDays = [...currentDays, day].sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
      }

      // 빈 배열이면 키 자체를 제거 (모든 요일 등원 = 설정 없음)
      if (newDays.length === 0) {
        const { [studentId]: _, ...rest } = prev;
        return rest;
      }

      return { ...prev, [studentId]: newDays };
    });
  };

  // 학생이 특정 요일에 등원하는지 확인
  const isStudentAttendingDay = (studentId: string, day: string): boolean => {
    const days = studentAttendanceDays[studentId];
    // 설정이 없으면 모든 요일 등원
    if (!days || days.length === 0) return true;
    return days.includes(day);
  };

  // 학생의 등원 요일 표시 텍스트 (수업 요일과 동일하면 표시 안함)
  const getAttendanceDaysText = (studentId: string): string | null => {
    const days = studentAttendanceDays[studentId];
    if (!days || days.length === 0) return null;

    // 수업 요일과 등원 요일이 동일하면 표시하지 않음
    if (days.length === classDays.length) {
      const sorted1 = [...days].sort();
      const sorted2 = [...classDays].sort();
      if (sorted1.every((day, i) => day === sorted2[i])) {
        return null;
      }
    }

    return days.join(', ');
  };

  // 영어 과목: 학생 밑줄 강조 토글
  const toggleStudentUnderline = (studentId: string) => {
    setStudentUnderlines(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  // 저장
  const handleSave = async () => {
    if (!className.trim()) {
      setError('수업명을 입력해주세요.');
      return;
    }
    if (!teacher.trim()) {
      setError('담임을 입력해주세요.');
      return;
    }

    // 중복 수업명 검사 (자기 자신 제외)
    const trimmedClassName = className.trim();
    const originalClassName = classInfo.className;
    if (trimmedClassName.toLowerCase() !== originalClassName.toLowerCase()) {
      const isDuplicate = existingClasses?.some(
        cls => cls.className.toLowerCase() === trimmedClassName.toLowerCase()
      );
      if (isDuplicate) {
        setError(`"${trimmedClassName}" 수업명이 이미 존재합니다. 다른 이름을 사용해주세요.`);
        return;
      }
    }

    // 스케줄 겹침 경고 확인
    if (scheduleConflicts.length > 0) {
      const conflictList = scheduleConflicts.map(c =>
        `  ${c.slot.split('-')[0]} ${c.slot.split('-')[1]}교시 — ${c.className} (${c.teacher})`
      ).join('\n');
      if (!confirm(`⚠️ 다음 시간대에 이미 수업이 있습니다:\n\n${conflictList}\n\n그래도 저장하시겠습니까?`)) {
        return;
      }
    }

    setError('');

    // 스케줄 변환
    const schedule: string[] = [];
    selectedSlots.forEach(key => {
      const [day, periodId] = key.split('-');
      schedule.push(`${day} ${periodId}`);
    });

    // 빈 문자열인 slotTeachers 항목 제거
    const filteredSlotTeachers: Record<string, string> = {};
    Object.entries(slotTeachers).forEach(([key, value]) => {
      if (value && value.trim()) {
        filteredSlotTeachers[key] = value.trim();
      }
    });

    const filteredSlotRooms: Record<string, string> = {};
    Object.entries(slotRooms).forEach(([key, value]) => {
      if (value && value.trim()) {
        filteredSlotRooms[key] = value.trim();
      }
    });

    try {
      if (isSimulationMode && simulationContext) {
        // 시뮬레이션 모드: SimulationContext에 저장
        // schedule을 ScenarioClass 형식으로 변환: "월 5" -> { day: "월", periodId: "5" }
        const scenarioSchedule = schedule.map(slot => {
          const [day, periodId] = slot.split(' ');
          return { day, periodId };
        });

        const updates: Partial<ScenarioClass> = {
          className: trimmedClassName,
          teacher: teacher.trim(),
          schedule: scenarioSchedule,
          room: room.trim(),
          slotTeachers: filteredSlotTeachers,
          slotRooms: filteredSlotRooms,
        };

        simulationContext.updateScenarioClassWithHistory(
          classInfo.id!,
          updates,
          `수업 수정: ${originalClassName}`
        );

        onClose(true);
      } else {
        // 실시간 모드: Firebase에 저장
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

        // 1. 수업 정보 업데이트
        await updateClassMutation.mutateAsync(updateData);

        // 2. 학생 추가/제거/등원요일/밑줄/부담임 변경이 있으면 처리
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
            studentStartDates,  // 학생별 시작일 전달
          });
        }

        // 수업명이 변경되었으면 새 수업명 전달
        const classNameChanged = className.trim() !== classInfo.className;
        onClose(true, classNameChanged ? className.trim() : undefined);
      }
    } catch (err) {
      console.error('[EditClassModal] Error updating class:', err);
      setError('수업 수정에 실패했습니다.');
    }
  };

  // 최종 학생 수 계산
  const finalStudentCount = currentStudents.length - studentsToRemove.size + studentsToAdd.size;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100] p-4">
      <div className="bg-white rounded-sm shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="bg-[#081429] text-white px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-[#fdb813]" />
              <h2 className="text-base font-bold">수업 편집</h2>
              <span className="px-2 py-0.5 bg-[#fdb813] text-[#081429] rounded text-xs font-bold">
                {SUBJECT_LABELS[classInfo.subject as SubjectType] || classInfo.subject}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleSave}
                disabled={updateClassMutation.isPending || manageStudentsMutation.isPending}
                className="bg-[#fdb813] hover:bg-[#e5a60f] text-[#081429] px-3 py-1.5 rounded font-semibold text-xs disabled:opacity-50 transition-colors"
              >
                {(updateClassMutation.isPending || manageStudentsMutation.isPending) ? '저장 중...' : '저장'}
              </button>
              <button
                onClick={() => onClose(false)}
                disabled={updateClassMutation.isPending || manageStudentsMutation.isPending}
                className="p-1.5 rounded hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 탭 네비게이션 */}
          <div className="flex gap-1 border-t border-white/20 pt-2">
            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeTab === 'info'
                  ? 'bg-[#fdb813] text-[#081429]'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              기본 정보
            </button>
            <button
              onClick={() => !isSimulationMode && setActiveTab('students')}
              disabled={isSimulationMode}
              className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeTab === 'students'
                  ? 'bg-[#fdb813] text-[#081429]'
                  : isSimulationMode
                  ? 'bg-white/5 text-white/40 cursor-not-allowed'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              학생 ({finalStudentCount})
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeTab === 'schedule'
                  ? 'bg-[#fdb813] text-[#081429]'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              스케줄
            </button>
          </div>
        </div>

        {/* 본문 - 고정 높이 */}
        <div className="flex-1 overflow-y-auto p-3" style={{ minHeight: '400px' }}>
          {error && (
            <div className="bg-red-50 border border-red-200 px-3 py-2 text-red-700 text-xs mb-3">
              {error}
            </div>
          )}

          {/* 기본 정보 탭 */}
          {activeTab === 'info' && (
            <div className="space-y-2">
              {/* 기본 정보 섹션 */}
              <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                  <User className="w-3 h-3 text-[#081429]" />
                  <h3 className="text-[#081429] font-bold text-xs">기본 정보</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  <div className="flex items-center gap-2 px-2 py-1">
                    <span className="w-16 shrink-0 text-xs font-medium text-[#373d41]">
                      수업명 <span className="text-red-500">*</span>
                    </span>
                    <input
                      type="text"
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      placeholder="예: LT1a"
                      className="flex-1 px-2 py-0.5 text-xs border border-gray-300 focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1">
                    <span className="w-16 shrink-0 text-xs font-medium text-[#373d41]">
                      담임 <span className="text-red-500">*</span>
                    </span>
                    <select
                      value={teacher}
                      onChange={(e) => setTeacher(e.target.value)}
                      className="flex-1 px-2 py-0.5 text-xs border border-gray-300 focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none"
                    >
                      <option value="">선택해주세요</option>
                      {availableTeachers.map(t => {
                        const displayName = getTeacherDisplayName(t);
                        const saveValue = getTeacherSaveValue(t);
                        return (
                          <option key={t.id} value={saveValue}>
                            {displayName}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  {availableTeachers.length === 0 && (
                    <div className="px-2 py-1">
                      <p className="text-xxs text-amber-600">
                        ⚠️ {SUBJECT_LABELS[classInfo.subject]} 과목 강사가 없습니다.
                      </p>
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-2 py-1">
                    <span className="w-16 shrink-0 text-xs font-medium text-[#373d41]">강의실</span>
                    <input
                      type="text"
                      value={room}
                      onChange={(e) => setRoom(e.target.value)}
                      placeholder="예: 302"
                      className="flex-1 px-2 py-0.5 text-xs border border-gray-300 focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 메모 섹션 */}
              <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                  <FileText className="w-3 h-3 text-[#081429]" />
                  <h3 className="text-[#081429] font-bold text-xs">메모</h3>
                </div>
                <div className="p-2">
                  <textarea
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="수업에 대한 메모를 입력하세요..."
                    rows={3}
                    className="w-full px-2 py-1 text-xs border border-gray-300 focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 스케줄 탭 */}
          {activeTab === 'schedule' && (
            <div className="space-y-2">
              {/* 스케줄 선택 섹션 */}
              <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                  <Calendar className="w-3 h-3 text-[#081429]" />
                  <h3 className="text-[#081429] font-bold text-xs">스케줄</h3>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {/* 헤더 - Sticky */}
                  <div className="grid bg-gray-100 border-b border-gray-200 sticky top-0 z-10" style={{ gridTemplateColumns: `32px repeat(${WEEKDAYS.length}, 1fr)` }}>
                    <div className="p-1 text-center text-xxs font-semibold text-gray-400 border-r border-gray-200"></div>
                    {WEEKDAYS.map((day) => (
                      <div key={day} className="p-1 text-center text-xs font-semibold text-gray-600 border-r border-gray-200 last:border-r-0">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* 교시 */}
                  {periods.map(periodId => (
                    <div
                      key={periodId}
                      className="grid border-b border-gray-100 last:border-b-0"
                      style={{ gridTemplateColumns: `32px repeat(${WEEKDAYS.length}, 1fr)` }}
                    >
                      <div className="p-1 text-center text-xxs text-gray-400 bg-gray-50 flex items-center justify-center border-r border-gray-200">
                        {periodId}
                      </div>
                    {WEEKDAYS.map((day) => {
                      const key = `${day}-${periodId}`;
                      const isSelected = selectedSlots.has(key);
                      const slotTeacher = slotTeachers[key];
                      const displayTeacher = slotTeacher || teacher;
                      const colors = displayTeacher ? getTeacherColor(displayTeacher) : { bgColor: '#fdb813', textColor: '#081429' };

                      // 과목에 맞게 표시할 이름 결정
                      let displayName = '';
                      if (isSelected) {
                        if (slotTeacher) {
                          const staffMember = findStaffByName(slotTeacher);
                          displayName = staffMember ? getTeacherDisplayName(staffMember) : slotTeacher;
                        } else if (teacher) {
                          const staffMember = findStaffByName(teacher);
                          displayName = staffMember ? getTeacherDisplayName(staffMember) : teacher;
                        } else {
                          displayName = '✓';
                        }
                      }

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleSlot(day, periodId)}
                          className={`p-1 transition-colors text-[10px] min-h-[24px] border-r border-gray-200 last:border-r-0 ${isSelected
                              ? 'font-semibold'
                              : 'hover:bg-gray-100 text-gray-300'
                            }`}
                          style={isSelected ? {
                            backgroundColor: colors.bgColor,
                            color: colors.textColor
                          } : undefined}
                        >
                          {displayName}
                        </button>
                      );
                    })}
                  </div>
                  ))}
                </div>
                {scheduleConflicts.length > 0 && (
                  <div className="mx-2 my-1.5 bg-amber-50 border border-amber-200 rounded-sm px-2 py-1.5">
                    <p className="font-semibold text-amber-700 text-xs mb-0.5">스케줄 겹침 감지</p>
                    {scheduleConflicts.map((conflict, i) => (
                      <p key={i} className="text-xxs text-amber-600">
                        {conflict.slot.split('-')[0]} {conflict.slot.split('-')[1]}교시 — {conflict.className} ({conflict.teacher})
                      </p>
                    ))}
                  </div>
                )}
                {selectedSlots.size > 0 && (
                  <div className="px-2 py-1.5 border-t border-gray-100 flex items-center justify-between">
                    <p className="text-xxs text-gray-500">{selectedSlots.size}개 교시 선택</p>
                    <button
                      type="button"
                      onClick={() => setShowAdvancedSchedule(!showAdvancedSchedule)}
                      className="text-xxs text-blue-600 hover:underline flex items-center gap-0.5"
                    >
                      {showAdvancedSchedule ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      교시별 부담임/강의실 설정
                    </button>
                  </div>
                )}
              </div>

              {/* 교시별 부담임 섹션 */}
              {showAdvancedSchedule && selectedSlots.size > 0 && (
                <div className="bg-white border border-gray-200 overflow-hidden">
                  <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                    <Users className="w-3 h-3 text-[#081429]" />
                    <h3 className="text-[#081429] font-bold text-xs">교시별 부담임</h3>
                    <span className="text-xxs text-gray-400 ml-1">(비워두면 담임)</span>
                  </div>
                  {(() => {
                    const selectedPeriods = new Set<string>();
                    selectedSlots.forEach(key => {
                      const [, periodId] = key.split('-');
                      selectedPeriods.add(periodId);
                    });
                    const sortedPeriods = Array.from(selectedPeriods).sort((a, b) => Number(a) - Number(b));

                    return sortedPeriods.map(periodId => (
                      <div
                        key={periodId}
                        className="grid border-b border-gray-100 last:border-b-0"
                        style={{ gridTemplateColumns: `32px repeat(${WEEKDAYS.length}, 1fr)` }}
                      >
                        <div className="p-1 text-center text-[10px] text-gray-400 bg-gray-50 flex items-center justify-center border-r border-gray-200">
                          {periodId}
                        </div>
                        {WEEKDAYS.map((day) => {
                          const key = `${day}-${periodId}`;
                          const isSelected = selectedSlots.has(key);
                          if (!isSelected) {
                            return <div key={key} className="bg-gray-50 min-h-[28px] border-r border-gray-200 last:border-r-0" />;
                          }
                          return (
                            <div key={key} className="p-0.5 border-r border-gray-200 last:border-r-0">
                              <select
                                value={slotTeachers[key] || ''}
                                onChange={(e) => setSlotTeacher(key, e.target.value)}
                                className="w-full h-full px-1 py-0.5 border border-gray-200 rounded text-[10px] focus:ring-1 focus:ring-[#fdb813] outline-none bg-white"
                              >
                                <option value="">
                                  {teacher ? (() => {
                                    const staffMember = findStaffByName(teacher);
                                    return staffMember ? getTeacherDisplayName(staffMember) : teacher;
                                  })() : '담임'}
                                </option>
                                {availableTeachers.map(t => {
                                  const displayName = getTeacherDisplayName(t);
                                  const saveValue = getTeacherSaveValue(t);
                                  return (
                                    <option key={t.id} value={saveValue}>
                                      {displayName}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    ));
                  })()}
                </div>
              )}

              {/* 교시별 강의실 섹션 */}
              {showAdvancedSchedule && selectedSlots.size > 0 && (
                <div className="bg-white border border-gray-200 overflow-hidden">
                  <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                    <BookOpen className="w-3 h-3 text-[#081429]" />
                    <h3 className="text-[#081429] font-bold text-xs">교시별 강의실</h3>
                    <span className="text-xxs text-gray-400 ml-1">(비워두면 기본)</span>
                  </div>
                  {(() => {
                    const selectedPeriods = new Set<string>();
                    selectedSlots.forEach(key => {
                      const [, periodId] = key.split('-');
                      selectedPeriods.add(periodId);
                    });
                    const sortedPeriods = Array.from(selectedPeriods).sort((a, b) => Number(a) - Number(b));

                    return sortedPeriods.map(periodId => (
                      <div
                        key={periodId}
                        className="grid border-b border-gray-100 last:border-b-0"
                        style={{ gridTemplateColumns: `32px repeat(${WEEKDAYS.length}, 1fr)` }}
                      >
                        <div className="p-1 text-center text-xxs text-gray-400 bg-gray-50 flex items-center justify-center border-r border-gray-200">
                          {periodId}
                        </div>
                        {WEEKDAYS.map((day) => {
                          const key = `${day}-${periodId}`;
                          const isSelected = selectedSlots.has(key);
                          if (!isSelected) {
                            return <div key={key} className="bg-gray-50 min-h-[28px] border-r border-gray-200 last:border-r-0" />;
                          }
                          return (
                            <div key={key} className="p-0.5 border-r border-gray-200 last:border-r-0">
                              <input
                                type="text"
                                value={slotRooms[key] || ''}
                                onChange={(e) => setSlotRoom(key, e.target.value)}
                                placeholder={room || '-'}
                                className="w-full h-full px-1 py-0.5 border border-gray-200 text-xxs focus:ring-1 focus:ring-[#fdb813] outline-none bg-white"
                              />
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

          {/* 학생 탭 */}
          {activeTab === 'students' && (
            <div className="space-y-2">
              {/* 현재 등록된 학생 섹션 */}
              <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                  <Users className="w-3 h-3 text-[#081429]" />
                  <h3 className="text-[#081429] font-bold text-xs">현재 등록된 학생</h3>
                  <span className="text-xxs text-gray-500 ml-1">({currentStudents.length - studentsToRemove.size}명)</span>
                  {classInfo.subject === 'math' && classDays.length > 1 && (
                    <span className="text-xxs text-blue-500 ml-auto">클릭: 등원요일 · 체크박스: 부담임</span>
                  )}
                  {classInfo.subject === 'math' && classDays.length <= 1 && (
                    <span className="text-xxs text-blue-500 ml-auto">체크박스: 부담임</span>
                  )}
                  {classInfo.subject === 'english' && (
                    <span className="text-xxs text-blue-500 ml-auto">U: 밑줄 강조</span>
                  )}
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
                        // 수학에서만 등원 요일 클릭 가능
                        const canExpandForDays = isMath && classDays.length > 1 && !isMarkedForRemoval;

                        return (
                          <div key={student.id} className={isMarkedForRemoval ? 'bg-red-50' : ''}>
                            <div
                              className={`flex items-center justify-between px-2.5 py-1.5 text-sm ${isMarkedForRemoval ? 'line-through text-gray-400' : 'hover:bg-gray-50'} ${canExpandForDays ? 'cursor-pointer' : ''}`}
                              onClick={() => {
                                if (canExpandForDays) {
                                  setExpandedStudentId(isExpanded ? null : student.id);
                                }
                              }}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {/* 수학: Calendar 아이콘 */}
                                {isMath && classDays.length > 1 && !isMarkedForRemoval && (
                                  <Calendar size={12} className="text-gray-400 flex-shrink-0" />
                                )}
                                {/* 수학: 부담임 체크박스 */}
                                {isMath && !isMarkedForRemoval && (
                                  <input
                                    type="checkbox"
                                    checked={studentSlotTeachers[student.id] || false}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      setStudentSlotTeachers(prev => ({
                                        ...prev,
                                        [student.id]: e.target.checked
                                      }));
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-3.5 h-3.5 text-[#fdb813] rounded focus:ring-[#fdb813] flex-shrink-0"
                                    title="부담임으로 지정"
                                  />
                                )}
                                {/* 영어: 밑줄 토글 버튼 */}
                                {isEnglish && !isMarkedForRemoval && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleStudentUnderline(student.id);
                                    }}
                                    className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded flex-shrink-0 transition-colors ${
                                      hasUnderline
                                        ? 'bg-blue-500 text-white underline'
                                        : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                                    }`}
                                    title={hasUnderline ? '밑줄 해제' : '밑줄 강조'}
                                  >
                                    U
                                  </button>
                                )}
                                <span className={`truncate ${isMarkedForRemoval ? 'text-gray-400' : 'text-gray-800'}`}>
                                  {student.name}
                                </span>
                                <span className="text-[10px] text-gray-400 flex-shrink-0">{formatSchoolGrade(student.school, student.grade)}</span>
                                {/* 수학에서만 등원 요일 표시 */}
                                {isMath && attendanceDaysText && !isMarkedForRemoval && (
                                  <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                                    {attendanceDaysText}만
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRemoveStudent(student.id);
                                }}
                                className={`p-1 rounded transition-colors flex-shrink-0 ${isMarkedForRemoval
                                    ? 'text-blue-600 hover:bg-blue-100'
                                    : 'text-red-500 hover:bg-red-100'
                                  }`}
                                title={isMarkedForRemoval ? '제거 취소' : '수업에서 제외'}
                              >
                                {isMarkedForRemoval ? (
                                  <span className="text-xs font-medium">취소</span>
                                ) : (
                                  <UserMinus size={14} />
                                )}
                              </button>
                            </div>
                            {/* 수학: 요일 선택 UI (펼쳐졌을 때) */}
                            {isMath && isExpanded && classDays.length > 1 && (
                              <div className="px-2.5 py-2 bg-gray-50 border-t border-gray-100">
                                <div className="text-[10px] text-gray-500 mb-1.5">등원 요일 선택 (체크 해제하면 해당 요일 미등원)</div>
                                <div className="flex gap-1 flex-wrap">
                                  {classDays.map(day => {
                                    const isAttending = isStudentAttendingDay(student.id, day);
                                    return (
                                      <button
                                        key={day}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleStudentDay(student.id, day);
                                        }}
                                        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                                          isAttending
                                            ? 'bg-[#fdb813] text-[#081429]'
                                            : 'bg-gray-200 text-gray-400 line-through'
                                        }`}
                                      >
                                        {day}
                                      </button>
                                    );
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

              {/* 추가 예정 학생 섹션 */}
              {studentsToAdd.size > 0 && (
                <div className="bg-white border border-gray-200 overflow-hidden">
                  <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                    <Users className="w-3 h-3 text-green-600" />
                    <h3 className="text-[#081429] font-bold text-xs">추가 예정</h3>
                    <span className="text-xxs text-green-600 ml-1">({studentsToAdd.size}명)</span>
                    {classInfo.subject === 'math' && classDays.length > 1 && (
                      <span className="text-xxs text-blue-500 ml-auto">클릭: 등원요일 · 체크박스: 부담임</span>
                    )}
                    {classInfo.subject === 'math' && classDays.length <= 1 && (
                      <span className="text-xxs text-blue-500 ml-auto">체크박스: 부담임</span>
                    )}
                    {classInfo.subject === 'english' && (
                      <span className="text-xxs text-blue-500 ml-auto">U: 밑줄 강조</span>
                    )}
                  </div>
                    <div className="max-h-40 overflow-y-auto">
                      {studentsToAddInfo.map(student => {
                        const startDate = studentStartDates[student.id] || new Date().toISOString().split('T')[0];
                        const today = new Date().toISOString().split('T')[0];
                        const isScheduled = startDate > today;
                        const isExpanded = expandedStudentId === student.id;
                        const attendanceDaysText = getAttendanceDaysText(student.id);
                        const isMath = classInfo.subject === 'math';
                        const isEnglish = classInfo.subject === 'english';
                        const canExpandForDays = isMath && classDays.length > 1;
                        const hasUnderline = studentUnderlines[student.id] || false;

                        return (
                          <div key={student.id} className="bg-green-50/30">
                            <div
                              className={`flex items-center justify-between px-2.5 py-1.5 text-sm hover:bg-green-50/60 ${canExpandForDays ? 'cursor-pointer' : ''}`}
                              onClick={() => {
                                if (canExpandForDays) {
                                  setExpandedStudentId(isExpanded ? null : student.id);
                                }
                              }}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {/* 수학: Calendar 아이콘 */}
                                {isMath && classDays.length > 1 && (
                                  <Calendar size={12} className="text-gray-400 flex-shrink-0" />
                                )}
                                {/* 수학: 부담임 체크박스 */}
                                {isMath && (
                                  <input
                                    type="checkbox"
                                    checked={studentSlotTeachers[student.id] || false}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      setStudentSlotTeachers(prev => ({
                                        ...prev,
                                        [student.id]: e.target.checked
                                      }));
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-3.5 h-3.5 text-[#fdb813] rounded focus:ring-[#fdb813] flex-shrink-0"
                                    title="부담임으로 지정"
                                  />
                                )}
                                {/* 영어: 밑줄 토글 버튼 */}
                                {isEnglish && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleStudentUnderline(student.id);
                                    }}
                                    className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded flex-shrink-0 transition-colors ${
                                      hasUnderline
                                        ? 'bg-blue-500 text-white underline'
                                        : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                                    }`}
                                    title={hasUnderline ? '밑줄 해제' : '밑줄 강조'}
                                  >
                                    U
                                  </button>
                                )}
                                <span className="truncate text-gray-800">{student.name}</span>
                                <span className="text-[10px] text-gray-400 flex-shrink-0">{formatSchoolGrade(student.school, student.grade)}</span>
                                {/* 수학: 등원 요일 표시 */}
                                {isMath && attendanceDaysText && (
                                  <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                                    {attendanceDaysText}만
                                  </span>
                                )}
                                {isScheduled && (
                                  <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                                    배정 예정
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <input
                                  type="date"
                                  value={startDate}
                                  onChange={(e) => {
                                    setStudentStartDates(prev => ({
                                      ...prev,
                                      [student.id]: e.target.value
                                    }));
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="px-1 py-0.5 text-[10px] border border-gray-200 rounded focus:ring-1 focus:ring-[#fdb813] outline-none w-[105px]"
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    cancelAddStudent(student.id);
                                  }}
                                  className="p-1 rounded transition-colors flex-shrink-0 text-red-500 hover:bg-red-100"
                                  title="추가 취소"
                                >
                                  <UserMinus size={14} />
                                </button>
                              </div>
                            </div>
                            {/* 수학: 요일 선택 UI (펼쳐졌을 때) */}
                            {isMath && isExpanded && classDays.length > 1 && (
                              <div className="px-2.5 py-2 bg-gray-50 border-t border-gray-100">
                                <div className="text-[10px] text-gray-500 mb-1.5">등원 요일 선택 (체크 해제하면 해당 요일 미등원)</div>
                                <div className="flex gap-1 flex-wrap">
                                  {classDays.map(day => {
                                    const isAttending = isStudentAttendingDay(student.id, day);
                                    return (
                                      <button
                                        key={day}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleStudentDay(student.id, day);
                                        }}
                                        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                                          isAttending
                                            ? 'bg-[#fdb813] text-[#081429]'
                                            : 'bg-gray-200 text-gray-400 line-through'
                                        }`}
                                      >
                                        {day}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                </div>
              )}

              {/* 학생 추가 섹션 */}
              <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                  <BookOpen className="w-3 h-3 text-[#081429]" />
                  <h3 className="text-[#081429] font-bold text-xs">학생 추가</h3>
                </div>
                <div className="p-2 border-b border-gray-100">
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="학생 검색하여 추가..."
                    className="w-full px-2 py-1 border border-gray-300 text-xs focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none"
                  />
                </div>
                <div className="max-h-32 overflow-y-auto">
                  {studentsLoading ? (
                    <div className="p-3 text-center text-gray-400 text-xs">로딩 중...</div>
                  ) : availableStudents.length === 0 ? (
                    <div className="p-3 text-center text-gray-400 text-xs">
                      {studentSearch ? '검색 결과가 없습니다' : '추가 가능한 학생이 없습니다'}
                    </div>
                  ) : (
                    availableStudents.map(student => (
                      <label
                        key={student.id}
                        className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer transition-colors hover:bg-gray-50 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={studentsToAdd.has(student.id)}
                          onChange={() => toggleAddStudent(student.id)}
                          className="w-3.5 h-3.5 text-[#fdb813] focus:ring-[#fdb813]"
                        />
                        <span className="truncate text-gray-800">{student.name}</span>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{formatSchoolGrade(student.school, student.grade)}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditClassModal;
