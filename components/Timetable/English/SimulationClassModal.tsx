/**
 * SimulationClassModal - 시뮬레이션 모드 수업 편집 모달
 *
 * 시뮬레이션 모드에서 수업 추가/편집/삭제
 * - 변경사항은 scenarioClasses에만 반영
 * - "실제 반영" 시 classes collection에 저장
 */

import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2, Calendar, Clock, User, Save } from 'lucide-react';
import { useScenario, ScenarioClass } from './context/SimulationContext';
import { EN_WEEKDAYS, EN_PERIODS } from './englishUtils';

interface SimulationClassModalProps {
  classId?: string;  // 편집 모드 시 classId, 없으면 추가 모드
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

  // 편집 모드: 기존 수업 정보 로드
  const existingClass = isEditMode ? scenario.getScenarioClass(classId) : undefined;

  // Form state
  const [className, setClassName] = useState(existingClass?.className || '');
  const [teacher, setTeacher] = useState(existingClass?.teacher || existingClass?.mainTeacher || '');
  const [schedule, setSchedule] = useState<{ day: string; periodId: string }[]>(
    existingClass?.schedule?.map(s => ({ day: s.day, periodId: s.periodId })) || []
  );

  // 새 스케줄 추가용 상태
  const [newDay, setNewDay] = useState('');
  const [newPeriod, setNewPeriod] = useState('');

  // 기존 수업들의 스케줄 (충돌 검사용)
  const existingSchedules = useMemo(() => {
    const schedules: { className: string; day: string; periodId: string; teacher: string }[] = [];
    Object.values(scenario.scenarioClasses).forEach(cls => {
      if (cls.id === classId) return; // 현재 편집 중인 수업 제외
      cls.schedule?.forEach(s => {
        schedules.push({
          className: cls.className,
          day: s.day,
          periodId: s.periodId,
          teacher: cls.teacher || cls.mainTeacher || '',
        });
      });
    });
    return schedules;
  }, [scenario.scenarioClasses, classId]);

  // 스케줄 충돌 검사
  const checkScheduleConflict = (day: string, periodId: string, teacherToCheck: string) => {
    return existingSchedules.find(
      s => s.day === day && s.periodId === periodId && s.teacher === teacherToCheck
    );
  };

  const handleAddSchedule = () => {
    if (!newDay || !newPeriod) {
      alert('요일과 교시를 선택해주세요.');
      return;
    }

    // 이미 추가된 스케줄인지 확인
    const alreadyAdded = schedule.some(s => s.day === newDay && s.periodId === newPeriod);
    if (alreadyAdded) {
      alert('이미 추가된 시간입니다.');
      return;
    }

    // 같은 강사의 다른 수업과 충돌 확인
    if (teacher) {
      const conflict = checkScheduleConflict(newDay, newPeriod, teacher);
      if (conflict) {
        alert(`⚠️ 시간표 충돌!\n\n${teacher} 선생님의 ${conflict.className} 수업이\n${newDay}요일 ${newPeriod}교시에 이미 있습니다.`);
        return;
      }
    }

    setSchedule([...schedule, { day: newDay, periodId: newPeriod }]);
    setNewDay('');
    setNewPeriod('');
  };

  const handleRemoveSchedule = (index: number) => {
    setSchedule(schedule.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!className.trim()) {
      alert('수업 이름을 입력해주세요.');
      return;
    }

    if (schedule.length === 0) {
      alert('스케줄을 최소 1개 이상 추가해주세요.');
      return;
    }

    // 스케줄 정렬 (요일 → 교시)
    const sortedSchedule = [...schedule].sort((a, b) => {
      const dayOrder = EN_WEEKDAYS.indexOf(a.day as any) - EN_WEEKDAYS.indexOf(b.day as any);
      if (dayOrder !== 0) return dayOrder;
      return parseInt(a.periodId) - parseInt(b.periodId);
    });

    if (isEditMode && existingClass) {
      // 편집 모드: 기존 수업 업데이트
      const changes: string[] = [];
      if (existingClass.className !== className) {
        changes.push(`이름: ${existingClass.className} → ${className}`);
      }
      if ((existingClass.teacher || existingClass.mainTeacher) !== teacher) {
        changes.push(`강사: ${existingClass.teacher || existingClass.mainTeacher || '(없음)'} → ${teacher || '(없음)'}`);
      }
      const oldScheduleStr = existingClass.schedule?.map(s => `${s.day}${s.periodId}`).sort().join(',');
      const newScheduleStr = sortedSchedule.map(s => `${s.day}${s.periodId}`).sort().join(',');
      if (oldScheduleStr !== newScheduleStr) {
        changes.push('스케줄 변경');
      }

      if (changes.length === 0) {
        alert('변경된 내용이 없습니다.');
        return;
      }

      // 이름 변경 시 renameScenarioClass 사용 (enrollments도 같이 업데이트)
      if (existingClass.className !== className) {
        const success = scenario.renameScenarioClass(existingClass.className, className);
        if (!success) return; // 충돌 등으로 실패
      }

      // 나머지 정보 업데이트
      scenario.updateScenarioClassWithHistory(classId!, {
        teacher,
        mainTeacher: teacher,
        schedule: sortedSchedule,
      }, `${className} 수업 정보 변경 (${changes.join(', ')})`);

    } else {
      // 추가 모드: 새 수업 생성
      scenario.addScenarioClass({
        className,
        subject: 'english',
        teacher,
        mainTeacher: teacher,
        schedule: sortedSchedule,
      });
    }

    onClose();
  };

  const handleDelete = () => {
    if (!isEditMode || !existingClass) return;

    const enrollmentCount = Object.keys(scenario.scenarioEnrollments[existingClass.className] || {}).length;

    if (enrollmentCount > 0) {
      if (!confirm(`⚠️ "${existingClass.className}" 수업에 ${enrollmentCount}명의 학생이 배정되어 있습니다.\n\n정말 삭제하시겠습니까? (학생 배정도 함께 삭제됩니다)`)) {
        return;
      }
    } else {
      if (!confirm(`"${existingClass.className}" 수업을 삭제하시겠습니까?`)) {
        return;
      }
    }

    scenario.deleteScenarioClass(classId!);
    onClose();
  };

  const getPeriodLabel = (periodId: string) => {
    const period = EN_PERIODS.find(p => p.id === periodId);
    return period ? period.label : `${periodId}교시`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-purple-600">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-white" />
            <span className="font-bold text-white">
              {isEditMode ? '수업 편집' : '새 수업 추가'}
            </span>
            <span className="text-xs text-purple-200">(시뮬레이션)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-purple-200 hover:text-white hover:bg-purple-500 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 수업 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              수업 이름 *
            </label>
            <input
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="예: DP3, LE2a"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* 담당 강사 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User className="w-4 h-4 inline mr-1" />
              담당 강사
            </label>
            <select
              value={teacher}
              onChange={(e) => setTeacher(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">선택 안함</option>
              {teachers.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.englishName ? `${t.englishName} (${t.name})` : t.name}
                </option>
              ))}
            </select>
          </div>

          {/* 스케줄 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              스케줄 *
            </label>

            {/* 현재 스케줄 목록 */}
            {schedule.length > 0 && (
              <div className="mb-3 space-y-1">
                {schedule.map((s, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between px-3 py-2 bg-purple-50 rounded-lg"
                  >
                    <span className="text-sm text-purple-700">
                      {s.day}요일 {getPeriodLabel(s.periodId)}
                    </span>
                    <button
                      onClick={() => handleRemoveSchedule(index)}
                      className="p-1 text-red-500 hover:bg-red-100 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 스케줄 추가 */}
            <div className="flex items-center gap-2">
              <select
                value={newDay}
                onChange={(e) => setNewDay(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">요일</option>
                {EN_WEEKDAYS.map((day) => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
              <select
                value={newPeriod}
                onChange={(e) => setNewPeriod(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">교시</option>
                {EN_PERIODS.map((period) => (
                  <option key={period.id} value={period.id}>{period.label}</option>
                ))}
              </select>
              <button
                onClick={handleAddSchedule}
                className="px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            {isEditMode && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                삭제
              </button>
            )}
            <div className={`flex items-center gap-2 ${!isEditMode ? 'ml-auto' : ''}`}>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
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
