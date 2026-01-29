import React, { useMemo, useState, useEffect, useRef, forwardRef } from 'react';
import { Student, SalaryConfig, AttendanceViewMode, SessionPeriod } from '../types';
import { getDaysInMonth, formatDateDisplay, formatDateKey, getBadgeStyle, getStudentStatus, isDateValidForStudent, getSchoolLevelSalarySetting, getDaysInSessionRanges } from '../utils';
import { formatSchoolGrade } from '../../../utils/studentUtils';
import { Sparkles, LogOut, Folder, FolderOpen, StickyNote, Save, ChevronUp, ChevronDown, ChevronRight, GripVertical, Check, X, Palette, RotateCcw } from 'lucide-react';
import { Exam, StudentScore, GRADE_COLORS } from '../../../types';

// 미리 정의된 셀 배경색 팔레트
export const PREDEFINED_CELL_COLORS = [
  { key: 'orange', label: '주황 (기본)', color: 'bg-orange-200', hex: '#fed7aa' },
  { key: 'yellow', label: '노랑', color: 'bg-yellow-200', hex: '#fef08a' },
  { key: 'green', label: '초록', color: 'bg-green-200', hex: '#bbf7d0' },
  { key: 'emerald', label: '에메랄드', color: 'bg-emerald-200', hex: '#a7f3d0' },
  { key: 'cyan', label: '하늘', color: 'bg-cyan-200', hex: '#a5f3fc' },
  { key: 'blue', label: '파랑', color: 'bg-blue-200', hex: '#bfdbfe' },
  { key: 'violet', label: '보라', color: 'bg-violet-200', hex: '#ddd6fe' },
  { key: 'pink', label: '분홍', color: 'bg-pink-200', hex: '#fbcfe8' },
  { key: 'rose', label: '장미', color: 'bg-rose-200', hex: '#fecdd3' },
  { key: 'gray', label: '회색', color: 'bg-gray-300', hex: '#d1d5db' },
] as const;

interface Props {
  currentDate: Date;
  students: Student[];
  salaryConfig: SalaryConfig;
  onAttendanceChange: (studentId: string, dateKey: string, value: number | null) => void;
  onEditStudent: (student: Student) => void;
  onMemoChange: (studentId: string, dateKey: string, memo: string) => void;
  onHomeworkChange?: (studentId: string, dateKey: string, value: boolean) => void;  // 과제 토글
  onCellColorChange?: (studentId: string, dateKey: string, color: string | null) => void;  // 셀 배경색 변경
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
}

interface ContextMenuState {
  x: number;
  y: number;
  studentId: string;
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
  highlightWeekends = false
}, ref) => {
  // 세션 모드에 따라 표시할 날짜 결정
  const days = useMemo(() => {
    if (viewMode === 'session' && selectedSession) {
      return getDaysInSessionRanges(selectedSession);
    }
    return getDaysInMonth(currentDate);
  }, [currentDate, viewMode, selectedSession]);
  const memoInputRef = useRef<HTMLTextAreaElement>(null);

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

  const handleCellClick = (studentId: string, dateKey: string, currentValue: number | undefined, isValid: boolean) => {
    if (!isValid) return; // Prevent clicking on invalid dates

    let nextValue: number | null = null;
    if (currentValue === undefined || currentValue === null) nextValue = 1;
    else if (currentValue > 0) nextValue = 0;
    else nextValue = null;

    onAttendanceChange(studentId, dateKey, nextValue);
  };

  const handleContextMenu = (e: React.MouseEvent, student: Student, dateKey: string, isValid: boolean) => {
    if (!isValid) return;
    e.preventDefault();

    // Get existing memo and cell color if any
    const existingMemo = student.memos?.[dateKey] || '';
    const existingColor = student.cellColors?.[dateKey] || '';

    // Calculate position (keep it within viewport bounds roughly)
    // For simplicity, just using clientX/Y. A robust solution would measure window size.
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      studentId: student.id,
      dateKey,
      mode: 'menu',
      memoText: existingMemo,
      currentColor: existingColor,
    });
  };

  const handleMenuSelect = (value: number | null) => {
    if (contextMenu) {
      onAttendanceChange(contextMenu.studentId, contextMenu.dateKey, value);
      setContextMenu(null);
    }
  };

  const handleMemoSave = () => {
    if (contextMenu) {
      onMemoChange(contextMenu.studentId, contextMenu.dateKey, contextMenu.memoText);
      setContextMenu(null);
    }
  };

  const handleColorSelect = (colorKey: string | null) => {
    if (contextMenu && onCellColorChange) {
      onCellColorChange(contextMenu.studentId, contextMenu.dateKey, colorKey);
      setContextMenu(null);
    }
  }

  // Helper to render rows with Group Headers
  const renderRows = () => {
    const rows: React.ReactNode[] = [];
    let currentGroup: string | null = null;

    students.forEach((student, idx) => {
      // 1. Group Header Logic
      const studentGroup = student.group || '그룹 없음'; // Default name for no group
      if (student.group && studentGroup !== currentGroup) {
        currentGroup = studentGroup;

        // 같은 그룹의 학생들 중 담임/부담임 여부 확인
        // 그룹의 첫 번째 학생 정보로 판단 (mainClasses 또는 slotClasses 사용)
        const groupStudents = students.filter(s => s.group === currentGroup);
        const firstStudent = groupStudents[0];
        // 그룹이 부담임인지 확인: mainClasses가 비어있고 slotClasses에 현재 그룹이 포함된 경우
        const isAssistantGroup = firstStudent ?
          (!firstStudent.mainClasses?.includes(currentGroup) && firstStudent.slotClasses?.includes(currentGroup)) :
          false;

        rows.push(
          <tr key={`group-${currentGroup}`} className="bg-slate-100 border-y border-slate-200">
            <td colSpan={days.length + 5} className="py-2 px-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
              <div className="flex items-center gap-2">
                {isAssistantGroup ? (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-bold">
                    부담임
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold">
                    담임
                  </span>
                )}
                <FolderOpen size={14} className="text-slate-400" />
                {currentGroup}
              </div>
            </td>
          </tr>
        );
      } else if (!student.group && currentGroup !== '그룹 없음' && currentGroup !== null) {
        // Transition from grouped to ungrouped (if sort logic puts ungrouped last)
        currentGroup = '그룹 없음';
        rows.push(
          <tr key="group-none" className="bg-slate-100 border-y border-slate-200">
            <td colSpan={days.length + 5} className="py-2 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <Folder size={14} className="text-slate-400" />
                그룹 없음
              </div>
            </td>
          </tr>
        );
      }

      // 2. Student Row Logic
      const currentMonthStr = currentDate.toISOString().slice(0, 7);
      const attendedUnits = (Object.entries(student.attendance) as [string, number][])
        .filter(([k, v]) => k.startsWith(currentMonthStr) && v > 0)
        .reduce((acc, [_, v]) => acc + v, 0);

      // Auto-match salary setting: First try explicit ID, then match from school name
      const salarySetting = student.salarySettingId
        ? salaryConfig.items.find(item => item.id === student.salarySettingId)
        : getSchoolLevelSalarySetting(student.school, salaryConfig.items);
      const levelName = salarySetting ? salarySetting.name : '미설정';
      const badgeStyle = salarySetting ? getBadgeStyle(salarySetting.color) : undefined;
      const badgeClass = salarySetting ? 'border' : 'bg-gray-100 text-gray-500 border-gray-200';
      const { isNew, isLeaving } = getStudentStatus(student, currentDate);

      rows.push(
        <tr key={student.id} className="group hover:bg-gray-50 transition-colors">
          {/* Fixed Columns */}
          <td className="p-3 sticky left-0 z-10 bg-white group-hover:bg-gray-50 border-r border-b border-gray-200 text-center text-[#373d41]/50 font-mono text-xs align-middle">
            {idx + 1}
          </td>
          <td className="p-3 sticky left-12 z-10 bg-white group-hover:bg-gray-50 border-r border-b border-gray-200 align-middle">
            <button
              onClick={() => onEditStudent(student)}
              className="text-left w-full hover:text-[#081429] font-bold text-[#373d41] truncate flex items-center gap-1.5"
            >
              {student.name}
              {student.isHomeroom && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-micro font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                  담임
                </span>
              )}
              {isNew && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#fdb813] text-[#081429] text-micro font-extrabold shadow-sm animate-pulse">
                  <Sparkles size={8} fill="#081429" /> NEW
                </span>
              )}
              {isLeaving && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-micro font-bold">
                  <LogOut size={8} /> END
                </span>
              )}
            </button>
          </td>
          <td className="p-3 sticky left-[148px] z-[90] bg-white group-hover:bg-gray-50 border-r border-b border-gray-200 align-middle">
            <div className="flex flex-col gap-1.5 justify-center">
              <div className="text-xs text-[#373d41] font-medium flex items-center gap-1">
                <span className="truncate max-w-[60px]" title={student.school}>{student.school}</span>
                <span className="text-gray-300">|</span>
                <span>{student.grade}</span>
              </div>
              <span
                className={`text-xxs px-2 py-0.5 rounded-full w-fit font-bold ${badgeClass}`}
                style={badgeStyle}
              >
                {levelName}
              </span>
            </div>
          </td>

          {/* Stat Cells */}
          <td className="p-3 border-r border-b border-gray-200 text-center text-gray-500 bg-[#f8f9fa] font-mono align-middle">
            <div className="flex flex-wrap justify-center gap-1 max-w-[140px] mx-auto">
              {[...(student.days || [])].sort((a, b) => {
                const order = ['월', '화', '수', '목', '금', '토', '일'];
                return order.indexOf(a[0]) - order.indexOf(b[0]);
              }).map(d => {
                const dayChar = d[0];
                let colorClass = "bg-white border-gray-300 text-gray-700";
                if (dayChar === '토') colorClass = "bg-blue-50 border-blue-300 text-blue-700";
                if (dayChar === '일') colorClass = "bg-red-50 border-red-300 text-red-700";
                return (
                  <span key={d} className={`text-xs font-bold border px-1.5 py-0.5 rounded ${colorClass}`}>{dayChar}</span>
                );
              })}
            </div>
          </td>
          <td className="p-3 border-r border-b border-gray-200 text-center font-bold text-[#081429] bg-[#f0f4f8] align-middle">
            {attendedUnits}
          </td>

          {/* Attendance Grid */}
          {days.map((day) => {
            const dateKey = formatDateKey(day);
            const { day: dayName } = formatDateDisplay(day);
            const status = student.attendance[dateKey];
            const memo = student.memos?.[dateKey];
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            const isScheduled = (student.days || []).includes(dayName);

            // Validity Check
            const isValid = isDateValidForStudent(dateKey, student);

            let cellClass = "";
            let content: React.ReactNode = null;

            if (!isValid) {
              // Invalid Date
              cellClass = "bg-slate-200 bg-[linear-gradient(45deg,#cbd5e1_25%,transparent_25%,transparent_50%,#cbd5e1_50%,#cbd5e1_75%,transparent_75%,transparent)] bg-[length:8px_8px] cursor-not-allowed shadow-inner border-slate-200";
            } else {
              // Valid Date Logic
              if (status > 0) {
                if (status === 1) {
                  cellClass = "bg-blue-100 hover:bg-blue-200 text-[#081429] cursor-pointer";
                  content = "1";
                } else {
                  cellClass = "bg-[#fff7d1] hover:bg-[#ffeeba] text-[#b45309] cursor-pointer font-bold";
                  content = status;
                }
              } else if (status === 0) {
                cellClass = "bg-red-50 hover:bg-red-100 text-red-500 cursor-pointer";
                content = "0";
              } else if (isScheduled) {
                cellClass = "bg-blue-50 hover:bg-blue-100 cursor-pointer";
                content = <div className="w-1.5 h-1.5 rounded-full bg-blue-300 mx-auto" />;
              } else if (isWeekend) {
                cellClass = "bg-[#f8f9fa] text-gray-200 cursor-pointer hover:bg-gray-100";
              } else {
                cellClass = "cursor-pointer hover:bg-gray-100 transition-colors";
              }
            }

            return (
              <td
                key={dateKey}
                onClick={() => handleCellClick(student.id, dateKey, status, isValid)}
                onContextMenu={(e) => handleContextMenu(e, student, dateKey, isValid)}
                className={`p-1 border-r border-b border-gray-200 text-center text-sm font-medium relative ${cellClass} align-middle`}
                title={memo ? `메모: ${memo}` : undefined}
              >
                {content}
                {/* Memo Indicator: Red Triangle in top-right */}
                {memo && (
                  <div className="absolute top-0 right-0 w-0 h-0 border-l-[6px] border-l-transparent border-t-[6px] border-t-red-500/80" />
                )}
              </td>
            );
          })}
        </tr>
      );
    });

    return rows;
  };

  return (
    <>
      <table ref={ref} className="border-separate border-spacing-0 w-full min-w-full text-sm text-left bg-white border border-gray-200 rounded-lg shadow-sm table-fixed">
        <thead className="bg-[#081429] text-white font-medium sticky top-0 z-[100] shadow-md">
          <tr>
            {/* Sticky Left Columns - Compact width */}
            <th className="p-2 sticky left-0 top-0 z-[110] bg-[#081429] border-r border-b border-[#ffffff]/10 w-8 text-center text-gray-400 align-middle text-xs">#</th>
            <th className="p-2 sticky left-8 top-0 z-[110] bg-[#081429] border-r border-b border-[#ffffff]/10 w-[70px] align-middle text-xs">이름</th>
            <th className="p-2 sticky left-[102px] top-0 z-[110] bg-[#081429] border-r border-b border-[#ffffff]/10 w-[80px] align-middle text-xs">학교</th>

            {/* Stat Columns - Compact */}
            <th className="p-2 sticky left-[182px] top-0 z-[110] border-r border-b border-[#ffffff]/10 w-[70px] text-center bg-[#081429] align-middle text-xs">요일</th>
            <th className="p-2 sticky left-[252px] top-0 z-[110] border-r border-b border-[#ffffff]/10 w-[36px] text-center bg-[#081429] align-middle text-xs">출석</th>

            {/* Dynamic Date Columns - Square for 4-quadrant layout */}
            {days.map((day) => {
              const { date, day: dayName, isWeekend } = formatDateDisplay(day);
              return (
                <th
                  key={day.toISOString()}
                  className={`p-1 sticky top-0 border-r border-b border-[#ffffff]/10 text-center align-middle min-w-[40px] bg-[#081429] ${isWeekend ? 'text-red-300' : 'text-gray-300'}`}
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
              days={days}
              currentDate={currentDate}
              salaryConfig={salaryConfig}
              onEditStudent={onEditStudent}
              onCellClick={handleCellClick}
              onContextMenu={handleContextMenu}
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
            />
          ) : (
            <tr>
              <td colSpan={days.length + 5} className="p-12 text-center text-gray-400">
                등록된 학생이 없습니다. 상단의 '학생 추가' 버튼을 눌러 시작하세요.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {contextMenu && (
        <div
          className="context-menu-container fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[180px] animate-in fade-in zoom-in-95 duration-100 origin-top-left"
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
                    className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 ${
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
    </>
  );
});

Table.displayName = 'Table';

// Extracted & Memoized Components

const StudentTableBody = React.memo(({ students, days, currentDate, salaryConfig, onEditStudent, onCellClick, onContextMenu, pendingUpdatesByStudent, pendingMemosByStudent, groupOrder = [], onGroupOrderChange, examsByDate, scoresByStudent, onHomeworkChange, collapsedGroups: externalCollapsedGroups, onCollapsedGroupsChange, highlightWeekends = false }: {
  students: Student[],
  days: Date[],
  currentDate: Date,
  salaryConfig: SalaryConfig,
  onEditStudent: (student: Student) => void,
  onCellClick: (studentId: string, dateKey: string, currentValue: number | undefined, isValid: boolean) => void,
  onContextMenu: (e: React.MouseEvent, student: Student, dateKey: string, isValid: boolean) => void;
  pendingUpdatesByStudent?: Record<string, Record<string, number | null>>;
  pendingMemosByStudent?: Record<string, Record<string, string>>;
  groupOrder?: string[];
  onGroupOrderChange?: (newOrder: string[]) => void;
  examsByDate?: Map<string, Exam[]>;
  scoresByStudent?: Map<string, Map<string, StudentScore>>;
  onHomeworkChange?: (studentId: string, dateKey: string, value: boolean) => void;
  collapsedGroups?: Set<string>;
  onCollapsedGroupsChange?: (newCollapsed: Set<string>) => void;
  highlightWeekends?: boolean;
}) => {
  // 그룹 접기/펼치기 상태 관리 (외부에서 전달받거나 내부 state 사용)
  const [internalCollapsedGroups, setInternalCollapsedGroups] = useState<Set<string>>(new Set());
  const collapsedGroups = externalCollapsedGroups ?? internalCollapsedGroups;

  const toggleGroupCollapse = (groupName: string) => {
    const next = new Set(collapsedGroups);
    if (next.has(groupName)) {
      next.delete(groupName);
    } else {
      next.add(groupName);
    }

    if (onCollapsedGroupsChange) {
      onCollapsedGroupsChange(next);
    } else {
      setInternalCollapsedGroups(next);
    }
  };

  // Extract unique groups from students
  const uniqueGroups = useMemo(() => {
    const groups = new Set<string>();
    students.forEach(s => { if (s.group) groups.add(s.group); });
    return Array.from(groups);
  }, [students]);

  // Helper to move group up/down in order
  const moveGroup = (groupName: string, direction: 'up' | 'down') => {
    if (!onGroupOrderChange) return;

    // Build current effective order (existing order + any new groups at end)
    const currentOrder = [...groupOrder];
    uniqueGroups.forEach(g => {
      if (!currentOrder.includes(g)) currentOrder.push(g);
    });

    const idx = currentOrder.indexOf(groupName);
    if (idx === -1) return;

    if (direction === 'up' && idx > 0) {
      [currentOrder[idx - 1], currentOrder[idx]] = [currentOrder[idx], currentOrder[idx - 1]];
    } else if (direction === 'down' && idx < currentOrder.length - 1) {
      [currentOrder[idx + 1], currentOrder[idx]] = [currentOrder[idx], currentOrder[idx + 1]];
    }

    onGroupOrderChange(currentOrder);
  };

  // Sort students by group order (담임 수업 우선, 부담임 수업 후순위)
  const sortedStudents = useMemo(() => {
    // Build effective group order
    const effectiveOrder = [...groupOrder];
    uniqueGroups.forEach(g => {
      if (!effectiveOrder.includes(g)) effectiveOrder.push(g);
    });

    return [...students].sort((a, b) => {
      const groupA = a.group || '그룹 없음';
      const groupB = b.group || '그룹 없음';

      // 담임 vs 부담임 우선 정렬 (담임 수업 상단)
      const aIsMain = (a.mainClasses?.length || 0) > 0;
      const bIsMain = (b.mainClasses?.length || 0) > 0;
      if (aIsMain && !bIsMain) return -1;
      if (!aIsMain && bIsMain) return 1;

      // Sort by group order first
      const orderA = effectiveOrder.indexOf(groupA);
      const orderB = effectiveOrder.indexOf(groupB);

      if (orderA !== orderB) {
        // Handle -1 (not in order) by putting at end
        if (orderA === -1) return 1;
        if (orderB === -1) return -1;
        return orderA - orderB;
      }

      // Within same group, maintain original order or sort by name
      return (a.name || '').localeCompare(b.name || '', 'ko');
    });
  }, [students, groupOrder, uniqueGroups]);

  // Build effective group order (existing order + any new groups)
  const effectiveGroupOrder = useMemo(() => {
    const order = [...groupOrder];
    uniqueGroups.forEach(g => {
      if (!order.includes(g)) order.push(g);
    });
    return order;
  }, [groupOrder, uniqueGroups]);

  // 각 그룹의 학생 수 계산
  const groupStudentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    sortedStudents.forEach(s => {
      const group = s.group || '그룹 없음';
      counts.set(group, (counts.get(group) || 0) + 1);
    });
    return counts;
  }, [sortedStudents]);

  const rows: React.ReactNode[] = [];
  let currentGroup: string | null = null;
  let rankIndex = 0;

  sortedStudents.forEach((student) => {
    rankIndex++;

    // 1. Group Header Logic
    const studentGroup = student.group || '그룹 없음';
    if (student.group && studentGroup !== currentGroup) {
      currentGroup = studentGroup;
      const groupIdx = effectiveGroupOrder.indexOf(currentGroup);
      const isFirst = groupIdx <= 0;
      const isLast = groupIdx >= effectiveGroupOrder.length - 1;
      const isCollapsed = collapsedGroups.has(currentGroup);
      const studentCount = groupStudentCounts.get(currentGroup) || 0;

      // 같은 그룹의 학생들 중 담임/부담임 여부 확인
      // 그룹의 첫 번째 학생 정보로 판단 (mainClasses 또는 slotClasses 사용)
      const groupStudents = students.filter(s => s.group === currentGroup);
      const firstStudent = groupStudents[0];
      // 그룹이 부담임인지 확인: mainClasses가 비어있고 slotClasses에 현재 그룹이 포함된 경우
      const isAssistantGroup = firstStudent ?
        (!firstStudent.mainClasses?.includes(currentGroup) && firstStudent.slotClasses?.includes(currentGroup)) :
        false;

      rows.push(
        <tr key={`group-${currentGroup}`} className="bg-slate-100 border-y border-slate-200">
          <td colSpan={days.length + 5} className="py-2 px-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
            <div className="flex items-center gap-2">
              {/* 접기/펼치기 버튼 */}
              <button
                onClick={() => toggleGroupCollapse(studentGroup)}
                className="p-0.5 rounded hover:bg-slate-200 transition-colors"
                title={isCollapsed ? '펼치기' : '접기'}
              >
                {isCollapsed ? (
                  <ChevronRight size={14} className="text-slate-500" />
                ) : (
                  <ChevronDown size={14} className="text-slate-500" />
                )}
              </button>
              {/* 담임/부담임 배지 */}
              {isAssistantGroup ? (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-bold">
                  부담임
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold">
                  담임
                </span>
              )}
              {isCollapsed ? (
                <Folder size={14} className="text-slate-400" />
              ) : (
                <FolderOpen size={14} className="text-slate-400" />
              )}
              {currentGroup}
              {/* 접혔을 때 학생 수 표시 */}
              {isCollapsed && (
                <span className="text-slate-400 font-normal text-[10px] ml-1">
                  ({studentCount}명)
                </span>
              )}
              {onGroupOrderChange && (
                <div className="flex items-center gap-0.5 ml-2">
                  <button
                    onClick={() => moveGroup(studentGroup, 'up')}
                    disabled={isFirst}
                    className={`p-0.5 rounded hover:bg-slate-200 transition-colors ${isFirst ? 'opacity-30 cursor-not-allowed' : ''}`}
                    title="위로 이동"
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    onClick={() => moveGroup(studentGroup, 'down')}
                    disabled={isLast}
                    className={`p-0.5 rounded hover:bg-slate-200 transition-colors ${isLast ? 'opacity-30 cursor-not-allowed' : ''}`}
                    title="아래로 이동"
                  >
                    <ChevronDown size={12} />
                  </button>
                </div>
              )}
            </div>
          </td>
        </tr>
      );
    } else if (!student.group && currentGroup !== '그룹 없음' && currentGroup !== null) {
      currentGroup = '그룹 없음';
      const isCollapsed = collapsedGroups.has('그룹 없음');
      const studentCount = groupStudentCounts.get('그룹 없음') || 0;

      rows.push(
        <tr key="group-none" className="bg-slate-100 border-y border-slate-200">
          <td colSpan={days.length + 5} className="py-2 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <div className="flex items-center gap-2">
              {/* 접기/펼치기 버튼 */}
              <button
                onClick={() => toggleGroupCollapse('그룹 없음')}
                className="p-0.5 rounded hover:bg-slate-200 transition-colors"
                title={isCollapsed ? '펼치기' : '접기'}
              >
                {isCollapsed ? (
                  <ChevronRight size={14} className="text-slate-400" />
                ) : (
                  <ChevronDown size={14} className="text-slate-400" />
                )}
              </button>
              <Folder size={14} className="text-slate-400" />
              그룹 없음
              {isCollapsed && (
                <span className="text-slate-400 font-normal text-[10px] ml-1">
                  ({studentCount}명)
                </span>
              )}
            </div>
          </td>
        </tr>
      );
    }

    // 그룹이 접혀있으면 학생 행 렌더링 스킵
    if (collapsedGroups.has(studentGroup)) {
      return;
    }

    const updates = pendingUpdatesByStudent?.[student.id];
    const memos = pendingMemosByStudent?.[student.id];

    rows.push(
      <StudentRow
        key={student.id}
        student={student}
        idx={rankIndex}
        days={days}
        currentDate={currentDate}
        salaryConfig={salaryConfig}
        onEditStudent={onEditStudent}
        onCellClick={onCellClick}
        onContextMenu={onContextMenu}
        pendingUpdates={updates}
        pendingMemos={memos}
        examsByDate={examsByDate}
        scoresByStudent={scoresByStudent}
        onHomeworkChange={onHomeworkChange}
        highlightWeekends={highlightWeekends}
      />
    );
  });

  return <>{rows}</>;
});

const StudentRow = React.memo(({ student, idx, days, currentDate, salaryConfig, onEditStudent, onCellClick, onContextMenu, pendingUpdates, pendingMemos, examsByDate, scoresByStudent, onHomeworkChange, highlightWeekends = false }: {
  student: Student,
  idx: number,
  days: Date[],
  currentDate: Date,
  salaryConfig: SalaryConfig,
  onEditStudent: (student: Student) => void,
  onCellClick: (studentId: string, dateKey: string, currentValue: number | undefined, isValid: boolean) => void,
  onContextMenu: (e: React.MouseEvent, student: Student, dateKey: string, isValid: boolean) => void;
  pendingUpdates?: Record<string, number | null>;
  pendingMemos?: Record<string, string>;
  examsByDate?: Map<string, Exam[]>;
  scoresByStudent?: Map<string, Map<string, StudentScore>>;
  onHomeworkChange?: (studentId: string, dateKey: string, value: boolean) => void;
  highlightWeekends?: boolean;
}) => {
  const currentMonthStr = currentDate.toISOString().slice(0, 7);

  // Merge attendance with pending updates for stats calculation within the row
  // Note: This only affects the "Attended Units" count displayed in the row.
  const attendanceDisplay = { ...student.attendance, ...pendingUpdates };

  const attendedUnits = Object.entries(attendanceDisplay)
    .filter(([k, v]) => k.startsWith(currentMonthStr) && (v as number) > 0)
    .reduce((acc, [_, v]) => acc + (v as number), 0);

  // Auto-match salary setting: First try explicit ID, then match from school name
  const salarySetting = student.salarySettingId
    ? salaryConfig.items.find(item => item.id === student.salarySettingId)
    : getSchoolLevelSalarySetting(student.school, salaryConfig.items);
  const levelName = salarySetting ? salarySetting.name : '미설정';
  const badgeStyle = salarySetting ? getBadgeStyle(salarySetting.color) : undefined;
  const badgeClass = salarySetting ? 'border' : 'bg-gray-100 text-gray-500 border-gray-200';
  const { isNew, isLeaving } = getStudentStatus(student, currentDate);

  return (
    <tr className="group hover:bg-gray-50 transition-colors">
      {/* Fixed Columns - Compact */}
      <td className="p-1 sticky left-0 z-[90] bg-white group-hover:bg-gray-50 border-r border-b border-gray-200 text-center text-[#373d41]/50 font-mono text-xxs align-middle w-8">
        {idx}
      </td>
      <td className="p-1 sticky left-8 z-[90] bg-white group-hover:bg-gray-50 border-r border-b border-gray-200 align-middle w-[70px]">
        <button
          onClick={() => onEditStudent(student)}
          className="text-left w-full hover:text-[#081429] font-bold text-[#373d41] truncate flex items-center gap-0.5 text-xs"
        >
          <span className="truncate">{student.name}</span>
          {isNew && (
            <span className="inline-flex items-center px-1 py-0.5 rounded-full bg-[#fdb813] text-[#081429] text-nano font-extrabold">
              N
            </span>
          )}
          {isLeaving && (
            <span className="inline-flex items-center px-1 py-0.5 rounded-full bg-red-100 text-red-600 text-nano font-bold">
              E
            </span>
          )}
        </button>
      </td>
      <td className="p-1 sticky left-[102px] z-[90] bg-white group-hover:bg-gray-50 border-r border-b border-gray-200 align-middle w-[80px]">
        <div className="flex flex-col gap-0.5 justify-center">
          <div className="text-xxs text-[#373d41] font-medium truncate" title={formatSchoolGrade(student.school, student.grade)}>
            {formatSchoolGrade(student.school, student.grade)}
          </div>
          <span
            className={`text-micro px-1.5 py-0.5 rounded-full w-fit font-bold ${badgeClass}`}
            style={badgeStyle}
          >
            {levelName}
          </span>
        </div>
      </td>

      {/* Stat Cells - Compact & Sticky */}
      <td className="p-1 sticky left-[182px] z-[90] border-r border-b border-gray-200 text-center text-gray-500 bg-[#f8f9fa] font-mono align-middle w-[70px]">
        <div className="flex flex-wrap justify-center gap-0.5">
          {[...(student.days || [])].sort((a, b) => {
            const order = ['월', '화', '수', '목', '금', '토', '일'];
            return order.indexOf(a[0]) - order.indexOf(b[0]);
          }).map(d => {
            const dayChar = d[0];
            let colorClass = "bg-white border-gray-200 text-gray-600";
            if (dayChar === '토') colorClass = "bg-blue-50 border-blue-200 text-blue-600";
            if (dayChar === '일') colorClass = "bg-red-50 border-red-200 text-red-600";
            return (
              <span key={d} className={`text-micro border px-1 rounded font-medium ${colorClass}`}>{dayChar}</span>
            );
          })}
        </div>
      </td>
      <td className="p-1 sticky left-[252px] z-[90] border-r border-b border-gray-200 text-center font-bold text-[#081429] bg-[#f0f4f8] align-middle w-[36px] text-xs">
        {attendedUnits}
      </td>

      {/* Attendance Cells - 4-Quadrant Design */}
      {days.map((day) => {
        const dateKey = formatDateKey(day);
        const { day: dayName } = formatDateDisplay(day);
        const status = pendingUpdates?.[dateKey] ?? student.attendance[dateKey];
        const memo = pendingMemos?.[dateKey] ?? student.memos?.[dateKey];
        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
        const isScheduled = (student.days || []).includes(dayName);

        // Validity Check
        const isValid = isDateValidForStudent(dateKey, student);

        // 과제 완료 여부 (Q2: 1시 방향)
        const homeworkDone = student.homework?.[dateKey] ?? false;

        // 해당 날짜의 시험 목록 조회
        const examsOnDate = examsByDate?.get(dateKey) || [];

        // 해당 학생의 시험 점수 조회
        const studentScores = scoresByStudent?.get(student.id);

        // 시험 점수 데이터 추출 (최대 2개: Q4=쪽지시험, Q3=기타시험)
        let dailyExamScore: StudentScore | null = null;
        let otherExamScore: StudentScore | null = null;

        examsOnDate.forEach(exam => {
          const score = studentScores?.get(exam.id);
          if (score) {
            if (exam.type === 'daily') {
              dailyExamScore = score;
            } else if (!otherExamScore) {
              otherExamScore = score;
            }
          }
        });

        // Cell base class for invalid/valid states
        let cellBaseClass = "";
        if (!isValid) {
          cellBaseClass = "bg-slate-200 bg-[linear-gradient(45deg,#cbd5e1_25%,transparent_25%,transparent_50%,#cbd5e1_50%,#cbd5e1_75%,transparent_75%,transparent)] bg-[length:8px_8px] cursor-not-allowed shadow-inner border-slate-200";
        }

        // 커스텀 셀 색상 조회
        const customCellColor = student.cellColors?.[dateKey];
        const customColorConfig = customCellColor ? PREDEFINED_CELL_COLORS.find(c => c.key === customCellColor) : null;

        // 커스텀 색상이 있으면 전체 셀에 적용
        const hasCustomColor = !!customColorConfig;
        const customBgStyle: React.CSSProperties | undefined = hasCustomColor
          ? { backgroundColor: customColorConfig.hex }
          : undefined;
        const customBgLightStyle: React.CSSProperties | undefined = hasCustomColor
          ? { backgroundColor: customColorConfig.hex, opacity: 0.6 }
          : undefined;

        // Q1 (출석) 스타일 - 커스텀 색상 또는 기본 색상 유지 (출석값과 무관)
        let q1BgClass = "";
        let q1BgStyle: React.CSSProperties | undefined;
        let q1Content: React.ReactNode = null;

        if (isValid) {
          // 배경색: 커스텀 색상 > 등록요일 주황색 > 비등록 흰색 (출석값과 무관하게 유지)
          if (hasCustomColor) {
            q1BgStyle = customBgStyle;
            q1BgClass = "hover:brightness-95";
          } else if (isScheduled) {
            q1BgClass = "bg-orange-200 hover:bg-orange-300";
          } else {
            q1BgClass = highlightWeekends && isWeekend ? "bg-gray-300 hover:bg-gray-400" : "bg-white hover:bg-gray-50";
          }

          // 출석값 표시 (숫자만, 배경색은 변경하지 않음)
          if (status !== undefined && status !== null) {
            if (status === 0) {
              q1Content = <span className="text-red-600 font-bold text-xs">0</span>;
            } else {
              q1Content = <span className="text-gray-800 font-bold text-xs">{status}</span>;
            }
          }
        }

        // Q2, Q3, Q4 배경 - 커스텀 색상 전체 적용 또는 등록 요일 색상
        const getQuadrantBg = (isLighter: boolean = true) => {
          if (!isValid) return { className: "bg-white" };
          if (hasCustomColor) {
            // 커스텀 색상 전체 적용 (연한 버전)
            return { style: isLighter ? customBgLightStyle : customBgStyle, className: "hover:brightness-95" };
          }
          // 주말 회색 처리
          const defaultBg = highlightWeekends && isWeekend ? "bg-gray-300" : "bg-white";
          return { className: isScheduled ? "bg-orange-100/50" : defaultBg };
        };
        const otherQuadrantProps = getQuadrantBg(true);

        return (
          <td
            key={dateKey}
            onContextMenu={(e) => onContextMenu(e, student, dateKey, isValid)}
            className={`p-0 border-r border-b border-gray-200 text-center text-xxs font-medium relative ${cellBaseClass} align-middle ${
              highlightWeekends && isWeekend && isValid ? 'bg-gray-300' : ''
            }`}
            title={memo ? `메모: ${memo}` : undefined}
          >
            {isValid ? (
              // 4등분 레이아웃 - 주말 회색 처리 시 배경색 조정
              <div className={`grid grid-cols-2 grid-rows-2 w-full h-full min-h-[36px] ${
                highlightWeekends && isWeekend ? 'bg-gray-300' : ''
              }`}>
                {/* Q1: 출석 (좌상단) - 11시 방향 */}
                <div
                  onClick={() => onCellClick(student.id, dateKey, status, isValid)}
                  className={`flex items-center justify-center border-r border-b ${highlightWeekends && isWeekend ? 'border-gray-400' : 'border-gray-300/50'} cursor-pointer transition-colors ${q1BgClass}`}
                  style={q1BgStyle}
                >
                  {q1Content}
                </div>
                {/* Q2: 과제 (우상단) - 1시 방향 */}
                <div
                  onClick={() => onHomeworkChange?.(student.id, dateKey, !homeworkDone)}
                  className={`flex items-center justify-center border-b ${highlightWeekends && isWeekend ? 'border-gray-400' : 'border-gray-300/50'} cursor-pointer transition-colors ${
                    homeworkDone
                      ? 'bg-emerald-100 hover:bg-emerald-200'
                      : otherQuadrantProps.className || 'hover:brightness-95'
                  }`}
                  style={!homeworkDone ? otherQuadrantProps.style : undefined}
                  title={homeworkDone ? '과제 완료' : '과제 미완료'}
                >
                  {homeworkDone && <Check className="w-2.5 h-2.5 text-emerald-600" />}
                </div>
                {/* Q4: 쪽지시험 (좌하단) - 7시 방향 */}
                <div
                  className={`flex items-center justify-center border-r ${highlightWeekends && isWeekend ? 'border-gray-400' : 'border-gray-300/50'} ${
                    dailyExamScore
                      ? GRADE_COLORS[dailyExamScore.grade || 'F'].bg
                      : otherQuadrantProps.className || ''
                  }`}
                  style={!dailyExamScore ? otherQuadrantProps.style : undefined}
                  title={dailyExamScore ? `쪽지시험: ${dailyExamScore.score}/${dailyExamScore.maxScore} (${dailyExamScore.grade})` : undefined}
                >
                  {dailyExamScore && (
                    <span className={`text-nano font-bold ${GRADE_COLORS[dailyExamScore.grade || 'F'].text}`}>
                      {dailyExamScore.grade || Math.round(dailyExamScore.percentage || 0)}
                    </span>
                  )}
                </div>
                {/* Q3: 시험 (우하단) - 5시 방향 */}
                <div
                  className={`flex items-center justify-center ${
                    otherExamScore
                      ? GRADE_COLORS[otherExamScore.grade || 'F'].bg
                      : otherQuadrantProps.className || ''
                  }`}
                  style={!otherExamScore ? otherQuadrantProps.style : undefined}
                  title={otherExamScore ? `시험: ${otherExamScore.score}/${otherExamScore.maxScore} (${otherExamScore.grade})` : undefined}
                >
                  {otherExamScore && (
                    <span className={`text-nano font-bold ${GRADE_COLORS[otherExamScore.grade || 'F'].text}`}>
                      {otherExamScore.grade || Math.round(otherExamScore.percentage || 0)}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="w-full h-full min-h-[36px]" />
            )}
            {/* Memo Indicator: Red Triangle in top-right */}
            {memo && (
              <div className="absolute top-0 right-0 w-0 h-0 border-l-[6px] border-l-transparent border-t-[6px] border-t-red-500/80 z-10" />
            )}
          </td>
        );
      })}
    </tr>
  );
});
export default Table;
