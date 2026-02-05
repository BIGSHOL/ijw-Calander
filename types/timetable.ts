// ============ ENGLISH TIMETABLE SCENARIO ============

export interface ScenarioEntry {
  id: string;                        // 문서 ID
  name: string;                      // 시나리오 이름
  description: string;               // 상세 설명

  // 스냅샷 데이터
  data: Record<string, any>;         // english_schedules_draft
  studentData: Record<string, any>;  // classes_draft
  classes?: Record<string, any>;     // 수업 데이터 (수학 시나리오용)

  // 메타데이터
  createdAt: string;
  createdBy: string;
  createdByUid: string;
  updatedAt?: string;
  updatedBy?: string;
  updatedByUid?: string;

  // 통계 (UI 표시용)
  stats?: {
    timetableDocCount: number;
    classCount: number;
    studentCount: number;
  };

  // 예약 적용 (Scheduled Auto-Apply)
  scheduledApplyDate?: string;  // 자동 적용 예약일 (YYYY-MM-DD)
  scheduledApplyStatus?: 'pending' | 'applied' | 'cancelled' | 'failed';  // 예약 상태
  scheduledApplyResult?: {
    appliedAt?: string;          // 실제 적용 일시
    appliedBy?: string;          // 적용자 (시스템 or 사용자)
    error?: string;              // 실패 시 에러 메시지
  };
}

// ============ TIMETABLE TYPES ============

export interface TimetableStudent {
  id: string;
  name: string;
  englishName?: string; // 영어 이름
  grade?: string;       // 학년
  school?: string;      // 학교
  underline?: boolean;  // 밑줄 표시 여부
  enrollmentDate?: string; // 신입생 등록일 (YYYY-MM-DD)
  withdrawalDate?: string; // 퇴원일 (YYYY-MM-DD)
  onHold?: boolean; // 대기생 여부
  isMoved?: boolean; // 반이동 학생 여부
  isScheduled?: boolean; // 배정 예정 (미래 시작일)
  isTransferred?: boolean; // 반이동으로 종료 (다른 반에 활성 등록이 있음 - 퇴원 섹션에서 제외)
  isTransferredIn?: boolean; // 반이동으로 들어옴 (다른 반에서 이동해 온 학생 - 초록 배경으로 상단 표시)
  personalSchedule?: { day: string; period: string }[];
  attendanceDays?: string[]; // 등원 요일 (비어있으면 모든 수업 요일에 등원)
  enrollmentDocId?: string; // Firestore enrollment 문서 ID (실제 문서 참조용)
  isSlotTeacher?: boolean; // 부담임 여부 (수학용)
}

export interface TimetableClass {
  id: string;
  className: string;    // 수업명
  teacher: string;      // 담당 강사
  room?: string;        // 교실
  subject: string;      // 과목 (수학/영어/기타)
  schedule: string[];   // ["월 1교시", "수 3교시"]
  studentList?: TimetableStudent[]; // @deprecated Use studentIds with UnifiedStudent
  studentIds?: string[];            // Link to students collection
  color?: string;
  order?: number;
  slotTeachers?: Record<string, string>;  // 교시별 담당강사 (key: "월-1-1", value: 강사명)
  slotRooms?: Record<string, string>;     // 교시별 강의실 (key: "월-1-1", value: 강의실)
}

export interface Teacher {
  id: string;
  name: string;
  englishName?: string; // 영어 이름
  subjects?: string[];  // 담당 과목
  isHidden?: boolean;   // 시간표 표시 여부
  isHiddenInAttendance?: boolean; // 출석부 표시 여부
  isNative?: boolean;   // 원어민 강사 여부
  color?: string;
  bgColor?: string;     // 퍼스널 배경색
  textColor?: string;   // 퍼스널 글자색
  order?: number;
  defaultRoom?: string; // 기본 강의실 (자동 입력용)
}

// 수업 키워드 색상 설정
export interface ClassKeywordColor {
  id: string;
  keyword: string;      // 키워드 (예: 'Phonics', 'Grammar')
  bgColor: string;      // 배경색
  textColor: string;    // 글자색
  order?: number;
}

// English Level System
export interface EnglishLevel {
  id: string;          // e.g., "dp", "pl"
  abbreviation: string;// e.g., "DP"
  fullName: string;    // e.g., "Dr. Phonics"
  order: number;       // Sort order index
  color?: string;      // Optional color
  isEiE?: boolean;     // EiE(English in English) 전용 레벨 여부
}

export interface LevelSettings {
  levels: EnglishLevel[];
}

// Parsed Class Name for Level Up
export interface ParsedClassName {
  levelAbbr: string;  // "DP", "RTT", "LE"
  number: number;     // 3, 6, 5
  suffix: string;     // "", "a", "b"
}
