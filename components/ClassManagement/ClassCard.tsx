import React from 'react';
import { Users, Clock, BookOpen, User } from 'lucide-react';
import { ClassInfo } from '../../hooks/useClasses';

interface ClassCardProps {
  classInfo: ClassInfo;
  onClick: () => void;
}

const ClassCard: React.FC<ClassCardProps> = ({ classInfo, onClick }) => {
  const { className, teacher, subject, schedule, studentCount } = classInfo;

  // 과목별 배경색
  const subjectBgColor = subject === 'math'
    ? 'bg-[#1a2845]'  // 연한 곤색 (수학)
    : 'bg-[#2a3f5f]'; // 파란빛 곤색 (영어)

  // 스케줄 텍스트 포맷팅
  const scheduleText = schedule && schedule.length > 0
    ? schedule.slice(0, 3).join(', ') + (schedule.length > 3 ? '...' : '')
    : '시간 미정';

  return (
    <div
      onClick={onClick}
      className={`
        bg-white border border-[#081429] rounded-lg p-6
        hover:border-[#fdb813] hover:border-2 hover:shadow-md
        transition-all cursor-pointer
        ${subjectBgColor} bg-opacity-5
      `}
    >
      {/* 제목 및 과목 배지 */}
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-[#081429] font-bold text-lg flex-1">
          {className}
        </h3>
        <span
          className={`
            px-2 py-1 rounded text-xs font-semibold
            ${subject === 'math'
              ? 'bg-[#081429] text-white'
              : 'bg-[#081429] text-white'}
          `}
        >
          {subject === 'math' ? '수학' : '영어'}
        </span>
      </div>

      {/* 강사 정보 */}
      <div className="flex items-center gap-2 mb-3 text-[#373d41] text-sm">
        <User className="w-4 h-4" />
        <span>강사: {teacher || '미정'}</span>
      </div>

      {/* 학생 수 */}
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-[#373d41]" />
        <span className="text-[#fdb813] font-semibold text-base">
          {studentCount || 0}명
        </span>
      </div>

      {/* 스케줄 */}
      <div className="flex items-start gap-2 text-[#373d41] text-sm">
        <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span className="line-clamp-2">{scheduleText}</span>
      </div>

      {/* 호버 효과용 하단 바 */}
      <div className="mt-4 pt-4 border-t border-[#081429] border-opacity-10">
        <div className="flex items-center justify-between text-xs text-[#373d41]">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3 h-3" />
            {subject === 'math' ? '수학 수업' : '영어 수업'}
          </span>
          <span className="text-[#fdb813] font-medium hover:underline">
            자세히 보기 →
          </span>
        </div>
      </div>
    </div>
  );
};

export default ClassCard;
