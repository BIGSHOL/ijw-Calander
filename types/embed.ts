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

export interface EmbedSettings {
  // 표시 옵션
  showStudentList: boolean;
  showTeacherInfo: boolean;
  showClassroom: boolean;
  showSchedule: boolean;

  // 필터 옵션
  filterByTeacher?: string[];   // 특정 선생님 수업만
  filterByClass?: string[];     // 특정 수업만

  // UI 옵션
  theme?: 'light' | 'dark' | 'auto';
  compactMode?: boolean;
}

// 기본 임베드 설정
export const DEFAULT_EMBED_SETTINGS: EmbedSettings = {
  showStudentList: true,
  showTeacherInfo: true,
  showClassroom: true,
  showSchedule: true,
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