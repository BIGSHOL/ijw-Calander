import { useMemo } from 'react';
import { EN_PERIODS, EN_WEEKDAYS, INJAE_PERIODS, EnglishPeriod } from '../englishUtils';
import { IntegrationSettings } from '../IntegrationViewSettings';
import { Teacher } from '../../../../types';
import { ClassInfo as ClassInfoFromDB } from '../../../../hooks/useClasses';

export interface ScheduleCell {
    className?: string;
    classId?: string;
    room?: string;
    teacher?: string;
    note?: string;
    merged?: { className: string; classId?: string; room?: string, teacher?: string, underline?: boolean }[];
    underline?: boolean;
}

type ScheduleData = Record<string, ScheduleCell>;

export interface ClassInfo {
    name: string;
    classId: string;
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
    roomBySlot: Record<string, string>;  // key: "periodId-day", value: room
    teacherCounts: Record<string, number>;
}

// 시뮬레이션용 클래스 데이터 타입 (SimulationContext의 ScenarioClass와 호환)
interface ScenarioClassData {
    className: string;
    mainTeacher?: string;
    [key: string]: any;
}

export const useEnglishClasses = (
    scheduleData: ScheduleData,
    settings: IntegrationSettings,
    teachersData: Teacher[],
    classesData: ClassInfoFromDB[] = [],
    isSimulationMode: boolean = false,
    scenarioClasses: Record<string, ScenarioClassData> = {}
) => {
    return useMemo(() => {
        const classMap = new Map<string, ClassInfo>();

        // Helper: 교시별 강의실을 포맷팅 (예: "월수 301 / 목 202-302")
        // roomBySlot: { "1-월": "301", "2-월": "301", "2-목": "202", "3-목": "302" }
        const formatRoomBySlot = (roomBySlot: Record<string, string>): string => {
            if (!roomBySlot || Object.keys(roomBySlot).length === 0) return '';

            const dayOrder = ['월', '화', '수', '목', '금', '토', '일'];

            // 요일별로 강의실 목록 수집 (순서 유지)
            const roomsByDay: Record<string, string[]> = {};
            Object.entries(roomBySlot).forEach(([slotKey, room]) => {
                if (!room) return;
                const [, day] = slotKey.split('-');
                if (!roomsByDay[day]) roomsByDay[day] = [];
                // 중복 제거하면서 순서 유지
                if (!roomsByDay[day].includes(room)) {
                    roomsByDay[day].push(room);
                }
            });

            // 강의실 패턴별로 요일 그룹화 (예: "301" -> ["월", "수"], "202-302" -> ["목"])
            const patternToDays: Record<string, string[]> = {};
            Object.entries(roomsByDay).forEach(([day, rooms]) => {
                const pattern = rooms.join('-');  // 여러 강의실이면 "202-302"
                if (!patternToDays[pattern]) patternToDays[pattern] = [];
                patternToDays[pattern].push(day);
            });

            // 정렬 및 포맷팅
            const parts = Object.entries(patternToDays)
                .map(([pattern, days]) => {
                    const sortedDays = days.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
                    return `${sortedDays.join('')} ${pattern}`;
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

            const processClassEntry = (cName: string, cRoom: string, cTeacher: string, currentDay: string, cClassId?: string, cUnderline?: boolean) => {
                // 인재원 수업 시간표 압축 매핑 (그룹 설정 기반)
                let mappedPeriodId = periodId;
                const classGroup = settings.customGroups?.find(g =>
                    (cClassId && g.classes.includes(cClassId)) || g.classes.includes(cName)
                );
                if (classGroup?.useInjaePeriod) {
                    if (periodId === '5' || periodId === '6') {
                        mappedPeriodId = '5'; // 6교시를 5교시로 병합
                    }
                }

                // isHidden 강사(LAB 등)인지 체크
                const teacherData = teachersData.find(t => t.name === cTeacher || t.englishName === cTeacher);
                const isHiddenTeacher = teacherData?.isHidden || false;

                if (!classMap.has(cName)) {
                    classMap.set(cName, {
                        name: cName,
                        classId: '',
                        mainTeacher: '',
                        mainRoom: (!isHiddenTeacher && cRoom) ? cRoom : '',
                        startPeriod: 0,
                        scheduleMap: {},
                        weekendShift: 0,
                        visiblePeriods: [],
                        finalDays: [],
                        roomByDay: {},
                        roomBySlot: {},
                        teacherCounts: {},
                        minPeriod: 99,
                        weekdayMin: 99,
                        weekendMin: 99,
                    });
                }
                const info = classMap.get(cName)!;

                // classId 할당 (첫 번째로 발견된 값 사용)
                if (cClassId && !info.classId) {
                    info.classId = cClassId;
                }

                // 교시-요일별 강의실 추적 (isHidden 강사의 강의실은 무시)
                const slotKey = `${mappedPeriodId}-${currentDay}`;
                if (cRoom && !isHiddenTeacher) {
                    info.roomBySlot[slotKey] = cRoom;
                }
                // 요일별 강의실 추적 (첫 번째 값만 - 호환성 유지, isHidden 제외)
                if (cRoom && !isHiddenTeacher && !info.roomByDay[currentDay]) {
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

                // 선생님별 수업 횟수 카운트 (isHidden 강사는 제외 - 담임 후보에서 제외)
                if (cTeacher && !isHiddenTeacher) {
                    info.teacherCounts[cTeacher] = (info.teacherCounts[cTeacher] || 0) + 1;
                }
                // mainRoom 설정 (isHidden 강사의 강의실은 무시)
                if (cRoom && !isHiddenTeacher) info.mainRoom = cRoom;

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

            processClassEntry(clsName, cell.room || '', cell.teacher || '', day, cell.classId, cell.underline);

            if (cell.merged && cell.merged.length > 0) {
                cell.merged.forEach(m => {
                    if (m.className) {
                        // merged 수업은 자체 teacher가 있으면 사용, 없으면 메인 셀의 teacher 사용
                        processClassEntry(m.className, m.room || '', m.teacher || cell.teacher || '', day, m.classId, m.underline);
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
            // 0. 담임 결정: 시뮬레이션 모드면 scenarioClasses에서, 아니면 classes 컬렉션에서 가져옴 (classId 기준)
            if (isSimulationMode && c.classId && scenarioClasses[c.classId]) {
                c.mainTeacher = scenarioClasses[c.classId].mainTeacher || '';
            } else {
                const classFromDB = classesData.find(cls => cls.id === c.classId);
                c.mainTeacher = classFromDB?.teacher || '';
            }

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
            // Logic: always show 4 periods if possible
            let start = effectiveMin;
            let end = effectiveMax;

            // Ensure minimal window of 4
            if (end - start < 3) {
                end = start + 3;
            }

            // Clamp
            start = Math.max(1, Math.min(start, 10));
            end = Math.max(1, Math.min(end, 10));

            // Adjust if still < 4 (e.g. at edges)
            if (end - start < 3) {
                // Try to expand down or up
                if (start > 1) start = Math.max(1, end - 3);
                if (end < 10) end = Math.min(10, start + 3);
            }

            // 그룹 설정에 따른 시간대 선택
            const classGroup = settings.customGroups?.find(g =>
                (c.classId && g.classes.includes(c.classId)) || g.classes.includes(c.name)
            );
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
            c.formattedRoomStr = formatRoomBySlot(c.roomBySlot);

            return c;
        });
    }, [scheduleData, settings, teachersData, classesData, isSimulationMode, scenarioClasses]);
};
