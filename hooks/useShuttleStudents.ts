/**
 * 셔틀 학생 시간대별 배정 훅
 *
 * MakeEdu에서 동기화된 shuttle_students 컬렉션 조회 →
 * 기존 students의 enrollments + classes의 schedule로 수업 종료 시간 계산 →
 * 가장 가까운 시간대(14,16,18,20,22시)에 배정
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

export interface ShuttleStudentSlot {
    studentName: string;
    className: string;
    subject: string;
    endTime: string; // 'HH:MM'
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

export function useShuttleStudents() {
    return useQuery({
        queryKey: ['shuttleStudents'],
        queryFn: async (): Promise<{
            scheduleMap: ShuttleScheduleMap;
            shuttleNames: string[];
            syncedAt: string | null;
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

            if (shuttleNameSet.size === 0) {
                const emptyMap: ShuttleScheduleMap = {};
                WEEKDAYS.forEach(day => {
                    emptyMap[day] = {} as Record<TimeSlot, ShuttleStudentSlot[]>;
                    TIME_SLOTS.forEach(slot => { emptyMap[day][slot] = []; });
                });
                return { scheduleMap: emptyMap, shuttleNames: [], syncedAt };
            }

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

            // 3. 모든 enrollments 조회 (collectionGroup)
            const enrollSnap = await getDocs(collectionGroup(db, 'enrollments'));
            const studentEnrollments = new Map<string, { className: string; subject: string }[]>();
            const today = new Date().toISOString().split('T')[0];

            enrollSnap.docs.forEach(doc => {
                const data = doc.data();
                const pathParts = doc.ref.path.split('/');
                const studentId = pathParts[1];

                // 활성 enrollment만 (종료/퇴원 안 된 것)
                if (data.endDate && data.endDate <= today) return;
                if (data.withdrawalDate) return;
                if (!data.className || !data.subject) return;
                // shuttle 자체 enrollment 제외
                if (data.subject === 'shuttle') return;

                if (!studentEnrollments.has(studentId)) {
                    studentEnrollments.set(studentId, []);
                }
                studentEnrollments.get(studentId)!.push({
                    className: data.className,
                    subject: data.subject,
                });
            });

            // 4. 수업(classes) 스케줄 조회
            const classesSnap = await getDocs(
                query(collection(db, 'classes'), where('isActive', '==', true))
            );
            const classScheduleMap = new Map<string, { schedule: string[]; subject: string }>();
            classesSnap.docs.forEach(doc => {
                const data = doc.data();
                if (data.className && data.schedule) {
                    classScheduleMap.set(data.className, {
                        schedule: data.schedule,
                        subject: data.subject || 'math',
                    });
                }
            });

            // 5. 요일별 + 시간대별 배정
            const scheduleMap: ShuttleScheduleMap = {};
            WEEKDAYS.forEach(day => {
                scheduleMap[day] = {} as Record<TimeSlot, ShuttleStudentSlot[]>;
                TIME_SLOTS.forEach(slot => { scheduleMap[day][slot] = []; });
            });

            for (const { id, name } of matchedStudentIds) {
                const enrollments = studentEnrollments.get(id) || [];

                for (const enrollment of enrollments) {
                    const classInfo = classScheduleMap.get(enrollment.className);
                    if (!classInfo) continue;

                    // 이 수업의 요일별 마지막 교시(endTime) 찾기
                    const dayEndTimes = new Map<string, { endTime: string; className: string; subject: string }>();

                    for (const slot of classInfo.schedule) {
                        const parts = slot.split(' ');
                        if (parts.length < 2) continue;
                        const day = parts[0];
                        const periodId = parts[1];
                        if (!WEEKDAYS.includes(day as any)) continue;

                        const periodInfo = getPeriodInfoForSubject(classInfo.subject, day);
                        const pInfo = periodInfo[periodId];
                        if (!pInfo) continue;

                        const existing = dayEndTimes.get(day);
                        if (!existing || pInfo.endTime > existing.endTime) {
                            dayEndTimes.set(day, {
                                endTime: pInfo.endTime,
                                className: enrollment.className,
                                subject: classInfo.subject,
                            });
                        }
                    }

                    // 요일별로 가장 늦은 종료 시간을 시간대에 배정
                    for (const [day, info] of dayEndTimes) {
                        const [hStr, mStr] = info.endTime.split(':');
                        const h = parseInt(hStr, 10);
                        const m = parseInt(mStr, 10);
                        const slot = nearestSlot(h, m);

                        // 같은 학생이 같은 요일/시간대에 이미 있는지 확인 (중복 방지)
                        const existing = scheduleMap[day][slot];
                        const alreadyExists = existing.some(
                            e => e.studentName === name && e.className === info.className
                        );
                        if (!alreadyExists) {
                            existing.push({
                                studentName: name,
                                className: info.className,
                                subject: info.subject,
                                endTime: info.endTime,
                            });
                        }
                    }
                }
            }

            // 각 셀 내 학생을 이름순 정렬
            for (const day of WEEKDAYS) {
                for (const slot of TIME_SLOTS) {
                    scheduleMap[day][slot].sort((a, b) => a.studentName.localeCompare(b.studentName, 'ko'));
                }
            }

            return {
                scheduleMap,
                shuttleNames: [...shuttleNameSet],
                syncedAt,
            };
        },
        staleTime: 60_000,
    });
}

export { TIME_SLOTS, WEEKDAYS };
