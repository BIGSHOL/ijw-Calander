import React, { useState, useMemo } from 'react';
import { X, Plus, Users, ChevronDown, ChevronUp, BookOpen, Calendar } from 'lucide-react';
import { useCreateClass, CreateClassData } from '../../hooks/useClassMutations';
import { useStudents } from '../../hooks/useStudents';
import { useClasses } from '../../hooks/useClasses';
import { SUBJECT_LABELS } from '../../utils/styleUtils';
import { ENGLISH_UNIFIED_PERIODS, MATH_UNIFIED_PERIODS, SCIENCE_UNIFIED_PERIODS, KOREAN_UNIFIED_PERIODS } from '../Timetable/constants';
import { useTeachers } from '../../hooks/useFirebaseQueries';
import { useStaff } from '../../hooks/useStaff';
import { SubjectType } from '../../types';

interface AddClassModalProps {
  onClose: () => void;
  defaultSubject?: SubjectType;
}

const AVAILABLE_SUBJECTS: SubjectType[] = ['math', 'english', 'science', 'korean'];

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
const WEEKDAY_ORDER: Record<string, number> = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 };

// 슬롯 정렬 함수 (월화수목금토일 순 → 교시 순)
const sortSlots = (slots: string[]): string[] => {
  return slots.sort((a, b) => {
    const [dayA, periodA] = a.split('-');
    const [dayB, periodB] = b.split('-');
    const dayOrderA = WEEKDAY_ORDER[dayA] ?? 99;
    const dayOrderB = WEEKDAY_ORDER[dayB] ?? 99;
    if (dayOrderA !== dayOrderB) return dayOrderA - dayOrderB;
    return Number(periodA) - Number(periodB);
  });
};

const AddClassModal: React.FC<AddClassModalProps> = ({ onClose, defaultSubject = 'math' }) => {
  // 기본 정보
  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState<SubjectType>(defaultSubject);
  const [mainTeacher, setMainTeacher] = useState('');
  const [room, setRoom] = useState('');

  // 스케줄 (그리드 선택)
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set()); // "월-5" 형태
  const [slotTeachers, setSlotTeachers] = useState<Record<string, string>>({}); // 교시별 강사
  const [slotRooms, setSlotRooms] = useState<Record<string, string>>({}); // 교시별 강의실
  const [showAdvancedSchedule, setShowAdvancedSchedule] = useState(false);

  // 학생 선택
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');

  const [error, setError] = useState('');

  const { students, loading: studentsLoading } = useStudents(false);
  const createClassMutation = useCreateClass();
  const { data: teachersData } = useTeachers();
  const { staff } = useStaff();
  const { data: existingClasses } = useClasses(subject); // 해당 과목의 기존 수업 목록

  // Map을 사용해 O(1) 강사 검색 최적화 (js-optimize-map-lookups)
  const staffMap = useMemo(() => {
    const map = new Map();
    staff.forEach(member => {
      map.set(member.id, member);
      // name과 englishName으로도 검색 가능하도록
      if (member.name) map.set(member.name, member);
      if (member.englishName) map.set(member.englishName, member);
    });
    return map;
  }, [staff]);

  // teachersData Map 생성 (O(1) 색상 조회)
  const teachersMap = useMemo(() => {
    const map = new Map();
    teachersData?.forEach(teacher => {
      if (teacher.name) map.set(teacher.name, teacher);
      if (teacher.englishName) map.set(teacher.englishName, teacher);
    });
    return map;
  }, [teachersData]);

  // 과목별 강사 필터링 (systemRole 또는 role='teacher' + subjects)
  const availableTeachers = useMemo(() => {
    return staff.filter(member => {
      // systemRole 기반 체크
      if (subject === 'math') {
        if (member.systemRole === 'math_teacher' || member.systemRole === 'math_lead') {
          return true;
        }
      } else if (subject === 'english') {
        if (member.systemRole === 'english_teacher' || member.systemRole === 'english_lead') {
          return true;
        }
      }

      // 레거시: role='teacher' + subjects 체크
      if (member.role === 'teacher' && member.subjects?.includes(subject as 'math' | 'english')) {
        return true;
      }

      return false;
    });
  }, [staff, subject]);

  // 강사 이름 표시 헬퍼 (과목별 다른 표시)
  const getTeacherDisplayName = (staffMember: typeof staff[0]) => {
    if (subject === 'english') {
      return staffMember.englishName || staffMember.name;
    }
    return staffMember.name;
  };

  // 강사 저장값 헬퍼 (영어 과목은 englishName 저장, 다른 과목은 name 저장)
  const getTeacherSaveValue = (staffMember: typeof staff[0]) => {
    if (subject === 'english') {
      return staffMember.englishName || staffMember.name;
    }
    return staffMember.name;
  };

  // 강사 색상 가져오기 (Map으로 O(1) 조회)
  const getTeacherColor = (teacherName: string) => {
    const teacherInfo = teachersMap.get(teacherName);
    return {
      bgColor: teacherInfo?.bgColor || '#fdb813',
      textColor: teacherInfo?.textColor || '#081429'
    };
  };

  // 과목별 교시
  const periods = subject === 'english' ? ENGLISH_UNIFIED_PERIODS
    : subject === 'math' ? MATH_UNIFIED_PERIODS
    : subject === 'science' ? SCIENCE_UNIFIED_PERIODS
    : KOREAN_UNIFIED_PERIODS;

  // 학생 필터링
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const search = studentSearch.toLowerCase();
    return students.filter(s =>
      (s.name || '').toLowerCase().includes(search) ||
      s.school?.toLowerCase().includes(search) ||
      s.grade?.toLowerCase().includes(search)
    );
  }, [students, studentSearch]);

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
  const setSlotTeacher = (key: string, teacher: string) => {
    setSlotTeachers(prev => ({ ...prev, [key]: teacher }));
  };

  // 슬롯 강의실 설정
  const setSlotRoom = (key: string, roomName: string) => {
    setSlotRooms(prev => ({ ...prev, [key]: roomName }));
  };

  // 학생 토글
  const toggleStudent = (studentId: string) => {
    if (selectedStudentIds.includes(studentId)) {
      setSelectedStudentIds(selectedStudentIds.filter(id => id !== studentId));
    } else {
      setSelectedStudentIds([...selectedStudentIds, studentId]);
    }
  };

  // 저장
  const handleSave = async () => {
    if (!className.trim()) {
      setError('수업명을 입력해주세요.');
      return;
    }
    if (!mainTeacher.trim()) {
      setError('담임 강사를 입력해주세요.');
      return;
    }
    if (selectedSlots.size === 0) {
      setError('최소 1개 이상의 교시를 선택해주세요.');
      return;
    }

    // 중복 수업명 검사
    const trimmedClassName = className.trim();
    const isDuplicate = existingClasses?.some(
      cls => cls.className.toLowerCase() === trimmedClassName.toLowerCase()
    );
    if (isDuplicate) {
      setError(`"${trimmedClassName}" 수업명이 이미 존재합니다. 다른 이름을 사용해주세요.`);
      return;
    }

    setError('');

    // 스케줄 변환
    const schedule: string[] = [];
    selectedSlots.forEach(key => {
      const [day, periodId] = key.split('-');
      schedule.push(`${day} ${periodId}`);
    });

    // 빈 문자열인 slotTeachers 및 slotRooms 항목 제거
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

    const classData: CreateClassData = {
      className: className.trim(),
      teacher: mainTeacher.trim(),
      subject,
      schedule,
      room: room.trim(),
      studentIds: selectedStudentIds,
      slotTeachers: filteredSlotTeachers,
      slotRooms: filteredSlotRooms,
    };

    try {
      await createClassMutation.mutateAsync(classData);
      onClose();
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[AddClassModal] Error creating class:', err);
      }
      setError('수업 생성에 실패했습니다.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100] p-4" onClick={onClose}>
      <div className="bg-white rounded-sm shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <h2 className="text-sm font-bold text-[#081429]">새 수업 추가</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-sm px-2 py-1.5 text-red-600 text-xs">
              {error}
            </div>
          )}

          {/* 섹션 1: 기본 정보 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
              <BookOpen className="w-3 h-3 text-[#081429]" />
              <h3 className="text-[#081429] font-bold text-xs">기본 정보</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {/* 수업명 */}
              <div className="flex items-center gap-2 px-1.5 py-1">
                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">수업명 <span className="text-red-500">*</span></span>
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="예: LT1a"
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none"
                />
              </div>

              {/* 과목 */}
              <div className="flex items-center gap-2 px-1.5 py-1">
                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">과목 <span className="text-red-500">*</span></span>
                <select
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value as SubjectType);
                    setSelectedSlots(new Set());
                  }}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none"
                >
                  {AVAILABLE_SUBJECTS.map(key => (
                    <option key={key} value={key}>{SUBJECT_LABELS[key]}</option>
                  ))}
                </select>
              </div>

              {/* 담임 강사 */}
              <div className="flex items-center gap-2 px-1.5 py-1">
                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">담임 강사 <span className="text-red-500">*</span></span>
                <div className="flex-1">
                  <select
                    value={mainTeacher}
                    onChange={(e) => setMainTeacher(e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none"
                  >
                    <option value="">선택해주세요</option>
                    {availableTeachers.map(teacher => {
                      const displayName = getTeacherDisplayName(teacher);
                      const saveValue = getTeacherSaveValue(teacher);
                      return (
                        <option key={teacher.id} value={saveValue}>
                          {displayName}
                        </option>
                      );
                    })}
                  </select>
                  {availableTeachers.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      ⚠️ {SUBJECT_LABELS[subject]} 과목 강사가 없습니다. 직원 관리에서 추가해주세요.
                    </p>
                  )}
                </div>
              </div>

              {/* 강의실 */}
              <div className="flex items-center gap-2 px-1.5 py-1">
                <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">강의실</span>
                <input
                  type="text"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="예: 302"
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none"
                />
              </div>
            </div>
          </div>

          {/* 섹션 2: 스케줄 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
              <Calendar className="w-3 h-3 text-[#081429]" />
              <h3 className="text-[#081429] font-bold text-xs">스케줄</h3>
            </div>
            <div className="p-1.5">
              {/* 스케줄 그리드 */}
              <div className="border border-gray-200 rounded-sm overflow-hidden">
                <div className="max-h-56 overflow-y-auto">
                  {/* 헤더 - Sticky */}
                  <div className="grid bg-gray-50 border-b border-gray-200 sticky top-0 z-10" style={{ gridTemplateColumns: `32px repeat(${WEEKDAYS.length}, 1fr)` }}>
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
                      {WEEKDAYS.map((day, idx) => {
                        const key = `${day}-${periodId}`;
                        const isSelected = selectedSlots.has(key);
                        const slotTeacher = slotTeachers[key];
                        const displayTeacher = slotTeacher || mainTeacher;
                        const colors = displayTeacher ? getTeacherColor(displayTeacher) : { bgColor: '#fdb813', textColor: '#081429' };

                        // 과목에 맞게 표시할 이름 결정 (Map으로 O(1) 조회)
                        let displayName = '';
                        if (isSelected) {
                          if (slotTeacher) {
                            const staffMember = staffMap.get(slotTeacher);
                            displayName = staffMember ? getTeacherDisplayName(staffMember) : slotTeacher;
                          } else if (mainTeacher) {
                            const staffMember = staffMap.get(mainTeacher);
                            displayName = staffMember ? getTeacherDisplayName(staffMember) : mainTeacher;
                          } else {
                            displayName = '✓';
                          }
                        }

                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => toggleSlot(day, periodId)}
                            className={`p-1 transition-colors text-xxs min-h-[24px] border-r border-gray-200 last:border-r-0 ${
                              isSelected
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
              </div>

              {selectedSlots.size > 0 && (
                <div className="mt-1.5 flex items-center justify-between">
                  <p className="text-xxs text-gray-500">{selectedSlots.size}개 교시 선택</p>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedSchedule(!showAdvancedSchedule)}
                    className="text-xxs text-blue-600 hover:underline flex items-center gap-0.5"
                  >
                    {showAdvancedSchedule ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    교시별 강사/강의실 설정
                  </button>
                </div>
              )}

              {showAdvancedSchedule && selectedSlots.size > 0 && (
                <div className="mt-2 space-y-2">
                  {/* 교시별 강사 설정 */}
                  <div className="border border-gray-200 rounded-sm overflow-hidden bg-gray-50">
                    <p className="text-xxs text-gray-500 px-2 py-1 border-b border-gray-200 bg-blue-50 font-semibold">교시별 강사 (비워두면 담임)</p>
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
                                <select
                                  value={slotTeachers[key] || ''}
                                  onChange={(e) => setSlotTeacher(key, e.target.value)}
                                  className="w-full h-full px-1 py-0.5 border border-gray-200 rounded text-xxs focus:ring-1 focus:ring-[#fdb813] outline-none bg-white"
                                >
                                  <option value="">
                                    {mainTeacher ? (() => {
                                      const staffMember = staffMap.get(mainTeacher);
                                      return staffMember ? getTeacherDisplayName(staffMember) : mainTeacher;
                                    })() : '담임'}
                                  </option>
                                  {availableTeachers.map(teacher => {
                                    const displayName = getTeacherDisplayName(teacher);
                                    const saveValue = getTeacherSaveValue(teacher);
                                    return (
                                      <option key={teacher.id} value={saveValue}>
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

                  {/* 교시별 강의실 설정 */}
                  <div className="border border-gray-200 rounded-sm overflow-hidden bg-gray-50">
                    <p className="text-xxs text-gray-500 px-2 py-1 border-b border-gray-200 bg-purple-50 font-semibold">교시별 강의실 (비워두면 기본 강의실)</p>
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
                                  className="w-full h-full px-1 py-0.5 border border-gray-200 rounded text-xxs focus:ring-1 focus:ring-[#fdb813] outline-none bg-white"
                                />
                              </div>
                            );
                          })}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 섹션 3: 학생 선택 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
              <Users className="w-3 h-3 text-[#081429]" />
              <h3 className="text-[#081429] font-bold text-xs">학생 선택</h3>
              <span className="text-xs text-[#fdb813] font-semibold ml-1">{selectedStudentIds.length}명</span>
            </div>
            <div className="divide-y divide-gray-100">
              {/* 검색창 */}
              <div className="px-1.5 py-1">
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="학생 검색..."
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none"
                />
              </div>

              {/* 학생 목록 */}
              <div className="max-h-40 overflow-y-auto">
                {studentsLoading ? (
                  <div className="px-2 py-3 text-center text-gray-400 text-xs">로딩 중...</div>
                ) : filteredStudents.length === 0 ? (
                  <div className="px-2 py-3 text-center text-gray-400 text-xs">학생이 없습니다</div>
                ) : (
                  filteredStudents.map(student => (
                    <label
                      key={student.id}
                      className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-colors border-b border-gray-50 last:border-b-0 ${
                        selectedStudentIds.includes(student.id) ? 'bg-[#fdb813]/10' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.includes(student.id)}
                        onChange={() => toggleStudent(student.id)}
                        className="w-3 h-3 text-[#fdb813] rounded focus:ring-[#fdb813]"
                      />
                      <span className="text-xs text-gray-800">{student.name}</span>
                      <span className="text-xxs text-gray-400">{student.grade}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="px-2 py-1.5 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 shrink-0">
          <button
            onClick={onClose}
            disabled={createClassMutation.isPending}
            className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded-sm hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={createClassMutation.isPending}
            className="px-3 py-1.5 bg-[#fdb813] text-[#081429] text-xs font-semibold rounded-sm hover:bg-[#e5a60f] transition-colors disabled:opacity-50"
          >
            {createClassMutation.isPending ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddClassModal;
