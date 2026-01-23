import { SubjectType } from '../../types';

// Firestore에서 가져온 경량 수업 데이터
export interface AssignmentClassData {
  id: string;
  className: string;
  subject: SubjectType;
  teacher: string;
  room: string;
  slotRooms: Record<string, string>;
  slotTeachers: Record<string, string>;
  studentCount: number;
  schedule: ScheduleSlotMinimal[];
}

export interface ScheduleSlotMinimal {
  day: string;
  periodId: string;
  startTime: string;
  endTime: string;
}

// 강의실 배정이 필요한 개별 슬롯
export interface AssignmentSlot {
  id: string;                    // `${classId}-${day}-${periodId}`
  classId: string;
  className: string;
  subject: SubjectType;
  teacher: string;
  day: string;
  periodId: string;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  studentCount: number;

  // 배정 상태
  currentRoom: string | null;    // Firestore 기존 강의실
  assignedRoom: string | null;   // 알고리즘 배정 결과 (프리뷰)
  assignmentSource: 'existing' | 'auto' | 'manual';

  // 영어 합반 메타데이터
  englishLevel?: string;
  englishLevelOrder?: number;
}

// 강의실 설정
export interface RoomConfig {
  name: string;
  floor: string;
  capacity: number;
  preferredSubjects: SubjectType[];
}

// 합반 제안
export interface MergeSuggestion {
  id: string;
  slots: AssignmentSlot[];
  combinedStudentCount: number;
  levelDifference: number;
  suggestedRoom: string;
  reason: string;
}

// 배정 결과
export interface AssignmentResult {
  slots: AssignmentSlot[];
  conflicts: AssignmentConflict[];
  mergeSuggestions: MergeSuggestion[];
  stats: AssignmentStats;
}

export interface AssignmentConflict {
  room: string;
  slotIds: string[];
  type: 'time_overlap' | 'capacity_exceeded';
}

export interface AssignmentStats {
  totalSlots: number;
  assigned: number;
  unassigned: number;
  conflicts: number;
  mergesAvailable: number;
}

// 배정 가중치 설정
export interface AssignmentWeights {
  subjectFloor: number;    // 과목-층 적합도 (0~100)
  capacityFit: number;     // 수용인원 매칭 (0~100)
  teacherProximity: number; // 선생님 동선 (0~100)
  evenDistribution: number; // 균등 분산 (0~100)
  gradeGrouping: number;   // 학년 그룹핑 (0~100)
}

// 제약 조건 (반드시 지킬 것)
export interface AssignmentConstraints {
  noOverCapacity: boolean;      // 수용인원 초과 금지
  keepConsecutive: boolean;     // 연속 수업 같은 교실 유지
  labOnlyForLab: boolean;      // LAB 수업은 LAB 교실만
}

// 프리셋 ID
export type StrategyPreset = 'subject-focus' | 'teacher-focus' | 'even-distribution' | 'efficiency' | 'custom';

// Firestore 적용용 업데이트 데이터
export interface RoomAssignmentUpdate {
  classId: string;
  slotKey: string;
  room: string;
}
