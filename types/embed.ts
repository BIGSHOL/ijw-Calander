// Embed Token Types
// 임베드 공유 링크용 토큰 시스템

export type EmbedType = 'math-timetable' | 'english-timetable';

export interface EmbedToken {
  id: string;
  type: EmbedType;
  name: string;           // 토큰 별칭 (예: "학부모 공유용")
  token: string;          // 실제 토큰 값 (UUID)
  createdAt: string;      // ISO date
  createdBy: string;      // staffId
  expiresAt?: string;     // ISO date (optional, null = 무기한)
  isActive: boolean;
  lastUsedAt?: string;    // 마지막 접근 시간
  usageCount: number;     // 접근 횟수
  settings?: EmbedSettings;
}

export type EmbedViewType = 'teacher' | 'class';

export interface EmbedSettings {
  // 뷰 타입
  viewType?: EmbedViewType;     // 강사뷰 (teacher) 또는 통합뷰 (class)

  // 표시 옵션
  showStudentList: boolean;
  showTeacherInfo: boolean;
  showClassroom: boolean;
  showSchedule: boolean;
  showHoldStudents?: boolean;      // 대기 학생 표시 여부
  showWithdrawnStudents?: boolean; // 퇴원 학생 표시 여부

  // 필터 옵션
  filterByTeacher?: string[];   // 특정 선생님 수업만
  filterByClass?: string[];     // 특정 수업만

  // UI 옵션
  theme?: 'light' | 'dark' | 'auto';
  compactMode?: boolean;
}

// 기본 임베드 설정
export const DEFAULT_EMBED_SETTINGS: EmbedSettings = {
  viewType: 'class',            // 기본값: 통합뷰 (카드형)
  showStudentList: true,
  showTeacherInfo: true,
  showClassroom: true,
  showSchedule: true,
  showHoldStudents: false,      // 기본값: 대기 학생 숨김
  showWithdrawnStudents: false, // 기본값: 퇴원 학생 숨김
  theme: 'light',
  compactMode: false,
};

// 토큰 생성용 입력 타입
export interface CreateEmbedTokenInput {
  type: EmbedType;
  name: string;
  expiresAt?: string;
  settings?: Partial<EmbedSettings>;
}

// 토큰 검증 결과
export interface EmbedTokenValidation {
  isValid: boolean;
  token?: EmbedToken;
  error?: 'NOT_FOUND' | 'EXPIRED' | 'INACTIVE';
}