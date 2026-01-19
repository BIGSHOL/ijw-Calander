import React from 'react';
import { UnifiedStudent, ClassHistoryEntry } from '../../../types';
import { Clock, Calendar, User } from 'lucide-react';
import { SUBJECT_COLORS, SUBJECT_LABELS } from '../../../utils/styleUtils';

interface ClassHistoryTabProps {
  student: UnifiedStudent;
}

const ClassHistoryTab: React.FC<ClassHistoryTabProps> = ({ student }) => {
  const classHistory = student.classHistory || [];

  // 수강 이력을 최신순으로 정렬 (startDate 기준)
  const sortedHistory = [...classHistory].sort((a, b) => {
    return b.startDate.localeCompare(a.startDate);
  });

  // 날짜 포맷팅
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  // 수강 기간 계산
  const calculateDuration = (startDate: string, endDate?: string) => {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30);

    if (diffMonths >= 1) {
      return `${diffMonths}개월`;
    } else {
      return `${diffDays}일`;
    }
  };

  if (classHistory.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="text-gray-500 text-sm">수강 이력이 없습니다</p>
        <p className="text-gray-400 text-xs mt-1">
          수업을 배정하면 이력이 자동으로 기록됩니다
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-[#081429]">수강 이력</h3>
        <span className="text-xs text-[#373d41]">
          ({classHistory.length}건)
        </span>
      </div>

      {/* 타임라인 */}
      <div className="space-y-3">
        {sortedHistory.map((entry, index) => {
          const subjectColor = SUBJECT_COLORS[entry.subject] || SUBJECT_COLORS.other;
          const isActive = !entry.endDate; // endDate가 없으면 현재 수강 중

          return (
            <div
              key={index}
              className={`relative pl-6 pb-3 ${index !== sortedHistory.length - 1 ? 'border-l-2 border-gray-200' : ''}`}
            >
              {/* 타임라인 점 */}
              <div
                className={`absolute left-0 top-1 w-3 h-3 rounded-full border-2 ${
                  isActive
                    ? 'bg-emerald-500 border-emerald-600 animate-pulse'
                    : 'bg-white border-gray-300'
                }`}
                style={{
                  marginLeft: '-7px'
                }}
              />

              {/* 카드 */}
              <div
                className={`bg-white border rounded-lg p-3 ${
                  isActive
                    ? 'border-emerald-300 bg-emerald-50/30'
                    : 'border-gray-200'
                }`}
              >
                {/* 헤더: 수업명 + 과목 뱃지 */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-sm text-[#081429]">
                    {entry.className}
                  </span>
                  <span
                    className="text-micro px-1.5 py-0.5 rounded font-bold"
                    style={{
                      backgroundColor: subjectColor.bg,
                      color: subjectColor.text,
                    }}
                  >
                    {SUBJECT_LABELS[entry.subject]}
                  </span>
                  {isActive && (
                    <span className="text-micro px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-700">
                      수강중
                    </span>
                  )}
                </div>

                {/* 상세 정보 */}
                <div className="space-y-1">
                  {/* 강사 */}
                  {entry.teacher && (
                    <div className="flex items-center gap-1.5 text-xxs text-[#373d41]">
                      <User className="w-3 h-3" />
                      <span>{entry.teacher}</span>
                    </div>
                  )}

                  {/* 수강 기간 */}
                  <div className="flex items-center gap-1.5 text-xxs text-[#373d41]">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {formatDate(entry.startDate)}
                      {entry.endDate && ` ~ ${formatDate(entry.endDate)}`}
                      {!entry.endDate && ' ~ 현재'}
                    </span>
                    <span className="text-gray-400">
                      ({calculateDuration(entry.startDate, entry.endDate)})
                    </span>
                  </div>

                  {/* 이동 사유 */}
                  {entry.reason && (
                    <div className="text-xxs text-gray-500 mt-1">
                      사유: {
                        entry.reason === 'levelup' ? '레벨업' :
                        entry.reason === 'schedule_change' ? '시간 변경' :
                        entry.reason === 'teacher_change' ? '강사 변경' :
                        '기타'
                      }
                    </div>
                  )}

                  {/* 메모 */}
                  {entry.note && (
                    <div className="text-xxs text-gray-500 mt-1 bg-gray-50 rounded px-2 py-1">
                      {entry.note}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ClassHistoryTab;
