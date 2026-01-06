import { useMemo } from 'react';
import { EN_PERIODS, EN_WEEKDAYS, INJAE_PERIODS, EnglishPeriod } from '../englishUtils';
import { IntegrationSettings } from '../IntegrationViewSettings';
import { Teacher } from '../../../../types';

export interface ScheduleCell {
    className?: string;
    room?: string;
    teacher?: string;
    note?: string;
    merged?: { className: string; room?: string, teacher?: string, underline?: boolean }[];
    underline?: boolean;
}

type ScheduleData = Record<string, ScheduleCell>;

export interface ClassInfo {
    name: string;
    mainTeacher: string;
    mainRoom: string;
    startPeriod: number;
    scheduleMap: Record<string, Record<string, ScheduleCell>>;
    weekendShift: number;
    visiblePeriods: EnglishPeriod[];
    finalDays: string[];
    formattedRoomStr?: string;
    minPeriod: number;
    weekdayMin: number;
    weekendMin: number;
    roomByDay: Record<string, string>;
    teacherCounts: Record<string, number>;
}

export const useEnglishClasses = (
    scheduleData: ScheduleData,
    settings: IntegrationSettings,
    teachersData: Teacher[]
) => {
    return useMemo(() => {
        const classMap = new Map<string, ClassInfo>();

        // Helper: 요일별 강의실을 포맷팅 (예: "월수 301 / 목 304")
        const formatRoomByDay = (roomByDay: Record<string, string>): string => {
            if (!roomByDay || Object.keys(roomByDay).length === 0) return '';

            const roomToDays: Record<string, string[]> = {};
            Object.entries(roomByDay).forEach(([day, room]) => {
                if (!room) return;
                if (!roomToDays[room]) roomToDays[room] = [];
                roomToDays[room].push(day);
            });

            const dayOrder = ['월', '화', '수', '목', '금', '토', '일'];
            const parts = Object.entries(roomToDays)
                .map(([room, days]) => {
                    const sortedDays = days.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
                    return `${sortedDays.join('')} ${room}`;
                })
                .sort((a, b) => {
                    const aFirstDay = a.split(' ')[0][0];
                    const bFirstDay = b.split(' ')[0][0];
                    return dayOrder.indexOf(aFirstDay) - dayOrder.indexOf(bFirstDay);
                });

            return parts.join(' / ');
        };

        // Pass 1: Gather Raw Data
        Object.entries(scheduleData).forEach(([key, cell]: [string, ScheduleCell]) => {
            const clsName = cell.className;
            if (!clsName) return;

            const parts = key.split('-');
            if (parts.length !== 3) return;
            const [, periodId, day] = parts;
            const pNum = parseInt(periodId);
            if (isNaN(pNum)) return;

            const processClassEntry = (cName: string, cRoom: string, cTeacher: string, currentDay: string, cUnderline?: boolean) => {
                // 인재원 수업 시간표 압축 매핑 (그룹 설정 기반)
                let mappedPeriodId = periodId;
                const classGroup = settings.customGroups?.find(g => g.classes.includes(cName));
                if (classGroup?.useInjaePeriod) {
                    if (periodId === '5' || periodId === '6') {
                        mappedPeriodId = '5'; // 6교시를 5교시로 병합
                    }
                }

                if (!classMap.has(cName)) {
                    classMap.set(cName, {
                        name: cName,
                        mainTeacher: '',
                        mainRoom: cRoom || '',
                        startPeriod: 0,
                        scheduleMap: {},
                        weekendShift: 0,
                        visiblePeriods: [],
                        finalDays: [],
                        roomByDay: {},
                        teacherCounts: {},
                        minPeriod: 99,
                        weekdayMin: 99,
                        weekendMin: 99,
                    });
                }
                const info = classMap.get(cName)!;

                // 요일별 강의실 추적
                if (cRoom && !info.roomByDay[currentDay]) {
                    info.roomByDay[currentDay] = cRoom;
                }

                // Populate Map with Mapped Period ID
                if (!info.scheduleMap[mappedPeriodId]) {
                    info.scheduleMap[mappedPeriodId] = {};
                }

                info.scheduleMap[mappedPeriodId][day] = {
                    ...cell,
                    className: cName,
                    room: cRoom,
                    teacher: cTeacher,
                    underline: cUnderline ?? cell.underline
                };

                // 선생님별 수업 횟수 카운트
                if (cTeacher) {
                    info.teacherCounts[cTeacher] = (info.teacherCounts[cTeacher] || 0) + 1;
                }
                if (cRoom) info.mainRoom = cRoom;

                // Min/Max Calc
                const mappedPNum = parseInt(mappedPeriodId);
                const dayIdx = EN_WEEKDAYS.indexOf(day as any);
                if (dayIdx !== -1) {
                    if (dayIdx <= 4) { // Weekday (Mon-Fri)
                        info.weekdayMin = Math.min(info.weekdayMin, mappedPNum);
                    } else { // Weekend (Sat-Sun)
                        info.weekendMin = Math.min(info.weekendMin, mappedPNum);
                    }
                }
                info.minPeriod = Math.min(info.minPeriod, mappedPNum);
            };

            processClassEntry(clsName, cell.room || '', cell.teacher || '', day, cell.underline);

            if (cell.merged && cell.merged.length > 0) {
                cell.merged.forEach(m => {
                    if (m.className) {
                        processClassEntry(m.className, m.room || '', cell.teacher || '', day, m.underline);
                    }
                });
            }
        });

        const validClasses = Array.from(classMap.values()).filter(c => {
            const cellCount = Object.values(c.scheduleMap).reduce(
                (sum, dayMap) => sum + Object.keys(dayMap).length,
                0
            );
            return cellCount > 0;
        });

        // Pass 3: Calculate Logic (Weekend Shift & Visible Periods)
        return validClasses.map(c => {
            // 0. 담임 결정
            let determinedMainTeacher = c.mainTeacher;
            const teacherEntries = Object.entries(c.teacherCounts);
            if (teacherEntries.length > 0) {
                const maxCount = Math.max(...teacherEntries.map(([, count]) => count));
                const topTeachers = teacherEntries.filter(([, count]) => count === maxCount);

                if (topTeachers.length === 1) {
                    determinedMainTeacher = topTeachers[0][0];
                } else {
                    const nonNativeTopTeachers = topTeachers.filter(([name]) => {
                        const teacherData = teachersData.find(t => t.name === name);
                        return !teacherData?.isNative;
                    });

                    if (nonNativeTopTeachers.length > 0) {
                        determinedMainTeacher = nonNativeTopTeachers[0][0];
                    } else {
                        determinedMainTeacher = topTeachers[0][0];
                    }
                }
            }
            c.mainTeacher = determinedMainTeacher;

            // 1. Weekend Shift Logic
            let weekendShift = 0;
            if (c.weekdayMin !== 99 && c.weekendMin !== 99 && c.weekdayMin > c.weekendMin) {
                weekendShift = c.weekdayMin - c.weekendMin;
            }
            c.weekendShift = weekendShift;

            // 2. Start Period Determination
            let effectiveMin = 99;
            let effectiveMax = -99;

            Object.keys(c.scheduleMap).forEach(pId => {
                const pNum = parseInt(pId);
                const days = Object.keys(c.scheduleMap[pId]);
                days.forEach(day => {
                    const dIdx = EN_WEEKDAYS.indexOf(day as any);
                    let eff = pNum;
                    if (dIdx >= 5 && weekendShift) {
                        eff = pNum + weekendShift;
                    }
                    effectiveMin = Math.min(effectiveMin, eff);
                    effectiveMax = Math.max(effectiveMax, eff);
                });
            });
            if (effectiveMin === 99) effectiveMin = 1;
            if (effectiveMax === -99) effectiveMax = 1;

            c.startPeriod = effectiveMin;

            // 3. Visible Periods (5-Period Window)
            // Logic from academy-app: Try to center but keep size 4 (actually 5 items: start to start+4)
            // Fixed logic: always show 5 periods if possible
            let start = effectiveMin;
            let end = effectiveMax;

            // Ensure minimal window of 5
            if (end - start < 4) {
                end = start + 4;
            }

            // Clamp
            start = Math.max(1, Math.min(start, 10));
            end = Math.max(1, Math.min(end, 10));

            // Adjust if still < 5 (e.g. at edges)
            if (end - start < 4) {
                // Try to expand down or up
                if (start > 1) start = Math.max(1, end - 4);
                if (end < 10) end = Math.min(10, start + 4);
            }

            // 그룹 설정에 따른 시간대 선택
            const classGroup = settings.customGroups?.find(g => g.classes.includes(c.name));
            const useInjaePeriod = classGroup?.useInjaePeriod || false;
            // NOTE: Injae periods need to be imported or handled. 
            // Assuming INJAE_PERIODS is available from englishUtils, but we need to import it. 
            // If not imported, we fallback to EN_PERIODS. 
            // We need to update imports at the top of the file too.

            const periodsToUse = useInjaePeriod ? INJAE_PERIODS : EN_PERIODS;

            const visiblePeriods = periodsToUse.filter(p => {
                const pid = parseInt(p.id);
                return pid >= start && pid <= end;
            });
            c.visiblePeriods = visiblePeriods;

            // 4. Final Days Logic (Weekend Replacement)
            const finalDays = ['월', '화', '수', '목', '금']; // Default Mon-Fri
            const activeDays = new Set<string>();

            // Scan all class entries to find active days
            Object.values(c.scheduleMap).forEach(dayMap => {
                Object.keys(dayMap).forEach(day => activeDays.add(day));
            });

            const weekendDays = Array.from(activeDays).filter(d => d === '토' || d === '일');

            // Replace empty weekdays with weekend days
            weekendDays.forEach(weekend => {
                if (!finalDays.includes(weekend)) {
                    // Find a weekday slot that has NO classes at all for this class
                    const emptyDayIndex = finalDays.findIndex(d => !activeDays.has(d));

                    if (emptyDayIndex !== -1) {
                        finalDays[emptyDayIndex] = weekend;
                    } else {
                        // If full, replace Friday? (fallback)
                        finalDays[4] = weekend;
                    }
                }
            });

            // Sort to maintain order if needed, but original app replaced in place.
            // Let's sort based on EN_WEEKDAYS index for sanity
            finalDays.sort((a, b) => EN_WEEKDAYS.indexOf(a as any) - EN_WEEKDAYS.indexOf(b as any));
            c.finalDays = finalDays;

            // 5. Formatted Room String
            c.formattedRoomStr = formatRoomByDay(c.roomByDay);

            return c;
        });
    }, [scheduleData, settings, teachersData]);
};
