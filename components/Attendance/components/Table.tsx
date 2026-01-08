import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Student, SalaryConfig } from '../types';
import { getDaysInMonth, formatDateDisplay, formatDateKey, getBadgeStyle, getStudentStatus, isDateValidForStudent } from '../utils';
import { Sparkles, LogOut, Folder, FolderOpen, StickyNote, Save, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';

interface Props {
  currentDate: Date;
  students: Student[];
  salaryConfig: SalaryConfig;
  onAttendanceChange: (studentId: string, dateKey: string, value: number | null) => void;
  onEditStudent: (student: Student) => void;
  onMemoChange: (studentId: string, dateKey: string, memo: string) => void;
  pendingUpdatesByStudent?: Record<string, Record<string, number | null>>;
  pendingMemosByStudent?: Record<string, Record<string, string>>;
  // Group ordering props
  groupOrder?: string[];
  onGroupOrderChange?: (newOrder: string[]) => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  studentId: string;
  dateKey: string;
  mode: 'menu' | 'memo'; // 'menu' for default actions, 'memo' for editing note
  memoText: string;
}

const Table: React.FC<Props> = ({
  currentDate,
  students,
  salaryConfig,
  onAttendanceChange,
  onEditStudent,
  onMemoChange,
  pendingUpdatesByStudent,
  pendingMemosByStudent,
  groupOrder = [],
  onGroupOrderChange
}) => {
  const days = useMemo(() => getDaysInMonth(currentDate), [currentDate]);
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

    // Get existing memo if any
    const existingMemo = student.memos?.[dateKey] || '';

    // Calculate position (keep it within viewport bounds roughly)
    // For simplicity, just using clientX/Y. A robust solution would measure window size.
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      studentId: student.id,
      dateKey,
      mode: 'menu',
      memoText: existingMemo,
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
        rows.push(
          <tr key={`group-${currentGroup}`} className="bg-slate-100 border-y border-slate-200">
            <td colSpan={days.length + 5} className="py-2 px-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
              <div className="flex items-center gap-2">
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

      const salarySetting = salaryConfig.items.find(item => item.id === student.salarySettingId);
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
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                  담임
                </span>
              )}
              {isNew && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#fdb813] text-[#081429] text-[9px] font-extrabold shadow-sm animate-pulse">
                  <Sparkles size={8} fill="#081429" /> NEW
                </span>
              )}
              {isLeaving && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[9px] font-bold">
                  <LogOut size={8} /> END
                </span>
              )}
            </button>
          </td>
          <td className="p-3 sticky left-[148px] z-10 bg-white group-hover:bg-gray-50 border-r border-b border-gray-200 align-middle">
            <div className="flex flex-col gap-1.5 justify-center">
              <div className="text-xs text-[#373d41] font-medium flex items-center gap-1">
                <span className="truncate max-w-[80px]" title={student.school}>{student.school}</span>
                <span className="text-gray-300">|</span>
                <span>{student.grade}</span>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full w-fit font-bold ${badgeClass}`}
                style={badgeStyle}
              >
                {levelName}
              </span>
            </div>
          </td>

          {/* Stat Cells */}
          <td className="p-3 border-r border-b border-gray-200 text-center text-gray-500 bg-[#f8f9fa] font-mono align-middle">
            <div className="flex flex-wrap justify-center gap-0.5 max-w-[60px] mx-auto">
              {[...(student.days || [])].sort((a, b) => {
                const order = ['월', '화', '수', '목', '금', '토', '일'];
                return order.indexOf(a[0]) - order.indexOf(b[0]);
              }).map(d => {
                const dayChar = d[0];
                let colorClass = "bg-white border-gray-200 text-gray-600";
                if (dayChar === '토') colorClass = "bg-blue-50 border-blue-200 text-blue-600";
                if (dayChar === '일') colorClass = "bg-red-50 border-red-200 text-red-600";
                return (
                  <span key={d} className={`text-[9px] border px-1 rounded ${colorClass}`}>{dayChar}</span>
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
    <div className="flex-1 overflow-hidden flex flex-col bg-white border border-gray-200 rounded-lg shadow-sm relative">
      <div className="overflow-auto custom-scrollbar relative h-full">
        <table className="border-collapse w-full min-w-max text-sm text-left">
          <thead className="bg-[#081429] text-white font-medium sticky top-0 z-20 shadow-md">
            <tr>
              {/* Sticky Left Columns - Added align-middle for vertical centering */}
              <th className="p-3 sticky left-0 z-30 bg-[#081429] border-r border-b border-[#ffffff]/10 w-12 text-center text-gray-400 align-middle">#</th>
              <th className="p-3 sticky left-12 z-30 bg-[#081429] border-r border-b border-[#ffffff]/10 min-w-[100px] align-middle">이름</th>
              <th className="p-3 sticky left-[148px] z-30 bg-[#081429] border-r border-b border-[#ffffff]/10 min-w-[150px] align-middle">학교/학년</th>

              {/* Stat Columns - Added align-middle */}
              <th className="p-3 border-r border-b border-[#ffffff]/10 min-w-[60px] text-center bg-[#ffffff]/5 align-middle">요일</th>
              <th className="p-3 border-r border-b border-[#ffffff]/10 min-w-[60px] text-center bg-[#ffffff]/5 align-middle">출석</th>

              {/* Dynamic Date Columns */}
              {days.map((day) => {
                const { date, day: dayName, isWeekend } = formatDateDisplay(day);
                return (
                  <th
                    key={day.toISOString()}
                    className={`p-2 border-r border-b border-[#ffffff]/10 min-w-[50px] text-center align-middle ${isWeekend ? 'text-red-300' : 'text-gray-300'
                      }`}
                  >
                    <div className="flex flex-col items-center justify-center leading-tight">
                      <span className="text-xs">{date}</span>
                      <span className="text-[10px] uppercase opacity-75">{dayName}</span>
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
      </div>

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
                <span className="font-normal text-[10px] text-gray-400">{contextMenu.dateKey}</span>
              </div>

              <button onClick={() => setContextMenu({ ...contextMenu, mode: 'memo' })} className="w-full text-left px-4 py-2 hover:bg-yellow-50 text-sm text-yellow-700 flex items-center gap-2 border-b border-gray-50">
                <StickyNote size={14} />
                <span>{contextMenu.memoText ? '메모/사유 수정' : '메모/사유 입력'}</span>
              </button>

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
          ) : (
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
          )}
        </div>
      )}
    </div>
  );
};

// Extracted & Memoized Components

const StudentTableBody = React.memo(({ students, days, currentDate, salaryConfig, onEditStudent, onCellClick, onContextMenu, pendingUpdatesByStudent, pendingMemosByStudent, groupOrder = [], onGroupOrderChange }: {
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
}) => {
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

  const rows: React.ReactNode[] = [];
  let currentGroup: string | null = null;
  let rankIndex = 0;

  students.forEach((student) => {
    rankIndex++;

    // 1. Group Header Logic
    const studentGroup = student.group || '그룹 없음';
    if (student.group && studentGroup !== currentGroup) {
      currentGroup = studentGroup;
      const groupIdx = groupOrder.indexOf(currentGroup);
      const isFirst = groupIdx <= 0;
      const isLast = groupIdx >= groupOrder.length - 1 || groupIdx === -1;

      rows.push(
        <tr key={`group-${currentGroup}`} className="bg-slate-100 border-y border-slate-200">
          <td colSpan={days.length + 5} className="py-2 px-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <FolderOpen size={14} className="text-slate-400" />
              {currentGroup}
              {onGroupOrderChange && (
                <div className="flex items-center gap-0.5 ml-2">
                  <button
                    onClick={() => moveGroup(currentGroup!, 'up')}
                    disabled={isFirst}
                    className={`p-0.5 rounded hover:bg-slate-200 transition-colors ${isFirst ? 'opacity-30 cursor-not-allowed' : ''}`}
                    title="위로 이동"
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    onClick={() => moveGroup(currentGroup!, 'down')}
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
      />
    );
  });

  return <>{rows}</>;
});

const StudentRow = React.memo(({ student, idx, days, currentDate, salaryConfig, onEditStudent, onCellClick, onContextMenu, pendingUpdates, pendingMemos }: {
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
}) => {
  const currentMonthStr = currentDate.toISOString().slice(0, 7);

  // Merge attendance with pending updates for stats calculation within the row
  // Note: This only affects the "Attended Units" count displayed in the row.
  const attendanceDisplay = { ...student.attendance, ...pendingUpdates };

  const attendedUnits = Object.entries(attendanceDisplay)
    .filter(([k, v]) => k.startsWith(currentMonthStr) && (v as number) > 0)
    .reduce((acc, [_, v]) => acc + (v as number), 0);

  const salarySetting = salaryConfig.items.find(item => item.id === student.salarySettingId);
  const levelName = salarySetting ? salarySetting.name : '미설정';
  const badgeStyle = salarySetting ? getBadgeStyle(salarySetting.color) : undefined;
  const badgeClass = salarySetting ? 'border' : 'bg-gray-100 text-gray-500 border-gray-200';
  const { isNew, isLeaving } = getStudentStatus(student, currentDate);

  return (
    <tr className="group hover:bg-gray-50 transition-colors">
      {/* Fixed Columns */}
      <td className="p-3 sticky left-0 z-10 bg-white group-hover:bg-gray-50 border-r border-b border-gray-200 text-center text-[#373d41]/50 font-mono text-xs align-middle">
        {idx}
      </td>
      <td className="p-3 sticky left-12 z-10 bg-white group-hover:bg-gray-50 border-r border-b border-gray-200 align-middle">
        <button
          onClick={() => onEditStudent(student)}
          className="text-left w-full hover:text-[#081429] font-bold text-[#373d41] truncate flex items-center gap-1.5"
        >
          {student.name}
          {student.isHomeroom && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
              담임
            </span>
          )}
          {isNew && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#fdb813] text-[#081429] text-[9px] font-extrabold shadow-sm animate-pulse">
              <Sparkles size={8} fill="#081429" /> NEW
            </span>
          )}
          {isLeaving && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[9px] font-bold">
              <LogOut size={8} /> END
            </span>
          )}
        </button>
      </td>
      <td className="p-3 sticky left-[148px] z-10 bg-white group-hover:bg-gray-50 border-r border-b border-gray-200 align-middle">
        <div className="flex flex-col gap-1.5 justify-center">
          <div className="text-xs text-[#373d41] font-medium flex items-center gap-1">
            <span className="truncate max-w-[80px]" title={student.school}>{student.school}</span>
            <span className="text-gray-300">|</span>
            <span>{student.grade}</span>
          </div>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full w-fit font-bold ${badgeClass}`}
            style={badgeStyle}
          >
            {levelName}
          </span>
        </div>
      </td>

      {/* Stat Cells */}
      <td className="p-3 border-r border-b border-gray-200 text-center text-gray-500 bg-[#f8f9fa] font-mono align-middle">
        <div className="flex flex-wrap justify-center gap-0.5 max-w-[60px] mx-auto">
          {[...(student.days || [])].sort((a, b) => {
            const order = ['월', '화', '수', '목', '금', '토', '일'];
            return order.indexOf(a[0]) - order.indexOf(b[0]);
          }).map(d => {
            const dayChar = d[0];
            let colorClass = "bg-white border-gray-200 text-gray-600";
            if (dayChar === '토') colorClass = "bg-blue-50 border-blue-200 text-blue-600";
            if (dayChar === '일') colorClass = "bg-red-50 border-red-200 text-red-600";
            return (
              <span key={d} className={`text-[11px] border px-1.5 py-0.5 rounded font-medium ${colorClass}`}>{dayChar}</span>
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
        const status = pendingUpdates && dateKey in pendingUpdates ? pendingUpdates[dateKey]! : student.attendance[dateKey];
        const memo = pendingMemos && dateKey in pendingMemos ? pendingMemos[dateKey]! : student.memos?.[dateKey];
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
            onClick={() => onCellClick(student.id, dateKey, status, isValid)}
            onContextMenu={(e) => onContextMenu(e, student, dateKey, isValid)}
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
export default Table;
