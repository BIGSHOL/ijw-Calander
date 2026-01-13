import React, { useState, useEffect } from 'react';
import { X, Edit, ChevronDown, ChevronUp } from 'lucide-react';
import { useUpdateClass, UpdateClassData } from '../../hooks/useClassMutations';
import { ClassInfo } from '../../hooks/useClasses';
import { SUBJECT_LABELS, SubjectType } from '../../utils/styleUtils';
import { ENGLISH_UNIFIED_PERIODS, MATH_UNIFIED_PERIODS } from '../Timetable/constants';
import { useTeachers } from '../../hooks/useFirebaseQueries';

interface EditClassModalProps {
  classInfo: ClassInfo;
  initialSlotTeachers?: Record<string, string>;
  onClose: (saved?: boolean) => void;
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토'];
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

const EditClassModal: React.FC<EditClassModalProps> = ({ classInfo, initialSlotTeachers, onClose }) => {
  const [className, setClassName] = useState(classInfo.className);
  const [teacher, setTeacher] = useState(classInfo.teacher);
  const [room, setRoom] = useState(classInfo.room || '');

  // 스케줄 그리드
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [slotTeachers, setSlotTeachers] = useState<Record<string, string>>(initialSlotTeachers || {});
  const [slotRooms, setSlotRooms] = useState<Record<string, string>>({});
  const [showAdvancedSchedule, setShowAdvancedSchedule] = useState(false);

  const [error, setError] = useState('');

  const updateClassMutation = useUpdateClass();
  const { data: teachersData } = useTeachers();

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

    // 기존 slotTeachers 데이터 로드
    if (classInfo.slotTeachers) {
      setSlotTeachers(classInfo.slotTeachers);
    }

    // 기존 slotRooms 데이터 로드
    if (classInfo.slotRooms) {
      setSlotRooms(classInfo.slotRooms);
    }
  }, [classInfo.schedule, classInfo.slotTeachers, classInfo.slotRooms]);

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

  // 저장
  const handleSave = async () => {
    if (!className.trim()) {
      setError('수업명을 입력해주세요.');
      return;
    }
    if (!teacher.trim()) {
      setError('강사명을 입력해주세요.');
      return;
    }

    setError('');

    // 스케줄 변환
    const schedule: string[] = [];
    selectedSlots.forEach(key => {
      const [day, periodId] = key.split('-');
      schedule.push(`${day} ${periodId}`);
    });

    console.log('[EditClassModal] Saving with schedule:', schedule);
    console.log('[EditClassModal] Selected slots:', Array.from(selectedSlots));
    console.log('[EditClassModal] Slot teachers:', slotTeachers);
    console.log('[EditClassModal] Slot rooms:', slotRooms);

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

    const updateData: UpdateClassData = {
      originalClassName: classInfo.className,
      originalSubject: classInfo.subject,
      newClassName: className.trim(),
      newTeacher: teacher.trim(),
      newSchedule: schedule,
      newRoom: room.trim(),
      slotTeachers: filteredSlotTeachers,
      slotRooms: filteredSlotRooms,
    };

    try {
      await updateClassMutation.mutateAsync(updateData);
      onClose(true); // 저장 성공 플래그 전달
    } catch (err) {
      console.error('[EditClassModal] Error updating class:', err);
      setError('수업 수정에 실패했습니다.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
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
                담임 강사 <span className="text-red-500">*</span>
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
              <div className="max-h-36 overflow-y-auto">
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
                      const displayTeacher = slotTeacher || teacher;
                      const colors = displayTeacher ? getTeacherColor(displayTeacher) : { bgColor: '#fdb813', textColor: '#081429' };

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleSlot(day, periodId)}
                          className={`p-1 transition-colors text-[10px] min-h-[24px] border-r border-gray-200 last:border-r-0 ${
                            isSelected
                              ? 'font-semibold'
                              : 'hover:bg-gray-100 text-gray-300'
                          }`}
                          style={isSelected ? {
                            backgroundColor: colors.bgColor,
                            color: colors.textColor
                          } : undefined}
                        >
                          {isSelected ? (slotTeacher || teacher || '✓') : ''}
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
                  교시별 강사/강의실 설정
                </button>
              </div>
            )}

            {showAdvancedSchedule && selectedSlots.size > 0 && (
              <div className="mt-2 space-y-2">
                {/* 교시별 강사 설정 */}
                <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                  <p className="text-[10px] text-gray-500 px-2 py-1 border-b border-gray-200 bg-blue-50 font-semibold">교시별 강사 (비워두면 담임)</p>
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

          {/* 안내 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <p className="text-blue-700 text-xs">
              <strong>안내:</strong> 수업 정보를 수정하면 등록된 학생 정보도 함께 업데이트됩니다.
              <br />
              <span className="text-blue-600">현재 {classInfo.studentCount || 0}명 등록</span>
            </p>
          </div>
        </div>

        {/* 푸터 */}
        <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-end gap-2 border-t shrink-0">
          <button
            onClick={() => onClose(false)}
            disabled={updateClassMutation.isPending}
            className="px-4 py-1.5 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={updateClassMutation.isPending}
            className="px-4 py-1.5 text-sm bg-[#fdb813] hover:bg-[#e5a60f] text-[#081429] rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            {updateClassMutation.isPending ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditClassModal;
