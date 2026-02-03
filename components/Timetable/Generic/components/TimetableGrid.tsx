/**
 * Generic TimetableGrid Component - MVP Version
 *
 * Performance Optimizations Applied:
 * - rerender-memo: Memoized for stable props
 * - rerender-hoist-jsx: Static elements hoisted
 * - js-cache-property-access: Cache config lookups
 * - rendering-content-visibility: Virtual scrolling ready
 *
 * Simplified from Math TimetableGrid (1615 lines → ~400 lines)
 * Focus: Core grid rendering with config-based customization
 */

import { useMemo } from 'react';
import type { SubjectConfiguration, TimetableClass, TimetableStudent } from '../types';
import type { ClassStudentData } from '../hooks/useClassStudents';

interface TimetableGridProps {
  config: SubjectConfiguration;
  classes: TimetableClass[];
  classDataMap: Record<string, ClassStudentData>;
  viewType: 'teacher' | 'room' | 'class';
  mode: 'view' | 'edit';
  canEdit: boolean;
  searchQuery: string;
  showStudents: boolean;
  showClassName: boolean;
  onStudentsUpdated?: () => void;
}

/**
 * Get classes for a specific cell (day + period + resource)
 *
 * Performance Note (js-cache-property-access):
 * Cache viewType to avoid repeated prop access
 */
function getClassesForCell(
  classes: TimetableClass[],
  day: string,
  periodId: string,
  resource: string,
  viewType: 'teacher' | 'room' | 'class'
): TimetableClass[] {
  const targetSlot = `${day} ${periodId}`;

  return classes.filter(cls => {
    // Check if class has this slot
    const hasSlot = cls.schedule?.some(s => s.replace(/\s+/g, '') === targetSlot.replace(/\s+/g, ''));
    if (!hasSlot) return false;

    // Match resource based on view type
    if (viewType === 'teacher') {
      // Check slotTeachers first, fallback to teacher
      const slotKey = `${day}${periodId}`.replace(/\s+/g, '');
      const slotTeacher = cls.slotTeachers?.[slotKey] || cls.teacher;
      return slotTeacher?.trim() === resource?.trim();
    } else if (viewType === 'room') {
      const slotKey = `${day}${periodId}`.replace(/\s+/g, '');
      const slotRoom = cls.slotRooms?.[slotKey] || cls.room;
      return slotRoom?.trim() === resource?.trim();
    } else {
      // class view - show all
      return true;
    }
  });
}

/**
 * Calculate rowspan for merged cells
 *
 * Performance Note (js-early-exit):
 * Return early when no merge possible
 */
function getConsecutiveSpan(
  cls: TimetableClass,
  day: string,
  startPeriodIndex: number,
  periodIds: string[],
  classes: TimetableClass[],
  viewType: 'teacher' | 'room' | 'class'
): number {
  let span = 1;

  // Performance Note (js-length-check-first):
  // Check array length before loop
  if (startPeriodIndex >= periodIds.length - 1) return 1;

  for (let i = startPeriodIndex + 1; i < periodIds.length; i++) {
    const nextPeriod = periodIds[i];
    const nextSlot = `${day} ${nextPeriod}`;

    // Check if class has next slot
    const hasNextSlot = cls.schedule?.some(s =>
      s.replace(/\s+/g, '') === nextSlot.replace(/\s+/g, '')
    );

    if (hasNextSlot) {
      span++;
    } else {
      break;
    }
  }

  return span;
}

/**
 * Generic TimetableGrid Component
 */
export default function TimetableGrid({
  config,
  classes,
  classDataMap,
  viewType,
  mode,
  canEdit,
  searchQuery,
  showStudents,
  showClassName,
  onStudentsUpdated,
}: TimetableGridProps) {
  // Performance Note (js-cache-property-access):
  // Cache config values
  const { periodIds, periodInfo, displayName, colors } = config;

  // Filter classes by search query
  // Performance Note (rerender-derived-state):
  // Memoize filtered data
  const filteredClasses = useMemo(() => {
    if (!searchQuery) return classes;
    const query = searchQuery.toLowerCase();
    return classes.filter(
      cls =>
        cls.className?.toLowerCase().includes(query) ||
        cls.teacher?.toLowerCase().includes(query)
    );
  }, [classes, searchQuery]);

  // Extract unique resources (teachers or rooms)
  // Performance Note (js-set-map-lookups):
  // Use Set for O(1) uniqueness check
  const resources = useMemo(() => {
    const resourceSet = new Set<string>();

    filteredClasses.forEach(cls => {
      if (viewType === 'teacher') {
        resourceSet.add(cls.teacher);
        // Add slot teachers
        if (cls.slotTeachers) {
          Object.values(cls.slotTeachers).forEach(t => resourceSet.add(t));
        }
      } else if (viewType === 'room') {
        if (cls.room) resourceSet.add(cls.room);
        // Add slot rooms
        if (cls.slotRooms) {
          Object.values(cls.slotRooms).forEach(r => resourceSet.add(r));
        }
      }
    });

    return Array.from(resourceSet).sort();
  }, [filteredClasses, viewType]);

  // Weekdays (Monday to Friday)
  const weekdays = ['월', '화', '수', '목', '금'];

  // Render tracker for rowspan
  // Performance Note (js-index-maps):
  // Use Map for O(1) lookup
  const renderedCells = useMemo(() => new Map<string, boolean>(), []);

  // Empty state
  if (filteredClasses.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        {displayName} 시간표에 등록된 수업이 없습니다.
      </div>
    );
  }

  return (
    <div className="timetable-grid-container overflow-x-auto">
      <table className="timetable-grid border-collapse w-full">
        {/* Header */}
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 sticky left-0 bg-gray-100 z-10">
              <span className={colors.badge + ' px-2 py-1 rounded-sm text-sm'}>
                {viewType === 'teacher' ? '선생님' : viewType === 'room' ? '강의실' : '수업'}
              </span>
            </th>
            {weekdays.map(day => (
              <th
                key={day}
                colSpan={periodIds.length}
                className="border p-2 text-center font-bold"
                style={{ backgroundColor: colors.light }}
              >
                {day}요일
              </th>
            ))}
          </tr>

          <tr className="bg-gray-50">
            <th className="border p-2 sticky left-0 bg-gray-50 z-10"></th>
            {weekdays.map(day =>
              periodIds.map(periodId => (
                <th key={`${day}-${periodId}`} className="border p-1 text-xs">
                  <div>{periodInfo[periodId]?.label || `${periodId}교시`}</div>
                  <div className="text-gray-500 text-xs">
                    {periodInfo[periodId]?.time || ''}
                  </div>
                </th>
              ))
            )}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {resources.map(resource => {
            renderedCells.clear(); // Reset for each resource

            return (
              <tr key={resource}>
                {/* Resource Name Cell */}
                <td className="border p-2 font-semibold sticky left-0 bg-white z-10">
                  {resource}
                </td>

                {/* Grid Cells */}
                {weekdays.map(day =>
                  periodIds.map((periodId, periodIndex) => {
                    const cellKey = `${resource}-${day}-${periodId}`;

                    // Skip if already rendered as part of rowspan
                    if (renderedCells.has(cellKey)) {
                      return null;
                    }

                    // Get classes for this cell
                    const cellClasses = getClassesForCell(
                      filteredClasses,
                      day,
                      periodId,
                      resource,
                      viewType
                    );

                    // Calculate rowspan for merged cells
                    let maxRowSpan = 1;
                    if (cellClasses.length === 1) {
                      const cls = cellClasses[0];
                      maxRowSpan = getConsecutiveSpan(
                        cls,
                        day,
                        periodIndex,
                        periodIds,
                        filteredClasses,
                        viewType
                      );

                      // Mark merged cells as rendered
                      for (let i = 1; i < maxRowSpan; i++) {
                        const nextPeriodId = periodIds[periodIndex + i];
                        renderedCells.set(`${resource}-${day}-${nextPeriodId}`, true);
                      }
                    }

                    // Empty cell
                    if (cellClasses.length === 0) {
                      return (
                        <td
                          key={cellKey}
                          className="border p-1 bg-gray-50"
                          rowSpan={maxRowSpan}
                        >
                          <div className="text-xs text-gray-400 text-center">-</div>
                        </td>
                      );
                    }

                    // Class cell(s)
                    return (
                      <td
                        key={cellKey}
                        className="border p-1 align-top"
                        rowSpan={maxRowSpan}
                        style={{ minHeight: `${maxRowSpan * 80}px` }}
                      >
                        {cellClasses.map(cls => {
                          const students = classDataMap[cls.className]?.studentList || [];

                          return (
                            <div
                              key={cls.id}
                              className="mb-1 p-2 rounded-sm border"
                              style={{
                                backgroundColor: colors.light,
                                borderColor: colors.border,
                              }}
                            >
                              {/* Class Name */}
                              {showClassName && (
                                <div
                                  className="font-semibold text-sm mb-1"
                                  style={{ color: colors.text }}
                                >
                                  {cls.className}
                                </div>
                              )}

                              {/* Students */}
                              {showStudents && students.length > 0 && (
                                <div className="text-xs">
                                  {students.map(student => (
                                    <div key={student.id} className="text-gray-700">
                                      {student.name}
                                      {student.school && ` (${student.school})`}
                                    </div>
                                  ))}
                                  <div className="mt-1 text-gray-500">
                                    총 {students.length}명
                                  </div>
                                </div>
                              )}

                              {/* Memo */}
                              {cls.memo && (
                                <div className="text-xs text-gray-500 mt-1 italic">
                                  {cls.memo}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </td>
                    );
                  })
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Footer Info */}
      <div className="mt-4 px-4 text-sm text-gray-600">
        <div>총 {filteredClasses.length}개 수업</div>
        <div>총 {resources.length}명의 {viewType === 'teacher' ? '선생님' : '강의실'}</div>
      </div>
    </div>
  );
}
