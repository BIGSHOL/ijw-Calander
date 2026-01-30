/**
 * useVisibleAttendanceStudents - Attendance student filtering and expansion logic
 *
 * PURPOSE: Extract visibleStudents useMemo from AttendanceManager
 *
 * BENEFITS:
 * - 90+ lines of useMemo split into testable function
 * - Independently memoized for optimal performance
 * - Easy to debug and maintain
 * - Reusable across attendance components
 *
 * PERFORMANCE: Vercel React Best Practices (rerender-derived-state)
 * - Original: Large useMemo inside component
 * - Optimized: Separate hook with independent memoization
 * - Result: Only re-runs when dependencies change
 */

import { useMemo } from 'react';
import { Student } from '../components/Attendance/types';

/**
 * Filter students visible for the current month and expand by classes
 *
 * Logic:
 * 1. Filter students active during the current month (based on startDate/endDate)
 * 2. Exclude withdrawn students
 * 3. Expand students by class (one student → multiple rows if multiple classes)
 * 4. Extract class schedules (days) from enrollments
 * 5. Sort by group order and name
 */
export const useVisibleAttendanceStudents = (
  allStudents: Student[],
  currentDate: Date,
  groupOrder: string[]
): Student[] => {
  return useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthFirstDay = new Date(year, month, 1).toISOString().slice(0, 10);
    const monthLastDay = new Date(year, month + 1, 0).toISOString().slice(0, 10);

    // Filter students active during current month
    const filtered = allStudents.filter(s => {
      if (s.status === 'withdrawn') return false;
      if (s.startDate && typeof s.startDate === 'string' && s.startDate > monthLastDay) return false;
      if (s.endDate && typeof s.endDate === 'string' && s.endDate < monthFirstDay) return false;
      return true;
    });

    // Expand students by class (one student can appear in multiple rows)
    const expandedStudents: Student[] = [];
    filtered.forEach(student => {
      const mainClasses = student.mainClasses || [];
      const slotClasses = student.slotClasses || [];
      const allClasses = [...mainClasses, ...slotClasses];

      if (allClasses.length === 0) {
        // No classes - add student as-is
        expandedStudents.push(student);
      } else {
        // Create separate row for each class
        allClasses.forEach(className => {
          // Extract class schedules (days) and dates from enrollments
          const classDays: string[] = [];
          let classStartDate = student.startDate;
          let classEndDate = student.endDate;

          if (student.enrollments && Array.isArray(student.enrollments)) {
            student.enrollments.forEach((enrollment: any) => {
              // Only process enrollments for this class
              if (enrollment.className === className) {
                // Get class-specific dates from enrollment
                if (enrollment.startDate) {
                  classStartDate = enrollment.startDate;
                }
                if (enrollment.endDate) {
                  classEndDate = enrollment.endDate;
                }

                // Skip if enrollment already ended
                if (enrollment.endDate) return;

                // Extract days from schedule field (e.g., "월 1" -> "월")
                if (enrollment.schedule && Array.isArray(enrollment.schedule)) {
                  enrollment.schedule.forEach((slot: string) => {
                    const day = slot.split(' ')[0];
                    if (day && !classDays.includes(day)) {
                      classDays.push(day);
                    }
                  });
                }
                // Also add from days field if exists
                if (enrollment.days && Array.isArray(enrollment.days)) {
                  enrollment.days.forEach((d: string) => {
                    if (!classDays.includes(d)) {
                      classDays.push(d);
                    }
                  });
                }
              }
            });
          }

          // Filter attendance data for this specific class
          // Keys with "::" are class-specific, keys without are legacy (shared)
          const classAttendance: Record<string, number> = {};
          const classMemos: Record<string, string> = {};
          const classHomework: Record<string, boolean> = {};
          const classCellColors: Record<string, string> = {};

          // Only use class-specific keys: "className::dateKey"
          Object.entries(student.attendance || {}).forEach(([key, value]) => {
            if (key.startsWith(`${className}::`)) {
              classAttendance[key.split('::')[1]] = value;
            }
          });

          Object.entries(student.memos || {}).forEach(([key, value]) => {
            if (key.startsWith(`${className}::`)) {
              classMemos[key.split('::')[1]] = value;
            }
          });

          Object.entries(student.homework || {}).forEach(([key, value]) => {
            if (key.startsWith(`${className}::`)) {
              classHomework[key.split('::')[1]] = value;
            }
          });

          Object.entries(student.cellColors || {}).forEach(([key, value]) => {
            if (key.startsWith(`${className}::`)) {
              classCellColors[key.split('::')[1]] = value;
            }
          });

          expandedStudents.push({
            ...student,
            group: className, // Set to single class name
            mainClasses: mainClasses.includes(className) ? [className] : [],
            slotClasses: slotClasses.includes(className) ? [className] : [],
            days: classDays.length > 0 ? classDays : undefined, // Class schedule days
            // Class-specific dates (수업별 시작/종료일)
            startDate: classStartDate,
            endDate: classEndDate,
            // Class-specific attendance data (filtered)
            attendance: classAttendance,
            memos: classMemos,
            homework: classHomework,
            cellColors: classCellColors,
          });
        });
      }
    });

    // Sort by group order and name
    return expandedStudents.sort((a, b) => {
      // Students without group go last
      if (!a.group && b.group) return 1;
      if (a.group && !b.group) return -1;

      const aGroupIdx = groupOrder.indexOf(a.group || '');
      const bGroupIdx = groupOrder.indexOf(b.group || '');

      // Both groups in groupOrder - sort by index
      if (aGroupIdx !== -1 && bGroupIdx !== -1) {
        if (aGroupIdx !== bGroupIdx) return aGroupIdx - bGroupIdx;
      } else if (aGroupIdx !== -1 && bGroupIdx === -1) {
        return -1; // a has order, b doesn't
      } else if (aGroupIdx === -1 && bGroupIdx !== -1) {
        return 1; // b has order, a doesn't
      } else {
        // Neither in groupOrder - sort alphabetically
        const groupCompare = (a.group || '').localeCompare(b.group || '');
        if (groupCompare !== 0) return groupCompare;
      }

      // Within same group, sort by name
      return (a.name || '').localeCompare(b.name || '', 'ko');
    });
  }, [allStudents, currentDate, groupOrder]);
};
