import React, { useMemo, useState, useEffect, useRef, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { Student, SalaryConfig, AttendanceViewMode, SessionPeriod } from '../types';
import { Exam, StudentScore, Holiday } from '../../../types';
import { getDaysInMonth, formatDateDisplay, formatDateKey, getDaysInSessionRanges } from '../utils';
import { StickyNote, Save, Palette, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { PREDEFINED_CELL_COLORS } from './cellColors';
import StudentTableBody from './StudentTableBody';

interface Props {
  currentDate: Date;
  students: Student[];
  salaryConfig: SalaryConfig;
  onAttendanceChange: (studentId: string, className: string, dateKey: string, value: number | null) => void;
  onEditStudent: (student: Student) => void;
  onMemoChange: (studentId: string, className: string, dateKey: string, memo: string) => void;
  onHomeworkChange?: (studentId: string, className: string, dateKey: string, value: boolean) => void;  // 과제 토글
  onCellColorChange?: (studentId: string, className: string, dateKey: string, color: string | null) => void;  // 셀 배경색 변경
  onSalarySettingChange?: (studentId: string, className: string, salarySettingId: string | null) => void;  // 급여 설정 수동 변경 (수업별)
  pendingUpdatesByStudent?: Record<string, Record<string, number | null>>;
  pendingMemosByStudent?: Record<string, Record<string, string>>;
  // Grade/Exam integration
  examsByDate?: Map<string, Exam[]>;
  scoresByStudent?: Map<string, Map<string, StudentScore>>;  // studentId -> examId -> score
  // Group ordering props
  groupOrder?: string[];
  onGroupOrderChange?: (newOrder: string[]) => void;
  // Group collapse props
  collapsedGroups?: Set<string>;
  onCollapsedGroupsChange?: (newCollapsed: Set<string>) => void;
  // Session mode props
  viewMode?: AttendanceViewMode;
  selectedSession?: SessionPeriod | null;
  // 주말 회색 처리 옵션
  highlightWeekends?: boolean;
  // 공휴일 데이터
  holidays?: Holiday[];
  // 정렬 모드: 수업별 그룹 | 이름순 flat
  sortMode?: 'class' | 'name';
  // 숨긴 날짜 열
  hiddenDates?: Set<string>;
  onHiddenDatesChange?: (newHidden: Set<string>) => void;
  // 전체 페이지 기준 그룹별 학생 수
  totalGroupCounts?: Map<string, number>;
}

interface ContextMenuState {
  x: number;
  y: number;
  studentId: string;
  className: string;  // 수업별 분리를 위한 className
  dateKey: string;
  mode: 'menu' | 'memo' | 'color'; // 'menu' for default actions, 'memo' for editing note, 'color' for color picker
  memoText: string;
  currentColor?: string;  // 현재 셀 배경색 (color mode에서 사용)
}

const Table = forwardRef<HTMLTableElement, Props>(({
  currentDate,
  students,
  salaryConfig,
  onAttendanceChange,
  onEditStudent,
  onMemoChange,
  onHomeworkChange,
  onCellColorChange,
  onSalarySettingChange,
  pendingUpdatesByStudent,
  pendingMemosByStudent,
  examsByDate,
  scoresByStudent,
  groupOrder = [],
  onGroupOrderChange,
  collapsedGroups,
  onCollapsedGroupsChange,
  viewMode = 'monthly',
  selectedSession,
  highlightWeekends = false,
  holidays = [],
  sortMode = 'class',
  hiddenDates = new Set<string>(),
  onHiddenDatesChange,
  totalGroupCounts
}, ref) => {
  // 세션 모드에 따라 표시할 날짜 결정
  const days = useMemo(() => {
    if (viewMode === 'session' && selectedSession) {
      return getDaysInSessionRanges(selectedSession);
    }
    return getDaysInMonth(currentDate);
  }, [currentDate, viewMode, selectedSession]);

  // 공휴일 날짜 Set (빠른 조회용)
  const holidayDateSet = useMemo(() => {
    return new Set(holidays.map(h => h.date));
  }, [holidays]);

  // 공휴일 이름 Map (툴팁용)
  const holidayNameMap = useMemo(() => {
    const map = new Map<string, string>();
    holidays.forEach(h => map.set(h.date, h.name));
    return map;
  }, [holidays]);

  const memoInputRef = useRef<HTMLTextAreaElement>(null);

  // 숨긴 날짜를 제외한 실제 표시 날짜
  const visibleDays = useMemo(() => {
    if (hiddenDates.size === 0) return days;
    return days.filter(day => !hiddenDates.has(formatDateKey(day)));
  }, [days, hiddenDates]);

  const hasHiddenDates = hiddenDates.size > 0;

  // 날짜 헤더 우클릭 메뉴 State
  const [dateContextMenu, setDateContextMenu] = useState<{ x: number; y: number; dateKey: string } | null>(null);

  useEffect(() => {
    if (!dateContextMenu) return;
    const close = () => setDateContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [dateContextMenu]);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Don't close if clicking inside the context menu
      if ((e.target as HTMLElement).closest('.context-menu-container')) return;
      setContextMenu(null);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Focus textarea when switching to memo mode
  useEffect(() => {
    if (contextMenu?.mode === 'memo' && memoInputRef.current) {
      memoInputRef.current.focus();
    }
  }, [contextMenu?.mode]);

  const handleCellClick = (studentId: string, className: string, dateKey: string, currentValue: number | undefined, isValid: boolean) => {
    if (!isValid) return; // Prevent clicking on invalid dates

    let nextValue: number | null = null;
    if (currentValue === undefined || currentValue === null) nextValue = 1;
    else if (currentValue > 0) nextValue = 0;
    else nextValue = null;

    onAttendanceChange(studentId, className, dateKey, nextValue);
  };

  const handleContextMenu = (e: React.MouseEvent, student: Student, dateKey: string, isValid: boolean) => {
    if (!isValid) return;
    e.preventDefault();

    // Get existing memo and cell color if any
    const existingMemo = student.memos?.[dateKey] || '';
    const existingColor = student.cellColors?.[dateKey] || '';
    const className = student.group || '';  // group이 className으로 설정됨

    // Calculate position (keep it within viewport bounds roughly)
    // For simplicity, just using clientX/Y. A robust solution would measure window size.
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      studentId: student.id,
      className,
      dateKey,
      mode: 'menu',
      memoText: existingMemo,
      currentColor: existingColor,
    });
  };

  const handleMenuSelect = (value: number | null) => {
    if (contextMenu) {
      onAttendanceChange(contextMenu.studentId, contextMenu.className, contextMenu.dateKey, value);
      setContextMenu(null);
    }
  };

  const handleMemoSave = () => {
    if (contextMenu) {
      onMemoChange(contextMenu.studentId, contextMenu.className, contextMenu.dateKey, contextMenu.memoText);
      setContextMenu(null);
    }
  };

  const handleColorSelect = (colorKey: string | null) => {
    if (contextMenu && onCellColorChange) {
      onCellColorChange(contextMenu.studentId, contextMenu.className, contextMenu.dateKey, colorKey);
      setContextMenu(null);
    }
  }

  return (
    <>
      <table ref={ref} className="border-separate border-spacing-0 w-full min-w-full text-sm text-left bg-white border border-gray-200 rounded-sm shadow-sm table-fixed">
        <thead className="bg-[#081429] text-white font-medium sticky top-0 z-[100] shadow-md">
          <tr>
            {/* Sticky Left Columns - Compact width */}
            <th className="p-2 sticky left-0 top-0 z-[110] bg-[#081429] border-r border-b border-[#ffffff]/10 w-8 text-center text-gray-400 align-middle text-xs">#</th>
            <th className="p-2 sticky left-8 top-0 z-[110] bg-[#081429] border-r border-b border-[#ffffff]/10 w-[70px] align-middle text-xs">이름</th>
            <th className="p-2 sticky left-[102px] top-0 z-[110] bg-[#081429] border-r border-b border-[#ffffff]/10 w-[80px] align-middle text-xs">학교</th>

            {/* Stat Columns - Compact */}
            <th className="p-2 sticky left-[182px] top-0 z-[110] border-r border-b border-[#ffffff]/10 w-[70px] text-center bg-[#081429] align-middle text-xs">요일</th>
            <th className="p-2 sticky left-[252px] top-0 z-[110] border-r border-b border-[#ffffff]/10 w-[36px] text-center bg-[#081429] align-middle text-xs">출석</th>

            {/* 숨긴 열 표시 바 */}
            {hiddenDates.size > 0 && onHiddenDatesChange && (
              <th className="p-1 sticky top-0 border-r border-b border-[#ffffff]/10 text-center align-middle bg-[#081429] w-[30px]">
                <button
                  type="button"
                  onClick={() => onHiddenDatesChange(new Set())}
                  className="text-micro text-yellow-400 hover:text-yellow-200 font-bold whitespace-nowrap"
                  title={`${hiddenDates.size}개 열 숨김 중 — 클릭하여 모두 표시`}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <Eye size={10} />
                    <span>{hiddenDates.size}</span>
                  </div>
                </button>
              </th>
            )}

            {/* Dynamic Date Columns - Square for 4-quadrant layout */}
            {visibleDays.map((day) => {
              const { date, day: dayName } = formatDateDisplay(day);
              const dateKey = formatDateKey(day);
              const isHoliday = holidayDateSet.has(dateKey);
              const holidayName = holidayNameMap.get(dateKey);
              const isSaturday = day.getDay() === 6;
              const isSunday = day.getDay() === 0;

              // 색상 우선순위: 공휴일(보라) > 일요일(빨강) > 토요일(파랑) > 평일(회색)
              let headerColorClass = 'text-gray-300';
              if (isHoliday) {
                headerColorClass = 'text-purple-300';
              } else if (isSunday) {
                headerColorClass = 'text-red-300';
              } else if (isSaturday) {
                headerColorClass = 'text-blue-300';
              }

              return (
                <th
                  key={day.toISOString()}
                  className={`p-1 sticky top-0 border-r border-b border-[#ffffff]/10 text-center align-middle min-w-[40px] bg-[#081429] ${headerColorClass} cursor-context-menu`}
                  title={holidayName || '우클릭으로 열 숨기기'}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setDateContextMenu({ x: e.clientX, y: e.clientY, dateKey });
                  }}
                >
                  <div className="flex flex-col items-center justify-center leading-tight">
                    <span className="text-xxs font-bold">{date}</span>
                    <span className="text-micro uppercase opacity-75">{dayName}</span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {students.length > 0 ? (
            <StudentTableBody
              students={students}
              days={visibleDays}
              hasHiddenDates={hiddenDates.size > 0}
              currentDate={currentDate}
              salaryConfig={salaryConfig}
              onEditStudent={onEditStudent}
              onCellClick={handleCellClick}
              onContextMenu={handleContextMenu}
              onSalarySettingChange={onSalarySettingChange}
              pendingUpdatesByStudent={pendingUpdatesByStudent}
              pendingMemosByStudent={pendingMemosByStudent}
              groupOrder={groupOrder}
              onGroupOrderChange={onGroupOrderChange}
              examsByDate={examsByDate}
              scoresByStudent={scoresByStudent}
              onHomeworkChange={onHomeworkChange}
              collapsedGroups={collapsedGroups}
              onCollapsedGroupsChange={onCollapsedGroupsChange}
              highlightWeekends={highlightWeekends}
              holidayDateSet={holidayDateSet}
              holidayNameMap={holidayNameMap}
              sortMode={sortMode}
              totalGroupCounts={totalGroupCounts}
            />
          ) : (
            <tr>
              <td colSpan={days.length + 5 + (hasHiddenDates ? 1 : 0)} className="p-12 text-center text-gray-400">
                등록된 학생이 없습니다. 상단의 '학생 추가' 버튼을 눌러 시작하세요.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {contextMenu && (
        <div
          className="context-menu-container fixed z-50 bg-white rounded-sm shadow-xl border border-gray-200 py-1 min-w-[180px] animate-in fade-in zoom-in-95 duration-100 origin-top-left"
          style={{ top: Math.min(contextMenu.y, window.innerHeight - 250), left: Math.min(contextMenu.x, window.innerWidth - 200) }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.mode === 'menu' ? (
            <>
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <span>수업 시간 선택</span>
                <span className="font-normal text-xxs text-gray-400">{contextMenu.dateKey}</span>
              </div>

              <button onClick={() => setContextMenu({ ...contextMenu, mode: 'memo' })} className="w-full text-left px-4 py-2 hover:bg-yellow-50 text-sm text-yellow-700 flex items-center gap-2 border-b border-gray-50">
                <StickyNote size={14} />
                <span>{contextMenu.memoText ? '메모/사유 수정' : '메모/사유 입력'}</span>
              </button>

              {onCellColorChange && (
                <button onClick={() => setContextMenu({ ...contextMenu, mode: 'color' })} className="w-full text-left px-4 py-2 hover:bg-violet-50 text-sm text-violet-700 flex items-center gap-2 border-b border-gray-50">
                  <Palette size={14} />
                  <span>배경색 변경</span>
                  {contextMenu.currentColor && (
                    <span
                      className="ml-auto w-4 h-4 rounded border border-gray-300"
                      style={{ backgroundColor: PREDEFINED_CELL_COLORS.find(c => c.key === contextMenu.currentColor)?.hex || contextMenu.currentColor }}
                    />
                  )}
                </button>
              )}

              <button onClick={() => handleMenuSelect(1)} className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-gray-700 flex justify-between">
                <span>기본 (2시간)</span> <span className="font-mono text-gray-400">1.0</span>
              </button>
              <button onClick={() => handleMenuSelect(0.5)} className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-gray-700 flex justify-between">
                <span>1시간</span> <span className="font-mono text-gray-400">0.5</span>
              </button>
              <button onClick={() => handleMenuSelect(1.5)} className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-gray-700 flex justify-between">
                <span>3시간</span> <span className="font-mono text-gray-400">1.5</span>
              </button>
              <button onClick={() => handleMenuSelect(2.0)} className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-gray-700 flex justify-between">
                <span>4시간</span> <span className="font-mono text-gray-400">2.0</span>
              </button>
              <button onClick={() => handleMenuSelect(2.5)} className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-gray-700 flex justify-between">
                <span>5시간</span> <span className="font-mono text-gray-400">2.5</span>
              </button>
              <button onClick={() => handleMenuSelect(3.0)} className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-gray-700 flex justify-between">
                <span>6시간</span> <span className="font-mono text-gray-400">3.0</span>
              </button>
              <div className="h-px bg-gray-100 my-1"></div>
              <button onClick={() => handleMenuSelect(0)} className="w-full text-left px-4 py-2 hover:bg-red-50 text-sm text-red-600">
                결석 처리 (0)
              </button>
              <button onClick={() => handleMenuSelect(null)} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-400">
                초기화
              </button>
            </>
          ) : contextMenu.mode === 'memo' ? (
            <div className="p-2 w-64">
              <div className="mb-2 text-xs font-bold text-gray-600 flex items-center gap-1">
                <StickyNote size={12} />
                메모 입력
              </div>
              <textarea
                ref={memoInputRef}
                className="w-full text-sm border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none mb-2 min-h-[80px]"
                placeholder="예: 병결, 여행, 지각 등"
                value={contextMenu.memoText}
                onChange={(e) => setContextMenu({ ...contextMenu, memoText: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleMemoSave();
                  }
                }}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setContextMenu({ ...contextMenu, mode: 'menu' })}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded"
                >
                  취소
                </button>
                <button
                  onClick={handleMemoSave}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                >
                  <Save size={12} /> 저장
                </button>
              </div>
            </div>
          ) : (
            /* Color Picker Mode */
            <div className="p-3 w-56">
              <div className="mb-3 text-xs font-bold text-gray-600 flex items-center gap-1">
                <Palette size={12} />
                배경색 선택
              </div>
              <div className="grid grid-cols-5 gap-2 mb-3">
                {PREDEFINED_CELL_COLORS.map((colorOption) => (
                  <button
                    key={colorOption.key}
                    onClick={() => handleColorSelect(colorOption.key)}
                    className={`w-8 h-8 rounded-sm border-2 transition-all hover:scale-110 ${
                      contextMenu.currentColor === colorOption.key
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: colorOption.hex }}
                    title={colorOption.label}
                  />
                ))}
              </div>
              <div className="flex gap-2 justify-between">
                <button
                  onClick={() => handleColorSelect(null)}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded flex items-center gap-1"
                  title="기본값으로 초기화"
                >
                  <RotateCcw size={12} /> 초기화
                </button>
                <button
                  onClick={() => setContextMenu({ ...contextMenu, mode: 'menu' })}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 날짜 헤더 우클릭 컨텍스트 메뉴 (열 숨기기) */}
      {dateContextMenu && createPortal(
        <div
          className="fixed bg-white rounded-sm shadow-xl border border-gray-200 py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
          style={{ top: dateContextMenu.y, left: dateContextMenu.x, zIndex: 9999 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              if (onHiddenDatesChange) {
                const next = new Set(hiddenDates);
                next.add(dateContextMenu.dateKey);
                onHiddenDatesChange(next);
              }
              setDateContextMenu(null);
            }}
            className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700 flex items-center gap-2"
          >
            <EyeOff size={14} />
            이 열 숨기기
          </button>
        </div>,
        document.body
      )}
    </>
  );
});

Table.displayName = 'Table';

export default Table;
