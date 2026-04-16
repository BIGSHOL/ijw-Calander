/**
 * TeacherHandoverModal
 *
 * 특정 수업의 담임을 지정일부터 다른 강사로 인수인계하는 모달.
 *
 * 핵심 동작:
 * - 인수일 D 기준 enrollment 찢기: 기존 담임 endDate=D-1, 새 담임 startDate=D
 * - 적용일이 오늘 또는 과거면 즉시 실행, 미래면 예약 (classes/{id}.pendingTeacher*)
 * - 예약된 인수인계는 TimetableManager의 auto-apply useEffect에서 매 마운트 시 체크
 *
 * 학생 입장 UX: 같은 className이지만 "지난 수업 (권나현)" + "수강 중 (김선생)"으로 자연스럽게 분리 표시
 *              ← CoursesTab 그룹핑 키에 staffId 포함되어 있어야 올바르게 분리됨 (선행 작업 완료)
 */

import React, { useMemo, useState } from 'react';
import { X, UserCheck, AlertCircle, Calendar } from 'lucide-react';
import { useTeachers } from '../../hooks/useFirebaseQueries';
import { useHandoverTeacher } from '../../hooks/useClassMutations';
import { getTodayKST } from '../../utils/dateUtils';
import { SubjectType } from '../../utils/styleUtils';
import { useEscapeClose } from '../../hooks/useEscapeClose';

interface TeacherHandoverModalProps {
  classId: string;
  className: string;
  subject: SubjectType;
  currentTeacher: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const TeacherHandoverModal: React.FC<TeacherHandoverModalProps> = ({
  classId,
  className,
  subject,
  currentTeacher,
  onClose,
  onSuccess,
}) => {
  useEscapeClose(onClose);
  const todayStr = getTodayKST();
  const tomorrowStr = useMemo(() => {
    const d = new Date(todayStr);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, [todayStr]);

  const { data: teachers = [] } = useTeachers();
  const handoverMutation = useHandoverTeacher();

  const [newTeacher, setNewTeacher] = useState<string>('');
  const [effectiveDate, setEffectiveDate] = useState<string>(tomorrowStr);
  const [reason, setReason] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // 표시용 강사 목록: isHidden 제외, 현재 담임 제외
  const selectableTeachers = useMemo(() => {
    return teachers.filter(t => !t.isHidden && t.name !== currentTeacher);
  }, [teachers, currentTeacher]);

  const isImmediate = effectiveDate <= todayStr;

  const handleSubmit = async () => {
    setError(null);
    if (!newTeacher) {
      setError('새 담임 강사를 선택해주세요.');
      return;
    }
    if (!effectiveDate) {
      setError('적용일을 선택해주세요.');
      return;
    }

    // 즉시 실행 시 확인 문구
    if (isImmediate) {
      const confirmMsg = `"${className}" 수업의 담임을 지금 바로 ${currentTeacher} → ${newTeacher}로 교체합니다.\n` +
        `${effectiveDate} 이전 수강 이력(권나현 시절)은 "지난 수업"에 남고, ${effectiveDate}부터 새 담임으로 수강 중이 됩니다.\n\n진행할까요?`;
      if (!window.confirm(confirmMsg)) return;
    }

    try {
      await handoverMutation.mutateAsync({
        classId,
        subject,
        className,
        currentTeacher,
        newTeacher,
        effectiveDate,
        reason: reason.trim() || undefined,
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || '인수인계 처리에 실패했습니다.');
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110]"
      onClick={onClose}
    >
      <div
        className="bg-white w-[460px] max-w-[92vw] rounded-sm shadow-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-primary text-white px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            <h2 className="text-sm font-bold">강사 인수인계</h2>
          </div>
          <button
            onClick={onClose}
            disabled={handoverMutation.isPending}
            className="text-white hover:text-gray-200 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 bg-gray-50 space-y-3">
          {/* 수업 정보 */}
          <div className="bg-white border border-gray-200 rounded-sm p-2.5">
            <div className="text-xxs text-gray-500 mb-1">대상 수업</div>
            <div className="text-sm font-bold text-primary">{className}</div>
            <div className="text-xs text-gray-600 mt-1">
              현재 담임: <span className="font-semibold text-gray-800">{currentTeacher}</span>
            </div>
          </div>

          {/* 새 담임 선택 */}
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">
              새 담임 <span className="text-red-500">*</span>
            </label>
            <select
              value={newTeacher}
              onChange={(e) => setNewTeacher(e.target.value)}
              disabled={handoverMutation.isPending}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-sm focus:outline-none focus:border-primary"
            >
              <option value="">— 강사 선택 —</option>
              {selectableTeachers.map(t => (
                <option key={t.id} value={t.name}>
                  {t.name}{t.englishName ? ` (${t.englishName})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 적용일 */}
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">
              <Calendar className="inline w-3 h-3 mr-1" />
              적용일 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={effectiveDate}
              min={todayStr}
              onChange={(e) => setEffectiveDate(e.target.value)}
              disabled={handoverMutation.isPending}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-sm focus:outline-none focus:border-primary"
            />
            <div className="text-xxs text-gray-500 mt-1">
              {isImmediate
                ? `⚡ 오늘 즉시 적용 — 기존 담임 enrollment가 ${effectiveDate} 전날까지로 종료되고 바로 새 담임으로 수강이 시작됩니다.`
                : `📅 ${effectiveDate}부터 새 담임으로 전환 예약 — 해당 날짜 도달 시 앱 로드 시점에 자동 적용됩니다.`}
            </div>
          </div>

          {/* 사유 메모 (옵션) */}
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">
              사유 메모 <span className="text-gray-400 text-xxs font-normal">(옵션)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={handoverMutation.isPending}
              placeholder="예: 권나현 선생님 퇴사"
              rows={2}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-sm focus:outline-none focus:border-primary resize-none"
            />
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-sm p-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-red-700">{error}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 bg-white border-t border-gray-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={handoverMutation.isPending}
            className="px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={handoverMutation.isPending || !newTeacher}
            className="px-3 py-1 text-xs font-semibold bg-accent hover:bg-[#e5a60f] text-primary disabled:opacity-50 transition-colors flex items-center gap-1"
          >
            {handoverMutation.isPending ? (
              <>
                <div className="animate-spin w-3 h-3 border-2 border-primary border-t-transparent rounded-full" />
                처리 중...
              </>
            ) : isImmediate ? (
              '즉시 적용'
            ) : (
              '예약'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeacherHandoverModal;
