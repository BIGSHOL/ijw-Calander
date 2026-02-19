import { TimetableClass } from '../../../../types';
import { convertLegacyPeriodId } from '../../constants';

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
        // Remove spaces for robust comparison
        const targetSlot = `${day}${period}`.replace(/\s+/g, '');

        // Schedule 매칭 먼저 확인
        const scheduleMatch = cls.schedule?.some(s => {
            const normalizedS = s.replace(/\s+/g, '');
            // Check exact match or sub-period matching
            return normalizedS === targetSlot || normalizedS.startsWith(`${targetSlot}-`);
        });

        if (!scheduleMatch) return false;

        // 리소스 매칭 (Teacher/Room) - slotTeachers/slotRooms 지원
        if (viewType === 'teacher') {
            // slotTeachers 키 생성: 레거시 periodId (1-2)를 새 periodId (2)로 변환
            // period가 "1-2" 형식이면 "2"로, 이미 "2" 형식이면 그대로 사용
            const normalizedPeriod = convertLegacyPeriodId(period);
            const slotKey = `${day}-${normalizedPeriod}`;
            const slotTeacher = cls.slotTeachers?.[slotKey];

            // slotTeacher가 있으면 그것 사용, 없으면 메인 teacher
            const effectiveTeacher = slotTeacher || cls.teacher;
            return effectiveTeacher?.trim() === resource?.trim();
        } else {
            // Room 뷰는 slotRooms 또는 기본 room
            const normalizedPeriod = convertLegacyPeriodId(period);
            const slotKey = `${day}-${normalizedPeriod}`;
            const slotRoom = cls.slotRooms?.[slotKey];
            const effectiveRoom = slotRoom || cls.room;
            return effectiveRoom?.trim() === resource?.trim();
        }
    });
};

// Helper: 특정 슬롯의 effective teacher/room 가져오기
const getEffectiveResource = (
    cls: TimetableClass,
    day: string,
    period: string,
    viewType: 'teacher' | 'room' | 'class'
): string => {
    const normalizedPeriod = convertLegacyPeriodId(period);
    const slotKey = `${day}-${normalizedPeriod}`;

    if (viewType === 'teacher') {
        return cls.slotTeachers?.[slotKey] || cls.teacher || '';
    } else {
        return cls.slotRooms?.[slotKey] || cls.room || '';
    }
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
    const startPeriod = periods[startPeriodIndex];
    const startResource = getEffectiveResource(cls, day, startPeriod, viewType);

    for (let i = startPeriodIndex + 1; i < periods.length; i++) {
        const nextPeriod = periods[i];
        const targetSlot = `${day}${nextPeriod}`.replace(/\s+/g, '');
        const hasNextSlot = cls.schedule?.some(s => s.replace(/\s+/g, '') === targetSlot);

        if (!hasNextSlot) break;

        // slotTeacher가 다르면 병합 불가 (다른 선생님 담당 교시)
        const nextResource = getEffectiveResource(cls, day, nextPeriod, viewType);
        if (nextResource !== startResource) break;

        // 다음 슬롯의 수업 세트와 시작 슬롯의 수업 세트 비교
        // 동일한 수업 세트면 병합 가능 (합반 포함)
        const classesInNextSlot = getClassesForCell(filteredClasses, day, nextPeriod, startResource, viewType);
        const classesInStartSlot = getClassesForCell(filteredClasses, day, startPeriod, startResource, viewType);
        const startIds = new Set(classesInStartSlot.map(c => c.id));
        const nextIds = new Set(classesInNextSlot.map(c => c.id));
        const isSameSet = startIds.size === nextIds.size && [...startIds].every(id => nextIds.has(id));

        if (isSameSet) {
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
    const currentPeriod = periods[periodIndex];
    const currentResource = getEffectiveResource(cls, day, currentPeriod, viewType);
    const currentIds = new Set(currentCellClasses.map(c => c.id));

    // Look backwards to see if any previous consecutive period started a rowspan that covers this cell
    for (let i = periodIndex - 1; i >= 0; i--) {
        const prevPeriod = periods[i];
        const targetSlot = `${day}${prevPeriod}`.replace(/\s+/g, '');
        const hasPrevSlot = cls.schedule?.some(s => s.replace(/\s+/g, '') === targetSlot);

        if (hasPrevSlot) {
            // slotTeacher가 다르면 병합 불가 (이 셀은 새로운 시작점)
            const prevResource = getEffectiveResource(cls, day, prevPeriod, viewType);
            if (prevResource !== currentResource) {
                return false;
            }

            // 이전 슬롯의 수업 세트와 현재 슬롯의 수업 세트 비교
            // 동일한 수업 세트면 이전 셀의 rowspan에 포함됨
            const classesInPrevSlot = getClassesForCell(filteredClasses, day, prevPeriod, currentResource, viewType);
            const prevIds = new Set(classesInPrevSlot.map(c => c.id));
            const isSameSet = currentIds.size === prevIds.size && [...currentIds].every(id => prevIds.has(id));

            if (!isSameSet) {
                // 수업 세트가 다르면 병합 불가, 새로운 시작점
                return false;
            }

            // 이전 슬롯과 동일한 수업 세트 → 이 셀은 rowspan에 포함됨
            return true;
        } else {
            // Break in the chain, so this is a new start
            break;
        }
    }
    return false;
};

