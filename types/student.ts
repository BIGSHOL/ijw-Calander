import { SubjectType } from './common';

// Detailed Enrollment Information
export interface Enrollment {
  subject: 'math' | 'english' | 'science' | 'korean' | 'other';
  classId: string;    // Document ID of the class
  className: string;  // Name of the class

  // Teacher identification (migration complete)
  staffId?: string;   // Staff document ID (references staff collection)
  teacherId_deprecated?: string; // Backup of original teacherId after migration (for rollback only)
  teacher?: string;   // 강사명 (레거시 호환)

  days: string[];     // Class schedule days (e.g., ['월', '수'])
  schedule?: string[]; // 스케줄 정보 (e.g., ['월 1교시', '수 3교시'])
  attendanceDays?: string[];  // 실제 등원 요일 (비어있거나 없으면 모든 수업 요일에 등원)

  // 수강 기간 정보
  startDate?: string;       // 수강 시작일 (enrollmentDate 별칭)
  enrollmentDate?: string;  // 수강 시작일 (YYYY-MM-DD)
  endDate?: string;         // 수강 종료일 (withdrawalDate 별칭)
  withdrawalDate?: string;  // 수강 종료일 (YYYY-MM-DD, undefined면 현재 수강 중)

  // 수강 상태
  onHold?: boolean;  // 일시정지 여부
  isScheduled?: boolean; // 배정 예정 (미래 시작일)

  // Migration metadata
  migrated?: boolean;
  migratedAt?: string;
}


// Phase 1: Unified Schedule Slot
export interface ScheduleSlot {
  day: string;           // 요일 (월, 화, 수, 목, 금, 토, 일)
  periodId: string;      // 교시 ID (e.g., "1-1", "5")
  startTime?: string;    // 시작 시간 (HH:mm)
  endTime?: string;      // 종료 시간 (HH:mm)
  room?: string;         // 강의실 (슬롯별로 다를 수 있음)
  teacher?: string;      // 담당 강사 (영어는 요일별로 다를 수 있음)
}

// Phase 1: Unified Class Structure
export interface UnifiedClass {
  id: string;
  className: string;
  subject: SubjectType;
  teacher: string;              // 주 담당 강사
  /** @deprecated slotTeachers 사용 권장 - 교시별 담당 선생님 배정 가능 */
  assistants?: string[];        // DEPRECATED: 보조 강사 (slotTeachers로 대체)
  room?: string;                // 기본 강의실
  schedule: ScheduleSlot[];     // 통일된 스케줄
  color?: string;
  isActive: boolean;

  // 레거시 호환
  legacySchedule?: string[];    // 기존 "월 1교시" 형식

  // 마이그레이션 메타데이터
  migratedFrom?: 'math' | 'english';
  originalDocId?: string;
  createdAt: string;
  updatedAt: string;
}

// Phase 1: Unified Student DB
export interface UnifiedStudent {
  // 기본 정보
  id: string;                    // UUID
  name: string;                  // 이름
  englishName?: string | null;   // 영어 이름
  school?: string;               // 학교
  grade?: string;                // 학년
  gender?: 'male' | 'female';    // 성별

  // 연락처 정보
  studentPhone?: string;         // 학생 휴대폰
  parentPhone?: string;          // 보호자 휴대폰 (SMS)
  parentName?: string;           // 보호자명
  parentRelation?: string;       // 보호자 관계 (모, 부, 기타)
  otherPhone?: string;           // 기타 알림 번호
  otherPhoneRelation?: string;   // 기타 알림 관계
  homePhone?: string;            // 원생 집전화

  // 주소 정보
  zipCode?: string;              // 우편번호
  address?: string;              // 주소
  addressDetail?: string;        // 상세주소

  // 추가 정보
  birthDate?: string;            // 생년월일 (YYYY-MM-DD)
  nickname?: string;             // 닉네임
  attendanceNumber?: string;     // 출결번호 (고유 식별자, 자동 생성: 학부모전화 뒤 4자리 + 중복방지)
  studentEmail?: string;         // 원생 이메일
  emailDomain?: string;          // 이메일 도메인
  enrollmentReason?: string;     // 입학동기

  // 형제 정보
  siblings?: string[];           // 형제 학생 ID 배열

  // 수납 정보
  cashReceiptNumber?: string;           // 현금영수증 발급용 번호
  cashReceiptType?: 'income' | 'expense'; // 소득공제용/지출증빙용
  billingDay?: number;                  // 수납 청구일 (매월)
  billingDiscount?: number;             // 수납 기본할인 (원)

  // 알림 설정
  smsNotification?: boolean;            // 등하원알림 (SMS)
  pushNotification?: boolean;           // 등하원알림 (푸시)
  kakaoNotification?: boolean;          // 등하원알림 (알림톡)
  otherSmsNotification?: boolean;       // 기타번호 등하원알림 (SMS)
  otherKakaoNotification?: boolean;     // 기타번호 등하원알림 (알림톡)
  billingSmsPrimary?: boolean;          // 수납문자발송 - 보호자
  billingSmsOther?: boolean;            // 수납문자발송 - 기타보호자
  overdueSmsPrimary?: boolean;          // 미납문자발송 - 보호자
  overdueSmsOther?: boolean;            // 미납문자발송 - 기타보호자

  // 기타 정보
  graduationYear?: string;              // 졸업연도
  customField1?: string;                // 기타항목1
  customField2?: string;                // 기타항목2
  memo?: string;                        // 메모

  // 수강 정보 (v5: 계층형 구조)
  enrollments: Enrollment[];     // 상세 수강 정보 (Subject -> Class -> Teacher mapping)
  subjects?: string[];           // 수강 과목 목록 (레거시 호환)

  // 레거시/마이그레이션 필드
  parentPhone2?: string;         // 보조 보호자 연락처
  enrollmentDate?: string;       // 등록일 (레거시 호환, startDate 별칭)
  legacyId?: string;             // 레거시 시스템 ID
  source?: string;               // 데이터 출처 (마이그레이션 시)

  // 상태 관리
  // prospect = prospective (예비) - 두 표기 모두 지원
  // on_hold: 휴원/대기 통합 (enrollment 레벨에서 세부 관리)
  status: 'active' | 'on_hold' | 'withdrawn' | 'prospect' | 'prospective';
  startDate: string;             // 등록일 (YYYY-MM-DD)
  endDate?: string;              // 퇴원일
  withdrawalDate?: string;       // 퇴원일 (YYYY-MM-DD) - 영어 시간표와 호환
  withdrawalReason?: string;     // 퇴원 사유
  withdrawalMemo?: string;       // 퇴원 관련 메모
  isOldWithdrawn?: boolean;      // 90일 이상 경과한 퇴원생 표시 (검색용)

  // 출석부 연동
  salarySettingId?: string;      // 급여 설정
  group?: string;                // 반 이름 (UI 표시용, 동적으로 계산됨)

  // 메타데이터
  createdAt: string;
  updatedAt: string;
}
