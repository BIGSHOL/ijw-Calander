import React from 'react';
import { ClassInfo } from '../../hooks/useClasses';
import { Inbox, ChevronRight, Users, FileText, Clock } from 'lucide-react';
import { SUBJECT_COLORS, SUBJECT_LABELS, SubjectType } from '../../utils/styleUtils';
import { SubjectForSchedule, MATH_PERIOD_INFO, ENGLISH_PERIOD_INFO, MATH_GROUP_TIMES, WEEKEND_PERIOD_INFO } from '../Timetable/constants';
import { useTeachers } from '../../hooks/useFirebaseQueries';
import { useStaff } from '../../hooks/useStaff';
import { isTeacherMatch, isSlotTeacherMatch } from '../../utils/teacherUtils';

// 요일별 색상 정의
const DAY_COLORS: Record<string, { bg: string; text: string }> = {
  '월': { bg: '#fef3c7', text: '#92400e' },  // amber
  '화': { bg: '#fce7f3', text: '#9d174d' },  // pink
  '수': { bg: '#dbeafe', text: '#1e40af' },  // blue
  '목': { bg: '#d1fae5', text: '#065f46' },  // green
  '금': { bg: '#e0e7ff', text: '#3730a3' },  // indigo
  '토': { bg: '#fee2e2', text: '#991b1b' },  // red
  '일': { bg: '#f3e8ff', text: '#6b21a8' },  // purple
};

interface ScheduleBadgeProps {
  schedule?: string[];
  subject: SubjectForSchedule;
}

/**
 * 스케줄을 시각적으로 표시하는 컴포넌트
 * 요일은 색상 배지로, 교시는 굵게 표시
 */
const ScheduleBadge: React.FC<ScheduleBadgeProps> = ({ schedule, subject }) => {
  if (!schedule || schedule.length === 0) {
    return <span className="text-gray-400 italic">시간 미정</span>;
  }

  // 요일에 따라 적절한 period info 선택
  const getPeriodInfoForDay = (day: string) => {
    if (day === '토' || day === '일') {
      return WEEKEND_PERIOD_INFO;
    }
    return subject === 'english' ? ENGLISH_PERIOD_INFO : MATH_PERIOD_INFO;
  };

  const dayOrder = ['월', '화', '수', '목', '금', '토', '일'];

  // 요일별로 periodId 수집
  const dayPeriods: Map<string, string[]> = new Map();

  for (const item of schedule) {
    const parts = item.split(' ');
    const day = parts[0];
    const periodId = parts[1] || '';
    const periodInfo = getPeriodInfoForDay(day);
    if (!periodId || !periodInfo[periodId]) continue;

    if (!dayPeriods.has(day)) {
      dayPeriods.set(day, []);
    }
    dayPeriods.get(day)!.push(periodId);
  }

  if (dayPeriods.size === 0) {
    return <span className="text-gray-400 italic">시간 미정</span>;
  }

  // 요일별로 라벨 생성
  const entries: Array<{ days: string[]; label: string }> = [];
  const dayLabels: Map<string, string> = new Map();

  for (const [day, periods] of dayPeriods) {
    const sortedPeriods = periods.sort((a, b) => Number(a) - Number(b));
    const isWeekend = day === '토' || day === '일';

    let label: string;
    if (isWeekend) {
      label = formatWeekendLabel(sortedPeriods);
    } else if (subject === 'english') {
      label = formatEnglishLabel(sortedPeriods);
    } else {
      label = formatMathLabel(sortedPeriods);
    }
    dayLabels.set(day, label);
  }

  // 같은 라벨을 가진 요일끼리 그룹화
  const labelToDays: Map<string, string[]> = new Map();

  for (const [day, label] of dayLabels) {
    if (!labelToDays.has(label)) {
      labelToDays.set(label, []);
    }
    labelToDays.get(label)!.push(day);
  }

  for (const [label, days] of labelToDays) {
    days.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
    entries.push({ days, label });
  }

  // 요일 순서대로 정렬
  entries.sort((a, b) => dayOrder.indexOf(a.days[0]) - dayOrder.indexOf(b.days[0]));

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {entries.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-0.5">
          {/* 요일 배지들 */}
          <div className="flex">
            {entry.days.map((day, dayIdx) => {
              const colors = DAY_COLORS[day] || { bg: '#f3f4f6', text: '#374151' };
              return (
                <span
                  key={day}
                  className={`px-1.5 py-0.5 text-[10px] font-bold ${dayIdx === 0 ? 'rounded-l' : ''} ${dayIdx === entry.days.length - 1 ? 'rounded-r' : ''}`}
                  style={{ backgroundColor: colors.bg, color: colors.text }}
                >
                  {day}
                </span>
              );
            })}
          </div>
          {/* 교시/시간 */}
          <span className="text-xs font-semibold text-gray-700">
            {entry.label}
          </span>
          {/* 구분자 */}
          {idx < entries.length - 1 && (
            <span className="text-gray-300 mx-0.5">/</span>
          )}
        </div>
      ))}
    </div>
  );
};

// 수학 교시 라벨 포맷팅
function formatMathLabel(periods: string[]): string {
  const completeGroups: number[] = [];
  const usedPeriods = new Set<string>();

  for (let group = 1; group <= 4; group++) {
    const first = String(group * 2 - 1);
    const second = String(group * 2);

    if (periods.includes(first) && periods.includes(second)) {
      completeGroups.push(group);
      usedPeriods.add(first);
      usedPeriods.add(second);
    }
  }

  const allPeriodsUsed = periods.every(p => usedPeriods.has(p));

  if (allPeriodsUsed && completeGroups.length > 0) {
    return completeGroups.map(g => `${g}교시`).join(', ');
  } else {
    const times = periods.map(p => MATH_PERIOD_INFO[p]).filter(Boolean);
    if (times.length === 0) return '시간 미정';

    const startTime = times[0].startTime;
    const endTime = times[times.length - 1].endTime;
    return `${startTime}~${endTime}`;
  }
}

// 주말 교시 라벨 포맷팅 (9:00 시작, 1시간 단위)
function formatWeekendLabel(periods: string[]): string {
  if (periods.length === 0) return '시간 미정';

  // 시간순으로 정렬
  const times = periods
    .map(p => WEEKEND_PERIOD_INFO[p])
    .filter(Boolean)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (times.length === 0) return '시간 미정';

  const startTime = times[0].startTime;
  const endTime = times[times.length - 1].endTime;
  return `${startTime}~${endTime}`;
}

// 영어 교시 라벨 포맷팅
function formatEnglishLabel(periods: string[]): string {
  if (periods.length === 0) return '시간 미정';

  const nums = periods.map(Number).sort((a, b) => a - b);

  if (nums.length === 1) {
    return `${nums[0]}교시`;
  }

  const isConsecutive = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);

  if (isConsecutive) {
    return `${nums[0]}~${nums[nums.length - 1]}교시`;
  } else {
    return nums.map(n => `${n}교시`).join(', ');
  }
}

interface ClassListProps {
  classes: ClassInfo[];
  onClassClick: (classInfo: ClassInfo) => void;
  isLoading?: boolean;
  currentTeacherFilter?: string; // 현재 필터링된 선생님 (있으면 해당 선생님 스케줄만 표시)
}

const ClassList: React.FC<ClassListProps> = ({ classes, onClassClick, isLoading, currentTeacherFilter }) => {
  // 강사 데이터 가져오기 (영어 이름 매칭용)
  const { data: teachersData } = useTeachers();
  const { staff } = useStaff();

  // Helper to display teacher name as "한글(영어이름)"
  const getTeacherDisplayName = (teacherName: string) => {
    if (!teacherName) return '-';
    const staffMember = teachersData?.find(t => t.name === teacherName || t.englishName === teacherName);
    if (staffMember && staffMember.englishName) {
      return `${staffMember.name}(${staffMember.englishName})`;
    }
    return teacherName;
  };

  // 선생님 이름 비교 (공통 함수 + displayName 형식 지원)
  const matchTeacher = (teacherName: string, filterValue: string): boolean => {
    if (!teacherName || !filterValue) return false;

    // 공통 함수로 기본 매칭
    if (isTeacherMatch(teacherName, filterValue, undefined, staff || [])) return true;

    // ClassList 전용: "한글(영어)" 형식과 비교
    const staffMember = staff?.find(s => s.name === teacherName || s.englishName === teacherName);
    if (staffMember && staffMember.englishName) {
      const displayName = `${staffMember.name}(${staffMember.englishName})`;
      if (displayName === filterValue) return true;
    }

    return false;
  };

  // 선생님 필터가 있으면 해당 선생님의 스케줄만 필터링하는 함수
  const filterScheduleByTeacher = (schedule: string[] | undefined, teacher: string, slotTeachers?: Record<string, string>): string[] | undefined => {
    if (!schedule || !currentTeacherFilter || currentTeacherFilter === 'all') {
      return schedule;
    }

    return schedule.filter(item => {
      const parts = item.split(' ');
      if (parts.length < 2) return false;

      const key = `${parts[0]}-${parts[1]}`;

      // slotTeacher가 있으면 그것과 비교
      if (isSlotTeacherMatch(slotTeachers, key, currentTeacherFilter, undefined, staff || [])) {
        return true;
      }

      // slotTeacher가 없으면 담임과 비교
      return !slotTeachers?.[key] && matchTeacher(teacher, currentTeacherFilter);
    });
  };

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {[...Array(8)].map((_, index) => (
            <div key={index} className="px-4 py-3 animate-pulse flex items-center gap-4">
              <div className="h-5 bg-gray-200 rounded w-32"></div>
              <div className="h-5 bg-gray-200 rounded w-16"></div>
              <div className="h-5 bg-gray-200 rounded w-12"></div>
              <div className="h-5 bg-gray-200 rounded w-24 flex-1"></div>
              <div className="h-5 bg-gray-200 rounded w-16"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 빈 상태
  if (!classes || classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Inbox className="w-16 h-16 text-[#373d41] opacity-50 mb-4" />
        <h3 className="text-[#081429] font-bold text-lg mb-2">
          등록된 수업이 없습니다
        </h3>
        <p className="text-[#373d41] text-sm">
          새 수업을 추가하거나 필터를 조정해보세요.
        </p>
      </div>
    );
  }

  // 수업 목록 테이블 (헤더는 ClassManagementTab에서 고정 표시)
  return (
    <div className="bg-white rounded-t-none rounded-b-lg border border-t-0 border-gray-200 overflow-hidden shadow-sm">
      {/* 테이블 바디 */}
      <div className="divide-y divide-gray-100">
        {classes.map((classInfo) => {
          const { className, teacher, subject, schedule, studentCount, memo } = classInfo;
          const subjectColors = SUBJECT_COLORS[subject as SubjectType] || SUBJECT_COLORS.math;
          const subjectLabel = SUBJECT_LABELS[subject as SubjectType] || subject;
          const subjectForSchedule: SubjectForSchedule = subject === 'english' ? 'english' : 'math';

          // 선생님 필터가 적용되면 해당 선생님의 스케줄만 필터링
          const filteredSchedule = filterScheduleByTeacher(schedule, teacher, classInfo.slotTeachers);

          return (
            <div
              key={classInfo.id}
              onClick={() => onClassClick(classInfo)}
              className="px-4 py-2.5 grid grid-cols-[80px_1fr_100px_100px_1fr_1fr_70px_40px] gap-3 items-center hover:bg-gray-50 cursor-pointer transition-colors group"
            >
              {/* 과목 배지 */}
              <div className="flex justify-center">
                <span
                  className="px-2 py-0.5 rounded text-xs font-semibold"
                  style={{
                    backgroundColor: subjectColors.bg,
                    color: subjectColors.text,
                  }}
                >
                  {subjectLabel}
                </span>
              </div>

              {/* 수업명 */}
              <div className="font-semibold text-[#081429] text-sm truncate">
                {className}
              </div>

              {/* 담임 */}
              <div className="text-[#373d41] text-sm truncate">
                {getTeacherDisplayName(teacher)}
              </div>

              {/* 부담임 */}
              <div className="text-[#373d41] text-sm truncate">
                {classInfo.slotTeachers && Object.keys(classInfo.slotTeachers).length > 0 ? (
                  <span
                    className="text-gray-600"
                    title={Array.from(new Set(Object.values(classInfo.slotTeachers)))
                      .map(name => getTeacherDisplayName(name))
                      .join(', ')}
                  >
                    {Array.from(new Set(Object.values(classInfo.slotTeachers)))
                      .map(name => getTeacherDisplayName(name))
                      .join(', ')}
                  </span>
                ) : (
                  <span className="text-gray-300">-</span>
                )}
              </div>

              {/* 스케줄 - 시각적 배지 컴포넌트 사용 */}
              <div className="overflow-hidden">
                <ScheduleBadge schedule={filteredSchedule} subject={subjectForSchedule} />
              </div>

              {/* 메모 */}
              <div className="text-gray-500 text-xs truncate flex items-center gap-1" title={memo || ''}>
                {memo ? (
                  <>
                    <FileText className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{memo}</span>
                  </>
                ) : (
                  <span className="text-gray-300">-</span>
                )}
              </div>

              {/* 학생수 */}
              <div className="flex items-center justify-center gap-1">
                <Users className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-sm font-medium text-[#081429]">
                  {studentCount || 0}
                </span>
              </div>

              {/* 화살표 */}
              <div className="flex justify-center">
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#fdb813] transition-colors" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ClassList;
