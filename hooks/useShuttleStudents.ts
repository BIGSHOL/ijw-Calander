/**
 * 셔틀 학생 시간대별 배정 훅
 *
 * MakeEdu에서 동기화된 shuttle_students 컬렉션 조회 →
 * 기존 students의 enrollments + classes의 schedule로 수업 종료 시간 계산 →
 * 가장 가까운 시간대(14,16,18,20,22시)에 배정
 * 강의실 기준 바른학습관/본원 분류 + 이동 필요 학생 감지
 */

import { useQuery } from '@tanstack/react-query';
import { collection, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import {
    MATH_PERIOD_INFO,
    ENGLISH_PERIOD_INFO,
    SCIENCE_PERIOD_INFO,
    KOREAN_PERIOD_INFO,
    WEEKEND_PERIOD_INFO,
} from '../components/Timetable/constants';
import type { PeriodInfo } from '../components/Timetable/constants';

const WEEKDAYS = ['월', '화', '수', '목', '금'] as const;
const TIME_SLOTS = [14, 16, 18, 20, 22] as const;
export type TimeSlot = typeof TIME_SLOTS[number];
export type Location = '바른학습관' | '본원';

export type BoardingType = '승차' | '하차';

export interface ShuttleStudentSlot {
    studentName: string;
    className: string;
    subject: string;
    time: string; // 'HH:MM' - 승차: 첫 수업 시작, 하차: 마지막 수업 종료
    location: Location;
    room: string;
    teacher: string;
    type: BoardingType;
}

export interface TransferStudent {
    studentName: string;
    day: string;
    bareunClasses: { className: string; room: string; startTime: string; endTime: string; teacher: string }[];
    bonwonClasses: { className: string; room: string; startTime: string; endTime: string; teacher: string }[];
}

// 요일별 + 시간대별 학생 배치 결과
export type ShuttleScheduleMap = Record<string, Record<TimeSlot, ShuttleStudentSlot[]>>;

function getPeriodInfoForSubject(subject: string, day: string): Record<string, PeriodInfo> {
    if (day === '토' || day === '일') return WEEKEND_PERIOD_INFO;
    switch (subject) {
        case 'english': return ENGLISH_PERIOD_INFO;
        case 'science': return SCIENCE_PERIOD_INFO;
        case 'korean': return KOREAN_PERIOD_INFO;
        default: return MATH_PERIOD_INFO;
    }
}

function nearestSlot(endHour: number, endMin: number): TimeSlot {
    const t = endHour + endMin / 60;
    return TIME_SLOTS.reduce((prev, curr) =>
        Math.abs(curr - t) < Math.abs(prev - t) ? curr : prev
    );
}

function getLocation(room: string): Location {
    if (!room) return '본원';
    return (room.startsWith('프리미엄') || room.startsWith('바른')) ? '바른학습관' : '본원';
}

function parseSlot(rawSlot: any): { day: string; periodId: string } | null {
    if (typeof rawSlot === 'string') {
        const parts = rawSlot.split(' ');
        if (parts.length < 2) return null;
        return { day: parts[0], periodId: parts[1] };
    }
    if (rawSlot && typeof rawSlot === 'object' && rawSlot.day && rawSlot.periodId) {
        return { day: String(rawSlot.day), periodId: String(rawSlot.periodId) };
    }
    return null;
}

export function useShuttleStudents(enabled = false) {
    return useQuery({
        queryKey: ['shuttleStudents'],
        enabled,
        queryFn: async (): Promise<{
            scheduleMap: ShuttleScheduleMap;
            shuttleNames: string[];
            syncedAt: string | null;
            transferStudents: TransferStudent[];
        }> => {
            // 1. shuttle_students에서 셔틀 탑승 학생 이름 조회
            const shuttleSnap = await getDocs(collection(db, 'shuttle_students'));
            const shuttleNameSet = new Set<string>();
            let syncedAt: string | null = null;

            shuttleSnap.docs.forEach(doc => {
                const data = doc.data();
                if (data.isShuttle && data.name) {
                    shuttleNameSet.add(data.name.trim());
                }
                if (data.syncedAt && !syncedAt) syncedAt = data.syncedAt;
            });

            console.warn('[useShuttleStudents] Step1 - Shuttle students:', shuttleNameSet.size);

            const emptyResult = () => {
                const emptyMap: ShuttleScheduleMap = {};
                WEEKDAYS.forEach(day => {
                    emptyMap[day] = {} as Record<TimeSlot, ShuttleStudentSlot[]>;
                    TIME_SLOTS.forEach(slot => { emptyMap[day][slot] = []; });
                });
                return { scheduleMap: emptyMap, shuttleNames: [], syncedAt, transferStudents: [] };
            };

            if (shuttleNameSet.size === 0) return emptyResult();

            // 2. 전체 students에서 이름 매칭으로 학생 ID 확보
            const studentsSnap = await getDocs(collection(db, 'students'));
            const matchedStudentIds: { id: string; name: string }[] = [];
            studentsSnap.docs.forEach(doc => {
                const data = doc.data();
                const name = (data.name || '').trim();
                if (shuttleNameSet.has(name) && data.status !== 'withdrawn') {
                    matchedStudentIds.push({ id: doc.id, name });
                }
            });
            console.warn('[useShuttleStudents] Step2 - Matched students:', matchedStudentIds.length);

            // 3. 모든 enrollments 조회 (collectionGroup)
            const enrollSnap = await getDocs(collectionGroup(db, 'enrollments'));
            const studentEnrollments = new Map<string, { className: string; subject: string }[]>();
            const today = new Date().toISOString().split('T')[0];

            enrollSnap.docs.forEach(doc => {
                const data = doc.data();
                const studentId = doc.ref.path.split('/')[1];
                if (data.endDate && data.endDate <= today) return;
                if (data.withdrawalDate) return;
                if (!data.className || !data.subject) return;
                if (data.subject === 'shuttle') return;

                if (!studentEnrollments.has(studentId)) {
                    studentEnrollments.set(studentId, []);
                }
                studentEnrollments.get(studentId)!.push({
                    className: data.className,
                    subject: data.subject,
                });
            });

            console.warn('[useShuttleStudents] Step3 - Students with enrollments:', studentEnrollments.size);

            // 4. 수업(classes) 스케줄 + 강의실 조회
            const classesSnap = await getDocs(
                query(collection(db, 'classes'), where('isActive', '==', true))
            );
            const classScheduleMap = new Map<string, {
                schedule: any[];
                subject: string;
                room: string;
                slotRooms: Record<string, string>;
                teacher: string;
            }>();
            classesSnap.docs.forEach(doc => {
                const data = doc.data();
                if (data.className && data.schedule) {
                    classScheduleMap.set(data.className, {
                        schedule: data.schedule,
                        subject: data.subject || 'math',
                        room: data.room || '',
                        slotRooms: data.slotRooms || {},
                        teacher: data.teacher || '',
                    });
                }
            });

            console.warn('[useShuttleStudents] Step4 - Active classes:', classScheduleMap.size);

            // 5. 요일별 + 시간대별 배정 + 이동 감지
            const scheduleMap: ShuttleScheduleMap = {};
            WEEKDAYS.forEach(day => {
                scheduleMap[day] = {} as Record<TimeSlot, ShuttleStudentSlot[]>;
                TIME_SLOTS.forEach(slot => { scheduleMap[day][slot] = []; });
            });

            const transferStudents: TransferStudent[] = [];

            interface Block {
                className: string;
                subject: string;
                room: string;
                location: Location;
                startTime: string;
                endTime: string;
                teacher: string;
            }

            try {
                for (const { id, name } of matchedStudentIds) {
                    const enrollments = studentEnrollments.get(id) || [];
                    if (enrollments.length === 0) continue;

                    // 학생의 모든 수업 블록을 요일별로 수집
                    const blocksByDay = new Map<string, Block[]>();

                    for (const enrollment of enrollments) {
                        const classInfo = classScheduleMap.get(enrollment.className);
                        if (!classInfo) continue;

                        for (const rawSlot of classInfo.schedule) {
                            const parsed = parseSlot(rawSlot);
                            if (!parsed) continue;
                            const { day, periodId } = parsed;
                            if (!WEEKDAYS.includes(day as any)) continue;

                            const periodInfo = getPeriodInfoForSubject(classInfo.subject, day);
                            const pInfo = periodInfo[periodId];
                            if (!pInfo) continue;

                            // 슬롯별 강의실 우선, 없으면 반 기본 강의실
                            const slotKey = `${day} ${periodId}`;
                            const room = classInfo.slotRooms[slotKey] || classInfo.room || '';
                            const location = getLocation(room);

                            if (!blocksByDay.has(day)) blocksByDay.set(day, []);
                            blocksByDay.get(day)!.push({
                                className: enrollment.className,
                                subject: classInfo.subject,
                                room,
                                location,
                                startTime: pInfo.startTime,
                                endTime: pInfo.endTime,
                                teacher: classInfo.teacher,
                            });
                        }
                    }

                    // 요일별로 처리
                    for (const [day, blocks] of blocksByDay) {
                        const sortedByStart = [...blocks].sort((a, b) => a.startTime.localeCompare(b.startTime));
                        const sortedByEnd = [...blocks].sort((a, b) => a.endTime.localeCompare(b.endTime));
                        const firstBlock = sortedByStart[0];
                        const lastBlock = sortedByEnd[sortedByEnd.length - 1];

                        // 승차: 첫 수업 시작 시간 기준
                        const [h1, m1] = firstBlock.startTime.split(':').map(Number);
                        const boardingSlot = nearestSlot(h1, m1);
                        const boardingArr = scheduleMap[day]?.[boardingSlot];
                        if (boardingArr && !boardingArr.some(e => e.studentName === name && e.type === '승차')) {
                            boardingArr.push({
                                studentName: name,
                                className: firstBlock.className,
                                subject: firstBlock.subject,
                                time: firstBlock.startTime,
                                location: firstBlock.location,
                                room: firstBlock.room,
                                teacher: firstBlock.teacher,
                                type: '승차',
                            });
                        }

                        // 하차: 마지막 수업 종료 시간 기준
                        const [h2, m2] = lastBlock.endTime.split(':').map(Number);
                        const alightingSlot = nearestSlot(h2, m2);
                        const alightingArr = scheduleMap[day]?.[alightingSlot];
                        if (alightingArr && !alightingArr.some(e => e.studentName === name && e.type === '하차')) {
                            alightingArr.push({
                                studentName: name,
                                className: lastBlock.className,
                                subject: lastBlock.subject,
                                time: lastBlock.endTime,
                                location: lastBlock.location,
                                room: lastBlock.room,
                                teacher: lastBlock.teacher,
                                type: '하차',
                            });
                        }

                        // 바른학습관 → 본원 이동 감지
                        const locations = new Set(blocks.map(b => b.location));
                        if (locations.has('바른학습관') && locations.has('본원')) {
                            if (!transferStudents.some(t => t.studentName === name && t.day === day)) {
                                const uniqueClasses = (loc: Location) => {
                                    const map = new Map<string, Block>();
                                    blocks.filter(b => b.location === loc).forEach(b => {
                                        const existing = map.get(b.className);
                                        if (!existing || b.endTime > existing.endTime) map.set(b.className, b);
                                    });
                                    // startTime은 해당 반의 가장 이른 시간
                                    return Array.from(map.values()).map(b => {
                                        const earliest = blocks
                                            .filter(bl => bl.className === b.className && bl.location === loc)
                                            .reduce((min, bl) => bl.startTime < min.startTime ? bl : min);
                                        return {
                                            className: b.className,
                                            room: b.room,
                                            startTime: earliest.startTime,
                                            endTime: b.endTime,
                                            teacher: b.teacher,
                                        };
                                    });
                                };
                                transferStudents.push({
                                    studentName: name,
                                    day,
                                    bareunClasses: uniqueClasses('바른학습관'),
                                    bonwonClasses: uniqueClasses('본원'),
                                });
                            }
                        }
                    }
                }
            } catch (err: any) {
                console.error('[useShuttleStudents] Step5 CRASH:', err.message, err.stack);
            }

            // 각 셀 내 학생을 이름순 정렬
            for (const day of WEEKDAYS) {
                for (const slot of TIME_SLOTS) {
                    scheduleMap[day][slot]?.sort((a, b) => a.studentName.localeCompare(b.studentName, 'ko'));
                }
            }

            let totalAssigned = 0;
            for (const day of WEEKDAYS) {
                for (const slot of TIME_SLOTS) {
                    totalAssigned += scheduleMap[day][slot]?.length || 0;
                }
            }
            console.warn('[useShuttleStudents] Total assigned:', totalAssigned, '/ Transfers:', transferStudents.length);

            return {
                scheduleMap,
                shuttleNames: [...shuttleNameSet],
                syncedAt,
                transferStudents,
            };
        },
        staleTime: 60_000,
    });
}

export { TIME_SLOTS, WEEKDAYS };
