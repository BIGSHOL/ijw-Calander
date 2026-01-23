import { SubjectType } from '../../types';
import { RoomConfig, AssignmentWeights, AssignmentConstraints, StrategyPreset } from './types';

// 강의실-층 매핑 및 기본 수용 인원
export const ROOM_CONFIGS: RoomConfig[] = [
  // 2층 (수학 위주)
  { name: 'SKY', floor: '2층', capacity: 25, preferredSubjects: ['math', 'science'] },
  { name: '201', floor: '2층', capacity: 20, preferredSubjects: ['math', 'science'] },
  { name: '202', floor: '2층', capacity: 20, preferredSubjects: ['math', 'science'] },
  { name: '203', floor: '2층', capacity: 20, preferredSubjects: ['math', 'science'] },
  { name: '204', floor: '2층', capacity: 20, preferredSubjects: ['math', 'science'] },
  { name: '205', floor: '2층', capacity: 15, preferredSubjects: ['math', 'science'] },
  { name: '206', floor: '2층', capacity: 15, preferredSubjects: ['math', 'science'] },
  // 3층 (영어 위주)
  { name: '301', floor: '3층', capacity: 20, preferredSubjects: ['english'] },
  { name: '302', floor: '3층', capacity: 20, preferredSubjects: ['english'] },
  { name: '303', floor: '3층', capacity: 15, preferredSubjects: ['english'] },
  { name: '304', floor: '3층', capacity: 15, preferredSubjects: ['english'] },
  { name: '305', floor: '3층', capacity: 15, preferredSubjects: ['english'] },
  { name: '306', floor: '3층', capacity: 15, preferredSubjects: ['english'] },
  // 6층
  { name: '601', floor: '6층', capacity: 25, preferredSubjects: ['math', 'korean'] },
  { name: '602', floor: '6층', capacity: 25, preferredSubjects: ['math', 'korean'] },
  { name: '603', floor: '6층', capacity: 20, preferredSubjects: ['math', 'korean'] },
  // 프리미엄관
  { name: '프리미엄1', floor: '프리미엄관', capacity: 12, preferredSubjects: ['english'] },
  { name: '프리미엄2', floor: '프리미엄관', capacity: 12, preferredSubjects: ['english'] },
  { name: 'LAB', floor: '프리미엄관', capacity: 15, preferredSubjects: ['english'] },
];

// 층별 과목 선호도 점수
export const FLOOR_SUBJECT_SCORE: Record<string, Partial<Record<SubjectType, number>>> = {
  '2층': { math: 10, science: 8, korean: 3, english: 1 },
  '3층': { english: 10, korean: 5, math: 1, science: 1 },
  '6층': { math: 7, korean: 8, science: 6, english: 3 },
  '프리미엄관': { english: 10, math: 2, science: 2, korean: 2 },
};

// 요일 목록
export const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const;

// 배정 소스별 색상
export const ASSIGNMENT_COLORS = {
  existing: {
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    text: 'text-slate-700',
    badge: 'bg-slate-200 text-slate-600',
  },
  auto: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    text: 'text-emerald-800',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  manual: {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    text: 'text-amber-800',
    badge: 'bg-amber-100 text-amber-700',
  },
  conflict: {
    bg: 'bg-red-50',
    border: 'border-red-400',
    text: 'text-red-800',
    badge: 'bg-red-100 text-red-700',
  },
  unassigned: {
    bg: 'bg-gray-50',
    border: 'border-gray-300 border-dashed',
    text: 'text-gray-500',
    badge: 'bg-gray-100 text-gray-500',
  },
} as const;

// 강의실명으로 RoomConfig 찾기 (없으면 동적 생성)
export function getRoomConfig(roomName: string): RoomConfig {
  const found = ROOM_CONFIGS.find(r => r.name === roomName);
  if (found) return found;

  // 동적 매핑
  let floor = '기타';
  const preferredSubjects: SubjectType[] = [];
  if (/^2\d{2}/.test(roomName) || roomName.includes('SKY')) {
    floor = '2층';
    preferredSubjects.push('math', 'science');
  } else if (/^3\d{2}/.test(roomName)) {
    floor = '3층';
    preferredSubjects.push('english');
  } else if (/^6\d{2}/.test(roomName)) {
    floor = '6층';
    preferredSubjects.push('math', 'korean');
  } else if (roomName.includes('프리미엄') || roomName.includes('LAB')) {
    floor = '프리미엄관';
    preferredSubjects.push('english');
  }

  return { name: roomName, floor, capacity: 20, preferredSubjects };
}

// 강의실 그룹핑 (표시용)
export function groupRoomConfigs(rooms: RoomConfig[]): { label: string; rooms: RoomConfig[] }[] {
  const groups: Record<string, RoomConfig[]> = {
    '2층': [],
    '3층': [],
    '6층': [],
    '프리미엄관': [],
    '기타': [],
  };

  for (const room of rooms) {
    const key = room.floor in groups ? room.floor : '기타';
    groups[key].push(room);
  }

  return Object.entries(groups)
    .filter(([, rooms]) => rooms.length > 0)
    .map(([label, rooms]) => ({ label, rooms }));
}

// ============ 배정 전략 프리셋 ============

export const STRATEGY_PRESETS: Record<StrategyPreset, { label: string; description: string; weights: AssignmentWeights }> = {
  'subject-focus': {
    label: '과목 집중',
    description: '같은 과목을 같은 층에 배치',
    weights: { subjectFloor: 90, capacityFit: 60, teacherProximity: 30, evenDistribution: 10, gradeGrouping: 20 },
  },
  'teacher-focus': {
    label: '선생님 우선',
    description: '선생님 이동 최소화',
    weights: { subjectFloor: 40, capacityFit: 50, teacherProximity: 90, evenDistribution: 20, gradeGrouping: 10 },
  },
  'even-distribution': {
    label: '균등 분산',
    description: '모든 강의실을 고르게 사용',
    weights: { subjectFloor: 20, capacityFit: 40, teacherProximity: 20, evenDistribution: 90, gradeGrouping: 10 },
  },
  'efficiency': {
    label: '효율 극대화',
    description: '수용인원 대비 최적 매칭',
    weights: { subjectFloor: 30, capacityFit: 90, teacherProximity: 40, evenDistribution: 30, gradeGrouping: 20 },
  },
  'custom': {
    label: '커스텀',
    description: '직접 가중치 조절',
    weights: { subjectFloor: 50, capacityFit: 50, teacherProximity: 50, evenDistribution: 50, gradeGrouping: 50 },
  },
};

export const DEFAULT_WEIGHTS: AssignmentWeights = STRATEGY_PRESETS['subject-focus'].weights;

export const DEFAULT_CONSTRAINTS: AssignmentConstraints = {
  noOverCapacity: true,
  keepConsecutive: true,
  labOnlyForLab: false,
};

// 가중치 팩터 메타 정보 (UI 표시용)
export const WEIGHT_FACTORS: { key: keyof AssignmentWeights; label: string; description: string }[] = [
  { key: 'subjectFloor', label: '과목-층 적합도', description: '영어→3층, 수학→2층 등 과목별 선호 층 배치' },
  { key: 'capacityFit', label: '수용인원 매칭', description: '학생수에 맞는 크기의 강의실 배정' },
  { key: 'teacherProximity', label: '선생님 동선', description: '같은 선생님의 수업을 인접 강의실에 배치' },
  { key: 'evenDistribution', label: '균등 분산', description: '특정 강의실에 몰리지 않도록 분산' },
  { key: 'gradeGrouping', label: '학년 그룹핑', description: '비슷한 학년을 같은 구역에 배치' },
];
