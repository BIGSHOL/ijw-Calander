import React, { useState, useEffect, useMemo } from 'react';
import { X, Edit, ChevronDown, ChevronUp, Users, UserMinus } from 'lucide-react';
import { useUpdateClass, UpdateClassData, useManageClassStudents } from '../../hooks/useClassMutations';
import { ClassInfo, useClasses } from '../../hooks/useClasses';
import { useClassDetail, ClassStudent } from '../../hooks/useClassDetail';
import { useStudents } from '../../hooks/useStudents';
import { SUBJECT_LABELS, SubjectType } from '../../utils/styleUtils';
import { ENGLISH_UNIFIED_PERIODS, MATH_UNIFIED_PERIODS } from '../Timetable/constants';
import { useTeachers } from '../../hooks/useFirebaseQueries';

interface EditClassModalProps {
  classInfo: ClassInfo;
  initialSlotTeachers?: Record<string, string>;
  onClose: (saved?: boolean, newClassName?: string) => void;
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
const WEEKDAY_ORDER: Record<string, number> = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 };

const EditClassModal: React.FC<EditClassModalProps> = ({ classInfo, initialSlotTeachers, onClose }) => {
  const [className, setClassName] = useState(classInfo.className);
  const [teacher, setTeacher] = useState(classInfo.teacher);
  const [room, setRoom] = useState(classInfo.room || '');
  const [memo, setMemo] = useState('');

  // 스케줄 그리드
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [slotTeachers, setSlotTeachers] = useState<Record<string, string>>(initialSlotTeachers || {});
  const [slotRooms, setSlotRooms] = useState<Record<string, string>>({});
  const [showAdvancedSchedule, setShowAdvancedSchedule] = useState(false);

  // 학생 관리
  const [showStudentList, setShowStudentList] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentsToAdd, setStudentsToAdd] = useState<Set<string>>(new Set());
  const [studentsToRemove, setStudentsToRemove] = useState<Set<string>>(new Set());

  const [error, setError] = useState('');

  const updateClassMutation = useUpdateClass();
  const manageStudentsMutation = useManageClassStudents();
  const { data: teachersData } = useTeachers();
  const { data: classDetail } = useClassDetail(classInfo.className, classInfo.subject);
  const { students: allStudents, loading: studentsLoading } = useStudents(false);
  const { data: existingClasses } = useClasses(classInfo.subject); // 해당 과목의 기존 수업 목록

  // 현재 등록된 학생 목록
  const currentStudents = classDetail?.students || [];
  const currentStudentIds = currentStudents.map(s => s.id);

  // 강사 색상 가져오기
  const getTeacherColor = (teacherName: string) => {
    const teacherInfo = teachersData?.find(t => t.name === teacherName);
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
          s.name.toLowerCase().includes(search) ||
          s.school?.toLowerCase().includes(search) ||
          s.grade?.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [allStudents, currentStudentIds, studentsToAdd, studentSearch]);

  // 추가 예정 학생 정보
  const studentsToAddInfo = useMemo(() => {
    if (!allStudents) return [];
    return allStudents.filter(s => studentsToAdd.has(s.id));
  }, [allStudents, studentsToAdd]);

  // 기존 스케줄을 그리드로 변환
  useEffect(() => {
    if (classInfo.schedule && classInfo.schedule.length > 0) {
      const slots = new Set<string>();
      classInfo.schedule.forEach(item => {
        const parts = item.split(' ');
        if (parts.length >= 2) {
          const day = parts[0];
          const periodId = parts[1];
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
    } else {
      newSet.add(studentId);
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

    setError('');

    // 스케줄 변환
    const schedule: string[] = [];
    selectedSlots.forEach(key => {
      const [day, periodId] = key.split('-');
      schedule.push(`${day} ${periodId}`);
    });

    // 빈 문자열 및 숨김 강사(LAB 등)인 slotTeachers 항목 제거
    const filteredSlotTeachers: Record<string, string> = {};
    Object.entries(slotTeachers).forEach(([key, value]) => {
      if (value && value.trim()) {
        // 숨김 강사인 경우 제외
        const teacherInfo = teachersData?.find(t => t.name === value.trim());
        if (!teacherInfo?.isHidden) {
          filteredSlotTeachers[key] = value.trim();
        }
      }
    });

    const filteredSlotRooms: Record<string, string> = {};
    Object.entries(slotRooms).forEach(([key, value]) => {
      if (value && value.trim()) {
        filteredSlotRooms[key] = value.trim();
      }
    });

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

    try {
      // 1. 수업 정보 업데이트
      await updateClassMutation.mutateAsync(updateData);

      // 2. 학생 추가/제거가 있으면 처리
      if (studentsToAdd.size > 0 || studentsToRemove.size > 0) {
        await manageStudentsMutation.mutateAsync({
          className: className.trim(),
          teacher: teacher.trim(),
          subject: classInfo.subject,
          schedule,
          addStudentIds: Array.from(studentsToAdd),
          removeStudentIds: Array.from(studentsToRemove),
        });
      }

      // 수업명이 변경되었으면 새 수업명 전달
      const classNameChanged = className.trim() !== classInfo.className;
      onClose(true, classNameChanged ? className.trim() : undefined);
    } catch (err) {
      console.error('[EditClassModal] Error updating class:', err);
      setError('수업 수정에 실패했습니다.');
    }
  };

  // 최종 학생 수 계산
  const finalStudentCount = currentStudents.length - studentsToRemove.size + studentsToAdd.size;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="bg-[#081429] text-white px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Edit className="w-5 h-5" />
            <h2 className="font-bold">수업 편집</h2>
          </div>
          <button onClick={() => onClose(false)} className="hover:bg-white/20 p-1.5 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* 기본 정보 - 2열 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                수업명 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="예: LT1a"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#fdb813] focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">과목</label>
              <input
                type="text"
                value={SUBJECT_LABELS[classInfo.subject as SubjectType] || classInfo.subject}
                disabled
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-100 text-gray-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                담임 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
                placeholder="예: Ellen"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#fdb813] focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">강의실</label>
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="예: 302"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#fdb813] focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* 스케줄 그리드 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">스케줄 선택</label>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="max-h-56 overflow-y-auto">
                {/* 헤더 - Sticky */}
                <div className="grid bg-gray-50 border-b border-gray-200 sticky top-0 z-10" style={{ gridTemplateColumns: `32px repeat(${WEEKDAYS.length}, 1fr)` }}>
                  <div className="p-1 text-center text-[10px] font-semibold text-gray-400 border-r border-gray-200"></div>
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
                    <div className="p-1 text-center text-[10px] text-gray-400 bg-gray-50 flex items-center justify-center border-r border-gray-200">
                      {periodId}
                    </div>
                    {WEEKDAYS.map((day) => {
                      const key = `${day}-${periodId}`;
                      const isSelected = selectedSlots.has(key);
                      const slotTeacher = slotTeachers[key];
                      // 숨김 강사인 경우 담임으로 대체 (스케줄 그리드 표시용)
                      const slotTeacherInfo = slotTeacher ? teachersData?.find(t => t.name === slotTeacher) : null;
                      const isSlotTeacherHidden = slotTeacherInfo?.isHidden;
                      const displayTeacher = (slotTeacher && !isSlotTeacherHidden) ? slotTeacher : teacher;
                      const colors = displayTeacher ? getTeacherColor(displayTeacher) : { bgColor: '#fdb813', textColor: '#081429' };

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
                          {isSelected ? (displayTeacher || '✓') : ''}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {selectedSlots.size > 0 && (
              <div className="mt-1.5 flex items-center justify-between">
                <p className="text-[10px] text-gray-500">{selectedSlots.size}개 교시 선택</p>
                <button
                  type="button"
                  onClick={() => setShowAdvancedSchedule(!showAdvancedSchedule)}
                  className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
                >
                  {showAdvancedSchedule ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                  교시별 부담임/강의실 설정
                </button>
              </div>
            )}

            {showAdvancedSchedule && selectedSlots.size > 0 && (
              <div className="mt-2 space-y-2">
                {/* 교시별 부담임 설정 */}
                <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                  <p className="text-[10px] text-gray-500 px-2 py-1 border-b border-gray-200 bg-blue-50 font-semibold">교시별 부담임 (비워두면 담임)</p>
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
                              <input
                                type="text"
                                value={slotTeachers[key] || ''}
                                onChange={(e) => setSlotTeacher(key, e.target.value)}
                                placeholder={teacher || '-'}
                                className="w-full h-full px-1 py-0.5 border border-gray-200 rounded text-[10px] focus:ring-1 focus:ring-[#fdb813] outline-none bg-white"
                              />
                            </div>
                          );
                        })}
                      </div>
                    ));
                  })()}
                </div>

                {/* 교시별 강의실 설정 */}
                <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                  <p className="text-[10px] text-gray-500 px-2 py-1 border-b border-gray-200 bg-purple-50 font-semibold">교시별 강의실 (비워두면 기본 강의실)</p>
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
                              <input
                                type="text"
                                value={slotRooms[key] || ''}
                                onChange={(e) => setSlotRoom(key, e.target.value)}
                                placeholder={room || '-'}
                                className="w-full h-full px-1 py-0.5 border border-gray-200 rounded text-[10px] focus:ring-1 focus:ring-[#fdb813] outline-none bg-white"
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

          {/* 메모 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">메모</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="수업에 대한 메모를 입력하세요..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#fdb813] focus:border-transparent outline-none resize-none"
            />
          </div>

          {/* 학생 관리 섹션 */}
          <div>
            <button
              type="button"
              onClick={() => setShowStudentList(!showStudentList)}
              className="w-full flex items-center justify-between p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-700">학생 관리</span>
                <span className="text-xs text-[#fdb813] font-semibold">
                  {finalStudentCount}명
                  {(studentsToAdd.size > 0 || studentsToRemove.size > 0) && (
                    <span className="text-gray-400 ml-1">
                      ({studentsToAdd.size > 0 && `+${studentsToAdd.size}`}
                      {studentsToAdd.size > 0 && studentsToRemove.size > 0 && ' '}
                      {studentsToRemove.size > 0 && `-${studentsToRemove.size}`})
                    </span>
                  )}
                </span>
              </div>
              {showStudentList ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showStudentList && (
              <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                {/* 현재 등록된 학생 */}
                <div className="border-b border-gray-200">
                  <div className="px-2.5 py-1.5 bg-blue-50 text-xs font-semibold text-blue-700">
                    현재 등록된 학생 ({currentStudents.length - studentsToRemove.size}명)
                  </div>
                  <div className="max-h-28 overflow-y-auto">
                    {currentStudents.length === 0 ? (
                      <div className="p-3 text-center text-gray-400 text-sm">등록된 학생이 없습니다</div>
                    ) : (
                      currentStudents.map(student => {
                        const isMarkedForRemoval = studentsToRemove.has(student.id);
                        return (
                          <div
                            key={student.id}
                            className={`flex items-center justify-between px-2.5 py-1.5 text-sm ${isMarkedForRemoval ? 'bg-red-50 line-through text-gray-400' : 'hover:bg-gray-50'
                              }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={isMarkedForRemoval ? 'text-gray-400' : 'text-gray-800'}>
                                {student.name}
                              </span>
                              <span className="text-[10px] text-gray-400">{student.school}{student.grade}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleRemoveStudent(student.id)}
                              className={`p-1 rounded transition-colors ${isMarkedForRemoval
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
                        );
                      })
                    )}
                  </div>
                </div>

                {/* 추가 예정 학생 */}
                {studentsToAdd.size > 0 && (
                  <div className="border-b border-gray-200">
                    <div className="px-2.5 py-1.5 bg-green-50 text-xs font-semibold text-green-700">
                      추가 예정 ({studentsToAdd.size}명)
                    </div>
                    <div className="max-h-20 overflow-y-auto">
                      {studentsToAddInfo.map(student => (
                        <div
                          key={student.id}
                          className="flex items-center justify-between px-2.5 py-1.5 text-sm bg-green-50/50"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-green-800">{student.name}</span>
                            <span className="text-[10px] text-gray-400">{student.school}{student.grade}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => cancelAddStudent(student.id)}
                            className="text-xs text-gray-500 hover:text-red-500 font-medium"
                          >
                            취소
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 학생 추가 검색 */}
                <div className="p-2 border-b border-gray-100">
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="학생 검색하여 추가..."
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-[#fdb813] outline-none"
                  />
                </div>

                {/* 추가 가능한 학생 목록 */}
                <div className="max-h-32 overflow-y-auto">
                  {studentsLoading ? (
                    <div className="p-3 text-center text-gray-400 text-sm">로딩 중...</div>
                  ) : availableStudents.length === 0 ? (
                    <div className="p-3 text-center text-gray-400 text-sm">
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
                          className="w-3.5 h-3.5 text-[#fdb813] rounded focus:ring-[#fdb813]"
                        />
                        <span className="text-gray-800">{student.name}</span>
                        <span className="text-[10px] text-gray-400">{student.school}{student.grade}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-end gap-2 border-t shrink-0">
          <button
            onClick={() => onClose(false)}
            disabled={updateClassMutation.isPending || manageStudentsMutation.isPending}
            className="px-4 py-1.5 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={updateClassMutation.isPending || manageStudentsMutation.isPending}
            className="px-4 py-1.5 text-sm bg-[#fdb813] hover:bg-[#e5a60f] text-[#081429] rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            {(updateClassMutation.isPending || manageStudentsMutation.isPending) ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditClassModal;
