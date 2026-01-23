import { AssignmentSlot, AssignmentResult, AssignmentConflict, AssignmentStats, MergeSuggestion, RoomConfig, AssignmentWeights, AssignmentConstraints } from '../types';
import { FLOOR_SUBJECT_SCORE } from '../constants';

interface TimeInterval {
  start: number;
  end: number;
  slotId: string;
}

function hasTimeConflict(
  occupancy: TimeInterval[],
  startMin: number,
  endMin: number
): boolean {
  return occupancy.some(o => o.start < endMin && startMin < o.end);
}

const RE_GRADE = /(초|중|고)(\d)/;

// 학년 추출 (클래스명에서)
function parseGrade(className: string): number {
  // 예: "중3수학A" -> 9, "고1과학" -> 10, "초6영어" -> 6
  const match = className.match(RE_GRADE);
  if (!match) return 0;
  const [, level, num] = match;
  const base = level === '초' ? 0 : level === '중' ? 6 : 9;
  return base + parseInt(num);
}

// 층 거리 계산 (선생님 동선용)
function floorDistance(floorA: string, floorB: string): number {
  const floorNum: Record<string, number> = {
    '2층': 2, '3층': 3, '6층': 6, '프리미엄관': 1, '기타': 4,
  };
  const a = floorNum[floorA] || 4;
  const b = floorNum[floorB] || 4;
  return Math.abs(a - b);
}

function calculateRoomScore(
  room: RoomConfig,
  slot: AssignmentSlot,
  occupancy: TimeInterval[],
  allSlots: AssignmentSlot[],
  weights: AssignmentWeights,
  constraints: AssignmentConstraints,
  rooms: RoomConfig[]
): number {
  let score = 0;
  const w = weights;

  // === 제약 조건 (위반 시 큰 패널티) ===

  // 수용인원 초과 금지
  if (constraints.noOverCapacity && room.capacity > 0 && slot.studentCount > room.capacity) {
    return -1000; // 절대 선택하지 않음
  }

  // LAB 수업은 LAB 교실만
  if (constraints.labOnlyForLab) {
    const isLabClass = slot.className.includes('LAB') || slot.className.includes('랩');
    const isLabRoom = room.name.includes('LAB');
    if (isLabClass && !isLabRoom) return -1000;
    if (!isLabClass && isLabRoom) score -= 50; // LAB 아닌 수업이 LAB에 배정되면 감점
  }

  // 연속 수업 같은 교실 유지
  if (constraints.keepConsecutive) {
    const consecutiveSlot = allSlots.find(
      s => s.classId === slot.classId &&
        s.id !== slot.id &&
        s.assignedRoom &&
        Math.abs(s.endMinutes - slot.startMinutes) <= 5 // 5분 이내 연속
    );
    if (consecutiveSlot && consecutiveSlot.assignedRoom === room.name) {
      score += 50; // 연속 수업이 같은 방이면 큰 보너스
    } else if (consecutiveSlot && consecutiveSlot.assignedRoom !== room.name) {
      score -= 30; // 다른 방이면 패널티
    }
  }

  // === 가중치 적용 점수 ===

  // 1. 과목-층 적합도 (기본 10점 스케일)
  if (w.subjectFloor > 0) {
    const floorScores = FLOOR_SUBJECT_SCORE[room.floor];
    const rawScore = (floorScores && floorScores[slot.subject]) || 0;
    score += rawScore * (w.subjectFloor / 100);
  }

  // 2. 수용인원 매칭 (기본 10점 스케일)
  if (w.capacityFit > 0 && room.capacity > 0) {
    const utilization = slot.studentCount / room.capacity;
    let rawScore = 0;
    if (slot.studentCount <= room.capacity) {
      if (utilization >= 0.7) rawScore = 10;       // 70~100% 활용 = 최고
      else if (utilization >= 0.5) rawScore = 7;   // 50~70%
      else if (utilization >= 0.3) rawScore = 4;   // 30~50%
      else rawScore = 1;                            // 방이 너무 큼
    } else {
      rawScore = -10; // 초과 (제약 아닐 때)
    }
    score += rawScore * (w.capacityFit / 100);
  }

  // 3. 선생님 동선 (기본 10점 스케일)
  if (w.teacherProximity > 0) {
    // 같은 선생님의 다른 수업이 이미 배정된 방 찾기
    const teacherOtherSlots = allSlots.filter(
      s => s.teacher === slot.teacher &&
        s.id !== slot.id &&
        s.assignedRoom
    );
    if (teacherOtherSlots.length > 0) {
      // 같은 방이면 보너스
      const sameRoom = teacherOtherSlots.some(s => s.assignedRoom === room.name);
      if (sameRoom) {
        score += 8 * (w.teacherProximity / 100);
      } else {
        // 같은 층이면 작은 보너스
        const teacherRooms = teacherOtherSlots.map(s =>
          rooms.find(r => r.name === s.assignedRoom)
        ).filter(Boolean) as RoomConfig[];

        const sameFloor = teacherRooms.some(r => r.floor === room.floor);
        if (sameFloor) {
          score += 5 * (w.teacherProximity / 100);
        } else {
          // 층 거리에 따라 감점
          const minDist = Math.min(...teacherRooms.map(r => floorDistance(r.floor, room.floor)));
          score -= minDist * 2 * (w.teacherProximity / 100);
        }
      }
    }
  }

  // 4. 균등 분산 (기본 10점 스케일)
  if (w.evenDistribution > 0) {
    const currentLoad = occupancy.length;
    // 사용이 적은 방일수록 보너스
    if (currentLoad === 0) {
      score += 10 * (w.evenDistribution / 100);
    } else if (currentLoad <= 2) {
      score += 6 * (w.evenDistribution / 100);
    } else if (currentLoad <= 4) {
      score += 2 * (w.evenDistribution / 100);
    } else {
      score -= (currentLoad - 4) * 2 * (w.evenDistribution / 100);
    }
  }

  // 5. 학년 그룹핑 (기본 10점 스케일)
  if (w.gradeGrouping > 0) {
    const slotGrade = parseGrade(slot.className);
    if (slotGrade > 0) {
      // 같은 방에 이미 배정된 수업의 학년 확인
      const roomSlots = allSlots.filter(s => s.assignedRoom === room.name && s.id !== slot.id);
      if (roomSlots.length > 0) {
        const grades = roomSlots.map(s => parseGrade(s.className)).filter(g => g > 0);
        if (grades.length > 0) {
          const avgGrade = grades.reduce((a, b) => a + b, 0) / grades.length;
          const diff = Math.abs(slotGrade - avgGrade);
          if (diff <= 1) score += 8 * (w.gradeGrouping / 100);       // 같은/인접 학년
          else if (diff <= 2) score += 4 * (w.gradeGrouping / 100);  // 2학년 차이
          else score -= diff * 2 * (w.gradeGrouping / 100);          // 먼 학년 감점
        }
      }
    }
  }

  return score;
}

function countValidRooms(
  slot: AssignmentSlot,
  rooms: RoomConfig[],
  occupancyMap: Map<string, TimeInterval[]>
): number {
  return rooms.filter(room => {
    const occupancy = occupancyMap.get(room.name) || [];
    return !hasTimeConflict(occupancy, slot.startMinutes, slot.endMinutes);
  }).length;
}

function detectConflicts(
  slots: AssignmentSlot[]
): AssignmentConflict[] {
  const conflicts: AssignmentConflict[] = [];
  const roomSlots = new Map<string, AssignmentSlot[]>();

  for (const slot of slots) {
    const room = slot.assignedRoom;
    if (!room) continue;
    if (!roomSlots.has(room)) roomSlots.set(room, []);
    roomSlots.get(room)!.push(slot);
  }

  for (const [room, roomSlotList] of roomSlots) {
    for (let i = 0; i < roomSlotList.length; i++) {
      for (let j = i + 1; j < roomSlotList.length; j++) {
        const a = roomSlotList[i];
        const b = roomSlotList[j];
        if (a.classId === b.classId) continue;
        if (a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes) {
          if (a.periodId === b.periodId) continue; // 합반
          conflicts.push({
            room,
            slotIds: [a.id, b.id],
            type: 'time_overlap',
          });
        }
      }
    }
  }

  return conflicts;
}

const RE_ENGLISH_CLASS = /^([A-Z]+)(\d+)/;

// 클래스명에서 레벨 약어와 숫자 파싱
function parseEnglishClassName(className: string): { level: string; number: number } | null {
  const match = className.match(RE_ENGLISH_CLASS);
  if (!match) return null;
  return { level: match[1], number: parseInt(match[2]) };
}

function findMergeCandidates(
  slots: AssignmentSlot[],
  rooms: RoomConfig[]
): MergeSuggestion[] {
  const suggestions: MergeSuggestion[] = [];
  const englishSlots = slots.filter(
    s => s.subject === 'english' && s.englishLevel && s.englishLevelOrder !== undefined
  );

  const timeGroups = new Map<string, AssignmentSlot[]>();
  for (const slot of englishSlots) {
    const key = `${slot.startTime}-${slot.endTime}`;
    if (!timeGroups.has(key)) timeGroups.set(key, []);
    timeGroups.get(key)!.push(slot);
  }

  for (const [, group] of timeGroups) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        // 이미 같은 방이면 스킵
        if (a.assignedRoom && a.assignedRoom === b.assignedRoom) continue;

        const parsedA = parseEnglishClassName(a.className);
        const parsedB = parseEnglishClassName(b.className);
        if (!parsedA || !parsedB) continue;

        // 같은 레벨(약어)만 합반 가능 (EiE+EiE OK, EiE+RTT NO)
        if (parsedA.level !== parsedB.level) continue;

        // 같은 숫자면 합반 불가 (EiE3+EiE3 NO, 같은 반의 분반이므로)
        if (parsedA.number === parsedB.number) continue;

        const levelDiff = Math.abs(parsedA.number - parsedB.number);
        if (levelDiff > 2) continue; // 숫자 차이 2 이하만

        const combinedCount = a.studentCount + b.studentCount;
        const validRooms = rooms.filter(r => r.capacity >= combinedCount);
        if (validRooms.length === 0) continue;

        suggestions.push({
          id: `merge-${a.id}-${b.id}`,
          slots: [a, b],
          combinedStudentCount: combinedCount,
          levelDifference: levelDiff,
          suggestedRoom: validRooms[0].name,
          reason: `${a.className}+${b.className}: 번호 차이 ${levelDiff}, 합산 ${combinedCount}명`,
        });
      }
    }
  }

  return suggestions;
}

export function runAutoAssignment(
  inputSlots: AssignmentSlot[],
  rooms: RoomConfig[],
  weights: AssignmentWeights,
  constraints: AssignmentConstraints
): AssignmentResult {
  // 모든 슬롯을 새로 배정 (기존 배정 무시, 전략에 따라 재배치)
  const slots = inputSlots.map(s => ({
    ...s,
    assignedRoom: null as string | null,
    assignmentSource: 'auto' as const,
  }));

  // Phase 1: 점유도 맵 초기화 (빈 상태에서 시작)
  const occupancyMap = new Map<string, TimeInterval[]>();
  for (const room of rooms) {
    occupancyMap.set(room.name, []);
  }

  // Phase 2: 제약 순서로 정렬 (가용 방 적은 슬롯부터 배정)
  const sortedSlots = [...slots].sort((a, b) => {
    const ca = countValidRooms(a, rooms, occupancyMap);
    const cb = countValidRooms(b, rooms, occupancyMap);
    if (ca !== cb) return ca - cb;
    // 동률이면 학생 수 많은 순 (큰 수업 먼저 배정)
    return b.studentCount - a.studentCount;
  });

  // Phase 3: Greedy 배정
  for (const slot of sortedSlots) {
    const isLabClass = slot.className.includes('LAB') || slot.className.includes('랩');

    const candidates = rooms
      .filter(room => {
        // LAB 수업은 충돌 무시하고 오직 LAB 강의실만 후보
        if (isLabClass) {
          return room.name.includes('LAB');
        }

        const occ = occupancyMap.get(room.name) || [];
        return !hasTimeConflict(occ, slot.startMinutes, slot.endMinutes);
      })
      .map(room => ({
        room,
        score: calculateRoomScore(
          room, slot, occupancyMap.get(room.name) || [],
          slots, weights, constraints, rooms
        ),
      }))
      .filter(c => c.score > -500) // 제약 위반 제거
      .sort((a, b) => b.score - a.score);

    if (candidates.length > 0) {
      const bestRoom = candidates[0].room;
      slot.assignedRoom = bestRoom.name;
      const occ = occupancyMap.get(bestRoom.name);
      if (occ) {
        occ.push({ start: slot.startMinutes, end: slot.endMinutes, slotId: slot.id });
      }
    }
    // assignedRoom remains null if no candidate
  }

  // Phase 4: 결과
  const allSlots = sortedSlots;
  const conflicts = detectConflicts(allSlots);
  const mergeSuggestions = findMergeCandidates(allSlots, rooms);

  let assignedCount = 0;
  for (let i = 0; i < allSlots.length; i++) {
    if (allSlots[i].assignedRoom) assignedCount++;
  }
  const stats: AssignmentStats = {
    totalSlots: allSlots.length,
    assigned: assignedCount,
    unassigned: allSlots.length - assignedCount,
    conflicts: conflicts.length,
    mergesAvailable: mergeSuggestions.length,
  };

  return { slots: allSlots, conflicts, mergeSuggestions, stats };
}
