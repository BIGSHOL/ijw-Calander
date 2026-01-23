import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
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
import { ClassroomBlock, parseTimeToMinutes } from '../types';

interface RawClass {
  id: string;
  className: string;
  teacher: string;
  subject: SubjectType;
  schedule: string[]; // "요일 periodId" 형태
  room: string;
  slotRooms: Record<string, string>;
  slotTeachers: Record<string, string>;
}

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

export function useClassroomData(selectedDay: string, selectedRooms: Set<string> | null, ignoredRooms: Set<string> = new Set()) {
  const [classes, setClasses] = useState<RawClass[]>([]);
  const [loading, setLoading] = useState(true);

  // Firebase 실시간 리스너
  useEffect(() => {
    const q = query(
      collection(db, 'classes'),
      where('isActive', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded: RawClass[] = snapshot.docs.map(doc => {
        const data = doc.data();
        const scheduleStrings = data.schedule?.map((slot: any) =>
          `${slot.day} ${slot.periodId}`
        ) || data.legacySchedule || [];

        return {
          id: doc.id,
          className: data.className || '',
          teacher: data.teacher || '',
          subject: (data.subject as SubjectType) || 'math',
          schedule: scheduleStrings,
          room: data.room || '',
          slotRooms: data.slotRooms || {},
          slotTeachers: data.slotTeachers || {},
        };
      });

      setClasses(loaded);
      setLoading(false);
    }, (error) => {
      console.error('[useClassroomData] Error:', error);
      setLoading(false);
    });

    return listenerRegistry.register('useClassroomData', unsubscribe);
  }, []);

  // 선택된 요일의 블록 생성 + 충돌 감지
  const { blocks, rooms } = useMemo(() => {
    const isWeekend = selectedDay === '토' || selectedDay === '일';
    const allBlocks: ClassroomBlock[] = [];

    for (const cls of classes) {
      const periodInfo = getPeriodInfoForSubject(cls.subject, isWeekend);
      const seenSlots = new Set<string>();

      for (const slot of cls.schedule) {
        if (seenSlots.has(slot)) continue;
        seenSlots.add(slot);
        const parts = slot.split(' ');
        if (parts.length < 2) continue;
        const [day, periodId] = parts;
        if (day !== selectedDay) continue;

        const period = periodInfo[periodId];
        if (!period) continue;

        const slotKey = `${day}-${periodId}`;
        const room = cls.slotRooms[slotKey] || cls.room;
        if (!room) continue;

        const teacher = cls.slotTeachers[slotKey] || cls.teacher;

        allBlocks.push({
          id: `${cls.id}-${slotKey}`,
          classId: cls.id,
          className: cls.className,
          teacher,
          subject: cls.subject,
          room,
          periodId,
          startTime: period.startTime,
          endTime: period.endTime,
          startMinutes: parseTimeToMinutes(period.startTime),
          endMinutes: parseTimeToMinutes(period.endTime),
          hasConflict: false,
          conflictIndex: 0,
          conflictTotal: 1,
        });
      }
    }

    // 충돌 감지: 같은 강의실에서 다른 수업 간 시간 겹침
    // 겹치는 블록 쌍 기록 (나란히 배치용)
    const overlappingPairs: [number, number][] = [];
    for (let i = 0; i < allBlocks.length; i++) {
      for (let j = i + 1; j < allBlocks.length; j++) {
        const a = allBlocks[i];
        const b = allBlocks[j];
        if (a.room !== b.room) continue;
        if (a.classId === b.classId) continue;
        if (a.periodId === b.periodId) continue; // 같은 교시 = 합반 (의도적 배치)
        if (a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes) {
          overlappingPairs.push([i, j]);
          // 같은 수업명인데 다른 ID면 DB 중복 가능성 경고
          if (a.className === b.className) {
            console.warn(`[강의실] DB 중복 의심: "${a.className}" (${a.classId} vs ${b.classId}) - ${a.room} ${a.startTime}~${a.endTime}`);
          }
          // 충돌 무시 강의실이 아닌 경우에만 경고 표시
          if (!ignoredRooms.has(a.room)) {
            allBlocks[i] = { ...a, hasConflict: true };
            allBlocks[j] = { ...b, hasConflict: true };
          }
        }
      }
    }

    // 겹치는 블록 나란히 배치를 위한 인덱스 할당 (충돌 무시 여부와 관계없이)
    const overlappingIndices = new Set<number>();
    for (const [i, j] of overlappingPairs) {
      overlappingIndices.add(i);
      overlappingIndices.add(j);
    }
    const roomGroups = new Map<string, number[]>();
    for (const idx of overlappingIndices) {
      const room = allBlocks[idx].room;
      if (!roomGroups.has(room)) roomGroups.set(room, []);
      roomGroups.get(room)!.push(idx);
    }

    for (const [, indices] of roomGroups) {
      // 시간 겹침 기준으로 연결된 그룹 찾기 (Union-Find 대신 간단한 그룹핑)
      const visited = new Set<number>();
      for (let i = 0; i < indices.length; i++) {
        if (visited.has(indices[i])) continue;
        // BFS로 겹치는 블록 그룹 찾기
        const group: number[] = [indices[i]];
        visited.add(indices[i]);
        let queue = [indices[i]];
        while (queue.length > 0) {
          const nextQueue: number[] = [];
          for (const cur of queue) {
            for (const other of indices) {
              if (visited.has(other)) continue;
              const a = allBlocks[cur];
              const b = allBlocks[other];
              if (a.classId === b.classId) continue;
              if (a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes) {
                visited.add(other);
                group.push(other);
                nextQueue.push(other);
              }
            }
          }
          queue = nextQueue;
        }
        // 그룹 내 블록에 인덱스 할당
        const total = group.length;
        group.sort((a, b) => allBlocks[a].startMinutes - allBlocks[b].startMinutes || a - b);
        for (let g = 0; g < group.length; g++) {
          allBlocks[group[g]] = { ...allBlocks[group[g]], conflictIndex: g, conflictTotal: total };
        }
      }
    }

    // 강의실 필터 적용 (selectedRooms가 null이면 전체)
    const filtered = selectedRooms
      ? allBlocks.filter(b => selectedRooms.has(b.room))
      : allBlocks;

    // 전체 강의실 목록 (필터 관계없이)
    const roomSet = new Set<string>();
    for (const cls of classes) {
      if (cls.room) roomSet.add(cls.room);
      Object.values(cls.slotRooms).forEach(r => { if (r) roomSet.add(r); });
    }
    const roomList = Array.from(roomSet).sort((a, b) => {
      const getGroup = (r: string) => {
        if (r.includes('SKY')) return 0;
        if (/^2\d{2}/.test(r)) return 1;
        if (/^3\d{2}/.test(r)) return 2;
        if (/^6\d{2}/.test(r)) return 3;
        if (r.includes('프리미엄') || r.includes('LAB')) return 4;
        return 5;
      };
      const ga = getGroup(a), gb = getGroup(b);
      if (ga !== gb) return ga - gb;
      return a.localeCompare(b, 'ko');
    });

    return { blocks: filtered, rooms: roomList };
  }, [classes, selectedDay, selectedRooms, ignoredRooms]);

  // 강의실별 그룹핑
  const blocksByRoom = useMemo(() => {
    const map = new Map<string, ClassroomBlock[]>();
    for (const block of blocks) {
      if (!map.has(block.room)) map.set(block.room, []);
      map.get(block.room)!.push(block);
    }
    // 각 방의 블록을 시간순 정렬
    for (const [, roomBlocks] of map) {
      roomBlocks.sort((a, b) => a.startMinutes - b.startMinutes);
    }
    return map;
  }, [blocks]);

  return { blocksByRoom, rooms, loading, blocks, classes };
}
