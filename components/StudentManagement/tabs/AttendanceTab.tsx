import React, { useMemo, useState } from 'react';
import { UnifiedStudent } from '../../../types';
import { Calendar as CalendarIcon, TrendingUp, TrendingDown, CheckCircle2, XCircle, BookOpen } from 'lucide-react';
import { useAttendanceRecords } from '../../../hooks/useAttendance';
import {
  SubjectForSchedule,
  MATH_PERIOD_INFO,
  ENGLISH_PERIOD_INFO,
  WEEKEND_PERIOD_INFO,
} from '../../Timetable/constants';

interface AttendanceTabProps {
  student: UnifiedStudent;
  readOnly?: boolean;
}

// 요일별 색상 정의
const DAY_COLORS: Record<string, { bg: string; text: string }> = {
  '월': { bg: '#fef3c7', text: '#92400e' },
  '화': { bg: '#fce7f3', text: '#9d174d' },
  '수': { bg: '#dbeafe', text: '#1e40af' },
  '목': { bg: '#d1fae5', text: '#065f46' },
  '금': { bg: '#e0e7ff', text: '#3730a3' },
  '토': { bg: '#fee2e2', text: '#991b1b' },
  '일': { bg: '#f3e8ff', text: '#6b21a8' },
};

// 출석 상태별 색상 및 라벨 (출석부와 동일)
const ATTENDANCE_STATUS = {
  1: { label: '출석', bg: '#10b981', text: '#ffffff', icon: CheckCircle2 },
  0: { label: '결석', bg: '#ef4444', text: '#ffffff', icon: XCircle },
  0.5: { label: '지각', bg: '#f59e0b', text: '#ffffff', icon: CheckCircle2 },
  '-0.5': { label: '조퇴', bg: '#f59e0b', text: '#ffffff', icon: CheckCircle2 },
} as const;

// 요일 배열
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// subject 판별 최적화 (Map 사용)
const SUBJECT_KEYWORDS = new Map<string, SubjectForSchedule>([
  ['영어', 'english'],
  ['English', 'english'],
]);

function getSubjectFromClassName(className: string): SubjectForSchedule {
  for (const [keyword, subject] of SUBJECT_KEYWORDS) {
    if (className.includes(keyword)) {
      return subject;
    }
  }
  return 'math';
}

// 스케줄 포맷 결과 캐싱 (400명+ 규모에서 중요)
const scheduleFormatCache = new Map<string, string>();

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

// 주말 교시 라벨 포맷팅
function formatWeekendLabel(periods: string[]): string {
  if (periods.length === 0) return '시간 미정';

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

// 스케줄 포맷 함수 (CoursesTab의 ScheduleBadge 로직 참고 + 캐싱)
function formatScheduleCompact(schedule: string[] | undefined, subject: SubjectForSchedule): string {
  if (!schedule || schedule.length === 0) {
    return '시간 미정';
  }

  // 캐시 키 생성 (schedule과 subject 조합)
  const cacheKey = `${subject}:${schedule.join(',')}`;

  // 캐시 확인
  if (scheduleFormatCache.has(cacheKey)) {
    return scheduleFormatCache.get(cacheKey)!;
  }

  const getPeriodInfoForDay = (day: string) => {
    if (day === '토' || day === '일') {
      return WEEKEND_PERIOD_INFO;
    }
    return subject === 'english' ? ENGLISH_PERIOD_INFO : MATH_PERIOD_INFO;
  };

  const dayOrder = ['월', '화', '수', '목', '금', '토', '일'];

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
    return '시간 미정';
  }

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

  const labelToDays: Map<string, string[]> = new Map();

  for (const [day, label] of dayLabels) {
    if (!labelToDays.has(label)) {
      labelToDays.set(label, []);
    }
    labelToDays.get(label)!.push(day);
  }

  const entries: Array<{ days: string[]; label: string }> = [];
  for (const [label, days] of labelToDays) {
    days.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
    entries.push({ days, label });
  }

  entries.sort((a, b) => dayOrder.indexOf(a.days[0]) - dayOrder.indexOf(b.days[0]));

  // 텍스트로만 반환
  const result = entries.map(entry => `${entry.days.join('')} ${entry.label}`).join(' / ');

  // 캐시 저장
  scheduleFormatCache.set(cacheKey, result);

  return result;
}

const AttendanceTab: React.FC<AttendanceTabProps> = ({ student, readOnly = false }) => {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate);
  const [selectedClass, setSelectedClass] = useState<string>('all'); // 'all' 또는 className

  // 현재 선택된 월의 yearMonth 포맷 (YYYY-MM)
  const yearMonth = useMemo(() => {
    const year = selectedMonth.getFullYear();
    const month = String(selectedMonth.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, [selectedMonth]);

  // 학생의 수업 목록 추출 (최적화: 캐시된 함수 사용)
  const classList = useMemo(() => {
    return student.enrollments.map(e => {
      // subject 추출 (최적화된 함수 사용)
      const subject = getSubjectFromClassName(e.className);

      return {
        className: e.className,
        subject,
        schedule: e.schedule,
        days: e.schedule?.map((slot: string) => slot.split(' ')[0]) || e.days || [],
        formattedSchedule: formatScheduleCompact(e.schedule, subject),
      };
    });
  }, [student.enrollments]);

  // Firebase에서 출석 데이터 가져오기
  const { data: attendanceData, isLoading } = useAttendanceRecords(student.id, yearMonth, true);
  const attendance = attendanceData?.attendance || {};
  const memos = attendanceData?.memos || {};

  // 달력 생성 로직
  const calendarDays = useMemo(() => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();

    // 이번 달의 첫날과 마지막 날
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // 첫 주의 빈 칸 수 (일요일 시작)
    const firstDayOfWeek = firstDay.getDay();

    // 마지막 날짜
    const lastDate = lastDay.getDate();

    const days: Array<{
      date: number;
      dateKey: string;
      isCurrentMonth: boolean;
      status?: number;
      memo?: string;
    }> = [];

    // 이전 달의 빈 칸
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({ date: 0, dateKey: '', isCurrentMonth: false });
    }

    // 이번 달의 날짜
    for (let date = 1; date <= lastDate; date++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
      days.push({
        date,
        dateKey,
        isCurrentMonth: true,
        status: attendance[dateKey],
        memo: memos[dateKey],
      });
    }

    return days;
  }, [selectedMonth, attendance, memos]);

  // 선택된 수업의 요일 추출
  const selectedClassDays = useMemo(() => {
    if (selectedClass === 'all') {
      // 모든 수업의 요일 합치기
      const allDays = new Set<string>();
      classList.forEach(cls => {
        cls.days.forEach(day => allDays.add(day));
      });
      return Array.from(allDays);
    }
    const classInfo = classList.find(c => c.className === selectedClass);
    return classInfo?.days || [];
  }, [selectedClass, classList]);

  // 통계 계산 (선택된 수업의 요일만 필터링)
  const stats = useMemo(() => {
    let filteredAttendance = { ...attendance };

    // 특정 수업 선택 시 해당 수업 요일만 필터링
    if (selectedClass !== 'all' && selectedClassDays.length > 0) {
      filteredAttendance = Object.fromEntries(
        Object.entries(attendance).filter(([dateKey]) => {
          const date = new Date(dateKey);
          const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
          return selectedClassDays.includes(dayOfWeek);
        })
      );
    }

    const values = Object.values(filteredAttendance);

    const totalDays = values.length;
    const presentCount = values.filter(v => v === 1).length;
    const absentCount = values.filter(v => v === 0).length;
    const lateCount = values.filter(v => v === 0.5).length;
    const earlyLeaveCount = values.filter(v => v === -0.5).length;

    const attendanceRate = totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 0;
    const absentRate = totalDays > 0 ? Math.round((absentCount / totalDays) * 100) : 0;

    return {
      totalDays,
      presentCount,
      absentCount,
      lateCount,
      earlyLeaveCount,
      attendanceRate,
      absentRate,
    };
  }, [attendance, selectedClass, selectedClassDays]);

  // 월 변경 핸들러
  const handlePrevMonth = () => {
    setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setSelectedMonth(new Date());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-xs text-gray-500">출석 데이터를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* 월 선택 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-[#081429]">출결 현황</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevMonth}
            className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-sm hover:bg-gray-200 transition-colors"
          >
            ‹
          </button>
          <button
            onClick={handleToday}
            className="px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-sm hover:bg-gray-50 transition-colors"
          >
            {selectedMonth.getFullYear()}년 {selectedMonth.getMonth() + 1}월
          </button>
          <button
            onClick={handleNextMonth}
            className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-sm hover:bg-gray-200 transition-colors"
          >
            ›
          </button>
        </div>
      </div>

      {/* 수업 필터 */}
      {classList.length > 0 && (
        <div className="flex items-center gap-1">
          <BookOpen className="w-3 h-3 text-gray-500" />
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="all">전체 수업</option>
            {classList.map((cls) => (
              <option key={cls.className} value={cls.className}>
                {cls.className} ({cls.formattedSchedule})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 통계 카드 - 컴팩트 (1행 4열) */}
      <div className="grid grid-cols-4 gap-1.5">
        <div className="bg-white border border-green-200 rounded-sm p-1.5">
          <p className="text-micro text-gray-500">출석률</p>
          <p className="text-base font-bold text-green-600">{stats.attendanceRate}%</p>
          <p className="text-xxs text-gray-400">{stats.presentCount}일</p>
        </div>

        <div className="bg-white border border-red-200 rounded-sm p-1.5">
          <p className="text-micro text-gray-500">결석률</p>
          <p className="text-base font-bold text-red-600">{stats.absentRate}%</p>
          <p className="text-xxs text-gray-400">{stats.absentCount}일</p>
        </div>

        <div className="bg-white border border-orange-200 rounded-sm p-1.5">
          <p className="text-micro text-gray-500">지각</p>
          <p className="text-base font-bold text-orange-600">{stats.lateCount}</p>
          <p className="text-xxs text-gray-400">일</p>
        </div>

        <div className="bg-white border border-orange-200 rounded-sm p-1.5">
          <p className="text-micro text-gray-500">조퇴</p>
          <p className="text-base font-bold text-orange-600">{stats.earlyLeaveCount}</p>
          <p className="text-xxs text-gray-400">일</p>
        </div>
      </div>

      {/* 달력 뷰 */}
      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {WEEKDAYS.map((day, idx) => (
            <div
              key={day}
              className={`text-center py-2 text-xs font-bold ${
                idx === 0 ? 'text-red-600' : idx === 6 ? 'text-blue-600' : 'text-gray-700'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            if (!day.isCurrentMonth) {
              return <div key={`empty-${idx}`} className="aspect-square border-b border-r border-gray-100" />;
            }

            const statusInfo = day.status !== undefined ? ATTENDANCE_STATUS[day.status as keyof typeof ATTENDANCE_STATUS] : null;
            const dayOfWeek = idx % 7;
            const isToday =
              day.dateKey === new Date().toISOString().slice(0, 10) &&
              selectedMonth.getMonth() === new Date().getMonth() &&
              selectedMonth.getFullYear() === new Date().getFullYear();

            // 선택된 수업의 수업일인지 확인
            const date = new Date(day.dateKey);
            const koreanDayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
            const isClassDay = selectedClass === 'all' || selectedClassDays.includes(koreanDayOfWeek);

            return (
              <div
                key={day.dateKey}
                className={`aspect-square border-b border-r border-gray-100 p-1 ${
                  isToday ? 'bg-blue-50' : !isClassDay ? 'bg-gray-50' : ''
                } hover:bg-gray-50 transition-colors relative group`}
              >
                {/* 날짜 */}
                <div
                  className={`text-xs font-medium ${
                    dayOfWeek === 0 ? 'text-red-600' : dayOfWeek === 6 ? 'text-blue-600' : 'text-gray-700'
                  } ${isToday ? 'font-bold' : ''} ${!isClassDay ? 'opacity-30' : ''}`}
                >
                  {day.date}
                </div>

                {/* 출석 상태 */}
                {statusInfo && (
                  <div className="mt-0.5">
                    <div
                      className="text-micro font-semibold rounded-sm px-1 py-0.5 text-center"
                      style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
                    >
                      {statusInfo.label}
                    </div>
                  </div>
                )}

                {/* 메모 툴팁 (있을 경우) */}
                {day.memo && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                    <div className="bg-gray-800 text-white text-micro rounded-sm px-2 py-1 whitespace-nowrap shadow-lg">
                      {day.memo}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 범례 */}
      <div className="bg-gray-50 border border-gray-200 rounded-sm p-2">
        <p className="text-xs font-medium text-gray-600 mb-1">범례</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ATTENDANCE_STATUS).map(([value, info]) => (
            <div key={value} className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: info.bg }}
              />
              <span className="text-xs text-gray-700">{info.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AttendanceTab;
