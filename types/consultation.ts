// ============ CONSULTATION TYPES (Phase 13: EduCRM Integration) ============

export enum ConsultationStatus {
  EngMathRegistered = '영수등록',
  MathRegistered = '수학등록',
  EngRegistered = '영어등록',
  PendingThisMonth = '이번달 등록예정',
  PendingFuture = '추후 등록예정',
  NotRegistered = '미등록',
  Registered = 'registered',
}

export enum ConsultationSubject {
  English = '영어',
  EiE = 'EiE',
  Math = '수학',
  Korean = '국어',
  Other = '기타',
}

export enum SchoolGrade {
  Elementary1 = '초1',
  Elementary2 = '초2',
  Elementary3 = '초3',
  Elementary4 = '초4',
  Elementary5 = '초5',
  Elementary6 = '초6',
  ElementaryLow = '초등 저학년', // Legacy support
  ElementaryHigh = '초등 고학년', // Legacy support
  Middle1 = '중1',
  Middle2 = '중2',
  Middle3 = '중3',
  High1 = '고1',
  High2 = '고2',
  High3 = '고3',
  Other = '기타',
}

export interface ConsultationRecord {
  id: string;

  // === 학생 기본 정보 (UnifiedStudent와 동기화) ===
  studentName: string;
  englishName?: string;            // 영어 이름 (추가)
  gender?: 'male' | 'female';      // 성별 (추가)
  schoolName: string;
  grade: SchoolGrade;
  graduationYear?: string;         // 졸업 연도 (추가)

  // === 연락처 정보 (UnifiedStudent와 동기화) ===
  studentPhone?: string;           // 학생 전화번호 (추가)
  homePhone?: string;              // 집 전화번호 (추가)
  parentPhone: string;
  parentName?: string;             // 보호자명 (추가)
  parentRelation?: string;         // 보호자 관계 (추가)

  // === 주소 정보 (UnifiedStudent와 동기화) ===
  zipCode?: string;                // 우편번호 (추가)
  address?: string;
  addressDetail?: string;          // 상세주소 (추가)

  // === 추가 정보 (UnifiedStudent와 동기화) ===
  birthDate?: string;              // 생년월일 (추가)
  nickname?: string;               // 닉네임 (추가)
  enrollmentReason?: string;       // 입학 동기 (추가)

  // === 학원 전용 추가 정보 ===
  safetyNotes?: string;            // 안전사항 (주의사항)
  careerGoal?: string;             // 희망진로
  siblings?: string;               // 남매 관계
  siblingsDetails?: string;        // 남매 관계 기록
  shuttleBusRequest?: boolean;     // 셔틀버스 신청
  studentType?: string;            // 학생 구분 (예비/재원 등)
  installmentAgreement?: boolean;  // 할부 규정 안내 동의서
  privacyAgreement?: boolean;      // 개인정보 활용 동의서

  // === 상담 전용 정보 ===
  consultationDate: string; // ISO Date string (YYYY-MM-DD)
  subject: ConsultationSubject;
  status: ConsultationStatus;
  counselor: string;
  receiver: string; // 수신자 (전화받고 입력한 사람)
  registrar: string;
  paymentAmount: string;
  paymentDate: string;
  notes: string;
  nonRegistrationReason: string;
  followUpDate: string;
  followUpContent: string;
  consultationPath: string;

  // === 시스템 필드 ===
  createdAt: string;
  updatedAt?: string;
  authorId?: string;

  // 예비원생/재원생 연동
  registeredStudentId?: string;  // 전환된 학생 ID (students 컬렉션)

  // === 과목별 상담 정보 ===
  mathConsultation?: SubjectConsultationDetail;
  englishConsultation?: SubjectConsultationDetail;
  koreanConsultation?: SubjectConsultationDetail;
  etcConsultation?: SubjectConsultationDetail;
}

// 과목별 상담 상세 정보
export interface SubjectConsultationDetail {
  levelTestScore?: string;          // 레벨테스트 점수
  academyHistory?: string;           // 학원 히스토리
  learningProgress?: string;         // 학습 진도
  examResults?: string;              // 학생 시험 성적
  consultationHistory?: string;      // 학생 상담 내역
  recommendedClass?: string;         // 추천반
  homeRoomTeacher?: string;          // 담임
  firstClassDate?: string;           // 첫 수업일
  notes?: string;                    // 기타
}

export interface ConsultationStats {
  totalConsultations: number;
  registeredCount: number;
  conversionRate: number;
  pendingCount: number;
}

// Consultation Status Colors for UI
export const CONSULTATION_STATUS_COLORS: Record<ConsultationStatus, string> = {
  [ConsultationStatus.EngMathRegistered]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  [ConsultationStatus.MathRegistered]: 'bg-teal-100 text-teal-800 border-teal-200',
  [ConsultationStatus.EngRegistered]: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  [ConsultationStatus.PendingThisMonth]: 'bg-amber-100 text-amber-800 border-amber-200',
  [ConsultationStatus.PendingFuture]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  [ConsultationStatus.NotRegistered]: 'bg-slate-100 text-slate-800 border-slate-200',
  [ConsultationStatus.Registered]: 'bg-blue-100 text-blue-800 border-blue-200',
};

export const CONSULTATION_CHART_COLORS = ['#059669', '#0d9488', '#0891b2', '#f59e0b', '#fbbf24', '#94a3b8'];

// ============ CONSULTATION MANAGEMENT TYPES (Phase 1) ============

/**
 * 상담 카테고리
 */
export type ConsultationCategory =
  | 'academic'        // 학업 성취도
  | 'behavior'        // 행동/태도
  | 'attendance'      // 출석 관련
  | 'progress'        // 학습 진도
  | 'concern'         // 고민 상담
  | 'compliment'      // 칭찬/격려
  | 'complaint'       // 불만/개선 요청
  | 'general'         // 일반 상담
  | 'other';          // 기타

/**
 * 상담 기록 (재원생 대상 학부모/학생 상담)
 */
export interface Consultation {
  // 기본 정보
  id: string;
  studentId: string;
  studentName: string;
  school?: string;
  grade?: string;

  // 상담 정보
  type: 'parent' | 'student';
  consultantId: string;
  consultantName: string;
  date: string;                        // YYYY-MM-DD
  time?: string;                       // HH:mm
  duration?: number;                   // 분

  // 상담 내용
  category: ConsultationCategory;
  subject?: 'math' | 'english' | 'all' | '수학' | '영어';
  title: string;
  content: string;

  // 학부모 상담 전용
  parentName?: string;
  parentRelation?: string;
  parentContact?: string;

  // 학생 상담 전용
  studentMood?: 'positive' | 'neutral' | 'negative';

  // 후속 조치
  followUpNeeded: boolean;
  followUpDate?: string;
  followUpDone: boolean;
  followUpNotes?: string;

  // 메타데이터
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

/**
 * 카테고리 설정 (UI 표시용)
 */
export interface ConsultationCategoryConfig {
  icon: string;
  label: string;
  color: string;
}

export const CATEGORY_CONFIG: Record<ConsultationCategory, ConsultationCategoryConfig> = {
  academic: { icon: '📚', label: '학업 성취도', color: '#081429' },
  behavior: { icon: '⚠️', label: '행동/태도', color: '#f59e0b' },
  attendance: { icon: '📅', label: '출석 관련', color: '#3b82f6' },
  progress: { icon: '📈', label: '학습 진도', color: '#10b981' },
  concern: { icon: '💭', label: '고민 상담', color: '#8b5cf6' },
  compliment: { icon: '⭐', label: '칭찬/격려', color: '#fdb813' },
  complaint: { icon: '📢', label: '불만/개선', color: '#ef4444' },
  general: { icon: '💬', label: '일반 상담', color: '#373d41' },
  other: { icon: '📝', label: '기타', color: '#6b7280' },
};
