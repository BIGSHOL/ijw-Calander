import React from 'react';
import { Users, Clock, BookOpen, User } from 'lucide-react';
import { ClassInfo } from '../../hooks/useClasses';
import { SUBJECT_COLORS, SUBJECT_LABELS, SubjectType } from '../../utils/styleUtils';
import { formatScheduleCompact, SubjectForSchedule } from '../Timetable/constants';
import { useScheduleDisplaySettings } from '../../hooks/useScheduleDisplaySettings';

interface ClassCardProps {
  classInfo: ClassInfo;
  onClick: () => void;
}

const ClassCard: React.FC<ClassCardProps> = ({ classInfo, onClick }) => {
  const { className, teacher, subject, schedule, studentCount } = classInfo;

  // 스케줄 표기 설정 가져오기
  const { data: displaySettings } = useScheduleDisplaySettings();

  // 과목 색상 (전역 스타일 시스템 사용)
  const subjectColors = SUBJECT_COLORS[subject as SubjectType] || SUBJECT_COLORS.math;
  const subjectLabel = SUBJECT_LABELS[subject as SubjectType] || subject;

  // 스케줄 텍스트 포맷팅 ("월 7, 월 8, 목 7, 목 8" -> "월목 4교시" 또는 "월목 20:10~22:00")
  const subjectForSchedule: SubjectForSchedule = subject === 'english' ? 'english' : 'math';
  const showTime = displaySettings?.[subjectForSchedule] === 'time';
  const scheduleText = formatScheduleCompact(schedule, subjectForSchedule, showTime);

  return (
    <div
      onClick={onClick}
      className="bg-white border-2 rounded-xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group"
      style={{
        borderColor: subjectColors.border,
        backgroundColor: subjectColors.light
      }}
    >
      {/* 제목 및 과목 배지 */}
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-[#081429] font-bold text-base flex-1 pr-2 leading-tight">
          {className}
        </h3>
        <span
          className="px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm shrink-0"
          style={{
            backgroundColor: subjectColors.bg,
            color: subjectColors.text,
            border: `1px solid ${subjectColors.border}`
          }}
        >
          {subjectLabel}
        </span>
      </div>

      {/* 강사 정보 */}
      <div className="flex items-center gap-2 mb-2 text-[#373d41] text-sm">
        <User className="w-4 h-4 opacity-60" />
        <span>{teacher || '미정'}</span>
      </div>

      {/* 학생 수 */}
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-4 h-4 text-[#373d41] opacity-60" />
        <span
          className="font-bold text-sm px-2 py-0.5 rounded"
          style={{
            backgroundColor: subjectColors.bg,
            color: subjectColors.text
          }}
        >
          {studentCount || 0}명
        </span>
      </div>

      {/* 스케줄 */}
      <div className="flex items-start gap-2 text-[#373d41] text-sm mb-3">
        <Clock className="w-4 h-4 mt-0.5 flex-shrink-0 opacity-60" />
        <span className="line-clamp-2 text-xs">{scheduleText}</span>
      </div>

      {/* 하단 바 */}
      <div className="pt-3 border-t" style={{ borderColor: `${subjectColors.border}40` }}>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-[#373d41] opacity-70">
            <BookOpen className="w-3 h-3" />
            {subjectLabel}
          </span>
          <span
            className="font-semibold group-hover:underline transition-colors"
            style={{ color: subjectColors.bg }}
          >
            자세히 보기 →
          </span>
        </div>
      </div>
    </div>
  );
};

export default ClassCard;
