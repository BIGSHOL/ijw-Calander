import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Trash2, Save, AlertCircle, BookOpen, Settings as SettingsIcon } from 'lucide-react';
import { SessionPeriod, DateRange } from '../types';
import { useSessionPeriods, useBatchSaveSessionPeriods } from '../../../hooks/useSessionPeriods';
import { formatDateKey, parseLocalDate, getCategoryLabel, mergeOverlappingRanges } from '../utils';

interface SessionSettingsTabProps {
  initialYear?: number;
  initialCategory?: 'math' | 'english' | 'eie';
}

const CATEGORIES: Array<'math' | 'english' | 'eie'> = ['math', 'english', 'eie'];
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const DAY_NAMES_SHORT = ['일', '월', '화', '수', '목', '금', '토'];

// 미니 달력 컴포넌트
const MiniCalendar: React.FC<{
  year: number;
  month: number;
  selectedRanges: DateRange[];
  dragRange: { start: string; end: string } | null;
  onMouseDown: (dateStr: string) => void;
  onMouseEnter: (dateStr: string) => void;
}> = ({ year, month, selectedRanges, dragRange, onMouseDown, onMouseEnter }) => {
  const days = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const result: Array<{ date: Date; dateStr: string } | null> = [];

    // 첫 주 앞의 빈 칸
    for (let i = 0; i < firstDay.getDay(); i++) {
      result.push(null);
    }

    // 해당 월의 날짜들
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month - 1, d);
      result.push({ date, dateStr: formatDateKey(date) });
    }

    return result;
  }, [year, month]);

  const isDateSelected = useCallback((dateStr: string) => {
    for (const range of selectedRanges) {
      if (dateStr >= range.startDate && dateStr <= range.endDate) {
        return true;
      }
    }
    return false;
  }, [selectedRanges]);

  const isDateInDragRange = useCallback((dateStr: string) => {
    if (!dragRange) return false;
    const start = dragRange.start < dragRange.end ? dragRange.start : dragRange.end;
    const end = dragRange.start < dragRange.end ? dragRange.end : dragRange.start;
    return dateStr >= start && dateStr <= end;
  }, [dragRange]);

  return (
    <div className="bg-white border border-gray-200 rounded-sm p-2">
      {/* 월 헤더 */}
      <div className="text-center text-xs font-bold text-gray-700 mb-1">
        {month}월
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-px text-center mb-0.5">
        {DAY_NAMES_SHORT.map((day, idx) => (
          <div
            key={day}
            className={`text-micro font-medium ${
              idx === 0 ? 'text-red-400' : idx === 6 ? 'text-blue-400' : 'text-gray-400'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-px">
        {days.map((day, idx) => {
          if (!day) {
            return <div key={`empty-${idx}`} className="h-5" />;
          }

          const isSelected = isDateSelected(day.dateStr);
          const isInDrag = isDateInDragRange(day.dateStr);
          const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;

          return (
            <button
              key={day.dateStr}
              onMouseDown={(e) => {
                e.preventDefault();
                onMouseDown(day.dateStr);
              }}
              onMouseEnter={() => onMouseEnter(day.dateStr)}
              className={`h-5 text-xxs font-medium rounded-sm transition-colors ${
                isSelected
                  ? 'bg-blue-500 text-white'
                  : isInDrag
                  ? 'bg-blue-200 text-blue-800'
                  : isWeekend
                  ? 'text-gray-400 hover:bg-gray-100'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {day.date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const SessionSettingsTab: React.FC<SessionSettingsTabProps> = ({
  initialYear = new Date().getFullYear(),
  initialCategory = 'math',
}) => {
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedCategory, setSelectedCategory] = useState<'math' | 'english' | 'eie'>(initialCategory);

  // 드래그 상태
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<string | null>(null);
  const [dragEnd, setDragEnd] = useState<string | null>(null);

  // Firebase 훅
  const { data: sessions = [], isLoading } = useSessionPeriods(selectedYear, selectedCategory);
  const batchSaveMutation = useBatchSaveSessionPeriods();

  // 월별 편집 범위 (로컬 상태) - { month: DateRange[] }
  const [editingRangesByMonth, setEditingRangesByMonth] = useState<Record<number, DateRange[]>>({});

  // 이전 세션 데이터 추적 (무한 루프 방지)
  const prevSessionsRef = useRef<string>('');
  const prevFilterRef = useRef<string>('');

  // 연도/카테고리 변경 시 ref 초기화
  useEffect(() => {
    const filterKey = `${selectedYear}-${selectedCategory}`;
    if (filterKey !== prevFilterRef.current) {
      prevFilterRef.current = filterKey;
      prevSessionsRef.current = ''; // 필터 변경 시 세션 ref 리셋
    }
  }, [selectedYear, selectedCategory]);

  // 세션 데이터가 변경되면 편집 상태 초기화
  useEffect(() => {
    if (!isLoading) {
      // 세션 데이터를 문자열로 직렬화하여 비교
      const sessionsKey = JSON.stringify(sessions.map(s => ({ month: s.month, ranges: s.ranges })));

      // 이전 데이터와 다를 때만 업데이트 (무한 루프 방지)
      if (sessionsKey !== prevSessionsRef.current) {
        prevSessionsRef.current = sessionsKey;

        const rangesByMonth: Record<number, DateRange[]> = {};
        sessions.forEach(session => {
          rangesByMonth[session.month] = session.ranges || [];
        });
        setEditingRangesByMonth(rangesByMonth);
      }
    }
  }, [isLoading, sessions, selectedYear, selectedCategory]);

  // 드래그 범위
  const dragRange = useMemo(() => {
    if (!isDragging || !dragStart || !dragEnd) return null;
    return { start: dragStart, end: dragEnd };
  }, [isDragging, dragStart, dragEnd]);

  // 드래그 시작
  const handleMouseDown = (dateStr: string) => {
    setIsDragging(true);
    setDragStart(dateStr);
    setDragEnd(dateStr);
  };

  // 드래그 중
  const handleMouseEnter = (dateStr: string) => {
    if (isDragging) {
      setDragEnd(dateStr);
    }
  };

  // 드래그 종료
  const handleMouseUp = () => {
    if (isDragging && dragStart && dragEnd) {
      const start = dragStart < dragEnd ? dragStart : dragEnd;
      const end = dragStart < dragEnd ? dragEnd : dragStart;

      // 시작/종료 월 계산
      const startMonth = parseInt(start.slice(5, 7));
      const endMonth = parseInt(end.slice(5, 7));

      // 새 범위 추가 (월별로 분리)
      setEditingRangesByMonth(prev => {
        const newRangesByMonth = { ...prev };

        for (let m = startMonth; m <= endMonth; m++) {
          const monthStart = m === startMonth ? start : `${selectedYear}-${String(m).padStart(2, '0')}-01`;
          const lastDayOfMonth = new Date(selectedYear, m, 0).getDate();
          const monthEnd = m === endMonth ? end : `${selectedYear}-${String(m).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

          const existingRanges = newRangesByMonth[m] || [];
          const newRange: DateRange = { startDate: monthStart, endDate: monthEnd };
          newRangesByMonth[m] = mergeOverlappingRanges([...existingRanges, newRange]);
        }

        return newRangesByMonth;
      });
    }
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  };

  // 전체 범위 초기화
  const handleClearAll = () => {
    if (confirm('모든 세션 범위를 삭제하시겠습니까?')) {
      setEditingRangesByMonth({});
    }
  };

  // 특정 월 범위 삭제
  const handleClearMonth = (month: number) => {
    setEditingRangesByMonth(prev => {
      const newRanges = { ...prev };
      delete newRanges[month];
      return newRanges;
    });
  };

  // 저장
  const handleSave = async () => {
    const sessionsToSave: SessionPeriod[] = [];

    MONTHS.forEach(month => {
      const ranges = editingRangesByMonth[month];
      if (ranges && ranges.length > 0) {
        sessionsToSave.push({
          id: `${selectedYear}-${selectedCategory}-${month}`,
          year: selectedYear,
          category: selectedCategory,
          month,
          ranges,
          sessions: 12, // 기본값
        });
      }
    });

    try {
      await batchSaveMutation.mutateAsync(sessionsToSave);
      alert('저장되었습니다.');
    } catch (error) {
      console.error('Failed to save sessions:', error);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  // 변경사항 있는지 확인
  const hasChanges = useMemo(() => {
    // 기존 세션과 편집 중인 범위 비교
    const originalByMonth: Record<number, string> = {};
    sessions.forEach(s => {
      originalByMonth[s.month] = JSON.stringify(s.ranges || []);
    });

    for (const month of MONTHS) {
      const original = originalByMonth[month] || '[]';
      const editing = JSON.stringify(editingRangesByMonth[month] || []);
      if (original !== editing) return true;
    }
    return false;
  }, [sessions, editingRangesByMonth]);

  // 설정된 월 요약
  const configuredMonths = useMemo(() => {
    return MONTHS.filter(m => {
      const ranges = editingRangesByMonth[m];
      return ranges && ranges.length > 0;
    });
  }, [editingRangesByMonth]);

  return (
    <div
      className="space-y-2 select-none"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Section 1: 세션 정보 */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
          <Calendar className="w-3 h-3 text-[#081429]" />
          <h3 className="text-[#081429] font-bold text-xs">세션 정보</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {/* Year / Category Selection Row */}
          <div className="px-2 py-1.5">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-12 shrink-0 text-xs font-medium text-[#373d41]">년도</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSelectedYear(y => y - 1)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-bold w-16 text-center">{selectedYear}년</span>
                <button
                  onClick={() => setSelectedYear(y => y + 1)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-xs font-medium text-[#373d41]">과목</span>
              <div className="flex gap-1">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 text-xs font-bold rounded-sm transition-colors ${
                      selectedCategory === cat
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {getCategoryLabel(cat)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
          로딩 중...
        </div>
      ) : (
        <>
          {/* Section 2: 기간 설정 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
              <BookOpen className="w-3 h-3 text-[#081429]" />
              <h3 className="text-[#081429] font-bold text-xs">기간 설정</h3>
            </div>
            <div className="p-2">
              <div className="text-xs text-gray-500 mb-2">
                달력에서 드래그하여 세션 기간을 설정하세요
              </div>

              {/* 12개월 달력 그리드 */}
              <div className="grid grid-cols-4 gap-2">
                {MONTHS.map(month => (
                  <MiniCalendar
                    key={month}
                    year={selectedYear}
                    month={month}
                    selectedRanges={editingRangesByMonth[month] || []}
                    dragRange={dragRange}
                    onMouseDown={handleMouseDown}
                    onMouseEnter={handleMouseEnter}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: 설정 요약 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-1">
                <SettingsIcon className="w-3 h-3 text-[#081429]" />
                <h3 className="text-[#081429] font-bold text-xs">설정 요약</h3>
              </div>
              {configuredMonths.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs text-red-500 hover:text-red-600 font-medium"
                >
                  전체 삭제
                </button>
              )}
            </div>
            <div className="p-2">
              {configuredMonths.length === 0 ? (
                <div className="text-xs text-gray-400">
                  설정된 세션이 없습니다.
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-xs font-bold text-gray-600 mb-1">
                    설정된 세션 ({configuredMonths.length}개월)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {configuredMonths.map(month => {
                      const ranges = editingRangesByMonth[month] || [];
                      const rangeStr = ranges.map(r => {
                        const s = parseLocalDate(r.startDate);
                        const e = parseLocalDate(r.endDate);
                        return `${s.getDate()}~${e.getDate()}`;
                      }).join(', ');

                      return (
                        <div
                          key={month}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 border border-blue-200 rounded text-xs text-blue-700"
                        >
                          <span className="font-bold">{month}월</span>
                          <span className="text-blue-500">({rangeStr})</span>
                          <button
                            onClick={() => handleClearMonth(month)}
                            className="text-blue-400 hover:text-red-500 ml-0.5"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: 작업 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
              <Save className="w-3 h-3 text-[#081429]" />
              <h3 className="text-[#081429] font-bold text-xs">작업</h3>
            </div>
            <div className="p-2">
              {/* 변경사항 알림 */}
              {hasChanges && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2 py-1.5 rounded mb-2 border border-amber-100">
                  <AlertCircle size={14} />
                  저장되지 않은 변경사항이 있습니다.
                </div>
              )}

              {/* 저장 버튼 */}
              <button
                onClick={handleSave}
                disabled={!hasChanges || batchSaveMutation.isPending}
                className={`w-full flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-bold rounded-sm transition-colors ${
                  hasChanges
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Save size={16} />
                {batchSaveMutation.isPending ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SessionSettingsTab;
