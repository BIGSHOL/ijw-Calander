import React, { useState, useMemo } from 'react';
import { Student, SalaryConfig } from '../types';
import { Exam, StudentScore } from '../../../types';
import { StudentTermSummary } from '../../../types/enrollmentTerm';
import { ChevronUp, ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react';
import StudentRow from './StudentRow';

export interface StudentTableBodyProps {
  students: Student[];
  days: Date[];
  currentDate: Date;
  salaryConfig: SalaryConfig;
  onEditStudent: (student: Student) => void;
  onCellClick: (studentId: string, className: string, dateKey: string, currentValue: number | undefined, isValid: boolean) => void;
  onContextMenu: (e: React.MouseEvent, student: Student, dateKey: string, isValid: boolean) => void;
  onSalarySettingChange?: (studentId: string, className: string, salarySettingId: string | null) => void;
  pendingUpdatesByStudent?: Record<string, Record<string, number | null>>;
  pendingMemosByStudent?: Record<string, Record<string, string>>;
  groupOrder?: string[];
  onGroupOrderChange?: (newOrder: string[]) => void;
  examsByDate?: Map<string, Exam[]>;
  scoresByStudent?: Map<string, Map<string, StudentScore>>;
  onHomeworkChange?: (studentId: string, className: string, dateKey: string, value: boolean) => void;
  collapsedGroups?: Set<string>;
  onCollapsedGroupsChange?: (newCollapsed: Set<string>) => void;
  highlightWeekends?: boolean;
  holidayDateSet?: Set<string>;
  holidayNameMap?: Map<string, string>;
  sortMode?: 'class' | 'name';
  hasHiddenDates?: boolean;
  totalGroupCounts?: Map<string, number>;
  enrollmentTerms?: Map<string, StudentTermSummary>;
  onEnrollmentTermClick?: (studentId: string, studentName: string, rect: { top: number; left: number }) => void;
}

const StudentTableBody = React.memo(({
  students,
  days,
  hasHiddenDates = false,
  currentDate,
  salaryConfig,
  onEditStudent,
  onCellClick,
  onContextMenu,
  onSalarySettingChange,
  pendingUpdatesByStudent,
  pendingMemosByStudent,
  groupOrder = [],
  onGroupOrderChange,
  examsByDate,
  scoresByStudent,
  onHomeworkChange,
  collapsedGroups: externalCollapsedGroups,
  onCollapsedGroupsChange,
  highlightWeekends = false,
  holidayDateSet = new Set(),
  holidayNameMap = new Map(),
  sortMode = 'class',
  totalGroupCounts,
  enrollmentTerms,
  onEnrollmentTermClick
}: StudentTableBodyProps) => {
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

  // Sort students by group order (수업 뷰) or by name (이름 뷰)
  const sortedStudents = useMemo(() => {
    if (sortMode === 'name') {
      // 이름순 정렬 (flat, 그룹 무시)
      return [...students].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
    }

    // 수업별 그룹 정렬 (기존 로직)
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
        if (orderA === -1) return 1;
        if (orderB === -1) return -1;
        return orderA - orderB;
      }

      // Within same group, maintain original order or sort by name
      return (a.name || '').localeCompare(b.name || '', 'ko');
    });
  }, [students, groupOrder, uniqueGroups, sortMode]);

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

    // 이름 뷰: 그룹 헤더 없이 바로 학생 행 렌더링
    if (sortMode === 'name') {
      // 그룹 헤더, 접기/펼치기 모두 스킵
    } else {
    // 수업 뷰: 기존 그룹 헤더 로직
    // 1. Group Header Logic
    const studentGroup = student.group || '그룹 없음';
    if (student.group && studentGroup !== currentGroup) {
      currentGroup = studentGroup;
      const groupIdx = effectiveGroupOrder.indexOf(currentGroup);
      const isFirst = groupIdx <= 0;
      const isLast = groupIdx >= effectiveGroupOrder.length - 1;
      const isCollapsed = collapsedGroups.has(currentGroup);
      const studentCount = totalGroupCounts?.get(currentGroup) ?? groupStudentCounts.get(currentGroup) ?? 0;

      const groupStudents = students.filter(s => s.group === currentGroup);
      const firstStudent = groupStudents[0];
      const isAssistantGroup = firstStudent ?
        (!firstStudent.mainClasses?.includes(currentGroup) && firstStudent.slotClasses?.includes(currentGroup)) :
        false;

      rows.push(
        <tr key={`group-${currentGroup}`} className="bg-slate-100 border-y border-slate-200">
          <td colSpan={days.length + 6 + (hasHiddenDates ? 1 : 0)} className="py-2 px-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
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
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-xxs font-bold">
                  부담임
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xxs font-bold">
                  담임
                </span>
              )}
              {isCollapsed ? (
                <Folder size={14} className="text-slate-400" />
              ) : (
                <FolderOpen size={14} className="text-slate-400" />
              )}
              {currentGroup}
              {isCollapsed && (
                <span className="text-slate-400 font-normal text-xxs ml-1">
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
      const studentCount = totalGroupCounts?.get('그룹 없음') ?? groupStudentCounts.get('그룹 없음') ?? 0;

      rows.push(
        <tr key="group-none" className="bg-slate-100 border-y border-slate-200">
          <td colSpan={days.length + 6 + (hasHiddenDates ? 1 : 0)} className="py-2 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <div className="flex items-center gap-2">
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
                <span className="text-slate-400 font-normal text-xxs ml-1">
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
    } // end of sortMode === 'class' block

    const updates = pendingUpdatesByStudent?.[student.id];
    const memos = pendingMemosByStudent?.[student.id];

    rows.push(
      <StudentRow
        key={`${student.id}_${student.group || 'nogroup'}`}
        student={student}
        idx={rankIndex}
        days={days}
        currentDate={currentDate}
        salaryConfig={salaryConfig}
        onEditStudent={onEditStudent}
        onCellClick={onCellClick}
        onContextMenu={onContextMenu}
        onSalarySettingChange={onSalarySettingChange}
        pendingUpdates={updates}
        pendingMemos={memos}
        examsByDate={examsByDate}
        scoresByStudent={scoresByStudent}
        onHomeworkChange={onHomeworkChange}
        highlightWeekends={highlightWeekends}
        holidayDateSet={holidayDateSet}
        holidayNameMap={holidayNameMap}
        hasHiddenDates={hasHiddenDates}
        enrollmentTerm={enrollmentTerms?.get(student.id)}
        onEnrollmentTermClick={onEnrollmentTermClick}
      />
    );
  });

  return <>{rows}</>;
});

StudentTableBody.displayName = 'StudentTableBody';

export default StudentTableBody;
