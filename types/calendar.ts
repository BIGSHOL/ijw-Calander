export interface CalendarEvent {
  id: string;
  departmentId: string; // Primary department (for backward compatibility)
  departmentIds?: string[]; // Multiple departments (new feature)
  title: string;
  description?: string;
  participants?: string;
  referenceUrl?: string; // External link (e.g., Notion, Sheets)
  startDate: string; // ISO Date YYYY-MM-DD
  endDate: string;   // ISO Date YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string;   // HH:mm
  isAllDay?: boolean;
  color: string;     // Hex or Tailwind class
  textColor?: string;
  borderColor?: string;
  authorId?: string; // UID of the creator
  authorName?: string; // Display name of the creator (snapshot)
  createdAt?: string; // ISO Date string
  updatedAt?: string; // ISO Date string
  version?: number; // Version number for optimistic concurrency control
  attendance?: Record<string, 'pending' | 'joined' | 'declined'>; // Key: UID, Value: Status
  // Recurrence fields
  recurrenceGroupId?: string;  // ID of the first event in recurrence group
  recurrenceIndex?: number;    // 1-based index in the recurrence group
  recurrenceType?: 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'monthly' | 'yearly';
  relatedGroupId?: string;     // Group ID for multi-department linked events
  isArchived?: boolean;        // True if event is from archived_events collection
  // Phase 14: Hashtag & Event Type Support
  tags?: string[];             // 해시태그 ID 배열 (예: ['meeting', 'deadline'])
  eventType?: 'general' | 'seminar'; // 이벤트 유형
  seminarData?: SeminarEventData;    // 세미나 전용 데이터 (eventType === 'seminar'일 때)
}

export interface DragSelection {
  departmentId: string;
  date: string;
}

// Monthly Bucket List - Unscheduled events for a target month
export interface BucketItem {
  id: string;
  title: string;
  targetMonth: string; // 'YYYY-MM' format
  departmentId?: string;
  priority: 'high' | 'medium' | 'low';
  createdAt: string; // ISO Date string
  authorId?: string; // UID of the creator
  authorName?: string; // Display name of the creator
}

// Task Memo - One-way notification/request between users
export interface TaskMemo {
  id: string;
  from: string;         // sender uid
  fromName: string;     // sender display name
  to: string;           // receiver uid
  toName: string;       // receiver display name
  message: string;
  createdAt: string;    // ISO Date string
  isRead: boolean;
  isDeleted?: boolean;
}

// ============ CALENDAR HASHTAG & SEMINAR TYPES ============

/**
 * 이벤트 해시태그 (검색 및 분류용)
 */
export interface EventTag {
  id: string;           // 고유 ID (자동 생성 또는 태그명 기반)
  name: string;         // 태그명 (예: "회의", "세미나", "시험")
  color?: string;       // 태그 색상 (선택)
  usageCount?: number;  // 사용 횟수 (추천용)
}

/**
 * 이벤트 유형
 */
export type CalendarEventType = 'general' | 'seminar';

/**
 * 세미나 참석자 정보 (확장)
 */
export interface SeminarAttendee {
  id: string;

  // 기본 정보
  name: string;
  phone: string;              // 전화번호 (필수)
  isCurrentStudent: boolean;  // 재원생 여부
  studentId?: string;         // 재원생인 경우 학생 ID (기존 학생 데이터 연동)

  // 비재원생 정보
  gender?: 'male' | 'female';
  ageGroup?: 'elementary' | 'middle' | 'high' | 'adult';  // 연령대
  grade?: string;             // 학년 (초1, 중2, 고3 등)
  address?: string;           // 주소 (간단히)
  organization?: string;      // 소속 기관/학교 (비재원생용)

  // 신청 정보
  registrationSource?: string; // 신청경로 (지인소개, 온라인, 전단지 등)
  parentAttending?: boolean;   // 부모 참석 여부
  companions?: string[];       // 동석자 이름 목록

  // 담당 및 상태
  assignedStaffId?: string;  // 담당 선생님 staff ID (references staff collection)
  assignedStaffName?: string; // 담당 선생님 이름
  status: 'registered' | 'confirmed' | 'attended' | 'cancelled' | 'no-show';

  // 메타 정보
  registeredAt: string;       // ISO Date string
  memo?: string;              // 메모
  createdBy?: string;         // 등록자 ID
  updatedAt?: string;         // 수정일
}

/**
 * 세미나 이벤트 확장 필드
 */
export interface SeminarEventData {
  // 연사 정보
  speaker?: string;           // 발표자/강연자 이름
  speakerBio?: string;        // 발표자 소개
  speakerContact?: string;    // 연사 연락처

  // 관리 정보
  manager?: string;           // 담당자
  managerContact?: string;    // 담당자 연락처
  maxAttendees?: number;      // 최대 참석 인원

  // 참석자 목록
  attendees?: SeminarAttendee[]; // 참석자 목록

  // 장소 및 자료
  venue?: string;             // 장소 상세
  materials?: string[];       // 자료 링크들

  // 기타
  registrationDeadline?: string; // 등록 마감일
  isPublic?: boolean;         // 외부 공개 여부
}

/**
 * 기본 해시태그 목록 (초기 제안용)
 */
export const DEFAULT_EVENT_TAGS: EventTag[] = [
  { id: 'meeting', name: '회의', color: '#3B82F6' },
  { id: 'seminar', name: '세미나', color: '#8B5CF6' },
  { id: 'exam', name: '시험', color: '#EF4444' },
  { id: 'holiday', name: '휴일', color: '#10B981' },
  { id: 'deadline', name: '마감', color: '#F59E0B' },
  { id: 'event', name: '행사', color: '#EC4899' },
  { id: 'training', name: '연수', color: '#06B6D4' },
  { id: 'parent-meeting', name: '학부모상담', color: '#84CC16' },
];
