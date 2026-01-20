import React, { useMemo, useState } from 'react';
import { UnifiedStudent } from '../../../types';
import { Calendar as CalendarIcon, TrendingUp, TrendingDown, CheckCircle2, XCircle, BookOpen } from 'lucide-react';
import { useAttendanceRecords } from '../../../hooks/useAttendance';

interface AttendanceTabProps {
  student: UnifiedStudent;
  readOnly?: boolean;
}

// 요일 한글 -> 영문 변환
const WEEKDAY_MAP: Record<string, string> = {
  '월': 'Mon',
  '화': 'Tue',
  '수': 'Wed',
  '목': 'Thu',
  '금': 'Fri',
  '토': 'Sat',
  '일': 'Sun',
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

const AttendanceTab: React.FC<AttendanceTabProps> = ({ student, readOnly = false }) => {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate);
  const [selectedClass, setSelectedClass] = useState<string>('all'); // 'all' 또는 className

  // 현재 선택된 월의 yearMonth 포맷 (YYYY-MM)
  const yearMonth = useMemo(() => {
    return selectedMonth.toISOString().slice(0, 7);
  }, [selectedMonth]);

  // 학생의 수업 목록 추출
  const classList = useMemo(() => {
    return student.enrollments.map(e => ({
      className: e.className,
      days: e.schedule?.map((slot: string) => slot.split(' ')[0]) || e.days || [],
    }));
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
            className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          >
            ‹
          </button>
          <button
            onClick={handleToday}
            className="px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
          >
            {selectedMonth.getFullYear()}년 {selectedMonth.getMonth() + 1}월
          </button>
          <button
            onClick={handleNextMonth}
            className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
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
            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="all">전체 수업</option>
            {classList.map((cls) => (
              <option key={cls.className} value={cls.className}>
                {cls.className} ({cls.days.join(', ')})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 통계 카드 - 컴팩트 (1행 4열) */}
      <div className="grid grid-cols-4 gap-1.5">
        <div className="bg-white border border-green-200 rounded p-1.5">
          <p className="text-micro text-gray-500">출석률</p>
          <p className="text-base font-bold text-green-600">{stats.attendanceRate}%</p>
          <p className="text-xxs text-gray-400">{stats.presentCount}일</p>
        </div>

        <div className="bg-white border border-red-200 rounded p-1.5">
          <p className="text-micro text-gray-500">결석률</p>
          <p className="text-base font-bold text-red-600">{stats.absentRate}%</p>
          <p className="text-xxs text-gray-400">{stats.absentCount}일</p>
        </div>

        <div className="bg-white border border-orange-200 rounded p-1.5">
          <p className="text-micro text-gray-500">지각</p>
          <p className="text-base font-bold text-orange-600">{stats.lateCount}</p>
          <p className="text-xxs text-gray-400">일</p>
        </div>

        <div className="bg-white border border-orange-200 rounded p-1.5">
          <p className="text-micro text-gray-500">조퇴</p>
          <p className="text-base font-bold text-orange-600">{stats.earlyLeaveCount}</p>
          <p className="text-xxs text-gray-400">일</p>
        </div>
      </div>

      {/* 달력 뷰 */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
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
                      className="text-micro font-semibold rounded px-1 py-0.5 text-center"
                      style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
                    >
                      {statusInfo.label}
                    </div>
                  </div>
                )}

                {/* 메모 툴팁 (있을 경우) */}
                {day.memo && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                    <div className="bg-gray-800 text-white text-micro rounded px-2 py-1 whitespace-nowrap shadow-lg">
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
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
        <p className="text-xs font-medium text-gray-600 mb-1">범례</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ATTENDANCE_STATUS).map(([value, info]) => (
            <div key={value} className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded"
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
