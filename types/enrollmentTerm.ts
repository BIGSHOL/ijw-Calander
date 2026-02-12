// ============ ENROLLMENT TERM TYPES ============

/**
 * 등록차수 상태
 */
export type EnrollmentTermStatus = 'active' | 'cancelled';

/**
 * 등록차수 생성 소스
 */
export type EnrollmentTermSource = 'auto' | 'manual';

/**
 * 등록차수 레코드
 * Firestore 컬렉션: enrollment_terms
 */
export interface EnrollmentTerm {
  id: string;
  studentId: string;          // Firestore student doc ID
  studentName: string;        // 비정규화 (표시용)
  month: string;              // "2026-01"
  termNumber: number;         // 차수 번호 (1, 2, 3...)
  billedAmount: number;       // 청구액
  unitPrice: number;          // 1회 단가 (스냅샷)
  salarySettingId?: string;
  salarySettingName?: string;
  billingRecordId?: string;   // 연결된 billing 문서 ID
  billingName?: string;       // 수납명 (비정규화)
  source: EnrollmentTermSource;
  status: EnrollmentTermStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 학생별 월간 등록차수 요약
 */
export interface StudentTermSummary {
  studentId: string;
  month: string;
  currentTermNumber: number;
  totalTerms: number;
  terms: EnrollmentTerm[];
}
