/**
 * SimulationClassModal - 시뮬레이션 모드 수업 편집 모달
 *
 * 시뮬레이션 모드에서 수업 추가/편집/삭제
 * - 변경사항은 scenarioClasses에만 반영
 * - "실제 반영" 시 classes collection에 저장
 * - 기존 EditClassModal과 동일한 그리드 UI (셀에 강사 이름 표시)
 */

import React, { useState, useEffect } from 'react';
import { X, Trash2, Save, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { useScenario } from './context/SimulationContext';
import { EN_WEEKDAYS, EN_PERIODS } from './englishUtils';

interface SimulationClassModalProps {
  classId?: string;
  onClose: () => void;
  teachers: { name: string; englishName?: string }[];
}

const SimulationClassModal: React.FC<SimulationClassModalProps> = ({
  classId,
  onClose,
  teachers,
}) => {
  const scenario = useScenario();
  const isEditMode = !!classId;
  const existingClass = isEditMode ? scenario.getScenarioClass(classId) : undefined;

  const [className, setClassName] = useState(existingClass?.className || '');
  const [teacher, setTeacher] = useState(existingClass?.teacher || existingClass?.mainTeacher || '');
  const [room, setRoom] = useState(existingClass?.room || '');
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [slotTeachers, setSlotTeachers] = useState<Record<string, string>>({});
  const [slotRooms, setSlotRooms] = useState<Record<string, string>>({});
  const [showAdvancedSchedule, setShowAdvancedSchedule] = useState(false);

  useEffect(() => {
    if (existingClass?.schedule) {
      const slots = new Set<string>();
      existingClass.schedule.forEach(s => {
        slots.add(`${s.day}-${s.periodId}`);
      });
      setSelectedSlots(slots);
    }
    if (existingClass?.slotTeachers) {
      setSlotTeachers(existingClass.slotTeachers);
    }
    if (existingClass?.slotRooms) {
      setSlotRooms(existingClass.slotRooms);
    }
  }, [existingClass]);

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

  const setSlotTeacher = (key: string, teacherName: string) => {
    setSlotTeachers(prev => ({ ...prev, [key]: teacherName }));
  };

  const setSlotRoom = (key: string, roomName: string) => {
    setSlotRooms(prev => ({ ...prev, [key]: roomName }));
  };

  const handleSave = () => {
    if (!className.trim()) {
      alert('수업 이름을 입력해주세요.');
      return;
    }
    if (selectedSlots.size === 0) {
      alert('스케줄을 최소 1개 이상 선택해주세요.');
      return;
    }

    const schedule: { day: string; periodId: string; room?: string }[] = [];
    selectedSlots.forEach(key => {
      const [day, periodId] = key.split('-');
      const slotRoom = slotRooms[key];
      schedule.push({ day, periodId, ...(slotRoom && { room: slotRoom }) });
    });

    const sortedSchedule = schedule.sort((a, b) => {
      const dayOrder = EN_WEEKDAYS.indexOf(a.day as any) - EN_WEEKDAYS.indexOf(b.day as any);
      if (dayOrder !== 0) return dayOrder;
      return parseInt(a.periodId) - parseInt(b.periodId);
    });

    const filteredSlotTeachers: Record<string, string> = {};
    Object.entries(slotTeachers).forEach(([key, value]) => {
      if (value && value.trim()) filteredSlotTeachers[key] = value.trim();
    });

    const filteredSlotRooms: Record<string, string> = {};
    Object.entries(slotRooms).forEach(([key, value]) => {
      if (value && value.trim()) filteredSlotRooms[key] = value.trim();
    });

    if (isEditMode && existingClass) {
      const changes: string[] = [];
      if (existingClass.className !== className) changes.push(`이름`);
      if ((existingClass.teacher || existingClass.mainTeacher) !== teacher) changes.push(`강사`);
      if (existingClass.schedule?.length !== sortedSchedule.length) changes.push(`스케줄`);

      if (changes.length === 0) {
        alert('변경된 내용이 없습니다.');
        return;
      }

      if (existingClass.className !== className) {
        const success = scenario.renameScenarioClass(existingClass.className, className);
        if (!success) return;
      }

      scenario.updateScenarioClassWithHistory(classId!, {
        teacher,
        mainTeacher: teacher,
        room,
        schedule: sortedSchedule,
        slotTeachers: filteredSlotTeachers,
        slotRooms: filteredSlotRooms,
      }, `${className} 수업 정보 변경`);
    } else {
      scenario.addScenarioClass({
        className,
        subject: 'english',
        teacher,
        mainTeacher: teacher,
        room,
        schedule: sortedSchedule,
        slotTeachers: filteredSlotTeachers,
        slotRooms: filteredSlotRooms,
      });
    }

    onClose();
  };

  const handleDelete = () => {
    if (!isEditMode || !existingClass) return;
    const enrollmentCount = Object.keys(scenario.scenarioEnrollments[existingClass.className] || {}).length;
    if (enrollmentCount > 0) {
      if (!confirm(`⚠️ "${existingClass.className}" 수업에 ${enrollmentCount}명의 학생이 배정되어 있습니다.\n\n정말 삭제하시겠습니까?`)) return;
    } else {
      if (!confirm(`"${existingClass.className}" 수업을 삭제하시겠습니까?`)) return;
    }
    scenario.deleteScenarioClass(classId!);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-purple-600">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-white" />
            <span className="font-bold text-white">
              {isEditMode ? '수업 편집' : '새 수업 추가'}
            </span>
            <span className="text-xs text-purple-200">(시뮬레이션)</span>
          </div>
          <button onClick={onClose} className="p-1.5 text-purple-200 hover:text-white hover:bg-purple-500 rounded transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">수업 이름 *</label>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="예: DP3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">담당 강사</label>
              <select
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              >
                <option value="">선택 안함</option>
                {teachers.map((t) => (
                  <option key={t.name} value={t.englishName || t.name}>
                    {t.englishName ? `${t.englishName} (${t.name})` : t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">강의실</label>
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="예: 201호"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">스케줄 선택 *</label>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="max-h-56 overflow-y-auto">
                <div className="grid bg-gray-50 border-b border-gray-200 sticky top-0 z-10" style={{ gridTemplateColumns: `32px repeat(${EN_WEEKDAYS.length}, 1fr)` }}>
                  <div className="p-1 text-center text-[10px] font-semibold text-gray-400 border-r border-gray-200"></div>
                  {EN_WEEKDAYS.map((day) => (
                    <div key={day} className="p-1 text-center text-xs font-semibold text-gray-600 border-r border-gray-200 last:border-r-0">{day}</div>
                  ))}
                </div>

                {EN_PERIODS.map((period) => (
                  <div key={period.id} className="grid border-b border-gray-100 last:border-b-0" style={{ gridTemplateColumns: `32px repeat(${EN_WEEKDAYS.length}, 1fr)` }}>
                    <div className="p-1 text-center text-[10px] text-gray-400 bg-gray-50 flex items-center justify-center border-r border-gray-200">
                      {period.id}
                    </div>
                    {EN_WEEKDAYS.map((day) => {
                      const key = `${day}-${period.id}`;
                      const isSelected = selectedSlots.has(key);
                      const slotTeacher = slotTeachers[key];
                      const displayTeacher = slotTeacher || teacher;

                      let displayName = '';
                      if (isSelected) {
                        displayName = slotTeacher || teacher || '✓';
                      }

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleSlot(day, period.id)}
                          className={`p-1 transition-colors text-[10px] min-h-[24px] border-r border-gray-200 last:border-r-0 ${
                            isSelected
                              ? 'bg-purple-500 text-white hover:bg-purple-600 font-semibold'
                              : 'bg-white text-gray-300 hover:bg-purple-50'
                          }`}
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
                <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                  <p className="text-[10px] text-gray-500 px-2 py-1 border-b border-gray-200 bg-blue-50 font-semibold">교시별 부담임 (비워두면 담임)</p>
                  {(() => {
                    const selectedPeriods = new Set<string>();
                    selectedSlots.forEach(key => selectedPeriods.add(key.split('-')[1]));
                    return Array.from(selectedPeriods).sort((a, b) => Number(a) - Number(b)).map(periodId => (
                      <div key={periodId} className="grid border-b border-gray-100 last:border-b-0" style={{ gridTemplateColumns: `32px repeat(${EN_WEEKDAYS.length}, 1fr)` }}>
                        <div className="p-1 text-center text-[10px] text-gray-400 bg-gray-50 flex items-center justify-center border-r border-gray-200">{periodId}</div>
                        {EN_WEEKDAYS.map((day) => {
                          const key = `${day}-${periodId}`;
                          const isSelected = selectedSlots.has(key);
                          if (!isSelected) return <div key={key} className="bg-gray-50 min-h-[28px] border-r border-gray-200 last:border-r-0" />;
                          return (
                            <div key={key} className="p-0.5 border-r border-gray-200 last:border-r-0">
                              <select
                                value={slotTeachers[key] || ''}
                                onChange={(e) => setSlotTeacher(key, e.target.value)}
                                className="w-full h-full px-1 py-0.5 border border-gray-200 rounded text-[10px] focus:ring-1 focus:ring-purple-500 outline-none bg-white"
                              >
                                <option value="">{teacher || '담임'}</option>
                                {teachers.map(t => (
                                  <option key={t.name} value={t.englishName || t.name}>
                                    {t.englishName ? `${t.englishName} (${t.name})` : t.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    ));
                  })()}
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                  <p className="text-[10px] text-gray-500 px-2 py-1 border-b border-gray-200 bg-purple-50 font-semibold">교시별 강의실 (비워두면 기본 강의실)</p>
                  {(() => {
                    const selectedPeriods = new Set<string>();
                    selectedSlots.forEach(key => selectedPeriods.add(key.split('-')[1]));
                    return Array.from(selectedPeriods).sort((a, b) => Number(a) - Number(b)).map(periodId => (
                      <div key={periodId} className="grid border-b border-gray-100 last:border-b-0" style={{ gridTemplateColumns: `32px repeat(${EN_WEEKDAYS.length}, 1fr)` }}>
                        <div className="p-1 text-center text-[10px] text-gray-400 bg-gray-50 flex items-center justify-center border-r border-gray-200">{periodId}</div>
                        {EN_WEEKDAYS.map((day) => {
                          const key = `${day}-${periodId}`;
                          const isSelected = selectedSlots.has(key);
                          if (!isSelected) return <div key={key} className="bg-gray-50 min-h-[28px] border-r border-gray-200 last:border-r-0" />;
                          return (
                            <div key={key} className="p-0.5 border-r border-gray-200 last:border-r-0">
                              <input
                                type="text"
                                value={slotRooms[key] || ''}
                                onChange={(e) => setSlotRoom(key, e.target.value)}
                                placeholder={room || '-'}
                                className="w-full h-full px-1 py-0.5 border border-gray-200 rounded text-[10px] focus:ring-1 focus:ring-purple-500 outline-none bg-white"
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

        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            {isEditMode && (
              <button onClick={handleDelete} className="flex items-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm">
                <Trash2 className="w-4 h-4" />
                삭제
              </button>
            )}
            <div className={`flex items-center gap-2 ${!isEditMode ? 'ml-auto' : ''}`}>
              <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors text-sm">
                취소
              </button>
              <button onClick={handleSave} className="flex items-center gap-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm">
                <Save className="w-4 h-4" />
                {isEditMode ? '저장' : '추가'}
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500 text-center">
            * 변경사항은 시뮬레이션에만 반영됩니다. "실제 반영" 시 저장됩니다.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SimulationClassModal;
