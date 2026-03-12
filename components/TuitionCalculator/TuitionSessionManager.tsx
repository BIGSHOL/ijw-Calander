import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Save, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useTuitionSessions } from '../../hooks/useTuitionSessions';
import type { TuitionSessionPeriod, TuitionDateRange } from '../../types/tuition';

const CATEGORIES = ['수학', '영어', 'EiE'] as const;
type SessionCategory = typeof CATEGORIES[number];

// 출석부 DB는 영어 카테고리를 사용 (math/english/eie)
const CATEGORY_TO_DB: Record<string, string> = { '수학': 'math', '영어': 'english', 'EiE': 'eie' };
const DB_TO_CATEGORY: Record<string, string> = { 'math': '수학', 'english': '영어', 'eie': 'EiE' };

// 카테고리별 월별 색상 (12개월)
const CATEGORY_COLORS: Record<SessionCategory, Array<{ bg: string; border: string; text: string }>> = {
  '수학': [
    { bg: 'bg-blue-200', border: 'border-blue-500', text: 'text-blue-800' },
    { bg: 'bg-cyan-200', border: 'border-cyan-500', text: 'text-cyan-800' },
    { bg: 'bg-sky-200', border: 'border-sky-500', text: 'text-sky-800' },
    { bg: 'bg-indigo-200', border: 'border-indigo-500', text: 'text-indigo-800' },
    { bg: 'bg-violet-200', border: 'border-violet-500', text: 'text-violet-800' },
    { bg: 'bg-blue-300', border: 'border-blue-600', text: 'text-blue-900' },
    { bg: 'bg-teal-200', border: 'border-teal-500', text: 'text-teal-800' },
    { bg: 'bg-cyan-300', border: 'border-cyan-600', text: 'text-cyan-900' },
    { bg: 'bg-sky-300', border: 'border-sky-600', text: 'text-sky-900' },
    { bg: 'bg-indigo-300', border: 'border-indigo-600', text: 'text-indigo-900' },
    { bg: 'bg-violet-300', border: 'border-violet-600', text: 'text-violet-900' },
    { bg: 'bg-blue-400', border: 'border-blue-700', text: 'text-white' },
  ],
  '영어': [
    { bg: 'bg-green-200', border: 'border-green-500', text: 'text-green-800' },
    { bg: 'bg-emerald-200', border: 'border-emerald-500', text: 'text-emerald-800' },
    { bg: 'bg-teal-200', border: 'border-teal-500', text: 'text-teal-800' },
    { bg: 'bg-lime-200', border: 'border-lime-500', text: 'text-lime-800' },
    { bg: 'bg-yellow-200', border: 'border-yellow-500', text: 'text-yellow-800' },
    { bg: 'bg-green-300', border: 'border-green-600', text: 'text-green-900' },
    { bg: 'bg-emerald-300', border: 'border-emerald-600', text: 'text-emerald-900' },
    { bg: 'bg-teal-300', border: 'border-teal-600', text: 'text-teal-900' },
    { bg: 'bg-lime-300', border: 'border-lime-600', text: 'text-lime-900' },
    { bg: 'bg-amber-200', border: 'border-amber-500', text: 'text-amber-800' },
    { bg: 'bg-green-400', border: 'border-green-700', text: 'text-white' },
    { bg: 'bg-emerald-400', border: 'border-emerald-700', text: 'text-white' },
  ],
  'EiE': [
    { bg: 'bg-purple-200', border: 'border-purple-500', text: 'text-purple-800' },
    { bg: 'bg-pink-200', border: 'border-pink-500', text: 'text-pink-800' },
    { bg: 'bg-fuchsia-200', border: 'border-fuchsia-500', text: 'text-fuchsia-800' },
    { bg: 'bg-rose-200', border: 'border-rose-500', text: 'text-rose-800' },
    { bg: 'bg-orange-200', border: 'border-orange-500', text: 'text-orange-800' },
    { bg: 'bg-purple-300', border: 'border-purple-600', text: 'text-purple-900' },
    { bg: 'bg-pink-300', border: 'border-pink-600', text: 'text-pink-900' },
    { bg: 'bg-fuchsia-300', border: 'border-fuchsia-600', text: 'text-fuchsia-900' },
    { bg: 'bg-rose-300', border: 'border-rose-600', text: 'text-rose-900' },
    { bg: 'bg-red-200', border: 'border-red-500', text: 'text-red-800' },
    { bg: 'bg-purple-400', border: 'border-purple-700', text: 'text-white' },
    { bg: 'bg-pink-400', border: 'border-pink-700', text: 'text-white' },
  ],
};

const getMonthColor = (category: string, month: number) => {
  const colors = CATEGORY_COLORS[category as SessionCategory];
  if (!colors) return { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-700' };
  return colors[(month - 1) % colors.length];
};

const getCategoryButtonColor = (category: string) => {
  const colors = CATEGORY_COLORS[category as SessionCategory];
  if (!colors) return { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-700' };
  return colors[0];
};

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface CalendarDay {
  day: number;
  isCurrentMonth: boolean;
  dateStr: string;
}

// 월별 달력 데이터 생성 (6주)
const getMonthCalendar = (year: number, month: number): CalendarDay[][] => {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const prevMonthLastDay = new Date(year, month - 1, 0).getDate();

  const allDays: CalendarDay[] = [];

  // 지난달 날짜 추가 (1일이 속한 주의 앞부분 + 한 주 추가)
  const needExtraWeek = startDayOfWeek <= 1;
  const daysBefore = needExtraWeek ? startDayOfWeek + 7 : startDayOfWeek;

  for (let i = daysBefore - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i;
    allDays.push({
      day,
      isCurrentMonth: false,
      dateStr: formatLocalDate(new Date(prevYear, prevMonth - 1, day)),
    });
  }

  // 이번 달 날짜
  for (let day = 1; day <= daysInMonth; day++) {
    allDays.push({
      day,
      isCurrentMonth: true,
      dateStr: formatLocalDate(new Date(year, month - 1, day)),
    });
  }

  // 다음달 날짜 (6주 = 42일 채우기)
  let nextDay = 1;
  while (allDays.length < 42) {
    allDays.push({
      day: nextDay,
      isCurrentMonth: false,
      dateStr: formatLocalDate(new Date(nextYear, nextMonth - 1, nextDay)),
    });
    nextDay++;
  }

  // 42일을 6주로 나누기
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < 6; i++) {
    weeks.push(allDays.slice(i * 7, (i + 1) * 7));
  }
  return weeks;
};

const isDateInRanges = (dateStr: string, ranges: TuitionDateRange[]): boolean =>
  ranges.some(range => dateStr >= range.startDate && dateStr <= range.endDate);

const isRangeStart = (dateStr: string, ranges: TuitionDateRange[]): boolean =>
  ranges.some(range => dateStr === range.startDate);

const isRangeEnd = (dateStr: string, ranges: TuitionDateRange[]): boolean =>
  ranges.some(range => dateStr === range.endDate);

// 겹치는 범위 병합
const mergeOverlappingRanges = (ranges: TuitionDateRange[]): TuitionDateRange[] => {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const merged: TuitionDateRange[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    const lastEndDate = parseLocalDate(last.endDate);
    const currentStartDate = parseLocalDate(current.startDate);
    lastEndDate.setDate(lastEndDate.getDate() + 1);
    if (currentStartDate <= lastEndDate) {
      last.endDate = current.endDate > last.endDate ? current.endDate : last.endDate;
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
};

export const TuitionSessionManager: React.FC = () => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedCategory, setSelectedCategory] = useState<string>('수학');
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // 드래그 선택 상태
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<string | null>(null);
  const [dragEnd, setDragEnd] = useState<string | null>(null);

  // 편집 중인 세션 데이터
  const [editData, setEditData] = useState<Record<string, TuitionDateRange[]>>({});

  const { sessions, isLoading, isSaving, saveSession } = useTuitionSessions();

  // Firebase 세션 데이터로 편집 데이터 초기화 (DB 영어 카테고리 → UI 한글 카테고리 매핑)
  useEffect(() => {
    const initialEditData: Record<string, TuitionDateRange[]> = {};
    sessions.forEach(s => {
      const uiCategory = DB_TO_CATEGORY[s.category] || s.category;
      const key = `${s.year}-${uiCategory}-${s.month}`;
      initialEditData[key] = s.ranges || [];
    });
    setEditData(initialEditData);
  }, [sessions]);

  // 드래그 시작
  const handleMouseDown = (dateStr: string, month: number) => {
    const key = `${selectedYear}-${selectedCategory}-${month}`;
    const existingRanges = editData[key] || [];

    // 이미 선택된 날짜 클릭 시 해당 범위 제거
    const isAlreadySelected = existingRanges.some(
      range => dateStr >= range.startDate && dateStr <= range.endDate
    );
    if (isAlreadySelected) {
      const newRanges = existingRanges.filter(
        range => !(dateStr >= range.startDate && dateStr <= range.endDate)
      );
      setEditData(prev => ({ ...prev, [key]: newRanges }));
      return;
    }

    setIsDragging(true);
    setSelectedMonth(month);
    setDragStart(dateStr);
    setDragEnd(dateStr);
  };

  // 드래그 중
  const handleMouseEnter = (dateStr: string) => {
    if (isDragging && dragStart) {
      setDragEnd(dateStr);
    }
  };

  // 드래그 종료 - 새 범위 추가
  const handleMouseUp = useCallback(() => {
    if (isDragging && dragStart && dragEnd && selectedMonth !== null) {
      const start = dragStart < dragEnd ? dragStart : dragEnd;
      const end = dragStart < dragEnd ? dragEnd : dragStart;
      const newRange: TuitionDateRange = { startDate: start, endDate: end };
      const key = `${selectedYear}-${selectedCategory}-${selectedMonth}`;
      setEditData(prev => {
        const existingRanges = prev[key] || [];
        const newRanges = [...existingRanges, newRange].sort((a, b) =>
          a.startDate.localeCompare(b.startDate)
        );
        return { ...prev, [key]: mergeOverlappingRanges(newRanges) };
      });
    }
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, [isDragging, dragStart, dragEnd, selectedMonth, selectedYear, selectedCategory]);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  // 저장 (UI 한글 카테고리 → DB 영어 카테고리 변환)
  const handleSave = async () => {
    try {
      for (const [key, ranges] of Object.entries(editData)) {
        if (ranges.length > 0) {
          const parts = key.split('-');
          const year = parseInt(parts[0]);
          const month = parseInt(parts[parts.length - 1]);
          const uiCategory = parts.slice(1, parts.length - 1).join('-');
          const dbCategory = CATEGORY_TO_DB[uiCategory] || uiCategory;
          const dbId = `${year}-${dbCategory}-${month}`;
          const sessionData: TuitionSessionPeriod = {
            id: dbId,
            year,
            category: dbCategory,
            month,
            ranges,
            sessions: 12,
          };
          await saveSession(sessionData);
        }
      }
      alert('저장되었습니다.');
    } catch (err) {
      console.error('세션 저장 오류:', err);
      alert('저장에 실패했습니다.');
    }
  };

  // 월 세션 초기화
  const handleClearSession = (month: number) => {
    const key = `${selectedYear}-${selectedCategory}-${month}`;
    setEditData(prev => ({ ...prev, [key]: [] }));
  };

  // 현재 드래그 범위
  const getDragRange = (): TuitionDateRange | null => {
    if (!isDragging || !dragStart || !dragEnd) return null;
    const start = dragStart < dragEnd ? dragStart : dragEnd;
    const end = dragStart < dragEnd ? dragEnd : dragStart;
    return { startDate: start, endDate: end };
  };

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-lg border border-[#373d41]/20 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#fdb813]" />
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-[#373d41]/20">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-[#081429] flex items-center gap-2">
          <Calendar className="w-6 h-6 text-[#fdb813]" />
          세션 기간 설정
        </h2>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 bg-[#fdb813] text-[#081429] px-4 py-2 rounded-lg font-bold hover:bg-[#fdc943] transition-colors disabled:opacity-50"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          저장
        </button>
      </div>

      {/* 연도 선택 */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <button
          onClick={() => setSelectedYear(prev => prev - 1)}
          className="p-2 rounded-full hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex gap-2">
          {[selectedYear - 1, selectedYear, selectedYear + 1].map(year => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                year === selectedYear
                  ? 'bg-[#081429] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {year}년
            </button>
          ))}
        </div>
        <button
          onClick={() => setSelectedYear(prev => prev + 1)}
          className="p-2 rounded-full hover:bg-slate-100 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* 카테고리 선택 */}
      <div className="flex justify-center gap-2 mb-4">
        {CATEGORIES.map(cat => {
          const btnColor = getCategoryButtonColor(cat);
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                cat === selectedCategory
                  ? `${btnColor.bg} ${btnColor.border} border-2 ${btnColor.text}`
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* 12개월 달력 그리드 */}
      <div className="grid grid-cols-4 gap-3 select-none">
        {MONTHS.map(month => {
          const weeks = getMonthCalendar(selectedYear, month);
          const key = `${selectedYear}-${selectedCategory}-${month}`;
          const ranges = editData[key] || [];
          const colors = getMonthColor(selectedCategory, month);
          const dragRange = selectedMonth === month ? getDragRange() : null;
          const displayRanges = dragRange ? [...ranges, dragRange] : ranges;

          return (
            <div key={month} className="border border-slate-200 rounded-lg p-2 aspect-square flex flex-col">
              <div className="flex justify-between items-center mb-1">
                <h3 className="font-bold text-sm text-[#081429]">{month}월</h3>
                {ranges.length > 0 && (
                  <button
                    onClick={() => handleClearSession(month)}
                    className="text-xs text-red-500 hover:text-red-700 transition-colors"
                  >
                    삭제
                  </button>
                )}
              </div>

              {/* 요일 헤더 */}
              <div className="grid grid-cols-7 gap-0 text-[11px] text-center mb-1">
                {WEEKDAYS.map((day, i) => (
                  <div
                    key={day}
                    className={`aspect-square flex items-center justify-center ${
                      i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* 달력 날짜 */}
              <div className="flex-1 flex flex-col">
                {weeks.map((week, weekIdx) => (
                  <div key={weekIdx} className="grid grid-cols-7 gap-0 flex-1">
                    {week.map((calDay, dayIdx) => {
                      const { day, isCurrentMonth, dateStr } = calDay;
                      const isInRange = isDateInRanges(dateStr, displayRanges);
                      const isStart = isRangeStart(dateStr, displayRanges);
                      const isEnd = isRangeEnd(dateStr, displayRanges);
                      const isWeekend = dayIdx === 0 || dayIdx === 6;

                      // isStart/isEnd를 사용하지 않는 경고 방지 (향후 확장용)
                      void isStart;
                      void isEnd;

                      return (
                        <div
                          key={dayIdx}
                          onMouseDown={() => handleMouseDown(dateStr, month)}
                          onMouseEnter={() => handleMouseEnter(dateStr)}
                          className={[
                            'aspect-square text-[11px] flex items-center justify-center cursor-pointer transition-colors',
                            isInRange ? colors.bg : 'hover:bg-slate-100',
                            !isCurrentMonth ? 'text-slate-300' : '',
                            isCurrentMonth && isWeekend && !isInRange
                              ? (dayIdx === 0 ? 'text-red-400' : 'text-blue-400')
                              : '',
                            isInRange ? colors.text : '',
                          ].filter(Boolean).join(' ')}
                        >
                          {day}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 안내 */}
      <div className="mt-4 text-sm text-slate-500 space-y-1">
        <p>* 드래그하여 세션 기간을 선택하세요. 여러 범위를 추가할 수 있습니다.</p>
        <p>* 세션은 항상 12회로 고정됩니다.</p>
        <p>* 삭제 버튼으로 해당 월의 모든 선택을 초기화할 수 있습니다.</p>
      </div>
    </div>
  );
};
