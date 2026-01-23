import { useState, useEffect, useMemo } from 'react';
import { collection, collectionGroup, query, onSnapshot, where, getDocs } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { listenerRegistry } from '../../../utils/firebaseCleanup';
import { SubjectType } from '../../../types';
import {
  MATH_PERIOD_INFO,
  ENGLISH_PERIOD_INFO,
  SCIENCE_PERIOD_INFO,
  KOREAN_PERIOD_INFO,
  WEEKEND_PERIOD_INFO,
  PeriodInfo,
} from '../../Timetable/constants';
import { parseTimeToMinutes } from '../../Classroom/types';
import { AssignmentClassData, AssignmentSlot, ScheduleSlotMinimal, RoomConfig } from '../types';
import { getRoomConfig } from '../constants';
import { DEFAULT_ENGLISH_LEVELS } from '../../Timetable/English/englishUtils';

function getPeriodInfoForSubject(
  subject: SubjectType,
  isWeekend: boolean
): Record<string, PeriodInfo> {
  if (isWeekend) return WEEKEND_PERIOD_INFO;
  switch (subject) {
    case 'english': return ENGLISH_PERIOD_INFO;
    case 'science': return SCIENCE_PERIOD_INFO;
    case 'korean': return KOREAN_PERIOD_INFO;
    default: return MATH_PERIOD_INFO;
  }
}

const RE_ENGLISH_LEVEL = /^([A-Z]+)\d/;

function parseEnglishLevel(className: string): { level?: string; order?: number } {
  if (!className) return {};
  const match = className.match(RE_ENGLISH_LEVEL);
  if (!match) return {};
  const abbr = match[1];
  const found = DEFAULT_ENGLISH_LEVELS.find(l => l.abbreviation === abbr);
  if (found) return { level: found.abbreviation, order: found.order };
  return {};
}

export function useClassroomAssignment(selectedDay: string) {
  const [classesData, setClassesData] = useState<AssignmentClassData[]>([]);
  const [enrollmentCounts, setEnrollmentCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  // enrollments 기반 학생 수 조회 (1회)
  useEffect(() => {
    const fetchEnrollments = async () => {
      try {
        const enrollmentsSnapshot = await getDocs(collectionGroup(db, 'enrollments'));
        const counts = new Map<string, Set<string>>();
        enrollmentsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const className = data.className as string;
          const studentId = doc.ref.parent.parent?.id;
          if (className && studentId) {
            if (!counts.has(className)) counts.set(className, new Set());
            counts.get(className)!.add(studentId);
          }
        });
        const result = new Map<string, number>();
        for (const [name, students] of counts) {
          result.set(name, students.size);
        }
        setEnrollmentCounts(result);
      } catch (err) {
        console.error('[useClassroomAssignment] Enrollment fetch error:', err);
      }
    };
    fetchEnrollments();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'classes'),
      where('isActive', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded: AssignmentClassData[] = snapshot.docs.map(doc => {
        const data = doc.data();
        const schedule: ScheduleSlotMinimal[] = (data.schedule || []).map((slot: any) => {
          const subject = (data.subject as SubjectType) || 'math';
          const isWeekend = slot.day === '토' || slot.day === '일';
          const periodInfo = getPeriodInfoForSubject(subject, isWeekend);
          const period = periodInfo[slot.periodId];
          return {
            day: slot.day,
            periodId: slot.periodId,
            startTime: period?.startTime || '',
            endTime: period?.endTime || '',
          };
        }).filter((s: ScheduleSlotMinimal) => s.startTime && s.endTime);

        // 학생 수: enrollments 우선, fallback으로 studentIds
        const className = data.className || '';
        const enrollCount = enrollmentCounts.get(className) || 0;
        const studentCount = enrollCount > 0 ? enrollCount : (data.studentIds?.length || 0);

        return {
          id: doc.id,
          className,
          subject: (data.subject as SubjectType) || 'math',
          teacher: data.teacher || '',
          room: data.room || '',
          slotRooms: data.slotRooms || {},
          slotTeachers: data.slotTeachers || {},
          studentCount,
          schedule,
        };
      });

      setClassesData(loaded);
      setLoading(false);
    }, (error) => {
      console.error('[useClassroomAssignment] Error:', error);
      setLoading(false);
    });

    return listenerRegistry.register('useClassroomAssignment', unsubscribe);
  }, [enrollmentCounts]);

  // 선택된 요일의 슬롯 생성
  const slots = useMemo((): AssignmentSlot[] => {
    const result: AssignmentSlot[] = [];

    for (const cls of classesData) {
      const daySlots = cls.schedule.filter(s => s.day === selectedDay);
      for (const slot of daySlots) {
        const slotKey = `${slot.day}-${slot.periodId}`;
        const room = cls.slotRooms[slotKey] || cls.room || null;
        const englishInfo = cls.subject === 'english' ? parseEnglishLevel(cls.className) : {};

        result.push({
          id: `${cls.id}-${slotKey}`,
          classId: cls.id,
          className: cls.className,
          subject: cls.subject,
          teacher: cls.slotTeachers[slotKey] || cls.teacher,
          day: slot.day,
          periodId: slot.periodId,
          startTime: slot.startTime,
          endTime: slot.endTime,
          startMinutes: parseTimeToMinutes(slot.startTime),
          endMinutes: parseTimeToMinutes(slot.endTime),
          studentCount: cls.studentCount,
          currentRoom: room,
          assignedRoom: room,
          assignmentSource: room ? 'existing' : 'existing',
          englishLevel: englishInfo.level,
          englishLevelOrder: englishInfo.order,
        });
      }
    }

    return result;
  }, [classesData, selectedDay]);

  // 전체 강의실 목록 도출
  const rooms = useMemo((): RoomConfig[] => {
    const roomSet = new Set<string>();
    for (const cls of classesData) {
      if (cls.room) roomSet.add(cls.room);
      Object.values(cls.slotRooms).forEach(r => { if (r) roomSet.add(r); });
    }

    const RE_2F = /^2\d{2}/;
    const RE_3F = /^3\d{2}/;
    const RE_6F = /^6\d{2}/;
    return Array.from(roomSet)
      .sort((a, b) => {
        const getGroup = (r: string) => {
          if (r.includes('SKY')) return 0;
          if (RE_2F.test(r)) return 1;
          if (RE_3F.test(r)) return 2;
          if (RE_6F.test(r)) return 3;
          if (r.includes('프리미엄') || r.includes('LAB')) return 4;
          return 5;
        };
        const ga = getGroup(a), gb = getGroup(b);
        if (ga !== gb) return ga - gb;
        return a.localeCompare(b, 'ko');
      })
      .map(name => getRoomConfig(name));
  }, [classesData]);

  return { slots, rooms, loading, classesData };
}
