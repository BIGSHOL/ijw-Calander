import { TimetableClass } from '../../../../types';

// Subject Theme Colors
export const getSubjectTheme = (subject: string) => {
    switch (subject) {
        case '수학':
            return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200', header: 'bg-blue-600 text-white' };
        case '영어':
            return { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200', header: 'bg-rose-600 text-white' };
        case '국어':
            return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200', header: 'bg-green-600 text-white' };
        case '과학':
            return { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200', header: 'bg-purple-600 text-white' };
        default:
            return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200', header: 'bg-gray-600 text-white' };
    }
};

// Get classes for cell
export const getClassesForCell = (
    filteredClasses: TimetableClass[],
    day: string,
    period: string,
    resource: string,
    viewType: 'teacher' | 'room' | 'class'
) => {
    return filteredClasses.filter(cls => {
        const resourceMatch = viewType === 'teacher' ? cls.teacher === resource : cls.room === resource;
        // Check exact match first
        const targetSlot = `${day} ${period}`;
        const scheduleMatch = cls.schedule?.some(s => s === targetSlot);
        return resourceMatch && scheduleMatch;
    });
};

// Calculate how many consecutive periods a class spans starting from given period
export const getConsecutiveSpan = (
    cls: TimetableClass,
    day: string,
    startPeriodIndex: number,
    periods: string[],
    filteredClasses: TimetableClass[],
    viewType: 'teacher' | 'room' | 'class'
): number => {
    let span = 1;
    for (let i = startPeriodIndex + 1; i < periods.length; i++) {
        const nextPeriod = periods[i];
        const targetSlot = `${day} ${nextPeriod}`;
        const hasNextSlot = cls.schedule?.some(s => s === targetSlot);

        // Check if next slot is "pure" (only contains this class)
        // If next slot has other classes, we must break the span to allow displaying them
        const resource = viewType === 'teacher' ? cls.teacher : cls.room;
        const classesInNextSlot = getClassesForCell(filteredClasses, day, nextPeriod, resource, viewType);
        const isNextSlotDirty = classesInNextSlot.some(c => c.id !== cls.id);

        if (hasNextSlot && !isNextSlotDirty) {
            span++;
        } else {
            break;
        }
    }
    return span;
};

// Check if this cell should be skipped (already covered by a rowspan from above)
export const shouldSkipCell = (
    cls: TimetableClass,
    day: string,
    periodIndex: number,
    currentCellClasses: TimetableClass[],
    periods: string[],
    filteredClasses: TimetableClass[],
    viewType: 'teacher' | 'room' | 'class'
): boolean => {
    // If current cell has multiple classes (conflict), NEVER skip. Show all.
    if (currentCellClasses.length > 1) return false;

    // Look backwards to see if any previous consecutive period started a rowspan that covers this cell
    for (let i = periodIndex - 1; i >= 0; i--) {
        const prevPeriod = periods[i];
        const targetSlot = `${day} ${prevPeriod}`;
        const hasPrevSlot = cls.schedule?.some(s => s === targetSlot);

        if (hasPrevSlot) {
            // Check if the PREVIOUS cell was "dirty". If it was dirty, it couldn't have spanned to here.
            const resource = viewType === 'teacher' ? cls.teacher : cls.room;
            const classesInPrevSlot = getClassesForCell(filteredClasses, day, prevPeriod, resource, viewType);
            const isPrevSlotDirty = classesInPrevSlot.some(c => c.id !== cls.id);

            if (isPrevSlotDirty) {
                // Previous slot had conflict, so it didn't span. We are the start of new segment.
                return false;
            }

            // Previous period has this class and was pure, so this cell is covered
            return true;
        } else {
            // Break in the chain, so this is a new start
            break;
        }
    }
    return false;
};
